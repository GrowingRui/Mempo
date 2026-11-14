import { toDay } from "./date";
import { streakOf } from "./stats";
import { LEVELS, type Level, type Progress, type Word } from "./types";

/**
 * Badges are worked out from progress every time (nothing stored), so backups and Move keep them.
 * - streak: longest streak ever reaches the goal
 * - words: new words studied (swiped at least once; "Skip words you know" doesn't count)
 * - level: every word of the level has been seen or skipped
 */
export type BadgeKind = "streak" | "words" | "level";

export interface Badge {
  id: string;
  kind: BadgeKind;
  /** Days or words to reach; for a level badge, the number of words in the level (0 until the list has loaded). */
  goal: number;
  level?: Level;
  /** How far along you are, capped at the goal. */
  have: number;
  earned: boolean;
}

export const STREAK_GOALS = [7, 30, 100, 365];
export const WORD_GOALS = [100, 500, 1000, 2500];

export const wordsStudied = (history: Progress["history"]) => Object.values(history).reduce((s, h) => s + h.new, 0);

export function badgesOf(p: Progress, words: Partial<Record<Level, Word[]>>, today = toDay()): Badge[] {
  const { longest } = streakOf(p.history, today);
  const learned = wordsStudied(p.history);
  const make = (id: string, kind: BadgeKind, goal: number, have: number, level?: Level): Badge => ({
    id,
    kind,
    goal,
    level,
    have: Math.min(have, goal),
    earned: goal > 0 && have >= goal,
  });
  return [
    ...STREAK_GOALS.map((g) => make(`streak${g}`, "streak", g, longest)),
    ...WORD_GOALS.map((g) => make(`words${g}`, "words", g, learned)),
    ...LEVELS.map((lv) => {
      const ws = words[lv] ?? [];
      return make(`level${lv}`, "level", ws.length, ws.filter((w) => p.cards[w.id]).length, lv);
    }),
  ];
}

/** Badges earned in `after` but not in `before` (e.g. during one study session). */
export function newBadges(before: Badge[], after: Badge[]): Badge[] {
  const had = new Set(before.filter((b) => b.earned).map((b) => b.id));
  return after.filter((b) => b.earned && !had.has(b.id));
}

/** Splits a list of all words into levels. */
export function byLevel(all: Word[]): Partial<Record<Level, Word[]>> {
  const out: Partial<Record<Level, Word[]>> = {};
  for (const w of all) (out[w.level] ??= []).push(w);
  return out;
}
