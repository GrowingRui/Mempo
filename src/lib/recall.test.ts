import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { blankOut, buildRecall, checkSpelling, clozeFor, letterHint, looksLike, normalize, promptMeanings, recallPool } from "./recall";
import { markDontKnow } from "./srs";
import { card, progress, TODAY, word } from "./test-helpers";
import type { Word } from "./types";

const w = (over: Partial<Word> & { id: string }): Word => ({ ...word(over.id), word: over.id, ...over });

describe("checkSpelling", () => {
  const access = w({ id: "access", forms: ["accessed", "accesses"], variants: [] });
  const colour = w({ id: "colour", variants: ["color"] });
  const wellBeing = w({ id: "well-being" });

  it("accepts the word, its forms and variants, in any case", () => {
    expect(checkSpelling("access", access)).toBe("right");
    expect(checkSpelling("  Accessed ", access)).toBe("right");
    expect(checkSpelling("color", colour)).toBe("right");
  });

  it("treats hyphens and spaces the same", () => {
    expect(checkSpelling("well being", wellBeing)).toBe("right");
    expect(checkSpelling("well-being", wellBeing)).toBe("right");
  });

  it("one typo is 'close' (still wrong); more is wrong", () => {
    expect(checkSpelling("acess", access)).toBe("close");
    expect(checkSpelling("axxess", access)).toBe("wrong");
    expect(checkSpelling("", access)).toBe("wrong");
  });

  it("short words need the exact spelling", () => {
    expect(checkSpelling("ad", w({ id: "add" }))).toBe("wrong");
  });

  it("normalize straightens curly apostrophes and drops accents", () => {
    expect(normalize("Can’t  Café")).toBe("can't cafe");
  });
});

describe("letterHint and gaps", () => {
  it("shows the first letter and one gap per letter", () => {
    expect(letterHint("access")).toBe("a _ _ _ _ _");
    expect(letterHint("set up")).toBe("s _ _   _ _");
  });

  it("blanks the word or a form in the example", () => {
    const access = w({ id: "access", forms: ["accessed"] });
    expect(blankOut("She accessed the archive.", access)).toBe("She _____ the archive.");
    expect(blankOut("Access denied.", access)).toBe("_____ denied.");
    expect(blankOut("No match here.", access)).toBeUndefined();
  });

  it("doesn't blank the word inside a longer word", () => {
    expect(blankOut("It was inaccessible.", w({ id: "access" }))).toBeUndefined();
  });

  it("clozeFor picks the first example that contains the word", () => {
    const x = w({ id: "pick", examples: [{ text: "Nothing here." }, { text: "Pick one." }] });
    expect(clozeFor(x)).toBe("_____ one.");
  });
});

describe("promptMeanings", () => {
  it("drops a Spanish meaning that gives the word away when Chinese is shown too", () => {
    const secular = w({ id: "secular", zh: [{ pos: "adj", gloss: ["世俗的"] }], es: [{ pos: "adj", gloss: ["secular"] }] });
    expect(promptMeanings(secular, ["zh", "es"]).map((l) => l.lang)).toEqual(["zh"]);
    expect(promptMeanings(secular, ["es"]).map((l) => l.lang)).toEqual(["es"]);
  });
});

describe("recallPool", () => {
  it("has only studied words, weakest first", () => {
    const words = ["dk", "due", "low", "high", "mastered", "unseen"].map((id) => word(id));
    const p = progress({
      cards: {
        mastered: card({ state: "mastered", box: 6, due: addDays(TODAY, 90) }),
        high: card({ box: 5, due: addDays(TODAY, 20) }),
        low: card({ box: 2, due: addDays(TODAY, 2) }),
        due: card({ box: 4, due: TODAY }),
        dk: card({ inDontKnow: true, due: addDays(TODAY, 1) }),
      },
    });
    expect(recallPool(words, p, TODAY).map((x) => x.id)).toEqual(["dk", "due", "low", "high", "mastered"]);
  });
});

describe("buildRecall", () => {
  const all = Array.from({ length: 12 }, (_, i) => word(`w${i}`));

  it("each question has 4 different options with the right one at `correct`", () => {
    const qs = buildRecall(all.slice(0, 5), all, "meaning", ["zh"], 15);
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
      expect(q.options[q.correct].id).toBe(q.word.id);
    }
  });

  it("asks at most `count` words, taken from the front of the pool", () => {
    const qs = buildRecall(all, all, "listen", ["zh"], 3);
    expect(qs.map((q) => q.word.id).sort()).toEqual(["w0", "w1", "w2"]);
  });

  it("never offers a wrong choice with the same meaning", () => {
    const twin = { ...word("twin"), zh: all[0].zh };
    const qs = buildRecall([all[0]], [...all, twin], "meaning", ["zh"], 1);
    expect(qs[0].options.map((o) => o.id)).not.toContain("twin");
  });

  it("spell questions have no options", () => {
    expect(buildRecall(all.slice(0, 2), all, "spell", ["zh"])[0].options).toEqual([]);
  });

  it("skips words with no meaning in the shown languages, except for listening", () => {
    const bare = { ...word("bare"), zh: [] };
    expect(buildRecall([bare], all, "meaning", ["zh"])).toEqual([]);
    expect(buildRecall([bare], all, "listen", ["zh"])).toHaveLength(1);
  });
});

describe("markDontKnow", () => {
  it("adds studied words to the list without changing their schedule", () => {
    const p = progress({ cards: { a: card({ box: 4, due: addDays(TODAY, 5), streak: 3 }) } });
    const q = markDontKnow(p, ["a", "never-studied"]);
    expect(q.cards.a).toEqual({ ...p.cards.a, inDontKnow: true, streak: 0 });
    expect(q.cards["never-studied"]).toBeUndefined();
  });
});

describe("looksLike (cognates that give the answer away)", () => {
  it.each([
    ["accesibilidad", "accessibility", true], // first 6 letters one edit apart
    ["aluminio", "aluminium", true],
    ["abandonar", "abandon", true],
    ["secular", "secular", true],
    ["objetivo", "aim", false],
    ["acto", "act", false], // short words only match exactly
    ["anticipar", "anticipate", true],
  ])("%s / %s → %s", (gloss, word, expected) => {
    expect(looksLike(gloss, word)).toBe(expected);
  });
});
