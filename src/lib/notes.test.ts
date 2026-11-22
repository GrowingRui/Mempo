import { describe, expect, it } from "vitest";
import { cleanNote, MAX_NOTE, noteOf, setNote } from "./notes";
import { normalizeProgress } from "./storage";
import { emptyProgress } from "./storage";

describe("my notes", () => {
  it("saves, changes and removes a note", () => {
    let p = setNote(emptyProgress(), "abandon", "  ab-and-on: a band on the beach  ");
    expect(noteOf(p, "abandon")).toBe("ab-and-on: a band on the beach");
    p = setNote(p, "abandon", "new trick");
    expect(p.notes).toEqual({ abandon: "new trick" });
    p = setNote(p, "abandon", "   ");
    expect(p.notes).toEqual({});
    expect(noteOf(p, "abandon")).toBe("");
  });

  it("folds line breaks and cuts long text", () => {
    expect(cleanNote("one\n\ntwo   three")).toBe("one two three");
    expect(cleanNote("x".repeat(500))).toHaveLength(MAX_NOTE);
  });

  it("does not touch the rest of the progress", () => {
    const p = emptyProgress();
    const q = setNote(p, "a", "hi");
    expect(q.cards).toBe(p.cards);
    expect(p.notes).toEqual({});
  });

  it("is read from saved progress and backups, keeping only real text", () => {
    expect(normalizeProgress({ cards: {}, notes: { a: " hi ", b: "", c: 5, d: "   " } }).progress.notes).toEqual({ a: "hi" });
    expect(normalizeProgress({ cards: {} }).progress.notes).toEqual({});
    expect(normalizeProgress({ cards: {}, notes: "oops" }).progress.notes).toEqual({});
  });
});
