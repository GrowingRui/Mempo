// "Read a text": the user pastes any English text and Mempo marks the B2–C2 words in it (and phrases like
// "give up" or "carbon footprint"). Everything runs in the browser; the text never leaves the device.
//
// Matching: each word of the text is looked up as written, then as a base form (abandoned → abandon,
// studies → study, making → make, stopped → stop, gave → give). A base form only counts when it's a Mempo word.
// Phrases match longest first, and the first word of a phrase may be inflected too (gave up, carries out).
import type { Word } from "./types";

/** How long a pasted text can be (characters). Longer texts are cut. */
export const MAX_TEXT = 20000;
/** Longest phrase in the word lists, in words. */
const MAX_PHRASE = 5;

/** A piece of the text: plain text, or a Mempo word as written in the text (`id` = the word). */
export interface Segment {
  text: string;
  id?: string;
}

/** Common irregular past forms, for phrasal verbs and verbs in the lists (gave up → give up). */
const IRREGULAR: Record<string, string> = {
  arose: "arise", arisen: "arise", bore: "bear", borne: "bear", beat: "beat", beaten: "beat", became: "become",
  began: "begin", begun: "begin", bent: "bend", bit: "bite", bitten: "bite", blew: "blow", blown: "blow",
  broke: "break", broken: "break", brought: "bring", built: "build", burnt: "burn", bought: "buy", caught: "catch",
  chose: "choose", chosen: "choose", came: "come", dealt: "deal", dug: "dig", did: "do", done: "do", drew: "draw",
  drawn: "draw", drove: "drive", driven: "drive", ate: "eat", eaten: "eat", fell: "fall", fallen: "fall", fed: "feed",
  felt: "feel", fought: "fight", found: "find", fled: "flee", flew: "fly", flown: "fly", forbade: "forbid",
  forbidden: "forbid", forgot: "forget", forgotten: "forget", forgave: "forgive", forgiven: "forgive", froze: "freeze",
  frozen: "freeze", got: "get", gotten: "get", gave: "give", given: "give", went: "go", gone: "go", ground: "grind",
  grew: "grow", grown: "grow", hung: "hang", had: "have", heard: "hear", hid: "hide", hidden: "hide", held: "hold",
  kept: "keep", knew: "know", known: "know", laid: "lay", led: "lead", leapt: "leap", left: "leave", lent: "lend",
  lay: "lie", lain: "lie", lost: "lose", made: "make", meant: "mean", met: "meet", paid: "pay", rode: "ride",
  ridden: "ride", rang: "ring", rung: "ring", rose: "rise", risen: "rise", ran: "run", said: "say", saw: "see",
  seen: "see", sought: "seek", sold: "sell", sent: "send", shook: "shake", shaken: "shake", shone: "shine",
  shot: "shoot", shrank: "shrink", shrunk: "shrink", sang: "sing", sung: "sing", sank: "sink", sunk: "sink",
  sat: "sit", slept: "sleep", slid: "slide", spoke: "speak", spoken: "speak", spent: "spend", spun: "spin",
  sprang: "spring", sprung: "spring", stood: "stand", stole: "steal", stolen: "steal", stuck: "stick", stung: "sting",
  strode: "stride", struck: "strike", stricken: "strike", strove: "strive", striven: "strive", swore: "swear",
  sworn: "swear", swept: "sweep", swam: "swim", swum: "swim", swung: "swing", took: "take", taken: "take",
  taught: "teach", tore: "tear", torn: "tear", told: "tell", thought: "think", threw: "throw", thrown: "throw",
  trod: "tread", trodden: "tread", undertook: "undertake", undertaken: "undertake", woke: "wake", woken: "wake",
  wore: "wear", worn: "wear", wove: "weave", woven: "weave", wept: "weep", won: "win", wound: "wind",
  withdrew: "withdraw", withdrawn: "withdraw", withheld: "withhold", withstood: "withstand", wrung: "wring",
  wrote: "write", written: "write",
};

/** Past forms that are just as often other words (turn left, a bit, a wound): only read as a verb inside a phrase (left out, found out). */
const AMBIGUOUS = new Set(["left", "found", "bit", "wound", "ground", "lay", "rose", "bore", "fell", "saw", "felt", "shot", "spoke", "wore", "lain"]);

const VOWEL = /[aeiou]/;

/**
 * Possible base forms of one lower-case word, most likely first (the word itself first).
 * Only guesses; the caller keeps the first one that is a Mempo word.
 */
export function baseForms(w: string, inPhrase = false): string[] {
  const out = [w];
  const add = (s: string) => s.length >= 2 && !out.includes(s) && out.push(s);
  if (IRREGULAR[w] && (inPhrase || !AMBIGUOUS.has(w))) add(IRREGULAR[w]);
  if (w.length < 4) return out;
  const stem = (suffix: string) => w.slice(0, -suffix.length);
  // studies → study, carried → carry
  if (w.endsWith("ies") || w.endsWith("ied")) add(stem("ies") + "y");
  // -ing / -ed: making → make, stopped → stop, played → play
  for (const suf of ["ing", "ed"]) {
    if (!w.endsWith(suf)) continue;
    const s = stem(suf);
    if (s.length < 2 || !VOWEL.test(s)) continue;
    add(s);
    add(s + "e");
    if (s.length >= 3 && s.at(-1) === s.at(-2)) add(s.slice(0, -1));
  }
  // -s / -es: makes → make, watches → watch (not -ss: "process" stays)
  if (w.endsWith("es")) add(stem("es"));
  if (w.endsWith("s") && !w.endsWith("ss")) add(stem("s"));
  // -'s: government's → government
  if (w.endsWith("'s")) add(stem("'s"));
  return out;
}

/** Text words → Mempo word id. Keys are lower case; phrases have single spaces. */
export type ReaderIndex = Map<string, string>;

const clean = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

export function readerIndex(words: Word[]): ReaderIndex {
  const index: ReaderIndex = new Map();
  // Headwords, forms and spellings first, so they win over a form seen in an example sentence.
  for (const w of words) for (const s of [w.word, ...(w.forms ?? []), ...(w.variants ?? [])]) if (!index.has(clean(s))) index.set(clean(s), w.id);
  for (const w of words) for (const e of w.examples) if (e.form && !index.has(clean(e.form))) index.set(clean(e.form), w.id);
  return index;
}

// A word: letters, with ' or - inside (don't, well-being). Curly apostrophes count too.
const WORD = /\p{L}+(?:['’-]\p{L}+)*/gu;

/** Splits the text into plain pieces and Mempo words, keeping every character (so it shows as written). */
export function markText(text: string, index: ReaderIndex): Segment[] {
  const tokens = [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length, low: clean(m[0]) }));
  const segments: Segment[] = [];
  let at = 0; // end of the text already handed out
  const plain = (end: number) => {
    if (end > at) segments.push({ text: text.slice(at, end) });
    at = end;
  };

  for (let i = 0; i < tokens.length; ) {
    let found: { id: string; n: number } | undefined;
    // Longest phrase first. Words of a phrase must be separated by spaces only (not across a full stop or comma).
    for (let n = Math.min(MAX_PHRASE, tokens.length - i); n >= 1 && !found; n--) {
      const span = tokens.slice(i, i + n);
      if (span.some((t, k) => k > 0 && !/^[ \t ]+$/.test(text.slice(span[k - 1].end, t.start)))) continue;
      const low = span.map((t) => t.low);
      // In a phrase either the first word is inflected (gave up, carries out) or the last one (carbon footprints),
      // never both. Hyphenated words that aren't in the lists stay unmarked rather than guessing.
      const keys = baseForms(low[0], n > 1).map((first) => [first, ...low.slice(1)].join(" "));
      if (n > 1) for (const last of baseForms(low[n - 1]).slice(1)) keys.push([...low.slice(0, -1), last].join(" "));
      const id = keys.map((k) => index.get(k)).find(Boolean);
      if (id) found = { id, n };
    }
    if (!found) {
      i++;
      continue;
    }
    const start = tokens[i].start;
    const end = tokens[i + found.n - 1].end;
    plain(start);
    segments.push({ text: text.slice(start, end), id: found.id });
    at = end;
    i += found.n;
  }
  plain(text.length);
  return segments;
}

/** The Mempo words in the text, each once, in the order they first appear, with how often they appear. */
export function foundWords(segments: Segment[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of segments) if (s.id) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

/** "Try an example": a short text written for Mempo, with words from every level and a few phrasal verbs. */
export const SAMPLE_TEXT = `Can a city learn to breathe again?

For years, residents complained that the traffic was unbearable. Rather than building yet another road, the council decided to carry out an ambitious experiment: it closed the old bridge to cars for a whole summer. Critics predicted chaos, and some shop owners were reluctant to give up their parking spaces.

The outcome, however, was striking. Air pollution fell noticeably, cyclists took over the empty lanes, and the riverside became a lively place to meet. Researchers who analysed the data found that emissions had dropped by almost a third, a reduction that few had anticipated.

Not everyone is convinced. Some argue that the success was a temporary phenomenon, fuelled by unusually warm weather and the novelty of the scheme. Others insist that the city cannot afford to put off such changes any longer, given the scale of the challenge. Either way, the debate has shown that ordinary people are willing to rethink habits they once took for granted.`;
