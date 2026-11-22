import { describe, expect, it } from "vitest";
import { countdownPlan } from "./countdown";

const TODAY = "2026-11-22";

describe("exam countdown", () => {
  it("leaves the last week for revision", () => {
    // 50 days to go: 43 days of new words. 860 words left / 43 = 20 a day.
    expect(countdownPlan("2027-01-11", TODAY, 860, 20)).toEqual({ status: "ontrack", days: 50, need: 20 });
    expect(countdownPlan("2027-01-11", TODAY, 861, 20)).toMatchObject({ status: "behind", need: 21 });
  });

  it("uses every day when the exam is close", () => {
    expect(countdownPlan("2026-12-02", TODAY, 100, 5)).toEqual({ status: "behind", days: 10, need: 10 });
    expect(countdownPlan(TODAY, TODAY, 30, 50)).toEqual({ status: "ontrack", days: 0, need: 30 }); // exam today: at least 1 day
  });

  it("knows when the level is finished or the date has passed", () => {
    expect(countdownPlan("2027-01-11", TODAY, 0, 20)).toEqual({ status: "done", days: 50 });
    expect(countdownPlan("2026-11-01", TODAY, 500, 20)).toEqual({ status: "past", days: -21 });
  });
});
