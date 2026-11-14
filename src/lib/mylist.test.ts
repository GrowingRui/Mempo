import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { inMyList, myListIds, toggleMyList } from "./mylist";
import { buildSession } from "./session";
import { normalizeProgress } from "./storage";
import { card, progress, TODAY, word } from "./test-helpers";

describe("My list", () => {
  it("stars a word, and a second tap takes it off", () => {
    const p = toggleMyList(progress(), "a", TODAY);
    expect(inMyList(p, "a")).toBe(true);
    expect(p.myList).toEqual({ a: TODAY });
    expect(inMyList(toggleMyList(p, "a", TODAY), "a")).toBe(false);
  });

  it("lists the most recently added first, also on the same day", () => {
    let p = toggleMyList(progress(), "old", addDays(TODAY, -3));
    p = toggleMyList(p, "x", TODAY);
    p = toggleMyList(p, "y", TODAY);
    expect(myListIds(p)).toEqual(["y", "x", "old"]);
  });

  it("practises every word on the list, weakest first", () => {
    const words = ["fine", "missed", "fresh", "due"].map((id) => word(id));
    const p = progress({
      cards: {
        fine: card({ due: addDays(TODAY, 10) }),
        missed: card({ inDontKnow: true, due: addDays(TODAY, 5) }),
        due: card({ due: TODAY }),
        other: card({ due: TODAY }), // not on the list
      },
      myList: { fine: TODAY, missed: TODAY, fresh: TODAY, due: TODAY },
    });
    expect(buildSession(words, p, "mylist", TODAY).map((w) => w.id)).toEqual(["missed", "fresh", "due", "fine"]);
  });

  it("is kept in saved progress and backups; older progress has an empty list", () => {
    expect(normalizeProgress({ cards: {}, myList: { a: TODAY, b: "yesterday", c: 5 } }).progress.myList).toEqual({ a: TODAY });
    expect(normalizeProgress({ cards: {} }).progress.myList).toEqual({});
  });
});
