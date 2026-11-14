import { addDays, toDay } from "./date";
import { statusOf, type WordStatus } from "./srs";
import type { DayHistory, Progress, Word } from "./types";

/** A day counts towards the streak if at least one card was answered (new or review). */
export const studied = (h: DayHistory | undefined) => !!h && h.new + h.reviewed > 0;

/** Streak freezes: you start with one, can hold this many, and earn one for every FREEZE_EVERY days studied in a row. */
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export interface Streak {
  /** Days studied in the current streak. Today not done yet doesn't break it: it ends at yesterday until midnight. */
  current: number;
  longest: number;
  doneToday: boolean;
  daysStudied: number;
  /** Freezes ready to use. */
  freezes: number;
  /** Days off that a freeze covered (the streak went on), oldest first. */
  frozen: string[];
}

/**
 * Works the streak out from the history alone, day by day from the first day studied, so it needs no stored state
 * (backups and Move keep it). A missed day uses a freeze if the streak is running and one is ready; a frozen day
 * keeps the streak but doesn't add to it. With no freeze left a missed day ends it. Freezes are kept across streaks.
 */
export function streakOf(history: Progress["history"], today = toDay()): Streak {
  const doneToday = studied(history[today]);
  const days = Object.keys(history).filter((d) => studied(history[d]) && d <= today).sort();
  let current = 0;
  let longest = 0;
  let freezes = 1;
  const frozen: string[] = [];

  if (days.length) {
    // Every day from the first one studied up to yesterday; today only counts once it's done.
    for (let d = days[0]; d < today; d = addDays(d, 1)) {
      if (studied(history[d])) {
        current++;
        if (current % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      } else if (current > 0 && freezes > 0) {
        freezes--;
        frozen.push(d);
      } else {
        current = 0;
      }
      longest = Math.max(longest, current);
    }
    if (doneToday) {
      current++;
      if (current % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      longest = Math.max(longest, current);
    }
  }
  return { current, longest, doneToday, daysStudied: days.length, freezes, frozen };
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
