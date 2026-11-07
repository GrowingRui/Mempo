import { site } from "../config/site";
import type { Progress, Settings } from "./types";

const KEY = `${site.storageKey}:progress`;

export const DEFAULT_SETTINGS: Settings = {
  level: "B2",
  dailyNew: 20,
  showZh: true,
  showEs: true,
  swipeKnow: "left",
};

export function emptyProgress(): Progress {
  return { settings: { ...DEFAULT_SETTINGS }, cards: {}, history: {} };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...p.settings },
      cards: p.cards ?? {},
      history: p.history ?? {},
    };
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
