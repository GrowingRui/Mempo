// Small builders shared by the *.test.ts files. Not used by the app.
import { emptyProgress } from "./storage";
import type { CardProgress, Level, Progress, Settings, Word } from "./types";

export const TODAY = "2026-11-07";

export function progress(over: Partial<Omit<Progress, "settings">> & { settings?: Partial<Settings> } = {}): Progress {
  const p = emptyProgress();
  return { ...p, ...over, settings: { ...p.settings, ...over.settings } };
}

export function card(over: Partial<CardProgress> = {}): CardProgress {
  return { state: "review", box: 2, due: TODAY, streak: 1, lapses: 0, inDontKnow: false, ...over };
}

export function word(id: string, level: Level = "B2"): Word {
  return { id, word: id, level, pos: ["n"], zh: [{ pos: "n", gloss: [`${id}-zh`] }], es: [{ pos: "n", gloss: [`${id}-es`] }], examples: [] };
}
