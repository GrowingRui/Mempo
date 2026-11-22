// "Speak it" (Recall): read the meaning, say the English word. The browser's own speech recognition
// (free; Chrome sends the audio to Google, Safari to Apple) turns it into text, and this decides whether it was the word.
import { accepted, editDistance, normalize } from "./recall";
import type { Word } from "./types";

/** Lower case, no punctuation, single spaces: "Abandon." → "abandon", "Mull it over!" → "mull it over". */
export function cleanHeard(s: string): string {
  return normalize(s.replace(/[.,!?;:"“”«»()¿¡]/g, " "));
}

/**
 * Whether any of the recogniser's guesses is the word. A guess counts if it is one of the word's accepted
 * spellings (headword, variants, forms), or contains one as whole words ("the word is abandon", "to abandon"),
 * or a single-word guess is one letter away from a word of 5+ letters (the recogniser picks a spelling:
 * "judgement" / "judgment").
 */
export function heardWord(guesses: string[], w: Word): boolean {
  const ok = [...accepted(w)];
  return guesses.some((g) => {
    const s = cleanHeard(g);
    if (!s) return false;
    const padded = ` ${s} `;
    if (ok.some((a) => a === s || padded.includes(` ${a} `))) return true;
    return !s.includes(" ") && ok.some((a) => a.length >= 5 && !a.includes(" ") && editDistance(s, a) === 1);
  });
}

// ---------- The browser's speech recognition ----------

/** The parts of the Web Speech API used here (not in TypeScript's DOM types yet). */
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether this browser can listen (Chrome, Edge, Safari, Samsung Internet; not Firefox). */
export function canListen(): boolean {
  return ctor() !== undefined;
}

/** Why listening gave nothing: no sound heard, microphone blocked, no internet, or anything else. */
export type ListenError = "no-speech" | "denied" | "offline" | "failed";

export interface Listening {
  /** Everything the recogniser thought it heard, most likely first; rejects with a ListenError. */
  result: Promise<string[]>;
  /** Stop without a result (leaving the question or the screen). */
  cancel: () => void;
}

/** Listens for one short answer in British English. */
export function listenOnce(lang = "en-GB"): Listening {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.reject<string[]>("failed" satisfies ListenError), cancel: () => {} };
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 5;
  let cancelled = false;
  const result = new Promise<string[]>((resolve, reject) => {
    const heard: string[] = [];
    rec.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) {
        const alts = e.results[i];
        for (let k = 0; k < alts.length; k++) if (alts[k].transcript.trim()) heard.push(alts[k].transcript.trim());
      }
    };
    let error: ListenError | undefined;
    rec.onerror = (e) => {
      error =
        e.error === "no-speech" || e.error === "aborted"
          ? "no-speech"
          : e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture"
            ? "denied"
            : e.error === "network"
              ? "offline"
              : "failed";
    };
    rec.onend = () => {
      if (cancelled) return;
      if (heard.length) resolve(heard);
      else reject(error ?? "no-speech");
    };
    try {
      rec.start();
    } catch {
      reject("failed" satisfies ListenError);
    }
  });
  result.catch(() => {}); // the caller handles it; don't report it as unhandled after a cancel
  return {
    result,
    cancel: () => {
      cancelled = true;
      try {
        rec.abort();
      } catch {
        // already stopped
      }
    },
  };
}
