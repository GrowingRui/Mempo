import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMatch, formatTime, loadBest, MATCH_PAIRS, saveBest, tileLines, tileMeaning } from "./match";
import { word } from "./test-helpers";
import type { Word } from "./types";

const w = (id: string, es?: string): Word => ({
  ...word(id),
  zh: [{ pos: "n", gloss: [`意思${id}`] }], // the helper's "id-zh" would look like the word
  ...(es ? { es: [{ pos: "n", gloss: [es] }] } : {}),
});
// Meanings that don't look like the word (the helper's "word0-es" would count as giving it away).
const many = (n: number) => Array.from({ length: n }, (_, i) => w(`word${i}`, `significado ${i}`));

describe("tileMeaning", () => {
  it("skips a meaning that spells out the word", () => {
    expect(tileMeaning(w("secular", "secular"), "es")).toBeUndefined();
    expect(tileMeaning(w("accessibility", "accesibilidad"), "es")).toBeUndefined();
    expect(tileMeaning(w("decision", "elección"), "es")).toBe("elección");
  });
});

describe("tileLines", () => {
  it("shows every shown language, in order", () => {
    const x = w("decision", "elección");
    expect(tileLines(x, ["zh", "es"])).toEqual([
      { lang: "zh", text: "意思decision" },
      { lang: "es", text: "elección" },
    ]);
    expect(tileLines(x, ["es"])).toEqual([{ lang: "es", text: "elección" }]);
  });

  it("leaves out a line that gives the word away, keeping the others", () => {
    const x = { ...w("secular", "secular"), zh: [{ pos: "n", gloss: ["世俗的"] }] };
    expect(tileLines(x, ["zh", "es"])).toEqual([{ lang: "zh", text: "世俗的" }]);
  });
});

describe("buildMatch", () => {
  it("makes a full board from the front of the pool, every word paired with its own meaning", () => {
    const pool = many(10);
    const board = buildMatch(pool, ["es"], MATCH_PAIRS, () => 0.3)!;
    expect(board.pairs).toHaveLength(MATCH_PAIRS);
    expect(new Set(board.pairs.map((p) => p.word.id))).toEqual(new Set(pool.slice(0, MATCH_PAIRS).map((x) => x.id)));
    for (const p of board.pairs) expect(p.lines).toEqual([{ lang: "es", text: `significado ${p.word.id.slice(4)}` }]);
    expect([...board.meaningOrder].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("puts both languages on the tiles when both are shown", () => {
    const board = buildMatch(many(6), ["zh", "es"])!;
    for (const p of board.pairs) expect(p.lines.map((l) => l.lang)).toEqual(["zh", "es"]);
  });

  it("never shows the same word or the same meaning twice", () => {
    const pool = [w("a1", "uno"), w("a2", "uno"), { ...w("a3"), word: "a1" }, ...many(5)];
    const board = buildMatch(pool, ["es"])!;
    expect(new Set(board.pairs.map((p) => p.lines[0].text)).size).toBe(board.pairs.length);
    expect(new Set(board.pairs.map((p) => p.word.word)).size).toBe(board.pairs.length);
    expect(board.pairs.map((p) => p.word.id)).not.toContain("a2");
    expect(board.pairs.map((p) => p.word.id)).not.toContain("a3");
  });

  it("makes a smaller board from few words, and none below 3", () => {
    expect(buildMatch(many(4), ["es"])!.pairs).toHaveLength(4);
    expect(buildMatch(many(2), ["es"])).toBeUndefined();
    expect(buildMatch([w("x", "x"), w("y", "y"), w("z", "z")], ["es"])).toBeUndefined();
  });
});

describe("times", () => {
  // Tests run in Node, which has no localStorage: a small in-memory one.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it("formats tenths, rounding down", () => {
    expect(formatTime(12_449)).toBe("12.4");
    expect(formatTime(0)).toBe("0.0");
  });

  it("keeps the best time per level", () => {
    expect(loadBest("B2")).toBeUndefined();
    expect(saveBest("B2", 20_000)).toBe(true);
    expect(saveBest("B2", 25_000)).toBe(false);
    expect(saveBest("B2", 18_000)).toBe(true);
    expect(loadBest("B2")).toBe(18_000);
    expect(loadBest("C1")).toBeUndefined();
  });
});
