// Word search, shared by the Word list and My list ("Add a word").
import type { Word } from "./types";

/** Lower-case, accents removed, so "accion" finds "acción". */
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Search text per word: headword, spellings and forms (they rank higher), then the translations. */
export type SearchIndex = Map<string, { en: string[]; tr: string }>;

export function searchIndex(words: Word[]): SearchIndex {
  return new Map(
    words.map((w) => [
      w.id,
      {
        en: [w.word, ...(w.variants ?? []), ...(w.forms ?? [])].map(norm),
        tr: norm([...w.zh, ...w.es].flatMap((g) => g.gloss).join(" | ")),
      },
    ]),
  );
}

/**
 * The words that match `q` (already normalized), best first: the exact word, then words that start with it,
 * then words that contain it, then words whose translations contain it. Keeps the input order within a rank.
 */
export function searchWords(words: Word[], index: SearchIndex, q: string): Word[] {
  if (!q) return words;
  const rank = (w: Word) => {
    const s = index.get(w.id);
    if (!s) return 4;
    if (s.en.some((e) => e === q)) return 0;
    if (s.en.some((e) => e.startsWith(q))) return 1;
    if (s.en.some((e) => e.includes(q))) return 2;
    if (s.tr.includes(q)) return 3;
    return 4;
  };
  return words
    .map((w) => ({ w, r: rank(w) }))
    .filter((x) => x.r < 4)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.w);
}
