import type { CardProgress, Progress } from "./types";

// Trouble words (Anki calls them "leeches"): words you keep forgetting. They are found from the
// progress alone, so nothing new is stored and backups / "Move to another device" bring them along.

/** A word is a trouble word once it has been missed this many times ("Don't know" answers on a card you knew before)... */
export const TROUBLE_LAPSES = 4;
/** ...until you get it right this many times in a row, which clears it. */
export const TROUBLE_CLEAR_STREAK = 3;
/** How many trouble words one "Trouble words" session holds. */
export const TROUBLE_ROUND = 20;

export function isTrouble(c: CardProgress | undefined): boolean {
  return !!c && c.lapses >= TROUBLE_LAPSES && c.streak < TROUBLE_CLEAR_STREAK;
}

/** Trouble words, the most missed first (ties: the earliest due). */
export function troubleIds(p: Progress): string[] {
  return Object.entries(p.cards)
    .filter(([, c]) => isTrouble(c))
    .sort(([a, x], [b, y]) => y.lapses - x.lapses || x.due.localeCompare(y.due) || a.localeCompare(b))
    .map(([id]) => id);
}
