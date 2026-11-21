import { describe, expect, it } from "vitest";
import { buildFamilies, familyOf } from "./family";
import type { Word } from "./types";

const w = (word: string, extra: Partial<Word> = {}): Word => ({
  id: word,
  word,
  level: "B2",
  pos: ["noun"],
  zh: [],
  es: [],
  examples: [],
  ...extra,
});

describe("word families", () => {
  const words = [
    w("decide", { pos: ["verb"] }),
    w("decision", { base: "decide" }),
    w("decisive", { base: "decision", pos: ["adjective"] }),
    w("undecided", { base: "decided" }),
    w("decided", { base: "decide", pos: ["adjective"] }),
    w("acceptable", { base: "accept" }), // "accept" is not a card
    w("unacceptable", { base: "acceptable" }),
    w("alone"),
  ];
  const index = buildFamilies(words);

  it("lists the other words of the family, root first, never the word itself", () => {
    expect(familyOf(index, words[1]).map((m) => m.text)).toEqual(["decide", "decisive", "undecided", "decided"]);
    expect(familyOf(index, words[0]).map((m) => m.text)).toEqual(["decision", "decisive", "undecided", "decided"]);
  });

  it("follows a chain of base words back to the same root", () => {
    expect(familyOf(index, words[2]).map((m) => m.text)).toContain("decide");
    expect(familyOf(index, words[3]).map((m) => m.text)).toContain("decision");
  });

  it("keeps a root that is not a card as plain text", () => {
    const fam = familyOf(index, words[5]);
    expect(fam.map((m) => m.text)).toEqual(["accept", "unacceptable"]);
    expect(fam[0].id).toBeUndefined();
  });

  it("gives a word with no relatives an empty family", () => {
    expect(familyOf(index, words[7])).toEqual([]);
  });

  it("survives a loop in the base links", () => {
    const loop = buildFamilies([w("a", { base: "b" }), w("b", { base: "a" })]);
    expect(familyOf(loop, w("a", { base: "b" })).length).toBeLessThanOrEqual(2);
  });
});
