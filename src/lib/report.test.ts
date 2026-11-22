import { describe, expect, it } from "vitest";
import type { ClozeItem } from "./exam";
import { manualLine, questionReportBody, reportUrl } from "./report";
import { word } from "./test-helpers";

describe("report a translation", () => {
  const w = { ...word("access"), es: [{ pos: "n", gloss: ["acceso"] }] };

  it("turns a suggestion into a scripts/manual.ts line", () => {
    expect(manualLine(w, "es", "acceso, entrada; paso")).toBe("  'access': { es: { n: ['acceso', 'entrada', 'paso'] } },");
    expect(manualLine(w, "zh", "通路，入口")).toBe("  'access': { zh: { n: ['通路', '入口'] } },");
  });

  it("escapes quotes, and gives no line for examples or empty suggestions", () => {
    const bs = String.fromCharCode(92); // backslash
    expect(manualLine(w, "es", "it's")).toBe(`  'access': { es: { n: ['it${bs}'s'] } },`);
    expect(manualLine(w, "example", "a better sentence")).toBeUndefined();
    expect(manualLine(w, "es", " , ")).toBeUndefined();
  });

  it("opens a new GitHub issue with the word, what's shown and the fix", () => {
    const url = new URL(reportUrl(w, "es", "entrada"));
    expect(url.pathname).toBe("/GrowingRui/Mempo/issues/new");
    expect(url.searchParams.get("title")).toBe("Translation: access (Spanish)");
    const body = url.searchParams.get("body")!;
    expect(body).toContain("id `access`");
    expect(body).toContain("Español: n. acceso");
    expect(body).toContain("'access': { es: { n: ['entrada'] } },");
  });
});

describe("report an exam question", () => {
  const q: ClozeItem = { id: "b2-120", level: "B2", text: "Tickets were sold _____ in an hour.", answer: "out", others: ["off", "away", "through"], note: "Sold out = none left." };

  it("says which question it is, what was shown and what the reader chose", () => {
    const body = questionReportBody(q, "fits", "Sold off also works", "off");
    expect(body).toContain("`b2-120` (B2)");
    expect(body).toContain("Another choice also fits");
    expect(body).toContain("Tickets were sold _____ in an hour.");
    expect(body).toContain("Answer: out");
    expect(body).toContain("Other choices: off, away, through");
    expect(body).toContain("The reader chose: off");
    expect(body).toContain("Sold off also works");
  });

  it("works with no comment and no choice", () => {
    const body = questionReportBody(q, "answer", "  ");
    expect(body).toContain("(none given)");
    expect(body).not.toContain("The reader chose");
  });
});
