import { describe, expect, it } from "vitest";
import { buildCloze, type ClozeItem } from "./exam";
import { dueCount, dueMissIds, recordExamAnswer } from "./misses";
import { emptyProgress, normalizeProgress } from "./storage";

const TODAY = "2026-11-22";
const item = (id: string, level: "B2" | "C1" = "B2"): ClozeItem => ({ id, level, text: "A _____ b.", answer: "x", others: ["a", "b", "c"], note: "Why, because." });

describe("mistake review for exam questions", () => {
  it("brings a miss back after 1, 3 and 7 days, then clears it", () => {
    let p = recordExamAnswer(emptyProgress(), "q", false, TODAY);
    expect(p.examMisses.q).toEqual({ due: "2026-11-23", n: 0 });
    p = recordExamAnswer(p, "q", true, "2026-11-23");
    expect(p.examMisses.q).toEqual({ due: "2026-11-26", n: 1 });
    p = recordExamAnswer(p, "q", true, "2026-11-26");
    expect(p.examMisses.q).toEqual({ due: "2026-12-03", n: 2 });
    p = recordExamAnswer(p, "q", true, "2026-12-03");
    expect(p.examMisses).toEqual({});
  });

  it("starts again after another miss, and ignores right answers to questions never missed", () => {
    let p = recordExamAnswer(emptyProgress(), "q", false, TODAY);
    p = recordExamAnswer(p, "q", true, "2026-11-23");
    p = recordExamAnswer(p, "q", false, "2026-11-26");
    expect(p.examMisses.q).toEqual({ due: "2026-11-27", n: 0 });
    const fresh = emptyProgress();
    expect(recordExamAnswer(fresh, "other", true, TODAY)).toBe(fresh);
  });

  it("knows which are due", () => {
    let p = recordExamAnswer(emptyProgress(), "a", false, "2026-11-20"); // due 21st
    p = recordExamAnswer(p, "b", false, TODAY); // due 23rd
    expect([...dueMissIds(p, TODAY)]).toEqual(["a"]);
    expect(dueCount([item("a"), item("b"), item("c")], p, TODAY)).toBe(1);
  });

  it("asks due questions first, whatever their level", () => {
    const items = [item("a"), item("b"), item("c"), item("d"), item("old", "C1")];
    const qs = buildCloze(items, [], "B2", 3, () => 0.5, new Set(["old"]));
    expect(qs[0].cloze?.id).toBe("old");
    expect(qs).toHaveLength(3);
  });

  it("is saved and read back, dropping broken entries", () => {
    const p = recordExamAnswer(emptyProgress(), "q", false, TODAY);
    expect(normalizeProgress(JSON.parse(JSON.stringify(p))).progress.examMisses).toEqual(p.examMisses);
    expect(normalizeProgress({ cards: {}, examMisses: { a: { due: "soon", n: 1 }, b: 5, c: { due: TODAY, n: 99 } } }).progress.examMisses).toEqual({ c: { due: TODAY, n: 2 } });
    expect(normalizeProgress({ cards: {} }).progress.examMisses).toEqual({});
  });
});
