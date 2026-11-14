import { site } from "../config/site";
import { LEVELS, type CardProgress, type DayHistory, type Progress, type Settings } from "./types";

const KEY = `${site.storageKey}:progress`;

export const DEFAULT_SETTINGS: Settings = {
  level: "B2",
  dailyNew: 20,
  showZh: true,
  showEs: true,
  showEn: true,
  swipeKnow: "left",
  theme: "light",
  lang: "en",
  maxReviews: 100,
};

export function emptyProgress(): Progress {
  return { settings: { ...DEFAULT_SETTINGS }, cards: {}, history: {}, myList: {} };
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATES = new Set(["new", "learning", "review", "mastered"]);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function cleanSettings(s: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!isObj(s)) return out;
  if (LEVELS.includes(s.level)) out.level = s.level;
  if (Number.isInteger(s.dailyNew) && s.dailyNew >= 1 && s.dailyNew <= 500) out.dailyNew = s.dailyNew;
  if (typeof s.showZh === "boolean") out.showZh = s.showZh;
  if (typeof s.showEs === "boolean") out.showEs = s.showEs;
  if (typeof s.showEn === "boolean") out.showEn = s.showEn;
  if (!out.showZh && !out.showEs) out.showZh = out.showEs = true;
  if (s.swipeKnow === "left" || s.swipeKnow === "right") out.swipeKnow = s.swipeKnow;
  if (Number.isInteger(s.maxReviews) && s.maxReviews >= 0 && s.maxReviews <= 1000) out.maxReviews = s.maxReviews;
  if (s.theme === "light" || s.theme === "dark" || s.theme === "system") out.theme = s.theme;
  if (s.lang === "en" || s.lang === "zh" || s.lang === "es") out.lang = s.lang;
  return out;
}

function cleanCard(c: unknown): CardProgress | null {
  if (!isObj(c) || !STATES.has(c.state) || typeof c.due !== "string" || !DAY.test(c.due)) return null;
  const card: CardProgress = {
    state: c.state,
    box: Math.min(6, Math.max(1, Math.round(num(c.box, 1)))),
    due: c.due,
    streak: Math.max(0, num(c.streak)),
    lapses: Math.max(0, num(c.lapses)),
    inDontKnow: c.inDontKnow === true,
  };
  if (typeof c.lastSeen === "string" && DAY.test(c.lastSeen)) card.lastSeen = c.lastSeen;
  return card;
}

/**
 * Turns anything that looks like saved progress into a valid Progress: unknown settings fall back to the
 * defaults, broken cards and days are dropped. `dropped` counts the cards and days that were thrown away.
 */
export function normalizeProgress(p: unknown): { progress: Progress; dropped: number } {
  const src = isObj(p) ? p : {};
  let dropped = 0;
  const cards: Progress["cards"] = {};
  for (const [id, c] of Object.entries(isObj(src.cards) ? src.cards : {})) {
    const card = cleanCard(c);
    if (card) cards[id] = card;
    else dropped++;
  }
  const history: Progress["history"] = {};
  for (const [day, h] of Object.entries(isObj(src.history) ? src.history : {})) {
    if (DAY.test(day) && isObj(h)) history[day] = { new: Math.max(0, num(h.new)), reviewed: Math.max(0, num(h.reviewed)) } satisfies DayHistory;
    else dropped++;
  }
  // My list (added later, so older progress and backups simply have none).
  const myList: Progress["myList"] = {};
  for (const [id, day] of Object.entries(isObj(src.myList) ? src.myList : {})) {
    if (id && typeof day === "string" && DAY.test(day)) myList[id] = day;
  }
  return { progress: { settings: cleanSettings(src.settings), cards, history, myList }, dropped };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeProgress(JSON.parse(raw)).progress : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or blocked (private mode): progress lives only in memory this visit.
  }
}
