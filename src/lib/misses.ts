// Mistake review for the exam tasks that have hand-written questions (Part 1, prepositions, confused words).
// A missed question comes back after 1 day, then 3, then 7; three right answers in a row clear it. Word
// formation misses are cards, so they already go on the "Don't know" list. Stored in Progress (`examMisses`).
import { addDays } from "./date";
import type { Progress } from "./types";

/** Days until a missed question comes back, by how many times in a row it was then answered right. */
export const MISS_STEPS = [1, 3, 7];

/** Records an answer to a hand-written question: a miss (re)starts the schedule; a right answer to a missed question moves it on. */
export function recordExamAnswer(p: Progress, id: string, right: boolean, today: string): Progress {
  const miss = p.examMisses[id];
  const examMisses = { ...p.examMisses };
  if (!right) examMisses[id] = { due: addDays(today, MISS_STEPS[0]), n: 0 };
  else if (miss) {
    const n = miss.n + 1;
    if (n >= MISS_STEPS.length) delete examMisses[id];
    else examMisses[id] = { due: addDays(today, MISS_STEPS[n]), n };
  } else return p;
  return { ...p, examMisses };
}

/** Ids of missed questions that are due today or earlier. */
export function dueMissIds(p: Progress, today: string): Set<string> {
  return new Set(Object.entries(p.examMisses).filter(([, m]) => m.due <= today).map(([id]) => id));
}

/** How many of these questions are due for another try. */
export function dueCount(items: { id: string }[], p: Progress, today: string): number {
  const due = dueMissIds(p, today);
  return items.filter((q) => due.has(q.id)).length;
}
