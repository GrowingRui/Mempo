// Match (Recall → Match): a board of studied words and their meanings, matched against the clock.
// Like the rest of Recall it doesn't move cards between boxes; words matched wrongly can go to "Don't know".
import type { TestLang } from "./leveltest";
import { normalize, safeMeaning, shuffle } from "./recall";
import type { Level, Word } from "./types";

/** Pairs on a full board. Fewer studied words give a smaller board (at least MATCH_MIN), but no best time. */
export const MATCH_PAIRS = 6;
export const MATCH_MIN = 3;
/** Seconds added for each wrong pair. */
export const PENALTY_S = 2;

export interface MatchPair {
  word: Word;
  /** The meaning on its tile, one line per shown language (as on the cards). */
  lines: { lang: TestLang; text: string }[];
}

export interface MatchBoard {
  pairs: MatchPair[];
  /** Order of the meaning tiles (indexes into pairs); the words keep pairs' order. */
  meaningOrder: number[];
}

/** The meaning for a tile without the glosses that spell out the word; undefined if none is left ("secular" = "secular"). */
export const tileMeaning = safeMeaning;

/** The tile's lines in the shown languages; a line that gives the word away is left out. */
export function tileLines(w: Word, langs: TestLang[]): MatchPair["lines"] {
  return langs.flatMap((lang) => {
    const text = tileMeaning(w, lang);
    return text ? [{ lang, text }] : [];
  });
}

/**
 * One board from `pool` (weakest first, as from recallPool). Two tiles never show the same word or share
 * a meaning line, so only one way to match is right. Undefined when fewer than MATCH_MIN pairs can be made.
 */
export function buildMatch(pool: Word[], langs: TestLang[], size = MATCH_PAIRS, rnd = Math.random): MatchBoard | undefined {
  const pairs: MatchPair[] = [];
  const words = new Set<string>();
  const texts = new Set<string>();
  for (const word of pool) {
    if (pairs.length === size) break;
    const lines = tileLines(word, langs);
    const keys = lines.map((l) => `${l.lang}:${l.text}`);
    const key = normalize(word.word);
    if (!lines.length || words.has(key) || keys.some((k) => texts.has(k))) continue;
    words.add(key);
    keys.forEach((k) => texts.add(k));
    pairs.push({ word, lines });
  }
  if (pairs.length < MATCH_MIN) return undefined;
  const shuffled = shuffle(pairs, rnd);
  return { pairs: shuffled, meaningOrder: shuffle(shuffled.map((_, i) => i), rnd) };
}

/** "12.4" for 12,400 ms. */
export function formatTime(ms: number): string {
  return (Math.floor(ms / 100) / 10).toFixed(1);
}

// Best time per level, in this browser only (like "Skip words you know"; not in backups).
const bestKey = (level: Level) => `mempo:match:${level}`;

export function loadBest(level: Level): number | undefined {
  try {
    const n = Number(localStorage.getItem(bestKey(level)));
    return n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

/** Saves the time if it beats the best. Returns true for a new best. */
export function saveBest(level: Level, ms: number): boolean {
  const best = loadBest(level);
  if (best !== undefined && best <= ms) return false;
  try {
    localStorage.setItem(bestKey(level), String(Math.round(ms)));
  } catch {
    // private mode or full storage: the game still works, the best just isn't kept
  }
  return true;
}
