import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST, addDays, parsePing, reportHtml, summarize, utcDay, type DayData } from "./stats";

const post = (body: unknown) => POST(new Request("http://localhost/api/stats", { method: "POST", body: JSON.stringify(body) }));
const get = (query: string) => GET(new Request(`http://localhost/api/stats${query}`));
const A = "0123456789abcdef";
const B = "fedcba9876543210";
const C = "00000000000000aa";

afterEach(() => vi.unstubAllEnvs());

describe("parsePing", () => {
  it("accepts a 16-hex id and a known event", () => {
    expect(parsePing({ id: A, event: "open" })).toEqual({ id: A, event: "open" });
    expect(parsePing({ id: A, event: "study", extra: 1 })).toEqual({ id: A, event: "study" });
  });
  it("rejects anything else", () => {
    for (const b of [null, "x", {}, { id: A }, { id: A, event: "click" }, { id: "0123456789ABCDEF", event: "open" }, { id: "abc", event: "open" }, { id: 5, event: "open" }])
      expect(parsePing(b)).toBeNull();
  });
});

describe("days", () => {
  it("adds UTC days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(utcDay(new Date("2026-11-08T23:59:59Z"))).toBe("2026-11-08");
  });
});

describe("summarize", () => {
  const today = "2026-11-20";
  const d = (n: number, x: Partial<DayData>): DayData => ({ day: addDays(today, -n), open: [], study: [], new: [], ...x });

  it("counts daily rows, returning devices and active devices", () => {
    const r = summarize([d(0, { open: [A, B], study: [A], new: [B] }), d(3, { open: [A, C] }), d(10, { open: [C] })], 3, today);
    expect(r.days).toHaveLength(30);
    expect(r.days[0]).toEqual({ day: today, open: 2, study: 1, new: 1, returning: 1 });
    expect(r.days[1]).toEqual({ day: "2026-11-19", open: 0, study: 0, new: 0, returning: 0 });
    expect(r.active7).toBe(3); // A, B, C
    expect(r.active30).toBe(3);
    expect(r.devicesEver).toBe(3);
  });

  it("measures come-back rates only for windows that are over", () => {
    const r = summarize(
      [
        // 40 days ago: A and B new. A comes back the next day and on day 20; B never does.
        d(40, { open: [A, B], new: [A, B] }),
        d(39, { open: [A] }),
        d(20, { open: [A] }),
        // 5 days ago: C new, back 2 days later. Its week isn't over, so it only counts for "next day".
        d(5, { open: [C], new: [C] }),
        d(3, { open: [C] }),
      ],
      3,
      today,
    );
    expect(r.nextDay).toEqual({ devices: 3, back: 1 }); // A yes; B no; C no (came back on day 2)
    expect(r.week).toEqual({ devices: 2, back: 1 }); // A and B only
    expect(r.month).toEqual({ devices: 2, back: 1 }); // A on day 20
  });

  it("renders a page, escaping nothing dangerous in", () => {
    const html = reportHtml(summarize([], 0, today));
    expect(html).toContain("<title>Mempo usage</title>");
    expect(html).toContain("not enough data yet");
  });
});

describe("HTTP (in memory)", () => {
  it("records pings and shows them in the report", async () => {
    vi.stubEnv("STATS_KEY", "s3cret");
    expect((await post({ id: A, event: "open" })).status).toBe(200);
    expect((await post({ id: A, event: "study" })).status).toBe(200);
    expect((await post({ id: B, event: "study" })).status).toBe(200);
    const res = await get("?key=s3cret&format=json");
    expect(res.status).toBe(200);
    const r = (await res.json()) as ReturnType<typeof summarize>;
    expect(r.devicesEver).toBe(2);
    expect(r.days[0]).toMatchObject({ open: 2, study: 2, new: 2, returning: 0 });
    const page = await get("?key=s3cret");
    expect(page.headers.get("content-type")).toContain("text/html");
  });
  it("rejects bad pings", async () => {
    expect((await post({ id: "nope", event: "open" })).status).toBe(400);
    expect((await POST(new Request("http://localhost/api/stats", { method: "POST", body: "{not json" }))).status).toBe(400);
  });
  it("needs the right key for the report", async () => {
    vi.stubEnv("STATS_KEY", "s3cret");
    expect((await get("")).status).toBe(401);
    expect((await get("?key=wrong!")).status).toBe(401);
    expect((await GET(new Request("http://localhost/api/stats", { headers: { Authorization: "Bearer s3cret" } }))).status).toBe(200);
  });
  it("falls back to CRON_SECRET, and refuses with no key set at all", async () => {
    vi.stubEnv("STATS_KEY", "");
    vi.stubEnv("CRON_SECRET", "cron");
    expect((await get("?key=cron")).status).toBe(200);
    vi.stubEnv("CRON_SECRET", "");
    expect((await get("?key=")).status).toBe(503);
  });
});
