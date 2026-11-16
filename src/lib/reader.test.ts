import { describe, expect, it } from "vitest";
import { baseForms, foundWords, markText, readerIndex } from "./reader";
import { word } from "./test-helpers";
import type { Word } from "./types";

const w = (text: string, over: Partial<Word> = {}): Word => ({ ...word(text.replace(/ /g, "-")), word: text, ...over });

const WORDS = [
  w("abandon"),
  w("study"),
  w("make"),
  w("stop"),
  w("give up", { examples: [{ text: "She gave it up.", form: "gave up" }] }),
  w("carry out"),
  w("carbon"),
  w("carbon footprint"),
  w("well-being"),
  w("process"),
  w("ardour", { variants: ["ardor"] }),
  w("leave"),
];
const index = readerIndex(WORDS);
const marked = (text: string) => markText(text, index).filter((s) => s.id).map((s) => `${s.text}=${s.id}`);

describe("Read a text", () => {
  it("keeps every character of the text, in order", () => {
    const text = "  They abandoned it,\nthen gave up!  ";
    expect(markText(text, index).map((s) => s.text).join("")).toBe(text);
  });

  it("finds words as written and in inflected forms", () => {
    expect(marked("Abandoned studies, making stops. She stopped.")).toEqual([
      "Abandoned=abandon",
      "studies=study",
      "making=make",
      "stops=stop",
      "stopped=stop",
    ]);
  });

  it("finds phrases, longest first, with the first or last word inflected", () => {
    expect(marked("He gave up and carries out tests on carbon footprints.")).toEqual([
      "gave up=give-up",
      "carries out=carry-out",
      "carbon footprints=carbon-footprint",
    ]);
    expect(marked("Carbon is cheap.")).toEqual(["Carbon=carbon"]);
  });

  it("doesn't join a phrase across punctuation", () => {
    expect(marked("Who gave? Up we go.")).toEqual([]);
  });

  it("finds spellings, hyphenated words and curly apostrophes", () => {
    expect(marked("Her ardor for well-being’s sake.")).toEqual(["ardor=ardour", "well-being’s=well-being"]);
  });

  it("doesn't cut -ss words or read ambiguous past forms as verbs", () => {
    expect(marked("The process. Turn left.")).toEqual(["process=process"]);
    expect(baseForms("process")).not.toContain("proces");
    expect(baseForms("left")).toEqual(["left"]);
    expect(baseForms("left", true)).toContain("leave");
  });

  it("lists each word once, in order, with how often it appears", () => {
    expect(foundWords(markText("Stop. Make it. Stopped again.", index))).toEqual([
      { id: "stop", count: 2 },
      { id: "make", count: 1 },
    ]);
  });
});
