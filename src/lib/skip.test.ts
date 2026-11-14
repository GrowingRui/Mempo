import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { buildSession, upcomingNew } from "./session";
import { checkCount, checkLang, cursorAfter, markKnown, pageFrom, pickChecks, skipResult, unmarkKnown } from "./skip";
import { answer, isDue, MAX_BOX } from "./srs";
import { card, progress, TODAY, word } from "./test-helpers";

describe("checkCount", () => {
  it("asks about one in four ticked words, at least 3", () => {
    expect(checkCount(0)).toBe(0);
    expect(checkCount(2)).toBe(2);
    expect(checkCount(3)).toBe(3);
    expect(checkCount(8)).toBe(3);
    expect(checkCount(13)).toBe(4);
    expect(checkCount(20)).toBe(5);
  });
});

describe("checkLang", () => {
  it("follows the interface language when that meaning is shown, else Chinese, else Spanish", () => {
    expect(checkLang(progress({ settings: { lang: "es", showEs: true } }).settings)).toBe("es");
    expect(checkLang(progress({ settings: { lang: "en", showZh: true, showEs: true } }).settings)).toBe("zh");
    expect(checkLang(progress({ settings: { lang: "zh", showZh: false, showEs: true } }).settings)).toBe("es");
  });
});

describe("pickChecks", () => {
  it("skips Spanish look-alikes and words without a meaning", () => {
    const same = { ...word("secular"), es: [{ pos: "adj", gloss: ["secular"] }] };
    const none = { ...word("empty"), es: [] };
    const picked = pickChecks([same, none, word("a"), word("b")], "es");
    expect(picked.map((w) => w.id).sort()).toEqual(["a", "b"]);
  });
});

describe("skipResult", () => {
  const ticked = ["a", "b", "c", "d", "e", "f"];

  it("passed: skips every ticked word except the ones answered wrong", () => {
    const r = skipResult(ticked, { a: true, b: true, c: true, d: true, e: false });
    expect(r.passed).toBe(true);
    expect(r.skip).toEqual(["a", "b", "c", "d", "f"]);
    expect(r.keep).toEqual(["e"]);
    expect([r.right, r.asked]).toEqual([4, 5]);
  });

  it("failed: skips only the words answered right", () => {
    const r = skipResult(ticked, { a: true, b: false, c: true });
    expect(r.passed).toBe(false);
    expect(r.skip).toEqual(["a", "c"]);
    expect(r.keep).toEqual(["b", "d", "e", "f"]);
  });

  it("nothing could be asked: trusts the ticks", () => {
    expect(skipResult(["a"], {}).skip).toEqual(["a"]);
  });
});

describe("markKnown", () => {
  it("puts new words in the last box, due in two months, without counting as study", () => {
    const p = markKnown(progress(), ["a"], TODAY);
    expect(p.cards.a).toMatchObject({ state: "review", box: MAX_BOX, due: addDays(TODAY, 60), inDontKnow: false });
    expect(p.cards.a.lastSeen).toBeUndefined();
    expect(p.history).toEqual({});
    expect(isDue(p.cards.a, TODAY)).toBe(false);
    expect(isDue(p.cards.a, addDays(TODAY, 60))).toBe(true);
  });

  it("leaves words that already have progress alone", () => {
    const existing = card({ box: 1, inDontKnow: true });
    const p = markKnown(progress({ cards: { a: existing } }), ["a"], TODAY);
    expect(p.cards.a).toBe(existing);
  });

  it("the check-in: Know makes it mastered, Don't know sends it back to study", () => {
    const p = markKnown(progress(), ["a"], TODAY);
    const later = addDays(TODAY, 60);
    expect(answer(p, "a", "know", later).cards.a.state).toBe("mastered");
    expect(answer(p, "a", "dontknow", later).cards.a).toMatchObject({ box: 1, inDontKnow: true, lapses: 1 });
  });

  it("skipped words no longer come up as new, and undo brings them back", () => {
    const words = ["a", "b", "c", "d"].map((id) => word(id));
    const p = progress({ settings: { dailyNew: 10 } });
    const first = upcomingNew(words, p).map((w) => w.id);
    const skipped = markKnown(p, first.slice(0, 2), TODAY);
    expect(upcomingNew(words, skipped).map((w) => w.id)).toEqual(first.slice(2));
    expect(buildSession(words, skipped, "today", TODAY).map((w) => w.id)).toEqual(first.slice(2));
    expect(unmarkKnown(skipped, first.slice(0, 2))).toEqual(p);
  });
});

describe("pageFrom", () => {
  const words = Array.from({ length: 7 }, (_, i) => word(`w${i}`));
  const upcoming = upcomingNew(words, progress());
  const ids = (ws: { id: string }[]) => ws.map((w) => w.id);

  it("starts at the beginning, then carries on after the last page instead of repeating unticked words", () => {
    const first = pageFrom(upcoming, 0, 3);
    expect(ids(first)).toEqual(ids(upcoming.slice(0, 3)));
    // Some words of the first page were skipped (no longer upcoming), the rest stay new: the next page still moves on.
    const after = upcomingNew(words, markKnown(progress(), [first[0].id], TODAY));
    expect(ids(pageFrom(after, cursorAfter(first), 3))).toEqual(ids(upcoming.slice(3, 6)));
  });

  it("starts over at the end of the level with the words still new", () => {
    const last = pageFrom(upcoming, cursorAfter(upcoming.slice(0, 6)), 3);
    expect(ids(last)).toEqual(ids(upcoming.slice(6)));
    expect(ids(pageFrom(upcoming, cursorAfter(last), 3))).toEqual(ids(upcoming.slice(0, 3)));
  });
});
