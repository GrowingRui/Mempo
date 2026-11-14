// "Skip words I know": tick the words of your level you already know, answer a quick meaning check on a few
// of them, and the ones that pass don't come up as new words. They come back once, in about two months,
// for a single check: "Know" then makes them Mastered, a miss sends them back into normal study.
import { site } from "../config/site";
import { addDays, toDay } from "./date";
import { askable, shuffle, type TestLang } from "./leveltest";
import { hash } from "./session";
import { INTERVALS, MAX_BOX } from "./srs";
import type { CardProgress, Level, Progress, Settings, Word } from "./types";

/** Words shown on one page to tick. */
export const BATCH = 20;
/** The check passes at this share of right answers. */
export const CHECK_PASS = 0.8;

/**
 * One page of words to tick. `upcoming` is in study order (sorted by `hash`); `cursor` is the hash of the last
 * word on the previous page, so the next visit carries on where you stopped instead of showing the words you
 * left unticked again. At the end of the level it starts over from the words that are still new.
 */
export function pageFrom(upcoming: Word[], cursor: number, n = BATCH): Word[] {
  const after = upcoming.filter((w) => hash(w.id) > cursor);
  return (after.length ? after : upcoming).slice(0, n);
}

/** Where the page after `page` starts. */
export const cursorAfter = (page: Word[]): number => (page.length ? hash(page[page.length - 1].id) : 0);

const cursorKey = (level: Level) => `${site.storageKey}:skip:${level}`;

/** The saved place in the level's word list (0 = start). Kept in this browser only; losing it just starts over. */
export function loadCursor(level: Level): number {
  try {
    const n = Number(localStorage.getItem(cursorKey(level)));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveCursor(level: Level, cursor: number): void {
  try {
    localStorage.setItem(cursorKey(level), String(cursor));
  } catch {
    // storage blocked: the next visit starts from the beginning
  }
}

/** Meaning language for the check: Spanish if the app is in Spanish and Spanish meanings are on, else Chinese if on, else Spanish. */
export function checkLang(s: Settings): TestLang {
  if (s.lang === "es" && s.showEs) return "es";
  return s.showZh ? "zh" : "es";
}

/** How many ticked words get a check question: about one in four, at least 3 (or all, if fewer were ticked). */
export function checkCount(ticked: number): number {
  return Math.min(ticked, Math.max(3, Math.ceil(ticked / 4)));
}

/** The ticked words to ask about. Words without a usable meaning (or Spanish look-alikes) can't be asked. */
export function pickChecks(ticked: Word[], lang: TestLang): Word[] {
  const ok = ticked.filter((w) => askable(w, lang));
  return shuffle(ok).slice(0, checkCount(ok.length));
}

export interface SkipResult {
  /** Words that become "known". */
  skip: string[];
  /** Ticked words that stay new (missed in the check, or not checked after a failed check). */
  keep: string[];
  passed: boolean;
  right: number;
  asked: number;
}

/**
 * Passed check: every ticked word is skipped except the ones answered wrong.
 * Failed check: only the words answered right are skipped; the rest stay in the study list.
 */
export function skipResult(ticked: string[], answers: Record<string, boolean>): SkipResult {
  const asked = Object.keys(answers).length;
  const right = Object.values(answers).filter(Boolean).length;
  const passed = asked === 0 || right / asked >= CHECK_PASS;
  const skip = ticked.filter((id) => (id in answers ? answers[id] : passed));
  const keep = ticked.filter((id) => !skip.includes(id));
  return { skip, keep, passed, right, asked };
}

/**
 * Schedules words you already know: last box, due in about two months. Words that already have progress are
 * left alone. Doesn't count as studying (no daily history), so the daily goal and streak are unchanged.
 */
export function markKnown(p: Progress, ids: string[], today = toDay()): Progress {
  const cards = { ...p.cards };
  for (const id of ids) {
    if (cards[id]) continue;
    cards[id] = {
      state: "review",
      box: MAX_BOX,
      due: addDays(today, INTERVALS[MAX_BOX - 1]),
      streak: 1,
      lapses: 0,
      inDontKnow: false,
    } satisfies CardProgress;
  }
  return { ...p, cards };
}

/** Undo for markKnown: the words become new again. */
export function unmarkKnown(p: Progress, ids: string[]): Progress {
  const cards = { ...p.cards };
  for (const id of ids) delete cards[id];
  return { ...p, cards };
}
