import { toDay } from "./date";
import { isDue } from "./srs";
import { myListIds } from "./mylist";
import { TROUBLE_ROUND, troubleIds } from "./trouble";
import type { Answer, Progress, Word } from "./types";

/** FNV-1a hash: gives every word a fixed pseudo-random place in the study order,
 *  so new words aren't served alphabetically but the order is the same on every visit. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const byHash = (a: string, b: string) => hash(a) - hash(b);

/**
 * today: due reviews (capped) → "Don't know" words → new words. review: every due card, no cap. dontknow: the whole list.
 * trouble: up to TROUBLE_ROUND words you keep missing, the most missed first (see trouble.ts).
 * mylist: every word on My list, weakest first. phrasal: up to PHRASAL_ROUND phrasal verbs of your level, weakest first.
 */
export type SessionMode = "today" | "review" | "dontknow" | "mylist" | "phrasal" | "trouble";

/** How many phrasal verbs one "Practise phrasal verbs" session holds. */
export const PHRASAL_ROUND = 20;

/**
 * The phrasal verbs of your level in practice order: "Don't know" first, then due reviews, then new ones
 * (in the daily-session order), then the rest by next review. Mastered ones come last.
 */
export function phrasalOrder(words: Word[], p: Progress, today = toDay()): Word[] {
  const rank = (id: string) => {
    const c = p.cards[id];
    if (!c) return 2;
    if (c.inDontKnow) return 0;
    if (isDue(c, today)) return 1;
    return c.state === "mastered" ? 4 : 3;
  };
  return words
    .filter((w) => w.phrasal && w.level === p.settings.level)
    .sort((a, b) => rank(a.id) - rank(b.id) || (p.cards[a.id]?.due ?? "").localeCompare(p.cards[b.id]?.due ?? "") || byHash(a.id, b.id));
}

export function newWordsLeftToday(p: Progress, today = toDay()): number {
  const done = p.history[today]?.new ?? 0;
  return Math.max(0, p.settings.dailyNew - done);
}

/** How many more reviews today's session may hold (the daily review cap minus what was already reviewed today). */
export function reviewsLeftToday(p: Progress, today = toDay()): number {
  const cap = p.settings.maxReviews;
  if (!cap) return Infinity;
  return Math.max(0, cap - (p.history[today]?.reviewed ?? 0));
}

/**
 * Card ids for each part of today's session (word data not needed, so Home can count without loading).
 * Reviews are capped by the daily review limit, most overdue first; `heldBack` counts the due reviews
 * that wait for another day (they can still be practised from "Reviews due").
 */
export function sessionParts(p: Progress, today = toDay()) {
  const entries = Object.entries(p.cards);
  const allReviews = entries
    .filter(([, c]) => isDue(c, today) && !c.inDontKnow)
    .sort(([a, x], [b, y]) => x.due.localeCompare(y.due) || byHash(a, b))
    .map(([id]) => id);
  const reviews = allReviews.slice(0, reviewsLeftToday(p, today));
  const heldBack = allReviews.length - reviews.length;
  const dontKnow = entries
    .filter(([, c]) => c.inDontKnow && c.lastSeen !== today)
    .map(([id]) => id)
    .sort(byHash);
  const allDue = entries.filter(([, c]) => isDue(c, today)).length;
  const dontKnowTotal = entries.filter(([, c]) => c.inDontKnow).length;
  return { reviews, dontKnow, allDue, dontKnowTotal, heldBack };
}

/** The words of your level you haven't studied yet, in the order new words come up in the daily session. */
export function upcomingNew(words: Word[], p: Progress): Word[] {
  return words.filter((w) => w.level === p.settings.level && !p.cards[w.id]).sort((a, b) => byHash(a.id, b.id));
}

/**
 * The cards for one study session.
 * `words` must contain every level that has progress (reviews come from all levels);
 * new words come only from `level`.
 */
export function buildSession(words: Word[], p: Progress, mode: SessionMode, today = toDay()): Word[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((w): w is Word => w !== undefined);

  if (mode === "dontknow") {
    return pick(Object.keys(p.cards).filter((id) => p.cards[id].inDontKnow).sort(byHash));
  }
  if (mode === "trouble") return pick(troubleIds(p)).slice(0, TROUBLE_ROUND);
  if (mode === "mylist") {
    // "Don't know" words first, then words not studied yet, then due ones, then the rest by next review.
    const rank = (id: string) => {
      const c = p.cards[id];
      return !c ? 1 : c.inDontKnow ? 0 : isDue(c, today) ? 2 : 3;
    };
    return pick(
      myListIds(p).sort((a, b) => rank(a) - rank(b) || (p.cards[a]?.due ?? "").localeCompare(p.cards[b]?.due ?? "") || byHash(a, b)),
    );
  }
  if (mode === "phrasal") return phrasalOrder(words, p, today).slice(0, PHRASAL_ROUND);
  if (mode === "review") {
    return pick(
      Object.entries(p.cards)
        .filter(([, c]) => isDue(c, today))
        .sort(([a, x], [b, y]) => x.due.localeCompare(y.due) || byHash(a, b))
        .map(([id]) => id),
    );
  }
  const { reviews, dontKnow } = sessionParts(p, today);
  const n = newWordsLeftToday(p, today);
  const fresh = upcomingNew(words, p).slice(0, n);
  return [...pick(reviews), ...pick(dontKnow), ...fresh];
}

/** How many cards later a missed card comes back in the same session. */
const RETRY_GAP: Record<Exclude<Answer, "know">, [number, number]> = {
  dontknow: [10, 15],
  unsure: [15, 20],
};

/**
 * After a wrong or unsure answer at `pos`, puts the card back into the queue a few cards later
 * (at the end if the queue is shorter). The card keeps coming back until it's answered "know".
 */
export function requeue<T>(queue: T[], pos: number, item: T, result: Answer): T[] {
  if (result === "know") return queue;
  const [min, max] = RETRY_GAP[result];
  const gap = min + Math.floor(Math.random() * (max - min + 1));
  const at = Math.min(pos + 1 + gap, queue.length);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}
