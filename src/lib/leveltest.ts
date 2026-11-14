import { LEVELS, type Level, type Word } from "./types";

export type TestLang = "zh" | "es";

export const PER_LEVEL = 10;
/** A level counts as "known" at this share of correct answers; the recommended level is the first one below it. */
export const PASS = 0.8;

export interface Question {
  word: Word;
  options: string[];
  correct: number; // index into options
}

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Short meaning shown as an answer option: the first two glosses of the first part of speech. */
export function meaning(w: Word, lang: TestLang, pos?: string): string | undefined {
  const glosses = w[lang];
  const g = (pos && glosses.find((x) => x.pos === pos)) || glosses[0];
  const text = g?.gloss
    .map((x) => x.replace(/^(?:[a-z]+\.\s*)+/, "").trim()) // drop leftover "vt. " style labels
    .filter(Boolean)
    .slice(0, 2)
    .join(lang === "zh" ? "；" : "; ");
  return text || undefined;
}

/** Spanish cognates like "secular" = "secular" would be free points, so they aren't asked. */
export function askable(w: Word, lang: TestLang): boolean {
  const m = meaning(w, lang);
  return !!m && !m.toLowerCase().split(/[;,\s]+/).includes(w.word.toLowerCase());
}

/** One "what does it mean?" question: the right meaning and 3 wrong ones taken from `pool`. */
export function makeQuestion(word: Word, pool: Word[], lang: TestLang): Question {
  const right = meaning(word, lang)!;
  const pos = word[lang][0]?.pos;
  const seen = new Set([right]);
  const wrong: string[] = [];
  // Prefer distractors with the same part of speech, so the answer can't be spotted by grammar alone.
  const candidates = shuffle(pool.filter((w) => w.id !== word.id));
  const ordered = [...candidates.filter((w) => w[lang][0]?.pos === pos), ...candidates];
  for (const d of ordered) {
    if (wrong.length === 3) break;
    const m = meaning(d, lang, pos);
    if (!m || seen.has(m) || m.includes(right) || right.includes(m)) continue;
    seen.add(m);
    wrong.push(m);
  }
  const options = shuffle([right, ...wrong]);
  return { word, options, correct: options.indexOf(right) };
}

/** PER_LEVEL random words from each level, shuffled together, each with 3 wrong meanings taken from the same level. */
export function buildTest(byLevel: Record<Level, Word[]>, lang: TestLang): Question[] {
  const questions: Question[] = [];
  for (const lv of LEVELS) {
    const pool = byLevel[lv].filter((w) => meaning(w, lang));
    const picked = shuffle(pool.filter((w) => askable(w, lang))).slice(0, PER_LEVEL);
    for (const word of picked) questions.push(makeQuestion(word, pool, lang));
  }
  return shuffle(questions);
}

export interface LevelScore {
  level: Level;
  right: number;
  total: number;
}

export function scoreByLevel(questions: Question[], answers: (number | null)[]): LevelScore[] {
  return LEVELS.map((level) => {
    const qs = questions.map((q, i) => ({ q, a: answers[i] })).filter(({ q }) => q.word.level === level);
    return { level, right: qs.filter(({ q, a }) => a === q.correct).length, total: qs.length };
  });
}

/** The first level you don't know well yet; C2 if you passed everything. */
export function recommendLevel(scores: LevelScore[]): Level {
  return scores.find((s) => s.total > 0 && s.right / s.total < PASS)?.level ?? "C2";
}

/** Rough number of words known: each level's share of correct answers times its size. */
export function estimateKnown(scores: LevelScore[], counts: Record<Level, number>): number {
  const n = scores.reduce((sum, s) => sum + (s.total ? (s.right / s.total) * counts[s.level] : 0), 0);
  return Math.round(n / 50) * 50;
}
