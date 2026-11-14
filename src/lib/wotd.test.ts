import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { word } from "./test-helpers";
import type { Word } from "./types";
import { dayNumber, reminderLine, wordOfTheDay, wotdCandidates } from "./wotd";

const w = (id: string, over: Partial<Word> = {}): Word => ({ ...word(id), examples: [{ text: `A ${id}.` }], ...over });

describe("word of the day", () => {
  it("counts days from 1970", () => {
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-11-15") - dayNumber("2026-11-14")).toBe(1);
  });

  it("leaves out inflected cards, offensive words, and words without an example or meaning", () => {
    const words = [
      w("good"),
      w("goes", { lemma: "go" }),
      w("slur", { sensitive: { level: "offensive", note: "" } }),
      w("bare", { examples: [] }),
      w("blank", { zh: [], es: [] }),
      w("high", { level: "C1" }),
    ];
    expect(wotdCandidates(words, "B2").map((x) => x.id)).toEqual(["good"]);
  });

  it("is the same all day, whatever order the list comes in, and goes through every word before repeating", () => {
    const words = Array.from({ length: 12 }, (_, i) => w(`w${String(i).padStart(2, "0")}`));
    const day = "2026-11-14";
    expect(wordOfTheDay(words, "B2", day)).toBe(wordOfTheDay([...words].reverse(), "B2", day));
    const seen = Array.from({ length: 12 }, (_, i) => wordOfTheDay(words, "B2", addDays(day, i))!.id);
    expect(new Set(seen).size).toBe(12);
    expect(wordOfTheDay([], "B2", day)).toBeUndefined();
  });

  it("writes the reminder line in the app's language, or the first meaning shown on cards", () => {
    const x = w("ubiquitous");
    const prefs = { level: "B2" as const, showZh: true, showEs: true };
    expect(reminderLine(x, { ...prefs, lang: "es" })).toBe("Palabra del día: ubiquitous · ubiquitous-es");
    expect(reminderLine(x, { ...prefs, lang: "zh" })).toBe("每日一词：ubiquitous · ubiquitous-zh");
    expect(reminderLine(x, { ...prefs, lang: "en", showZh: false })).toBe("Word of the day: ubiquitous · ubiquitous-es");
    expect(reminderLine(x, { ...prefs, lang: "en", showZh: false, showEs: false })).toBe("Word of the day: ubiquitous");
  });
});
