import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./date";
import { first, retrievability } from "./fsrs";
import { answer, boxFor, isDue, MASTERED_AT, MAX_INTERVAL, memoryOf, nextReview, statusOf } from "./srs";
import { card, progress, TODAY } from "./test-helpers";
import type { Progress } from "./types";

const TOMORROW = addDays(TODAY, 1);

describe("answer: brand-new words", () => {
  it("'know' on a new word counts as Easy: due in about 8 days", () => {
    const p = answer(progress(), "w", "know", TODAY);
    expect(p.cards.w).toMatchObject({ state: "review", s: 8.3, d: 1, box: 3, due: addDays(TODAY, 8), streak: 1, inDontKnow: false, lastSeen: TODAY });
  });

  it("'don't know' on a new word: learning, due tomorrow, on the Don't know list, no lapse", () => {
    const p = answer(progress(), "w", "dontknow", TODAY);
    expect(p.cards.w).toMatchObject({ state: "learning", box: 1, s: 0.21, due: TOMORROW, streak: 0, lapses: 0, inDontKnow: true });
  });

  it("'not sure' on a new word: learning, due tomorrow, NOT on the Don't know list", () => {
    const p = answer(progress(), "w", "unsure", TODAY);
    expect(p.cards.w).toMatchObject({ state: "learning", box: 1, due: TOMORROW, inDontKnow: false });
  });

  it("counts a new word in today's history", () => {
    const p = answer(progress(), "w", "dontknow", TODAY);
    expect(p.history[TODAY]).toEqual({ new: 1, reviewed: 0 });
  });
});

describe("FSRS formulas", () => {
  it("the chance of remembering is 90 % after S days and falls with time", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(30, 10)).toBeLessThan(retrievability(20, 10));
  });

  it("first answers: harder grades give lower stability and higher difficulty", () => {
    const [again, hard, good, easy] = ([1, 2, 3, 4] as const).map(first);
    expect(again.s).toBeLessThan(hard.s);
    expect(hard.s).toBeLessThan(good.s);
    expect(good.s).toBeLessThan(easy.s);
    expect(again.d).toBeGreaterThan(good.d);
  });
});

describe("answer: FSRS scheduling", () => {
  /** Answers "know" on each due day and returns the waits between reviews. */
  function waits(start: Progress, n: number): number[] {
    let p = start;
    let day = TODAY;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      p = answer(p, "w", "know", day);
      out.push(daysBetween(day, p.cards.w.due));
      day = p.cards.w.due;
    }
    return out;
  }

  it("each 'know' on time makes the next wait longer", () => {
    const w = waits(answer(progress(), "w", "dontknow", addDays(TODAY, -1)), 6);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThan(w[i - 1]);
    expect(w[0]).toBeLessThanOrEqual(3);
  });

  it("a word that's easy for you needs fewer reviews than one you missed", () => {
    const easy = waits(progress(), 3);
    const hard = waits(answer(progress(), "w", "dontknow", addDays(TODAY, -1)), 3);
    expect(easy[2]).toBeGreaterThan(hard[2] * 2);
  });

  it("knowing a word you were late to review grows it more than knowing it early", () => {
    const base = { s: 10, d: 5, box: 3, lastSeen: addDays(TODAY, -10) };
    const onTime = answer(progress({ cards: { w: card(base) } }), "w", "know", TODAY).cards.w;
    const late = answer(progress({ cards: { w: card({ ...base, lastSeen: addDays(TODAY, -30) }) } }), "w", "know", TODAY).cards.w;
    expect(late.s!).toBeGreaterThan(onTime.s!);
  });

  it("waits are at most MAX_INTERVAL days", () => {
    const p = answer(progress({ cards: { w: card({ s: 2000, d: 1, box: 6, lastSeen: addDays(TODAY, -900) }) } }), "w", "know", TODAY);
    expect(daysBetween(TODAY, p.cards.w.due)).toBe(MAX_INTERVAL);
  });

  it("'know' that makes a card stick for MASTERED_AT days makes it mastered", () => {
    const p = answer(progress({ cards: { w: card({ s: 150, d: 2, box: 6, lastSeen: addDays(TODAY, -150) }) } }), "w", "know", TODAY);
    expect(p.cards.w.s!).toBeGreaterThanOrEqual(MASTERED_AT);
    expect(p.cards.w.state).toBe("mastered");
  });

  it("'not sure' is due tomorrow, makes the word harder, and doesn't grow its stability", () => {
    const p = answer(progress({ cards: { w: card({ s: 14, d: 4, box: 4, streak: 3, lastSeen: addDays(TODAY, -14) }) } }), "w", "unsure", TODAY);
    expect(p.cards.w).toMatchObject({ s: 14, box: 4, due: TOMORROW, streak: 0, inDontKnow: false });
    expect(p.cards.w.d!).toBeGreaterThan(4);
  });

  it("'don't know' drops the stability, back to level 1, due tomorrow", () => {
    const p = answer(progress({ cards: { w: card({ s: 40, d: 3, box: 5, lastSeen: addDays(TODAY, -40) }) } }), "w", "dontknow", TODAY);
    expect(p.cards.w).toMatchObject({ box: 1, state: "learning", due: TOMORROW, inDontKnow: true });
    expect(p.cards.w.s!).toBeLessThan(10);
    expect(p.cards.w.d!).toBeGreaterThan(3);
  });

  it("the level shown follows the stability", () => {
    expect([0.2, 1, 3, 7, 14, 30, 60, 500].map(boxFor)).toEqual([1, 1, 2, 3, 4, 5, 6, 6]);
  });
});

describe("cards saved before FSRS", () => {
  it("get their stability from the box and a difficulty from their lapses", () => {
    expect(memoryOf(card({ box: 4 })).s).toBe(14);
    expect(memoryOf(card({ box: 1 })).s).toBe(1);
    expect(memoryOf(card({ box: 3, lapses: 2 })).d).toBeGreaterThan(memoryOf(card({ box: 3 })).d);
    expect(memoryOf(card({ box: 3, s: 9, d: 4 }))).toEqual({ s: 9, d: 4 });
  });

  it("carry on from where they were: a box 4 card known on time waits longer than 14 days", () => {
    const p = answer(progress({ cards: { w: card({ box: 4, lastSeen: addDays(TODAY, -14) }) } }), "w", "know", TODAY);
    expect(daysBetween(TODAY, p.cards.w.due)).toBeGreaterThan(14);
    expect(p.cards.w.s).toBeDefined();
  });

  it("a card without lastSeen is treated as reviewed on time", () => {
    const p = answer(progress({ cards: { w: card({ box: 6 }) } }), "w", "know", TODAY);
    expect(p.cards.w.state).toBe("mastered");
  });
});

describe("answer: history", () => {
  it("counts a review (not a new word) in history", () => {
    const p = answer(progress({ cards: { w: card() } }), "w", "know", TODAY);
    expect(p.history[TODAY]).toEqual({ new: 0, reviewed: 1 });
  });
});

describe("answer: lapses", () => {
  it("'don't know' on a card in box 2+ counts a lapse", () => {
    const p = answer(progress({ cards: { w: card({ box: 3, lapses: 1 }) } }), "w", "dontknow", TODAY);
    expect(p.cards.w.lapses).toBe(2);
  });

  it("'don't know' on a box 1 card is not a lapse", () => {
    const p = answer(progress({ cards: { w: card({ box: 1 }) } }), "w", "dontknow", TODAY);
    expect(p.cards.w.lapses).toBe(0);
  });

  it("'not sure' is never a lapse", () => {
    const p = answer(progress({ cards: { w: card({ box: 4 }) } }), "w", "unsure", TODAY);
    expect(p.cards.w.lapses).toBe(0);
  });
});

describe("answer: only the first answer of the day moves a card up", () => {
  it("a second 'know' on the same day changes nothing", () => {
    let p = answer(progress({ cards: { w: card({ box: 2 }) } }), "w", "know", TODAY);
    const after = p.cards.w;
    p = answer(p, "w", "know", TODAY);
    expect(p.cards.w).toEqual(after);
  });

  it("missing a card and then knowing it later the same day keeps it at level 1, due tomorrow", () => {
    let p = answer(progress({ cards: { w: card({ box: 4 }) } }), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", TODAY);
    expect(p.cards.w).toMatchObject({ box: 1, due: TOMORROW, inDontKnow: true });
  });

  it("a wrong answer later the same day still counts", () => {
    let p = answer(progress({ cards: { w: card({ box: 2 }) } }), "w", "know", TODAY);
    p = answer(p, "w", "dontknow", TODAY);
    expect(p.cards.w).toMatchObject({ box: 1, inDontKnow: true });
  });

  it("seeing a card twice in one day counts it in history once", () => {
    let p = answer(progress({ cards: { w: card() } }), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", TODAY);
    expect(p.history[TODAY]).toEqual({ new: 0, reviewed: 1 });
  });

  it("a new word answered twice counts as 1 new, 0 reviews", () => {
    let p = answer(progress(), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", TODAY);
    expect(p.history[TODAY]).toEqual({ new: 1, reviewed: 0 });
  });
});

describe("answer: leaving the Don't know list", () => {
  it("needs 2 'know' answers on 2 different days", () => {
    let p = answer(progress(), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", addDays(TODAY, 1));
    expect(p.cards.w.inDontKnow).toBe(true);
    p = answer(p, "w", "know", addDays(TODAY, 2));
    expect(p.cards.w.inDontKnow).toBe(false);
  });

  it("'not sure' in between resets the run", () => {
    let p = answer(progress(), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", addDays(TODAY, 1));
    p = answer(p, "w", "unsure", addDays(TODAY, 2));
    expect(p.cards.w.inDontKnow).toBe(true);
    p = answer(p, "w", "know", addDays(TODAY, 3));
    expect(p.cards.w.inDontKnow).toBe(true);
    p = answer(p, "w", "know", addDays(TODAY, 4));
    expect(p.cards.w.inDontKnow).toBe(false);
  });

  it("'know' on the same day as the miss does not count towards leaving", () => {
    let p = answer(progress(), "w", "dontknow", TODAY);
    p = answer(p, "w", "know", TODAY);
    p = answer(p, "w", "know", addDays(TODAY, 1));
    expect(p.cards.w.inDontKnow).toBe(true);
  });
});

describe("answer: does not touch other data", () => {
  it("returns a new object and leaves the input alone", () => {
    const before = progress({ cards: { w: card({ box: 2 }) } });
    const copy = structuredClone(before);
    answer(before, "w", "know", TODAY);
    expect(before).toEqual(copy);
  });
});

describe("isDue", () => {
  it("is due on or after the due date", () => {
    expect(isDue(card({ due: TODAY }), TODAY)).toBe(true);
    expect(isDue(card({ due: addDays(TODAY, -3) }), TODAY)).toBe(true);
    expect(isDue(card({ due: TOMORROW }), TODAY)).toBe(false);
  });

  it("is not due again once seen today", () => {
    expect(isDue(card({ due: TODAY, lastSeen: TODAY }), TODAY)).toBe(false);
  });

  it("mastered cards are never due", () => {
    expect(isDue(card({ state: "mastered", due: "2020-01-01" }), TODAY)).toBe(false);
  });
});

describe("statusOf", () => {
  it("shows the right status for the word list", () => {
    expect(statusOf(undefined)).toBe("new");
    expect(statusOf(card({ state: "learning" }))).toBe("learning");
    expect(statusOf(card({ state: "review" }))).toBe("review");
    expect(statusOf(card({ state: "mastered" }))).toBe("mastered");
    expect(statusOf(card({ state: "review", inDontKnow: true }))).toBe("dontknow");
  });
});

describe("nextReview", () => {
  it("finds the earliest upcoming day and how many cards are due then", () => {
    const p = progress({
      cards: {
        a: card({ due: addDays(TODAY, 3) }),
        b: card({ due: addDays(TODAY, 3) }),
        c: card({ due: addDays(TODAY, 7) }),
        d: card({ due: TODAY }), // due now: not "upcoming"
        e: card({ state: "mastered", due: TOMORROW }),
      },
    });
    expect(nextReview(p, TODAY)).toEqual({ day: addDays(TODAY, 3), count: 2 });
  });

  it("a card already seen today but still overdue counts for tomorrow", () => {
    const p = progress({ cards: { a: card({ due: TODAY, lastSeen: TODAY }) } });
    expect(nextReview(p, TODAY)).toEqual({ day: TOMORROW, count: 1 });
  });

  it("is undefined with no cards", () => {
    expect(nextReview(progress(), TODAY)).toBeUndefined();
  });
});
