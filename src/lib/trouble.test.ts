import { describe, expect, it } from "vitest";
import { answer } from "./srs";
import { buildSession } from "./session";
import { isTrouble, TROUBLE_CLEAR_STREAK, TROUBLE_LAPSES, TROUBLE_ROUND, troubleIds } from "./trouble";
import { card, progress, TODAY, word } from "./test-helpers";

describe("trouble words", () => {
  it("needs enough misses, and clears after a run of right answers", () => {
    expect(isTrouble(undefined)).toBe(false);
    expect(isTrouble(card({ lapses: TROUBLE_LAPSES - 1, streak: 0 }))).toBe(false);
    expect(isTrouble(card({ lapses: TROUBLE_LAPSES, streak: 0 }))).toBe(true);
    expect(isTrouble(card({ lapses: 9, streak: TROUBLE_CLEAR_STREAK - 1 }))).toBe(true);
    expect(isTrouble(card({ lapses: 9, streak: TROUBLE_CLEAR_STREAK }))).toBe(false);
  });

  it("lists the most missed first", () => {
    const p = progress({ cards: { a: card({ lapses: 4, streak: 0 }), b: card({ lapses: 7, streak: 0 }), c: card({ lapses: 2 }), d: card({ lapses: 5, streak: 1 }) } });
    expect(troubleIds(p)).toEqual(["b", "d", "a"]);
  });

  it("builds a session of trouble words only, at most one round, from every level", () => {
    const ids = Array.from({ length: TROUBLE_ROUND + 5 }, (_, i) => `w${i}`);
    const cards = Object.fromEntries(ids.map((id, i) => [id, card({ lapses: 4 + i, streak: 0 })]));
    cards.fine = card({ lapses: 0 });
    const words = [...ids.map((id, i) => word(id, i % 2 ? "C1" : "B2")), word("fine")];
    const s = buildSession(words, progress({ cards }), "trouble", TODAY);
    expect(s).toHaveLength(TROUBLE_ROUND);
    expect(s.map((w) => w.id)).not.toContain("fine");
    expect(s[0].id).toBe(ids[ids.length - 1]); // the most missed
  });

  it("a real miss of a learned word makes it a trouble word; three right answers on three days clear it", () => {
    // Three lapses already, and a word that was well known (memory level 4), so the next miss is a lapse.
    let p = progress({ cards: { x: card({ s: 20, d: 5, box: 4, lapses: TROUBLE_LAPSES - 1, streak: 5, lastSeen: "2026-10-01", due: "2026-10-21" }) } });
    expect(isTrouble(p.cards.x)).toBe(false);
    p = answer(p, "x", "dontknow", "2026-11-10");
    expect(p.cards.x.lapses).toBe(TROUBLE_LAPSES);
    expect(isTrouble(p.cards.x)).toBe(true);
    p = answer(p, "x", "know", "2026-11-11");
    p = answer(p, "x", "know", "2026-11-12");
    expect(isTrouble(p.cards.x)).toBe(true); // two in a row is not enough yet
    p = answer(p, "x", "know", "2026-11-13");
    expect(isTrouble(p.cards.x)).toBe(false);
  });
});
