import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { answer, INTERVALS, isDue, MAX_BOX, nextReview, statusOf } from "./srs";
import { card, progress, TODAY } from "./test-helpers";

const TOMORROW = addDays(TODAY, 1);

describe("answer: brand-new words", () => {
  it("'know' on a new word starts it in box 2, due in 3 days", () => {
    const p = answer(progress(), "w", "know", TODAY);
    expect(p.cards.w).toMatchObject({ state: "review", box: 2, due: addDays(TODAY, 3), streak: 1, inDontKnow: false, lastSeen: TODAY });
  });

  it("'don't know' on a new word: box 1, due tomorrow, on the Don't know list, no lapse", () => {
    const p = answer(progress(), "w", "dontknow", TODAY);
    expect(p.cards.w).toMatchObject({ state: "learning", box: 1, due: TOMORROW, streak: 0, lapses: 0, inDontKnow: true });
  });

  it("'not sure' on a new word: box 1, due tomorrow, NOT on the Don't know list", () => {
    const p = answer(progress(), "w", "unsure", TODAY);
    expect(p.cards.w).toMatchObject({ state: "learning", box: 1, due: TOMORROW, inDontKnow: false });
  });

  it("counts a new word in today's history", () => {
    const p = answer(progress(), "w", "dontknow", TODAY);
    expect(p.history[TODAY]).toEqual({ new: 1, reviewed: 0 });
  });
});

describe("answer: Leitner boxes", () => {
  it.each(INTERVALS.slice(0, -1).map((_, i) => i + 1))("'know' in box %i moves up one box with the right interval", (box) => {
    const p = answer(progress({ cards: { w: card({ box, lastSeen: "2026-01-01" }) } }), "w", "know", TODAY);
    expect(p.cards.w.box).toBe(box + 1);
    expect(p.cards.w.due).toBe(addDays(TODAY, INTERVALS[box]));
    expect(p.cards.w.state).toBe("review");
  });

  it("intervals are 1, 3, 7, 14, 30, 60 days", () => {
    expect(INTERVALS).toEqual([1, 3, 7, 14, 30, 60]);
  });

  it("'know' in the last box makes the card mastered", () => {
    const p = answer(progress({ cards: { w: card({ box: MAX_BOX }) } }), "w", "know", TODAY);
    expect(p.cards.w.state).toBe("mastered");
  });

  it("'not sure' moves down one box (never below 1) and is due tomorrow", () => {
    let p = answer(progress({ cards: { w: card({ box: 4, streak: 3 }) } }), "w", "unsure", TODAY);
    expect(p.cards.w).toMatchObject({ box: 3, due: TOMORROW, streak: 0 });
    p = answer(progress({ cards: { w: card({ box: 1 }) } }), "w", "unsure", TODAY);
    expect(p.cards.w.box).toBe(1);
  });

  it("'don't know' always goes back to box 1", () => {
    const p = answer(progress({ cards: { w: card({ box: 5 }) } }), "w", "dontknow", TODAY);
    expect(p.cards.w).toMatchObject({ box: 1, state: "learning", due: TOMORROW, inDontKnow: true });
  });

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

  it("missing a card and then knowing it later the same day keeps it in box 1, due tomorrow", () => {
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
