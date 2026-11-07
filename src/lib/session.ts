import { addDays, toDay } from "./date";
import type { Answer, CardProgress, Progress, Word } from "./types";

/** FNV-1a hash: gives every word a fixed pseudo-random place in the study order,
 *  so new words aren't served alphabetically but the order is the same on every visit. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function newWordsLeftToday(p: Progress, today = toDay()): number {
  const done = p.history[today]?.new ?? 0;
  return Math.max(0, p.settings.dailyNew - done);
}

/** Today's new cards for the chosen level. (Phase 3 adds due reviews and "Don't know" words in front.) */
export function buildSession(words: Word[], p: Progress, today = toDay()): Word[] {
  const n = newWordsLeftToday(p, today);
  if (n === 0) return [];
  return words
    .filter((w) => !p.cards[w.id])
    .sort((a, b) => hash(a.id) - hash(b.id))
    .slice(0, n);
}

/**
 * Records one answer. Simple first version; Phase 3 replaces it with full Leitner boxes.
 * - know:     box +1, due tomorrow
 * - unsure:   back to box 1, due tomorrow, but NOT added to the "Don't know" list
 * - dontknow: back to box 1, due today, added to the "Don't know" list
 */
export function answer(p: Progress, wordId: string, result: Answer, today = toDay()): Progress {
  const prev = p.cards[wordId];
  const isNew = !prev;
  const base = { lapses: prev?.lapses ?? 0, inDontKnow: prev?.inDontKnow ?? false, lastSeen: today };
  const card: CardProgress =
    result === "know"
      ? { ...base, state: "review", box: Math.min((prev?.box ?? 0) + 1, 6), due: addDays(today, 1), streak: (prev?.streak ?? 0) + 1 }
      : result === "unsure"
        ? { ...base, state: "learning", box: 1, due: addDays(today, 1), streak: 0 }
        : { ...base, state: "learning", box: 1, due: today, streak: 0, lapses: base.lapses + (isNew ? 0 : 1), inDontKnow: true };
  const day = p.history[today] ?? { new: 0, reviewed: 0 };
  return {
    ...p,
    cards: { ...p.cards, [wordId]: card },
    history: {
      ...p.history,
      [today]: isNew ? { ...day, new: day.new + 1 } : { ...day, reviewed: day.reviewed + 1 },
    },
  };
}
