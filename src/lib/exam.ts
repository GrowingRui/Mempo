// Exam practice: tasks from the Cambridge Reading and Use of English paper (B2 First, C1 Advanced,
// C2 Proficiency). Unlike Recall, these can ask words you haven't studied yet: they train an exam skill.
// The quiz screen is shared with Recall (src/pages/Recall.tsx); the questions are built here.
//
// Part 3, word formation: an example sentence with a gap and the base word in capitals (DECIDE);
// type the form that fits. Base words come from scripts/families.ts (`base` on the word).
import { toDay } from "./date";
import { accepted, editDistance, escapeRe, normalize, recallPool, shuffle, wordRe, GAP, type RecallQuestion } from "./recall";
import type { Level, Progress, Word } from "./types";

/** Word formation: a sentence with one gap, and the exact form that fills it ("decisions" when the sentence needs the plural). */
export interface FormGap {
  text: string;
  answer: string;
}

/**
 * The word-formation question for a word with a `base`: the first example that has the word exactly
 * once and doesn't also contain the base word (that would give the answer away). Undefined if none fits.
 */
export function formGap(w: Word): FormGap | undefined {
  if (!w.base) return undefined;
  const baseRe = new RegExp(`(?<!\\p{L})${escapeRe(w.base)}(?!\\p{L})`, "iu");
  for (const ex of w.examples) {
    const hits = [...ex.text.matchAll(wordRe(w))];
    if (hits.length !== 1 || baseRe.test(ex.text)) continue;
    const at = hits[0].index ?? 0;
    return { text: ex.text.slice(0, at) + GAP + ex.text.slice(at + hits[0][0].length), answer: hits[0][0].toLowerCase() };
  }
  return undefined;
}

/**
 * right: exactly the form the gap needs. form: the right word in another form ("decision" for "decisions"),
 * which the exam marks wrong. close: one typo away. Only "right" counts.
 */
export function checkForm(input: string, gap: FormGap, w: Word): "right" | "form" | "close" | "wrong" {
  const s = normalize(input);
  if (!s) return "wrong";
  const answer = normalize(gap.answer);
  if (s === answer) return "right";
  if (accepted(w).has(s)) return "form";
  return s.length >= 4 && editDistance(s, answer) === 1 ? "close" : "wrong";
}

/**
 * Words for word formation: studied ones first (weakest first, as in the other exercises), then the
 * rest of the chosen level, so there are enough questions early on (only about a third of the words
 * have a base word).
 */
export function formPool(words: Word[], p: Progress, today = toDay(), rnd = Math.random): Word[] {
  const studied = recallPool(words, p, today, rnd).filter((w) => formGap(w));
  const others = shuffle(
    words.filter((w) => !p.cards[w.id] && w.level === p.settings.level && formGap(w)),
    rnd,
  );
  return [...studied, ...others];
}

// Part 1, multiple-choice cloze: a sentence with a gap and 4 words of close meaning; only one fits
// (a collocation, fixed phrase or word pattern). Unlike the other tasks, these questions are written by
// hand (src/data/part1.json), because wrong choices built from the word list often also fit the gap.

/** One hand-written Part 1 question. `card`: the id of the Mempo card the answer belongs to, if any. */
export interface ClozeItem {
  id: string;
  level: Level;
  text: string;
  answer: string;
  others: string[];
  note: string;
  card?: string;
}

/** Part 1 has 8 gaps in the real paper, so a round has 8 questions. */
export const CLOZE_ROUND = 8;

/** The questions, loaded only when Part 1 is opened (a separate file, cached for offline use). */
export function loadCloze(): Promise<ClozeItem[]> {
  return import("../data/part1.json").then((m) => m.default as ClozeItem[]);
}

/** A stand-in word for a choice or answer that isn't a Mempo card: shown and spoken, never saved. */
function plainWord(id: string, text: string, level: Level): Word {
  return { id, word: text, level, pos: [], zh: [], es: [], examples: [] };
}

/**
 * One Part 1 round: questions at the user's level first, topped up from other levels while there are
 * few. Each question's `word` is the answer's card (so a missed one can go on "Don't know") or a
 * stand-in; the choices are shuffled.
 */
export function buildCloze(items: ClozeItem[], words: Word[], level: Level, count = CLOZE_ROUND, rnd = Math.random): RecallQuestion[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const mine = shuffle(items.filter((q) => q.level === level), rnd);
  const rest = shuffle(items.filter((q) => q.level !== level), rnd);
  return [...mine, ...rest].slice(0, count).map((item) => {
    const word = (item.card && byId.get(item.card)) || plainWord(`part1:${item.id}`, item.answer, item.level);
    const texts = shuffle([item.answer, ...item.others], rnd);
    const options = texts.map((t, k) => plainWord(`part1:${item.id}:${k}`, t, item.level));
    return { word, options, correct: texts.indexOf(item.answer), cloze: item };
  });
}
