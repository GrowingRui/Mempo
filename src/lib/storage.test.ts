import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { addDays, toDay } from "./date";
import { DEFAULT_SETTINGS, normalizeProgress } from "./storage";
import { card, TODAY } from "./test-helpers";

describe("normalizeProgress", () => {
  it("keeps valid progress as it is", () => {
    const p = { settings: { ...DEFAULT_SETTINGS, level: "C1", dailyNew: 30 }, cards: { a: card({ lastSeen: TODAY }) }, history: { [TODAY]: { new: 1, reviewed: 2 } } };
    expect(normalizeProgress(p)).toEqual({ progress: p, dropped: 0 });
  });

  it("drops broken cards and days and counts them", () => {
    const { progress, dropped } = normalizeProgress({
      cards: { ok: card(), noState: { due: TODAY }, badDue: card({ due: "tomorrow" }), notObj: 5 },
      history: { [TODAY]: { new: 1, reviewed: 0 }, "07/11/2026": { new: 1, reviewed: 0 } },
    });
    expect(Object.keys(progress.cards)).toEqual(["ok"]);
    expect(Object.keys(progress.history)).toEqual([TODAY]);
    expect(dropped).toBe(4);
  });

  it("clamps the box to 1-6 and fixes negative numbers", () => {
    const { progress } = normalizeProgress({ cards: { a: { ...card(), box: 99, streak: -2, lapses: "x" } } });
    expect(progress.cards.a).toMatchObject({ box: 6, streak: 0, lapses: 0 });
  });

  it("unknown settings fall back to the defaults", () => {
    const { progress } = normalizeProgress({ settings: { level: "A1", dailyNew: 0, swipeKnow: "up", theme: "pink" }, cards: {} });
    expect(progress.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("turns both translations back on if both were off", () => {
    const { progress } = normalizeProgress({ settings: { showZh: false, showEs: false } });
    expect(progress.settings).toMatchObject({ showZh: true, showEs: true });
  });

  it("anything that isn't an object gives empty progress", () => {
    for (const junk of [null, 42, "hi", []]) {
      expect(normalizeProgress(junk).progress).toEqual({ settings: DEFAULT_SETTINGS, cards: {}, history: {} });
    }
  });
});

describe("parseBackup", () => {
  const progress = { settings: DEFAULT_SETTINGS, cards: { a: card() }, history: {} };

  it("reads a backup file", () => {
    const text = JSON.stringify({ app: "mempo", version: 1, exportedAt: "2026-11-07T10:00:00.000Z", progress });
    expect(parseBackup(text)).toEqual({ progress, dropped: 0, exportedAt: "2026-11-07T10:00:00.000Z" });
  });

  it("also accepts bare progress (what localStorage holds)", () => {
    expect(parseBackup(JSON.stringify(progress)).progress).toEqual(progress);
  });

  it("rejects files that aren't JSON or aren't a backup", () => {
    expect(() => parseBackup("not json")).toThrow(/isn’t JSON/);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/isn’t a Mempo backup/);
  });

  it("rejects backups from a newer version of the app", () => {
    expect(() => parseBackup(JSON.stringify({ app: "mempo", version: 2, progress }))).toThrow(/newer version/);
  });
});

describe("dates", () => {
  it("toDay uses the local calendar date", () => {
    expect(toDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("addDays crosses months, years and leap days", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
