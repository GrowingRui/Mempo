import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { breakdown, lastDays, MAX_FREEZES, streakOf } from "./stats";
import { card, TODAY, word } from "./test-helpers";

const day = (n: number) => addDays(TODAY, n);
const did = { new: 5, reviewed: 0 };

describe("streakOf", () => {
  it("counts days in a row including today", () => {
    const s = streakOf({ [day(-2)]: did, [day(-1)]: did, [TODAY]: did }, TODAY);
    expect(s).toMatchObject({ current: 3, doneToday: true, daysStudied: 3 });
  });

  it("not studying yet today does not break the streak (it ends at yesterday)", () => {
    const s = streakOf({ [day(-2)]: did, [day(-1)]: did }, TODAY);
    expect(s).toMatchObject({ current: 2, doneToday: false });
  });

  it("one missed day uses the starting freeze and keeps the streak (the frozen day doesn't add to it)", () => {
    const s = streakOf({ [day(-3)]: did, [day(-2)]: did, [TODAY]: did }, TODAY);
    expect(s).toMatchObject({ current: 3, freezes: 0, frozen: [day(-1)] });
  });

  it("two missed days with only one freeze break the streak", () => {
    const s = streakOf({ [day(-4)]: did, [day(-3)]: did, [TODAY]: did }, TODAY);
    expect(s).toMatchObject({ current: 1, longest: 2, freezes: 0, frozen: [day(-2)] });
  });

  it("a second miss after the freeze is used breaks the streak", () => {
    const s = streakOf({ [day(-5)]: did, [day(-3)]: did, [day(-2)]: did, [TODAY]: did }, TODAY);
    expect(s).toMatchObject({ current: 1, longest: 3, frozen: [day(-4)] });
  });

  it("missing yesterday uses a freeze even before today is done", () => {
    const s = streakOf({ [day(-3)]: did, [day(-2)]: did }, TODAY);
    expect(s).toMatchObject({ current: 2, doneToday: false, freezes: 0, frozen: [day(-1)] });
  });

  it("earns a freeze every 7 days in a row, holding at most 2", () => {
    const h: Record<string, typeof did> = {};
    for (let i = -20; i <= 0; i++) h[day(i)] = did;
    expect(streakOf(h, TODAY)).toMatchObject({ current: 21, freezes: MAX_FREEZES, frozen: [] });
    const six: Record<string, typeof did> = {};
    for (let i = -5; i <= 0; i++) six[day(i)] = did;
    expect(streakOf(six, TODAY).freezes).toBe(1);
  });

  it("an earned freeze covers a later miss", () => {
    const h: Record<string, typeof did> = {};
    for (let i = -9; i <= -3; i++) h[day(i)] = did; // 7 days: 1 + 1 = 2 freezes
    h[TODAY] = did; // days -2 and -1 missed
    expect(streakOf(h, TODAY)).toMatchObject({ current: 8, freezes: 0, frozen: [day(-2), day(-1)] });
  });

  it("after a streak ends, a new one starts from 1 with the freezes left", () => {
    expect(streakOf({ [day(-10)]: did }, TODAY)).toMatchObject({ current: 0, longest: 1, freezes: 0, frozen: [day(-9)] });
    expect(streakOf({ [day(-10)]: did, [TODAY]: did }, TODAY)).toMatchObject({ current: 1, freezes: 0 });
  });

  it("missing yesterday and today with no freeze left means 0", () => {
    expect(streakOf({ [day(-3)]: did }, TODAY).current).toBe(0);
  });

  it("a day with zero answers doesn't count", () => {
    const s = streakOf({ [day(-1)]: { new: 0, reviewed: 0 }, [TODAY]: did }, TODAY);
    expect(s).toMatchObject({ current: 1, daysStudied: 1 });
  });

  it("reviews alone count as studying", () => {
    expect(streakOf({ [TODAY]: { new: 0, reviewed: 3 } }, TODAY).doneToday).toBe(true);
  });

  it("remembers the longest streak", () => {
    const h = { [day(-10)]: did, [day(-9)]: did, [day(-8)]: did, [day(-7)]: did, [day(-1)]: did }; // the freeze covers only day -6
    expect(streakOf(h, TODAY)).toMatchObject({ current: 1, longest: 4 });
  });

  it("works across month and year ends", () => {
    const s = streakOf({ "2026-12-30": did, "2026-12-31": did, "2027-01-01": did }, "2027-01-01");
    expect(s).toMatchObject({ current: 3, longest: 3 });
  });

  it("empty history", () => {
    expect(streakOf({}, TODAY)).toEqual({ current: 0, longest: 0, doneToday: false, daysStudied: 0, freezes: 1, frozen: [] });
  });
});

describe("lastDays", () => {
  it("returns n days, oldest first, ending today, with zeros for days off", () => {
    const bars = lastDays({ [TODAY]: { new: 2, reviewed: 3 } }, 14, TODAY);
    expect(bars).toHaveLength(14);
    expect(bars[0]).toEqual({ day: day(-13), new: 0, reviewed: 0 });
    expect(bars[13]).toEqual({ day: TODAY, new: 2, reviewed: 3 });
  });
});

describe("breakdown", () => {
  it("counts words per status; words never seen are 'new'", () => {
    const words = [word("a"), word("b"), word("c"), word("d"), word("e")];
    const cards = {
      a: card({ state: "learning" }),
      b: card({ state: "review" }),
      c: card({ state: "mastered" }),
      d: card({ inDontKnow: true }),
      other: card(), // a word from another level is ignored
    };
    expect(breakdown(words, cards)).toEqual({ new: 1, learning: 1, review: 1, mastered: 1, dontknow: 1, total: 5 });
  });
});
