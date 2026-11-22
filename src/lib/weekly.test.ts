import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { normalizeProgress } from "./storage";
import { accuracyOf, weeklySummary, weekTotals } from "./weekly";

const TODAY = "2026-11-22";
const d = (n: number) => addDays(TODAY, n);

describe("weekly summary", () => {
  const history = {
    [TODAY]: { new: 10, reviewed: 20, answers: 40, right: 30 },
    [d(-2)]: { new: 5, reviewed: 0, answers: 10, right: 5 },
    [d(-6)]: { new: 1, reviewed: 1 }, // the 7th day back counts
    [d(-7)]: { new: 100, reviewed: 100, answers: 10, right: 10 }, // last week
    [d(-9)]: { new: 3, reviewed: 4 },
  };

  it("adds up the last 7 days, today included", () => {
    const w = weekTotals(history, TODAY);
    expect(w).toMatchObject({ days: 3, new: 16, reviewed: 21, answers: 50, right: 35 });
    expect(w.best).toEqual({ day: TODAY, cards: 30 });
  });

  it("works out accuracy only from days that recorded answers", () => {
    expect(accuracyOf(weekTotals(history, TODAY))).toBe(70);
    expect(accuracyOf(weekTotals({ [TODAY]: { new: 1, reviewed: 0 } }, TODAY))).toBeUndefined();
  });

  it("compares with the 7 days before, when there was anything then", () => {
    const s = weeklySummary(history, TODAY);
    expect(s.before).toMatchObject({ days: 2, new: 103, reviewed: 104 });
    expect(weeklySummary({ [TODAY]: { new: 1, reviewed: 0 } }, TODAY).before).toBeUndefined();
  });

  it("handles an empty history", () => {
    const s = weeklySummary({}, TODAY);
    expect(s.week).toEqual({ days: 0, new: 0, reviewed: 0, answers: 0, right: 0 });
    expect(s.before).toBeUndefined();
  });

  it("is kept when progress is saved and loaded, and broken counts are dropped", () => {
    const p = normalizeProgress({ cards: {}, history: { [TODAY]: { new: 1, reviewed: 2, answers: 5, right: 9 }, [d(-1)]: { new: 1, reviewed: 0, answers: "x" } } }).progress;
    expect(p.history[TODAY]).toEqual({ new: 1, reviewed: 2, answers: 5, right: 5 }); // right can't exceed answers
    expect(p.history[d(-1)]).toEqual({ new: 1, reviewed: 0 });
  });
});
