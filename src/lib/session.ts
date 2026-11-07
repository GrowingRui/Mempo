import { toDay } from "./date";
import { isDue } from "./srs";
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

/** today: due reviews → "Don't know" words → new words. review: due cards only. dontknow: the whole list. */
export type SessionMode = "today" | "review" | "dontknow";

export function newWordsLeftToday(p: Progress, today = toDay()): number {
  const done = p.history[today]?.new ?? 0;
  return Math.max(0, p.settings.dailyNew - done);
}

/** Card ids for each part of today's session (word data not needed, so Home can count without loading). */
export function sessionParts(p: Progress, today = toDay()) {
  const entries = Object.entries(p.cards);
  const reviews = entries
    .filter(([, c]) => isDue(c, today) && !c.inDontKnow)
    .sort(([a, x], [b, y]) => x.due.localeCompare(y.due) || byHash(a, b))
    .map(([id]) => id);
  const dontKnow = entries
    .filter(([, c]) => c.inDontKnow && c.lastSeen !== today)
    .map(([id]) => id)
    .sort(byHash);
  const allDue = entries.filter(([, c]) => isDue(c, today)).length;
  const dontKnowTotal = entries.filter(([, c]) => c.inDontKnow).length;
  return { reviews, dontKnow, allDue, dontKnowTotal };
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
  const fresh = words
    .filter((w) => w.level === p.settings.level && !p.cards[w.id])
    .sort((a, b) => byHash(a.id, b.id))
    .slice(0, n);
  return [...pick(reviews), ...pick(dontKnow), ...fresh];
}

/** How many cards later a missed card comes back in the same session. */
const RETRY_GAP: Record<Exclude<Answer, "know">, [number, number]> = {
  dontknow: [3, 5],
  unsure: [6, 9],
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
