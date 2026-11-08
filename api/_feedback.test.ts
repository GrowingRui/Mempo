import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_MESSAGE, PER_HOUR, POST, emailText, parseFeedback, subject } from "./feedback";

let ipCount = 0;
/** Each call gets its own network address unless one is given, so the hourly limit doesn't leak between tests. */
const post = (body: unknown, ip = `10.0.0.${++ipCount}`) =>
  POST(
    new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("parseFeedback", () => {
  it("accepts a normal message and trims it", () => {
    expect(parseFeedback({ kind: "bug", message: "  The audio stops.  " })).toEqual({ kind: "bug", message: "The audio stops." });
  });
  it("keeps a valid email, about and details", () => {
    const f = parseFeedback({ kind: "idea", message: "Dark blue theme", email: " ana@example.com ", about: "x\ny", details: "Version: abc" });
    expect(f).toEqual({ kind: "idea", message: "Dark blue theme", email: "ana@example.com", about: "x y", details: "Version: abc" });
  });
  it("lets a word report have no message, but nothing else", () => {
    expect(parseFeedback({ kind: "word", message: "" })).toEqual({ kind: "word", message: "" });
    expect(parseFeedback({ kind: "bug", message: "   " })).toBeNull();
  });
  it("rejects bad kinds, emails and long messages", () => {
    expect(parseFeedback({ kind: "spam", message: "hi" })).toBeNull();
    expect(parseFeedback({ kind: "toString", message: "hi" })).toBeNull();
    expect(parseFeedback({ kind: "bug", message: "hi", email: "not an email" })).toBeNull();
    expect(parseFeedback({ kind: "bug", message: "hi", email: "a@b.c\nBcc: x@y.z" })).toBeNull();
    expect(parseFeedback({ kind: "bug", message: "x".repeat(MAX_MESSAGE + 1) })).toBeNull();
    expect(parseFeedback(null)).toBeNull();
    expect(parseFeedback("bug")).toBeNull();
  });
});

describe("the email", () => {
  it("has a subject from the kind and the start of the message, or the about line", () => {
    expect(subject({ kind: "bug", message: "Short one" })).toBe("[Mempo] Bug: Short one");
    expect(subject({ kind: "idea", message: "a".repeat(80) })).toBe(`[Mempo] Suggestion: ${"a".repeat(60)}…`);
    expect(subject({ kind: "word", message: "", about: "access · Chinese" })).toBe("[Mempo] Wrong word info: access · Chinese");
  });
  it("says how to answer, and ends with the details", () => {
    const text = emailText({ kind: "bug", message: "Broken", email: "ana@example.com", details: "Screen: settings" });
    expect(text).toContain("Broken");
    expect(text).toContain("Reply to: ana@example.com");
    expect(text.endsWith("Screen: settings")).toBe(true);
    expect(emailText({ kind: "bug", message: "Broken" })).toContain("No email given");
  });
});

describe("POST", () => {
  it("prints the email locally when Resend isn't set up", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await post({ kind: "bug", message: "It crashed" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(log.mock.calls[0][0]).toContain("It crashed");
  });

  it("sends through Resend, with the user's address as Reply-To", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetch = vi.fn(async () => Response.json({ id: "1" }));
    vi.stubGlobal("fetch", fetch);
    expect((await post({ kind: "idea", message: "More levels", email: "ana@example.com" })).status).toBe(200);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const sent = JSON.parse(init.body as string);
    expect(sent.to).toEqual(["xiarui091@gmail.com"]);
    expect(sent.reply_to).toBe("ana@example.com");
    expect(sent.subject).toBe("[Mempo] Suggestion: More levels");
  });

  it("reports when Resend refuses", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post({ kind: "bug", message: "x" })).status).toBe(502);
  });

  it("pretends to accept what bots send, without sending it", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await (await post({ kind: "bug", message: "Buy now", website: "http://spam" })).json()).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses bad requests", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect((await post({ kind: "bug", message: "" })).status).toBe(400);
  });

  it(`allows ${PER_HOUR} messages an hour from one address`, async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.spyOn(console, "info").mockImplementation(() => {});
    for (let i = 0; i < PER_HOUR; i++) expect((await post({ kind: "bug", message: `#${i}` }, "10.9.9.9")).status).toBe(200);
    expect((await post({ kind: "bug", message: "one more" }, "10.9.9.9")).status).toBe(429);
    expect((await post({ kind: "bug", message: "someone else" })).status).toBe(200);
  });
});
