import { addDays, toDay } from "./date";
import type { Answer, CardProgress, Progress } from "./types";

/** Leitner boxes: days until the next review after a "know" lands a card in box 1, 2, 3 … */
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const MAX_BOX = INTERVALS.length;

/** "Know" answers in a row, on different days, that take a card off the "Don't know" list. */
export const LEAVE_DONT_KNOW_AFTER = 2;

export function isDue(c: CardProgress, today = toDay()): boolean {
  return c.state !== "mastered" && c.due <= today && c.lastSeen !== today;
}

const stateFor = (box: number): CardProgress["state"] => (box <= 1 ? "learning" : "review");

/**
 * Records one answer and schedules the card.
 *
 * Only the first answer of the day moves a card *up*: seeing a card again later the same day
 * (it came back in the session, or you practise the "Don't know" list twice) never pushes it
 * further out. A wrong answer always counts.
 *
 * - know:     up one box (a brand-new word you already know starts in box 2, due in 3 days).
 *             Answering "know" in the last box makes the card `mastered`.
 *             Leaves the "Don't know" list after 2 "know" days in a row.
 * - unsure:   down one box, due tomorrow, "know" run reset. Not added to the "Don't know" list.
 * - dontknow: back to box 1, due tomorrow, added to the "Don't know" list.
 */
export function answer(p: Progress, wordId: string, result: Answer, today = toDay()): Progress {
  const prev = p.cards[wordId];
  const firstToday = !prev || prev.lastSeen !== today;
  let card: CardProgress;

  if (result === "know") {
    if (!prev) {
      card = { state: "review", box: 2, due: addDays(today, INTERVALS[1]), streak: 1, lapses: 0, inDontKnow: false, lastSeen: today };
    } else if (!firstToday) {
      card = prev; // already scheduled today
    } else if (prev.box >= MAX_BOX) {
      card = { ...prev, state: "mastered", streak: prev.streak + 1, inDontKnow: false, lastSeen: today };
    } else {
      const box = Math.max(prev.box, 0) + 1;
      const streak = prev.streak + 1;
      card = {
        ...prev,
        state: stateFor(box),
        box,
        due: addDays(today, INTERVALS[box - 1]),
        streak,
        inDontKnow: prev.inDontKnow && streak < LEAVE_DONT_KNOW_AFTER,
        lastSeen: today,
      };
    }
  } else {
    const box = result === "unsure" ? Math.max(1, (prev?.box ?? 1) - 1) : 1;
    // A lapse = forgetting a word you had already learned.
    const lapsed = result === "dontknow" && prev !== undefined && prev.box > 1;
    card = {
      state: stateFor(box),
      box,
      due: addDays(today, 1),
      streak: 0,
      lapses: (prev?.lapses ?? 0) + (lapsed ? 1 : 0),
      inDontKnow: result === "dontknow" || (prev?.inDontKnow ?? false),
      lastSeen: today,
    };
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
