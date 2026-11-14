import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCloze, checkForm, CLOZE_ROUND, formGap, formPool, loadCloze, type ClozeItem } from "./exam";
import { buildRecall, GAP } from "./recall";
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

describe("multiple-choice cloze (Part 1)", () => {
  const item = (id: string, level: "B2" | "C1" = "B2", card?: string): ClozeItem => ({
    id,
    level,
    card,
    text: `It was _____ ${id}.`,
    answer: "right",
    others: ["wrong1", "wrong2", "wrong3"],
    note: "Why.",
  });

  it("asks the user's level first, links the answer's card and shuffles the choices", () => {
    const items = [item("c1", "C1"), item("a", "B2", "known"), item("b")];
    const qs = buildCloze(items, [word("known")], "B2", 8, () => 0.3);
    expect(qs.map((q) => q.cloze?.id).slice(0, 2).sort()).toEqual(["a", "b"]);
    expect(qs[2].cloze?.id).toBe("c1"); // topped up from another level
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(q.options[q.correct].word).toBe("right");
    }
    expect(qs.find((q) => q.cloze?.id === "a")?.word.id).toBe("known");
    expect(qs.find((q) => q.cloze?.id === "b")?.word.word).toBe("right"); // stand-in, not a card
  });

  it("keeps a round to 8 questions", () => {
    const many = Array.from({ length: 20 }, (_, i) => item(String(i)));
    expect(buildCloze(many, [], "B2")).toHaveLength(CLOZE_ROUND);
  });

  it("has well-formed hand-written questions", async () => {
    const items = await loadCloze();
    const dir = join(__dirname, "../../public/data");
    const ids = new Set(["b2", "c1", "c2"].flatMap((l) => (JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8")) as Word[]).map((w) => w.id)));
    expect(new Set(items.map((q) => q.id)).size).toBe(items.length);
    for (const q of items) {
      expect(q.text.split(GAP), q.id).toHaveLength(2);
      const choices = [q.answer, ...q.others].map((c) => c.toLowerCase());
      expect(new Set(choices).size, q.id).toBe(4);
      expect(q.note.length, q.id).toBeGreaterThan(10);
      if (q.card) expect(ids.has(q.card), q.id).toBe(true);
    }
  });
});
