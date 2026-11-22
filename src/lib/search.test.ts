import { describe, expect, it } from "vitest";
import { norm, searchIndex, searchWords } from "./search";
import { word } from "./test-helpers";

describe("word search", () => {
  const words = [word("abandon"), word("abate"), word("bandage")];
  const index = searchIndex(words);
  const ids = (q: string, notes?: Record<string, string>) => searchWords(words, index, norm(q), notes).map((w) => w.id);

  it("puts the exact word first, then words that start with it, then words that contain it", () => {
    expect(ids("aba")).toEqual(["abandon", "abate"]);
    expect(ids("band")).toEqual(["bandage", "abandon"]);
  });

  it("finds words by the user's note, accents and case ignored", () => {
    const notes = { abate: "Think of a BAÑO slowly draining" };
    expect(ids("bano")).toEqual([]);
    expect(ids("bano", notes)).toEqual(["abate"]);
    expect(ids("draining", notes)).toEqual(["abate"]);
  });

  it("ranks a note match below a match on the word itself", () => {
    expect(ids("band", { abate: "a band plays" })).toEqual(["bandage", "abandon", "abate"]);
  });
});
