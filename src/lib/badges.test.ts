import { describe, expect, it } from "vitest";
import { badgesOf, byLevel, newBadges, wordsStudied } from "./badges";
import { addDays } from "./date";
import { card, progress, TODAY, word } from "./test-helpers";

const day = (n: number) => addDays(TODAY, n);
const get = (bs: ReturnType<typeof badgesOf>, id: string) => bs.find((b) => b.id === id)!;

describe("badges", () => {
  it("streak badges use the longest streak", () => {
    const history: Record<string, { new: number; reviewed: number }> = {};
    for (let i = -40; i <= -34; i++) history[day(i)] = { new: 1, reviewed: 0 }; // 7 days, long ago
    const bs = badgesOf(progress({ history }), {}, TODAY);
    expect(get(bs, "streak7")).toMatchObject({ earned: true, have: 7 });
    expect(get(bs, "streak30")).toMatchObject({ earned: false, have: 7, goal: 30 });
  });

  it("word badges count new words studied, not skipped ones", () => {
    const p = progress({ history: { [day(-1)]: { new: 60, reviewed: 300 }, [TODAY]: { new: 45, reviewed: 0 } } });
    expect(wordsStudied(p.history)).toBe(105);
    const bs = badgesOf(p, {}, TODAY);
    expect(get(bs, "words100").earned).toBe(true);
    expect(get(bs, "words500")).toMatchObject({ earned: false, have: 105 });
  });

  it("a level badge needs every word of the level seen or skipped, and its list loaded", () => {
    const words = byLevel([word("a"), word("b"), word("c", "C1")]);
    const half = progress({ cards: { a: card() } });
    expect(get(badgesOf(half, words, TODAY), "levelB2")).toMatchObject({ earned: false, have: 1, goal: 2 });
    const full = progress({ cards: { a: card(), b: card() } });
    expect(get(badgesOf(full, words, TODAY), "levelB2").earned).toBe(true);
    expect(get(badgesOf(full, {}, TODAY), "levelB2")).toMatchObject({ earned: false, goal: 0 });
  });

  it("newBadges lists only badges earned since", () => {
    const words = byLevel([word("a")]);
    const before = badgesOf(progress(), words, TODAY);
    const after = badgesOf(progress({ cards: { a: card() }, history: { [TODAY]: { new: 1, reviewed: 0 } } }), words, TODAY);
    expect(newBadges(before, after).map((b) => b.id)).toEqual(["levelB2"]);
    expect(newBadges(after, after)).toEqual([]);
  });
});
