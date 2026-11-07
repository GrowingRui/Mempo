import { addDays, toDay } from "./date";
import { statusOf, type WordStatus } from "./srs";
import type { DayHistory, Progress, Word } from "./types";

/** A day counts towards the streak if at least one card was answered (new or review). */
export const studied = (h: DayHistory | undefined) => !!h && h.new + h.reviewed > 0;

export interface Streak {
  /** Days in a row up to today. Today not done yet doesn't break it: it ends at yesterday until midnight. */
  current: number;
  longest: number;
  doneToday: boolean;
  daysStudied: number;
}

export function streakOf(history: Progress["history"], today = toDay()): Streak {
  const doneToday = studied(history[today]);
  let current = 0;
  for (let d = doneToday ? today : addDays(today, -1); studied(history[d]); d = addDays(d, -1)) current++;

  const days = Object.keys(history).filter((d) => studied(history[d])).sort();
  let longest = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && addDays(days[i - 1], 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return { current, longest: Math.max(longest, current), doneToday, daysStudied: days.length };
}

export interface DayBar {
  day: string;
  new: number;
  reviewed: number;
}

/** The last `n` days, oldest first, with zeros for days off. */
export function lastDays(history: Progress["history"], n: number, today = toDay()): DayBar[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    const h = history[day];
    return { day, new: h?.new ?? 0, reviewed: h?.reviewed ?? 0 };
  });
}

export type LevelBreakdown = Record<WordStatus, number> & { total: number };

/** How many words of a list are in each state ("new" = not seen yet). */
export function breakdown(words: Word[], cards: Progress["cards"]): LevelBreakdown {
  const out: LevelBreakdown = { new: 0, learning: 0, review: 0, mastered: 0, dontknow: 0, total: words.length };
  for (const w of words) out[statusOf(cards[w.id])]++;
  return out;
}
