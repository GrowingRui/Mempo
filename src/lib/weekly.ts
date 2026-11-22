// Weekly summary on the Stats tab: the last 7 days (today and the 6 before it) next to the 7 days before that.
// Worked out from the daily history alone, so nothing extra is stored (accuracy only counts days that recorded answers).
import { addDays, toDay } from "./date";
import { studied } from "./stats";
import type { Progress } from "./types";

export interface WeekTotals {
  /** Days with at least one card answered. */
  days: number;
  new: number;
  reviewed: number;
  /** Answers given, and how many were "Know". */
  answers: number;
  right: number;
  /** The day with the most cards answered (undefined if none). */
  best?: { day: string; cards: number };
}

/** Totals for the 7 days ending on `end`. */
export function weekTotals(history: Progress["history"], end: string): WeekTotals {
  const t: WeekTotals = { days: 0, new: 0, reviewed: 0, answers: 0, right: 0 };
  for (let i = 0; i < 7; i++) {
    const day = addDays(end, -i);
    const h = history[day];
    if (!h) continue;
    if (studied(h)) t.days++;
    t.new += h.new;
    t.reviewed += h.reviewed;
    t.answers += h.answers ?? 0;
    t.right += h.right ?? 0;
    const cards = h.new + h.reviewed;
    if (cards > 0 && (!t.best || cards > t.best.cards)) t.best = { day, cards };
  }
  return t;
}

/** The share of answers that were "Know", 0–100; undefined when no answers were recorded. */
export const accuracyOf = (t: WeekTotals): number | undefined => (t.answers > 0 ? Math.round((t.right / t.answers) * 100) : undefined);

export interface WeeklySummary {
  week: WeekTotals;
  /** The 7 days before: undefined when nothing was studied then, so there is nothing to compare with. */
  before?: WeekTotals;
}

export function weeklySummary(history: Progress["history"], today = toDay()): WeeklySummary {
  const week = weekTotals(history, today);
  const before = weekTotals(history, addDays(today, -7));
  return { week, before: before.days > 0 ? before : undefined };
}
