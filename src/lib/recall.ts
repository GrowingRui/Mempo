// Active recall: instead of judging yourself, you have to find or produce the English word.
// Only words you have already studied are asked. Practising here doesn't move cards between boxes;
// at the end you can choose to put the missed words on the "Don't know" list (markDontKnow in srs.ts).
import { toDay } from "./date";
import { meaning, type TestLang } from "./leveltest";
import { isDue } from "./srs";
import type { Progress, Word } from "./types";

/** meaning: read the translation, pick the word. listen: hear it, pick the word. spell: read the translation, type the word. */
export type RecallKind = "meaning" | "listen" | "spell";

export const ROUND = 15;
export const OPTIONS = 4;

export interface RecallQuestion {
  word: Word;
  /** Answer choices (the right word among OPTIONS - 1 others); empty for "spell". */
  options: Word[];
  correct: number;
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lower-case, curly quotes straightened, hyphens and runs of spaces turned into one space. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[-\s]+/g, " ")
    .trim();
}

/** Every spelling that counts as the word: the headword, its variants and its forms. */
function accepted(w: Word): Set<string> {
  return new Set([w.word, ...(w.variants ?? []), ...(w.forms ?? [])].map(normalize));
}

/** How many single-letter edits turn a into b (stops counting above 2). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** right: the word or one of its forms/variants. close: one typo away (still counts as wrong). */
export function checkSpelling(input: string, w: Word): "right" | "close" | "wrong" {
  const s = normalize(input);
  if (!s) return "wrong";
  const ok = accepted(w);
  if (ok.has(s)) return "right";
  return s.length >= 4 && [...ok].some((a) => editDistance(s, a) === 1) ? "close" : "wrong";
}

/** "a _ _ _ _ _" for "access": the first letter, then one gap per letter (spaces and hyphens kept). */
export function letterHint(word: string): string {
  return [...word].map((ch, i) => (i === 0 || !/\p{L}/u.test(ch) ? ch : "_")).join(" ");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The example sentence with the word (or any of its forms) replaced by a gap; undefined if it isn't in the sentence. */
export function blankOut(text: string, w: Word): string | undefined {
  const terms = [...accepted(w), normalize(w.word)].flatMap((t) => [t, t.replace(/ /g, "-")]);
  const sorted = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<!\\p{L})(?:${sorted.map((t) => escapeRe(t).replace(/ /g, "[\\s-]+")).join("|")})(?!\\p{L})`, "giu");
  const out = text.replace(re, "_____");
  return out === text ? undefined : out;
}

/** The example to show in "spell": the first one that contains the word. */
export function clozeFor(w: Word): string | undefined {
  for (const ex of w.examples) {
    const b = blankOut(ex.text, w);
    if (b) return b;
  }
  return undefined;
}

/**
 * True for a translation that spells out the answer: the same word, or a cognate sharing its start
 * (first letters at most one edit apart: "accesibilidad" for accessibility). Short words must match exactly.
 */
export function looksLike(gloss: string, word: string): boolean {
  if (gloss === word) return true;
  const need = Math.min(6, word.length - 2);
  if (need < 4 || gloss.length < need) return false;
  return editDistance(gloss.slice(0, need), word.slice(0, need)) <= 1;
}

/**
 * Meaning lines for the question, in the languages the user shows. A Spanish meaning that is
 * just the English word ("secular" = "secular") would give the answer away, so it's dropped
 * when another language is available.
 */
export function promptMeanings(w: Word, langs: TestLang[]): { lang: TestLang; text: string }[] {
  const lines = langs.flatMap((lang) => {
    const text = meaning(w, lang);
    return text ? [{ lang, text }] : [];
  });
  const giveaway = (t: string) => normalize(t).split(/[;,\s]+/).some((g) => looksLike(g, normalize(w.word)));
  const safe = lines.filter((l) => !giveaway(l.text));
  return safe.length ? safe : lines;
}

/**
 * Studied words, weakest first: "Don't know" list, then due reviews, then low boxes, then the rest.
 * Inside each group the order is random, so every round is a little different.
 */
export function recallPool(words: Word[], p: Progress, today = toDay(), rnd = Math.random): Word[] {
  const rank = (w: Word) => {
    const c = p.cards[w.id];
    if (c.inDontKnow) return 0;
    if (isDue(c, today) || c.lastSeen === today) return 1;
    if (c.box <= 2) return 2;
    return c.state === "mastered" ? 4 : 3;
  };
  const studied = words.filter((w) => p.cards[w.id]);
  const keyed = shuffle(studied, rnd).map((w) => ({ w, r: rank(w) }));
  return keyed.sort((a, b) => a.r - b.r).map((x) => x.w);
}

/** Wrong choices that look like fair answers: same level and part of speech first, never the same word or meaning. */
function distractors(target: Word, all: Word[], kind: RecallKind, langs: TestLang[], rnd: () => number): Word[] {
  const right = accepted(target);
  const rightMeanings = new Set(promptMeanings(target, langs).map((l) => l.text));
  const pos = target.pos[0];
  const pool = shuffle(
    all.filter((w) => w.id !== target.id && !right.has(normalize(w.word)) && !accepted(w).has(normalize(target.word))),
    rnd,
  );
  const tiers = [
    pool.filter((w) => w.level === target.level && w.pos[0] === pos),
    pool.filter((w) => w.pos[0] === pos),
    pool,
  ];
  const out: Word[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const w of tier) {
      if (out.length === OPTIONS - 1) return out;
      const key = normalize(w.word);
      if (seen.has(key)) continue;
      // In "meaning", a word with the same translation would also be a right answer.
      if (kind === "meaning" && promptMeanings(w, langs).some((l) => rightMeanings.has(l.text))) continue;
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

/**
 * One round of questions from the weakest studied words. `all` is every word (for wrong choices).
 * Words with no meaning in the shown languages are skipped for "meaning" and "spell".
 */
export function buildRecall(pool: Word[], all: Word[], kind: RecallKind, langs: TestLang[], count = ROUND, rnd = Math.random): RecallQuestion[] {
  const usable = kind === "listen" ? pool : pool.filter((w) => promptMeanings(w, langs).length > 0);
  const picked = shuffle(usable.slice(0, count), rnd);
  return picked.map((word) => {
    if (kind === "spell") return { word, options: [], correct: -1 };
    const options = shuffle([word, ...distractors(word, all, kind, langs, rnd)], rnd);
    return { word, options, correct: options.indexOf(word) };
  });
}
