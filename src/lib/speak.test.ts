import { describe, expect, it } from "vitest";
import { cleanHeard, heardWord } from "./speak";
import { word } from "./test-helpers";
import type { Word } from "./types";

const w = (over: Partial<Word>): Word => ({ ...word("x"), ...over });

describe("Speak it: did the recogniser hear the word?", () => {
  const abandon = w({ id: "abandon", word: "abandon", forms: ["abandoned", "abandons"] });

  it("cleans what was heard", () => {
    expect(cleanHeard("Abandon.")).toBe("abandon");
    expect(cleanHeard("  Mull it-over! ")).toBe("mull it over");
  });

  it("accepts the word, any capital or full stop, and its forms", () => {
    expect(heardWord(["Abandon."], abandon)).toBe(true);
    expect(heardWord(["abandoned"], abandon)).toBe(true);
  });

  it("accepts the word inside a short phrase, as whole words only", () => {
    expect(heardWord(["to abandon"], abandon)).toBe(true);
    expect(heardWord(["the word is abandon"], abandon)).toBe(true);
    expect(heardWord(["abandonment"], abandon)).toBe(false);
  });

  it("looks at every guess, not only the first", () => {
    expect(heardWord(["a band on", "abandon"], abandon)).toBe(true);
    expect(heardWord(["a band on", "London"], abandon)).toBe(false);
    expect(heardWord([], abandon)).toBe(false);
    expect(heardWord([" "], abandon)).toBe(false);
  });

  it("forgives one letter in a long single word (a spelling the recogniser chose), not in short ones", () => {
    const judgement = w({ id: "judgement", word: "judgement" });
    expect(heardWord(["judgment"], judgement)).toBe(true);
    const aide = w({ id: "aide", word: "aide" });
    expect(heardWord(["aid"], aide)).toBe(false);
    expect(heardWord(["except"], w({ id: "accept", word: "accept" }))).toBe(false);
  });

  it("hears phrasal verbs, also with a hyphen or a past form", () => {
    const mull = w({ id: "mull-over", word: "mull over", phrasal: true, examples: [{ text: "She [mulled over] it.", form: "mulled over" }] });
    expect(heardWord(["Mull over"], mull)).toBe(true);
    expect(heardWord(["I mulled over"], mull)).toBe(true);
    expect(heardWord(["mull"], mull)).toBe(false);
  });
});
