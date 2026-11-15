// Checks the phrasal verb cards in the built word files (public/data, made by npm run data:enrich from scripts/phrasal.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blankOut, buildRecall } from "./recall";
import type { Word } from "./types";

const all = ["b2", "c1", "c2"].flatMap((l) => JSON.parse(readFileSync(join(process.cwd(), "public/data", `${l}.json`), "utf8")) as Word[]);
const phrasal = all.filter((w) => w.phrasal);

describe("phrasal verb cards", () => {
  it("there are phrasal verbs at every level", () => {
    for (const level of ["B2", "C1", "C2"]) expect(phrasal.filter((w) => w.level === level).length).toBeGreaterThan(30);
  });

  it("every id is used once across all levels", () => {
    const ids = all.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each has Chinese, Spanish and English meanings and an example the Recall gap can find", () => {
    for (const w of phrasal) {
      expect(w.zh[0]?.gloss.length, w.word).toBeGreaterThan(0);
      expect(w.es[0]?.gloss.length, w.word).toBeGreaterThan(0);
      expect(w.en?.[0]?.gloss.length, w.word).toBeGreaterThan(0);
      expect(blankOut(w.examples[0].text, w), `${w.word}: ${w.examples[0].text}`).toBeDefined();
    }
  });

  it("a meaning question about a phrasal verb gets 3 other phrasal verbs as wrong choices", () => {
    const [q] = buildRecall([phrasal[0]], all, "meaning", ["zh", "es"]);
    expect(q.options).toHaveLength(4);
    expect(q.options.every((o) => o.phrasal)).toBe(true);
  });
});
