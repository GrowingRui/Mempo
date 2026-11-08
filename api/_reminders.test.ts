// Tests for api/reminders.ts. The "_" keeps Vercel from turning this file into a function.
import { describe, expect, it } from "vitest";
import { dueDay, idOf, localNow, message, parseReminder, type Reminder } from "./reminders";

const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" } };
const rem = (r: Partial<Reminder> = {}): Reminder => ({ sub, time: "19:00", tz: "Europe/Madrid", ...r });
// 8 Nov 2026: Madrid is UTC+1, Shanghai UTC+8, New York UTC-5.
const at = (iso: string) => new Date(iso);

describe("parseReminder", () => {
  it("accepts a good body and keeps only known fields", () => {
    const r = parseReminder({ subscription: { ...sub, expirationTime: null }, time: "07:30", tz: "Asia/Shanghai", lastStudied: "2026-11-07", streak: 3, extra: 1 });
    expect(r).toEqual({ sub, time: "07:30", tz: "Asia/Shanghai", lastStudied: "2026-11-07", streak: 3 });
  });
  it("rejects bad input", () => {
    expect(parseReminder(null)).toBeNull();
    expect(parseReminder({ subscription: sub, time: "25:00", tz: "Europe/Madrid" })).toBeNull();
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "Mars/Olympus" })).toBeNull();
    expect(parseReminder({ subscription: { ...sub, endpoint: "http://x" }, time: "19:00", tz: "UTC" })).toBeNull();
    expect(parseReminder({ subscription: { endpoint: sub.endpoint }, time: "19:00", tz: "UTC" })).toBeNull();
  });
  it("drops a broken lastStudied or streak but keeps the reminder", () => {
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "UTC", lastStudied: "yesterday", streak: -1 })).toEqual({ sub, time: "19:00", tz: "UTC" });
  });
  it("keeps a known app language, leaves English and unknown ones out", () => {
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "UTC", lang: "zh" })?.lang).toBe("zh");
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "UTC", lang: "es" })?.lang).toBe("es");
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "UTC", lang: "en" })).not.toHaveProperty("lang");
    expect(parseReminder({ subscription: sub, time: "19:00", tz: "UTC", lang: "fr" })).not.toHaveProperty("lang");
  });
});

describe("localNow", () => {
  it("gives the date and time in the user's time zone", () => {
    expect(localNow(at("2026-11-08T18:30:00Z"), "Europe/Madrid")).toEqual({ day: "2026-11-08", minutes: 19 * 60 + 30 });
    expect(localNow(at("2026-11-08T18:30:00Z"), "Asia/Shanghai")).toEqual({ day: "2026-11-09", minutes: 2 * 60 + 30 });
    expect(localNow(at("2026-11-08T03:00:00Z"), "America/New_York")).toEqual({ day: "2026-11-07", minutes: 22 * 60 });
  });
  it("shows midnight as 00:00, not 24:00", () => {
    expect(localNow(at("2026-11-08T23:00:00Z"), "Europe/Madrid").minutes).toBe(0);
  });
});

describe("dueDay", () => {
  it("is due from the chosen time until 3 hours later", () => {
    expect(dueDay(rem(), at("2026-11-08T17:59:00Z"))).toBeNull(); // 18:59 in Madrid
    expect(dueDay(rem(), at("2026-11-08T18:00:00Z"))).toBe("2026-11-08");
    expect(dueDay(rem(), at("2026-11-08T18:20:00Z"))).toBe("2026-11-08"); // scheduler running late
    expect(dueDay(rem(), at("2026-11-08T21:00:00Z"))).toBe("2026-11-08");
    expect(dueDay(rem(), at("2026-11-08T21:01:00Z"))).toBeNull(); // too late, skip today
  });
  it("uses each user's own time zone", () => {
    expect(dueDay(rem({ tz: "Asia/Shanghai" }), at("2026-11-08T11:05:00Z"))).toBe("2026-11-08"); // 19:05 in Shanghai
    expect(dueDay(rem({ tz: "Asia/Shanghai" }), at("2026-11-08T18:05:00Z"))).toBeNull(); // 02:05 next day
  });
  it("sends once a day", () => {
    expect(dueDay(rem({ lastSent: "2026-11-08" }), at("2026-11-08T18:15:00Z"))).toBeNull();
    expect(dueDay(rem({ lastSent: "2026-11-07" }), at("2026-11-08T18:15:00Z"))).toBe("2026-11-08");
  });
  it("skips days already studied", () => {
    expect(dueDay(rem({ lastStudied: "2026-11-08" }), at("2026-11-08T18:15:00Z"))).toBeNull();
    expect(dueDay(rem({ lastStudied: "2026-11-07" }), at("2026-11-08T18:15:00Z"))).toBe("2026-11-08");
  });
  it("handles a late time without crossing midnight wrongly", () => {
    const late = rem({ time: "23:00" });
    expect(dueDay(late, at("2026-11-08T22:30:00Z"))).toBe("2026-11-08"); // 23:30
    expect(dueDay(late, at("2026-11-08T23:30:00Z"))).toBeNull(); // 00:30 next day: before 23:00 there
  });
});

describe("message", () => {
  it("mentions a streak that's still alive", () => {
    expect(message(rem({ lastStudied: "2026-11-07", streak: 5 }), "2026-11-08").title).toBe("Keep your 5-day streak going 🔥");
  });
  it("works across a month and year end", () => {
    expect(message(rem({ lastStudied: "2026-12-31", streak: 2 }), "2027-01-01").title).toContain("2-day streak");
  });
  it("is a plain nudge when the streak is already broken or never started", () => {
    expect(message(rem({ lastStudied: "2026-11-05", streak: 5 }), "2026-11-08").title).toBe("Time for your words ✨");
    expect(message(rem(), "2026-11-08").title).toBe("Time for your words ✨");
  });
  it("speaks the app's language", () => {
    expect(message(rem({ lang: "zh", lastStudied: "2026-11-07", streak: 5 }), "2026-11-08").title).toBe("保持你的 5 天连续学习 🔥");
    expect(message(rem({ lang: "es" }), "2026-11-08").title).toBe("Hora de tus palabras ✨");
    expect(message(rem({ lang: "es", lastStudied: "2026-11-07", streak: 1 }), "2026-11-08").title).toBe("Mantén tu racha de 1 día 🔥");
  });
});

describe("idOf", () => {
  it("is short, stable and different per address", async () => {
    const a = await idOf(sub.endpoint);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await idOf(sub.endpoint)).toBe(a);
    expect(await idOf(sub.endpoint + "x")).not.toBe(a);
  });
});
