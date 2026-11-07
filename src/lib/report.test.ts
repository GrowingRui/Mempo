import { describe, expect, it } from "vitest";
import { manualLine, reportUrl } from "./report";
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
