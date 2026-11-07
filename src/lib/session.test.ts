import { afterEach, describe, expect, it, vi } from "vitest";
import { addDays } from "./date";
import { buildSession, newWordsLeftToday, requeue, sessionParts } from "./session";
import { card, progress, TODAY, word } from "./test-helpers";

const ids = (ws: { id: string }[]) => ws.map((w) => w.id);

describe("newWordsLeftToday", () => {
  it("is the daily goal minus new words already done today", () => {
    expect(newWordsLeftToday(progress({ settings: { dailyNew: 20 } }), TODAY)).toBe(20);
    const p = progress({ settings: { dailyNew: 20 }, history: { [TODAY]: { new: 15, reviewed: 40 } } });
    expect(newWordsLeftToday(p, TODAY)).toBe(5);
  });

  it("never goes below 0", () => {
    const p = progress({ settings: { dailyNew: 10 }, history: { [TODAY]: { new: 25, reviewed: 0 } } });
    expect(newWordsLeftToday(p, TODAY)).toBe(0);
  });

  it("yesterday's new words don't count against today", () => {
    const p = progress({ history: { [addDays(TODAY, -1)]: { new: 20, reviewed: 0 } } });
    expect(newWordsLeftToday(p, TODAY)).toBe(20);
  });
});

describe("buildSession: today", () => {
  const words = [word("r1"), word("r2"), word("dk"), word("n1"), word("n2"), word("n3"), word("c1word", "C1"), word("later")];
  const p = progress({
    settings: { level: "B2", dailyNew: 2 },
    cards: {
      r1: card({ due: addDays(TODAY, -2) }),
      r2: card({ due: TODAY }),
      dk: card({ box: 1, due: addDays(TODAY, 5), inDontKnow: true }),
      later: card({ due: addDays(TODAY, 4) }),
    },
  });

  it("puts due reviews first (oldest first), then Don't know words, then new words", () => {
    const s = ids(buildSession(words, p, "today", TODAY));
    expect(s.slice(0, 3)).toEqual(["r1", "r2", "dk"]);
    expect(s).toHaveLength(5);
  });

  it("takes only as many new words as the daily goal allows, from the chosen level only", () => {
    const fresh = ids(buildSession(words, p, "today", TODAY)).slice(3);
    expect(fresh).toHaveLength(2);
    fresh.forEach((id) => expect(["n1", "n2", "n3"]).toContain(id));
  });

  it("gives the same new words in the same order on every visit", () => {
    expect(ids(buildSession(words, p, "today", TODAY))).toEqual(ids(buildSession(words, p, "today", TODAY)));
  });

  it("does not include cards that aren't due yet", () => {
    expect(ids(buildSession(words, p, "today", TODAY))).not.toContain("later");
  });

  it("a due card on the Don't know list appears once, in the Don't know part", () => {
    const q = progress({ settings: { dailyNew: 0 }, cards: { dk: card({ due: TODAY, inDontKnow: true }) } });
    expect(ids(buildSession(words, q, "today", TODAY))).toEqual(["dk"]);
  });

  it("Don't know words already practised today are left out", () => {
    const q = progress({ settings: { dailyNew: 0 }, cards: { dk: card({ inDontKnow: true, lastSeen: TODAY, due: addDays(TODAY, 1) }) } });
    expect(buildSession(words, q, "today", TODAY)).toEqual([]);
  });

  it("skips progress for words missing from the word data", () => {
    const q = progress({ settings: { dailyNew: 0 }, cards: { ghost: card({ due: TODAY }) } });
    expect(buildSession(words, q, "today", TODAY)).toEqual([]);
  });
});

describe("buildSession: review and dontknow modes", () => {
  const words = [word("a"), word("b"), word("c")];
  const p = progress({
    cards: {
      a: card({ due: TODAY }),
      b: card({ due: TODAY, inDontKnow: true }),
      c: card({ due: addDays(TODAY, 3), inDontKnow: true }),
    },
  });

  it("review: only due cards (including due Don't know cards), no new words", () => {
    expect(ids(buildSession(words, p, "review", TODAY)).sort()).toEqual(["a", "b"]);
  });

  it("dontknow: the whole list, due or not", () => {
    expect(ids(buildSession(words, p, "dontknow", TODAY)).sort()).toEqual(["b", "c"]);
  });
});

describe("sessionParts", () => {
  it("counts all due cards and the whole Don't know list", () => {
    const p = progress({
      cards: {
        a: card({ due: TODAY }),
        b: card({ due: TODAY, inDontKnow: true }),
        c: card({ due: addDays(TODAY, 3), inDontKnow: true }),
      },
    });
    const parts = sessionParts(p, TODAY);
    expect(parts.reviews).toEqual(["a"]);
    expect(parts.dontKnow.sort()).toEqual(["b", "c"]);
    expect(parts.allDue).toBe(2);
    expect(parts.dontKnowTotal).toBe(2);
  });
});

describe("requeue", () => {
  afterEach(() => vi.restoreAllMocks());
  const queue = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"];

  it("'know' leaves the queue as it is", () => {
    expect(requeue(queue, 0, "a", "know")).toBe(queue);
  });

  it.each([
    [0, 3],
    [0.999, 5],
  ])("'don't know' comes back 3-5 cards later (random %f → gap %i)", (r, gap) => {
    vi.spyOn(Math, "random").mockReturnValue(r);
    const q = requeue(queue, 0, "a", "dontknow");
    expect(q).toHaveLength(queue.length + 1);
    expect(q.indexOf("a", 1)).toBe(1 + gap);
  });

  it.each([
    [0, 6],
    [0.999, 9],
  ])("'not sure' comes back 6-9 cards later (random %f → gap %i)", (r, gap) => {
    vi.spyOn(Math, "random").mockReturnValue(r);
    const q = requeue(queue, 0, "a", "unsure");
    expect(q.indexOf("a", 1)).toBe(1 + gap);
  });

  it("goes to the end when the queue is too short", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    expect(requeue(["a", "b"], 0, "a", "unsure")).toEqual(["a", "b", "a"]);
  });
});
