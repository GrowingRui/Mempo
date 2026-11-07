import type { Level, Word } from "./types";

const cache = new Map<Level, Promise<Word[]>>();

export function loadWords(level: Level): Promise<Word[]> {
  let p = cache.get(level);
  if (!p) {
    p = fetch(`/data/${level.toLowerCase()}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${level} words (${r.status})`);
      return r.json() as Promise<Word[]>;
    });
    p.catch(() => cache.delete(level)); // allow a retry after a network error
    cache.set(level, p);
  }
  return p;
}

export interface LevelIndex {
  counts: Record<Level | "total", number>;
  sources: { what: string; name: string; url: string; licence: string }[];
}

let indexPromise: Promise<LevelIndex> | undefined;
export function loadIndex(): Promise<LevelIndex> {
  indexPromise ??= fetch("/data/index.json").then((r) => r.json());
  return indexPromise;
}
