import { addDays, daysBetween, toDay } from "./date";
import { first, intervalFor, next, type Grade } from "./fsrs";
import type { Answer, CardProgress, Progress } from "./types";

/**
 * Strength levels 1–6 shown for a card ("box"), from its FSRS stability in days: a card is in level n when it
 * stays remembered for at least INTERVALS[n - 1] days. Before FSRS these were the fixed review intervals.
 */
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const MAX_BOX = INTERVALS.length;

/** "Know" answers in a row, on different days, that take a card off the "Don't know" list. */
export const LEAVE_DONT_KNOW_AFTER = 2;

/** A "know" that makes the card stick for this many days makes it mastered (no more reviews). */
export const MASTERED_AT = 180;

/** Longest wait between two reviews, in days. */
export const MAX_INTERVAL = 365;

export function isDue(c: CardProgress, today = toDay()): boolean {
  return c.state !== "mastered" && c.due <= today && c.lastSeen !== today;
}

const stateFor = (box: number): CardProgress["state"] => (box <= 1 ? "learning" : "review");

export function boxFor(s: number): number {
  return Math.max(1, INTERVALS.filter((days) => s >= days).length);
}

/**
 * A card's FSRS memory. Cards saved before FSRS (2026-11-16) have only a box: their stability is that box's
 * interval, and their difficulty starts as for a word you knew, plus a bit for every lapse.
 */
export function memoryOf(c: CardProgress): { s: number; d: number } {
  if (c.s !== undefined && c.d !== undefined) return { s: c.s, d: c.d };
  const s = INTERVALS[Math.min(MAX_BOX, Math.max(1, c.box)) - 1];
  const d = first(3).d + 1.5 * c.lapses + (c.inDontKnow ? 2 : 0);
  return { s, d: Math.min(10, d) };
}

const GRADE: Record<Answer, Grade> = { dontknow: 1, unsure: 2, know: 3 };
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Records one answer and schedules the card with FSRS (see fsrs.ts).
 *
 * Only the first answer of the day moves a card *up*: seeing a card again later the same day
 * (it came back in the session, or you practise the "Don't know" list twice) never pushes it
 * further out. A wrong answer always counts.
 *
 * - know:     FSRS "Good"; the next review is when the chance of remembering falls to 90 %.
 *             A brand-new word you already know counts as "Easy" (back in about 8 days).
 *             A card that will now stick for MASTERED_AT days becomes `mastered`.
 *             Leaves the "Don't know" list after 2 "know" days in a row.
 * - unsure:   FSRS "Hard" (the word gets harder, its stability doesn't grow), due tomorrow, "know" run reset.
 *             Not added to the "Don't know" list.
 * - dontknow: FSRS "Again" (stability drops), due tomorrow, added to the "Don't know" list.
 */
export function answer(p: Progress, wordId: string, result: Answer, today = toDay()): Progress {
  const prev = p.cards[wordId];
  const firstToday = !prev || prev.lastSeen !== today;
  let card: CardProgress;

  if (result === "know" && prev && !firstToday) {
    card = prev; // already scheduled today
  } else {
    let mem: { s: number; d: number };
    if (!prev) mem = first(result === "know" ? 4 : GRADE[result]);
    else {
      const old = memoryOf(prev);
      const days = prev.lastSeen ? Math.max(0, daysBetween(prev.lastSeen, today)) : Math.max(1, Math.round(old.s));
      mem = next(old, days, GRADE[result]);
      if (result === "unsure") mem.s = Math.min(mem.s, old.s);
    }
    const s = round2(mem.s);
    const d = round2(mem.d);
    const box = boxFor(s);

    if (result === "know") {
      const streak = (prev?.streak ?? 0) + 1;
      const wait = Math.min(MAX_INTERVAL, Math.max(1, Math.round(intervalFor(s))));
      card = {
        state: prev && s >= MASTERED_AT ? "mastered" : stateFor(box),
        box,
        s,
        d,
        due: addDays(today, wait),
        streak,
        lapses: prev?.lapses ?? 0,
        inDontKnow: (prev?.inDontKnow ?? false) && streak < LEAVE_DONT_KNOW_AFTER,
        lastSeen: today,
      };
    } else {
      // A lapse = forgetting a word you had already learned.
      const lapsed = result === "dontknow" && prev !== undefined && prev.box > 1;
      card = {
        state: result === "dontknow" ? "learning" : stateFor(box),
        box: result === "dontknow" ? 1 : box,
        s,
        d,
        due: addDays(today, 1),
        streak: 0,
        lapses: (prev?.lapses ?? 0) + (lapsed ? 1 : 0),
        inDontKnow: result === "dontknow" || (prev?.inDontKnow ?? false),
        lastSeen: today,
      };
    }
  }

  const day = p.history[today] ?? { new: 0, reviewed: 0 };
  const nextDay = !prev ? { ...day, new: day.new + 1 } : firstToday ? { ...day, reviewed: day.reviewed + 1 } : day;
  return {
    ...p,
    cards: { ...p.cards, [wordId]: card },
    history: { ...p.history, [today]: nextDay },
  };
}

/** What the word list shows for a word. "dontknow" wins over the card's box state. */
export type WordStatus = "new" | "learning" | "review" | "mastered" | "dontknow";

export function statusOf(c: CardProgress | undefined): WordStatus {
  if (!c) return "new";
  return c.inDontKnow ? "dontknow" : c.state === "new" ? "learning" : c.state;
}

/** Earliest upcoming review (after today), with how many cards are due that day. */
export function nextReview(p: Progress, today = toDay()): { day: string; count: number } | undefined {
  let day: string | undefined;
  let count = 0;
  for (const c of Object.values(p.cards)) {
    if (c.state === "mastered" || isDue(c, today)) continue;
    const d = c.due > today ? c.due : addDays(today, 1);
    if (!day || d < day) {
      day = d;
      count = 1;
    } else if (d === day) count++;
  }
  return day ? { day, count } : undefined;
}

/**
 * Puts studied words on the "Don't know" list without changing their schedule
 * (used after an active recall round). Words never studied are skipped.
 */
export function markDontKnow(p: Progress, ids: string[]): Progress {
  const cards = { ...p.cards };
  for (const id of ids) {
    const c = cards[id];
    if (c) cards[id] = { ...c, inDontKnow: true, streak: 0 };
  }
  return { ...p, cards };
}
