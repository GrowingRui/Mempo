let voice: SpeechSynthesisVoice | null | undefined;

/**
 * Scores a voice by how natural it sounds. Old offline voices (e.g. Windows
 * "Microsoft Hazel Desktop") sound robotic; the neural voices in Edge
 * ("... Online (Natural)"), Google's voices in Chrome, and Apple's
 * Enhanced/Premium voices sound much more like a real speaker.
 */
function score(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|premium|enhanced/.test(name)) s += 100;
  else if (name.includes("google")) s += 60;
  else if (name.includes("online")) s += 50;
  else if (!v.localService) s += 30;
  if (name.includes("desktop")) s -= 20;
  // Prefer British English (the word list is Cambridge), then US, then any English.
  const lang = v.lang.replace("_", "-").toLowerCase();
  if (lang === "en-gb") s += 10;
  else if (lang === "en-us") s += 5;
  return s;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (voices.length === 0) return null;
  return voices.reduce((best, v) => (score(v) > score(best) ? v : best));
}

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

if (canSpeak) {
  // Chrome loads voices asynchronously.
  speechSynthesis.addEventListener?.("voiceschanged", () => (voice = pickVoice()));
}

/*
 * Audio warm-up. Speakers and Bluetooth headsets go to sleep when idle and
 * clip the first part of the next sound while waking. We play silence through
 * Web Audio before speaking, and keep it running for a while after, so the
 * output device is already awake when the word starts.
 */
let ctx: AudioContext | null = null;
let sleepTimer: number | undefined;
const WARMUP_MS = 250;
const KEEP_AWAKE_MS = 20000;

function wakeAudio(): number {
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return 0;
  let delay = 0;
  if (!ctx) {
    ctx = new AC() as AudioContext;
    const gain = ctx.createGain();
    gain.gain.value = 0; // silent
    const osc = ctx.createOscillator();
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    delay = WARMUP_MS;
  } else if (ctx.state !== "running") {
    void ctx.resume();
    delay = WARMUP_MS;
  }
  window.clearTimeout(sleepTimer);
  sleepTimer = window.setTimeout(() => void ctx?.suspend(), KEEP_AWAKE_MS);
  return delay;
}

let pending: number | undefined;

/*
 * Pre-made recordings. Every word has an MP3 in public/audio/ (made by
 * scripts/gen-audio.py with a British neural voice), so pronunciation sounds the
 * same on every device, whatever voices the system has installed. If a file
 * is missing or fails to load, we fall back to the browser's own voice.
 */

/** Must match audio_file_name() in scripts/gen-audio.py. */
function audioUrl(id: string): string {
  let name = id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(name)) name += "-w"; // "con.mp3" can't exist on Windows
  return `${import.meta.env.BASE_URL}audio/${name}.mp3`;
}

const clips = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

function clip(id: string): HTMLAudioElement {
  let a = clips.get(id);
  if (!a) {
    a = new Audio(audioUrl(id));
    a.preload = "auto";
    clips.set(id, a);
  }
  return a;
}

/** Starts downloading a word's audio so the first click plays at once. */
export function preloadWord(id: string): void {
  if (typeof window !== "undefined") clip(id);
}

/** Plays the pronunciation of a word: the pre-made recording, or the browser voice as a fallback. */
export function playWord(id: string, text: string): void {
  window.clearTimeout(pending);
  if (canSpeak && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
  if (current) {
    current.pause();
    current.currentTime = 0;
  }

  const a = clip(id);
  current = a;
  const delay = wakeAudio();
  pending = window.setTimeout(() => {
    a.currentTime = 0;
    a.play().catch(() => {
      clips.delete(id); // try the file again next time
      speak(text);
    });
  }, delay);
}

export function speak(text: string): void {
  if (!canSpeak) return;
  window.clearTimeout(pending);

  let delay = wakeAudio();
  // Calling speak() right after cancel() makes Chrome drop the start of the utterance.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
    delay = Math.max(delay, 100);
  }

  pending = window.setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice === undefined) voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-GB";
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }, delay);
}
