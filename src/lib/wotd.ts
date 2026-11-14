// Word of the day: one word per level per day, the same for everyone, picked from the date alone (no server,
// no account). Shown on Home and in the daily reminder. The reminder's text comes from the server, which
// knows no words, so the service worker (src/sw.ts) adds the word itself from the word list it keeps offline.
// To know the level and languages, it reads a small copy of those settings the app saves (savePrefsForReminder).
import { meaning } from "./leveltest";
import type { Lang, Level, Settings, Word } from "./types";

/** Words that make a good word of the day: a real headword (not an inflected card), with a meaning and an example, nothing offensive. */
export function wotdCandidates(words: Word[], level: Level): Word[] {
  return words
    .filter((w) => w.level === level && !w.lemma && !w.sensitive && w.examples.length > 0 && w.zh.length + w.es.length > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Days since 1970-01-01 for a "YYYY-MM-DD" day. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * The word for a day. Days step through the list by a fixed stride (about 0.618 of its length) that shares
 * no factor with the length, so every word comes once before any comes back, and neighbouring days get
 * unrelated words rather than alphabetical neighbours.
 */
export function wordOfTheDay(words: Word[], level: Level, day: string): Word | undefined {
  const list = wotdCandidates(words, level);
  const n = list.length;
  if (!n) return undefined;
  let stride = Math.max(1, Math.round(n * 0.618034)); // golden ratio: consecutive days land far apart
  while (gcd(stride, n) !== 1) stride++;
  return list[(((dayNumber(day) * stride) % n) + n) % n];
}

/** Settings the service worker needs for the reminder's word. */
export interface ReminderPrefs {
  level: Level;
  lang: Lang;
  showZh: boolean;
  showEs: boolean;
}

const PREFS_CACHE = "mempo-prefs";
const PREFS_URL = "/__mempo/prefs.json";

/** Saves the settings for the service worker (Cache Storage, which both can read). */
export async function savePrefsForReminder(s: Settings): Promise<void> {
  if (typeof caches === "undefined") return;
  const prefs: ReminderPrefs = { level: s.level, lang: s.lang, showZh: s.showZh, showEs: s.showEs };
  const cache = await caches.open(PREFS_CACHE);
  await cache.put(PREFS_URL, new Response(JSON.stringify(prefs), { headers: { "Content-Type": "application/json" } }));
}

export async function readPrefsForReminder(): Promise<ReminderPrefs | undefined> {
  const res = await (await caches.open(PREFS_CACHE)).match(PREFS_URL);
  return res ? ((await res.json()) as ReminderPrefs) : undefined;
}

/** The label in the notification (the app's own texts are in src/i18n, which the service worker doesn't load). */
const LABEL: Record<Lang, string> = { en: "Word of the day", zh: "每日一词", es: "Palabra del día" };

/**
 * The notification line: "Word of the day: ubiquitous · 无处不在的". The meaning is in the interface language
 * when it's Chinese or Spanish, otherwise the first one the user shows on cards.
 */
export function reminderLine(w: Word, p: ReminderPrefs): string {
  const order = [...(p.lang === "zh" || p.lang === "es" ? [p.lang] : []), ...(p.showZh ? ["zh" as const] : []), ...(p.showEs ? ["es" as const] : [])];
  const m = order.map((l) => meaning(w, l)).find(Boolean);
  const label = `${LABEL[p.lang] ?? LABEL.en}${p.lang === "zh" ? "：" : ": "}`;
  return `${label}${w.word}${m ? ` · ${m}` : ""}`;
}
