import { describe, expect, it } from "vitest";
import { checkForm, formGap, formPool } from "./exam";
import { buildRecall } from "./recall";
import { card, progress, TODAY, word } from "./test-helpers";
import type { Word } from "./types";

describe("word formation", () => {
  const decision: Word = {
    ...word("decision"),
    base: "decide",
    forms: ["decisions"],
    examples: [
      { text: "You have to decide: is this decision right?" }, // has the base word: gives it away
      { text: "Decisions, decisions! Hard decisions." }, // the word twice
      { text: "They made two difficult Decisions last year." },
    ],
  };

  it("picks the first fair example and keeps the exact form the gap needs", () => {
    expect(formGap(decision)).toEqual({ text: "They made two difficult _____ last year.", answer: "decisions" });
  });

  it("has no question without a base word or a usable example", () => {
    expect(formGap({ ...decision, base: undefined })).toBeUndefined();
    expect(formGap({ ...decision, examples: decision.examples.slice(0, 2) })).toBeUndefined();
  });

  it("only the exact form counts; another form or a typo is pointed out", () => {
    const gap = formGap(decision)!;
    expect(checkForm(" Decisions ", gap, decision)).toBe("right");
    expect(checkForm("decision", gap, decision)).toBe("form");
    expect(checkForm("decisons", gap, decision)).toBe("close");
    expect(checkForm("decide", gap, decision)).toBe("wrong");
    expect(checkForm("", gap, decision)).toBe("wrong");
  });

  it("asks studied words first, then fills up from the chosen level", () => {
    const mk = (id: string, level: "B2" | "C1" = "B2"): Word => ({ ...word(id, level), base: "x", examples: [{ text: `A ${id} here.` }] });
    const all = [mk("studied"), mk("fresh"), mk("other", "C1"), word("nobase")];
    const p = progress({ cards: { studied: card(), nobase: card() }, settings: { level: "B2" } });
    expect(formPool(all, p, TODAY).map((w) => w.id)).toEqual(["studied", "fresh"]);
    const qs = buildRecall(formPool(all, p, TODAY), all, "form", ["zh"]);
    expect(qs.map((q) => q.options)).toEqual([[], []]);
  });
});
