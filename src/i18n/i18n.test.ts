import { describe, expect, it } from "vitest";
import { parseBackup } from "../lib/backup";
import { normalizeProgress } from "../lib/storage";
import { LANGS, messagesFor, tr } from "./index";
import en from "./en";
import es from "./es";
import zh from "./zh";

describe("app language setting", () => {
  it("defaults to English and keeps only known languages", () => {
    expect(normalizeProgress({}).progress.settings.lang).toBe("en");
    expect(normalizeProgress({ settings: { lang: "zh" } }).progress.settings.lang).toBe("zh");
    expect(normalizeProgress({ settings: { lang: "es" } }).progress.settings.lang).toBe("es");
    expect(normalizeProgress({ settings: { lang: "de" } }).progress.settings.lang).toBe("en");
  });
  it("has a picker entry and a table for every language", () => {
    for (const { value } of LANGS) expect(messagesFor(value).settings.title).toBeTruthy();
  });
});

describe("message tables", () => {
  it("say today / tomorrow / a date for the next review", () => {
    expect([en.when("2026-11-08", "2026-11-08"), en.when("2026-11-09", "2026-11-08")]).toEqual(["today", "tomorrow"]);
    expect([zh.when("2026-11-08", "2026-11-08"), zh.when("2026-11-09", "2026-11-08")]).toEqual(["今天", "明天"]);
    expect([es.when("2026-11-08", "2026-11-08"), es.when("2026-11-09", "2026-11-08")]).toEqual(["hoy", "mañana"]);
    expect(en.when("2026-11-10", "2026-11-08")).toMatch(/^on Tue 10 Nov/);
    expect(zh.when("2026-11-10", "2026-11-08")).toContain("11月10日");
  });
  it("use singular and plural", () => {
    expect([en.common.words(1), en.common.words(5)]).toEqual(["1 word", "5 words"]);
    expect([es.common.words(1), es.common.words(5)]).toEqual(["1 palabra", "5 palabras"]);
    expect(zh.common.words(5)).toBe("5 个词");
  });
});

describe("errors from lib code", () => {
  it("follow the current language", () => {
    expect(tr()).toBe(en); // no <LangProvider> rendered in tests: English
    expect(() => parseBackup("not json")).toThrow(en.backup.notJson);
  });
});
