// "Send feedback": suggestions and problem reports from inside the app. Runs as a Vercel serverless function at /api/feedback.
//
//   POST { kind: "bug" | "idea" | "word" | "other", message, email?, about?, details?, website? }
//        → { ok: true }, or { error } with 400 (bad form), 429 (too many), 502/503 (couldn't send)
//
// The message is emailed to the developer through Resend (resend.com). If the user gives an email address, it
// becomes Reply-To, so pressing Reply answers them. "details" are filled in by the app (version, device, screen,
// the word), so problems can be reproduced without asking back. Nothing is stored except short-lived counters.
//
// Spam protection: "website" is a hidden trap field that only bots fill in (they get a fake "ok"); at most
// 5 messages per hour from one network address (counted under "mempo:feedback:<hash>" in the shared Upstash Redis,
// the address itself is never stored) and 100 a day in total, well inside Resend's free 3,000 a month.
//
// Settings (Vercel → Settings → Environment Variables, and .env.local):
//   RESEND_API_KEY      from resend.com → API Keys
//   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*)   same database as the reminders
// Running locally without RESEND_API_KEY, the email is printed in the terminal instead of sent.
//
// Only erasable TypeScript here: `npm run preview` loads this file with Node's own type stripping.

const PREFIX = "mempo:feedback:"; // prefixed: the database may be shared with other projects
const TO = ["xiarui091", "gmail.com"].join("@"); // same as site.feedbackMail
// Resend's test sender: delivers to the Resend account's own address without verifying a domain.
const FROM = "Mempo feedback <onboarding@resend.dev>";

export const KINDS = { bug: "Bug", idea: "Suggestion", word: "Wrong word info", other: "Other" } as const;
export type Kind = keyof typeof KINDS;
export const MAX_MESSAGE = 4000;
export const MAX_DETAILS = 6000;
export const PER_HOUR = 5;
export const PER_DAY = 100;

export interface Feedback {
  kind: Kind;
  message: string;
  email?: string;
  /** Short subject addition, e.g. "access · Chinese" for a word report. */
  about?: string;
  /** Filled in by the app: version, device, screen, word… */
  details?: string;
}

// ---------- pure logic (tested in _feedback.test.ts) ----------

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
// Line breaks and other control characters, which have no place in a subject or a single-line field.
const CONTROL = /[\u0000-\u001f\u007f]+/g;
const oneLine = (s: string) => s.replace(CONTROL, " ").trim();

/** Checks what the app sent. Returns null if anything looks wrong. */
export function parseFeedback(body: unknown): Feedback | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.kind !== "string" || !Object.hasOwn(KINDS, b.kind)) return null;
  const kind = b.kind as Kind;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length > MAX_MESSAGE) return null;
  // A word report can be just "this is wrong" (the word and what's shown come in the details); anything else needs words.
  if (!message && kind !== "word") return null;
  const f: Feedback = { kind, message };
  if (b.email !== undefined && b.email !== "") {
    if (typeof b.email !== "string") return null;
    const email = b.email.trim();
    if (email.length > 200 || !EMAIL.test(email)) return null;
    f.email = email;
  }
  if (typeof b.about === "string" && oneLine(b.about)) f.about = oneLine(b.about).slice(0, 100);
  if (typeof b.details === "string" && b.details.trim()) f.details = b.details.trim().slice(0, MAX_DETAILS);
  return f;
}

/** True when the hidden trap field was filled in: a bot. */
export const isBot = (body: unknown) => typeof body === "object" && body !== null && !!(body as Record<string, unknown>).website;

export function subject(f: Feedback): string {
  const head = f.about ?? (oneLine(f.message).slice(0, 60) + (oneLine(f.message).length > 60 ? "…" : ""));
  return `[Mempo] ${KINDS[f.kind]}${head ? `: ${head}` : ""}`;
}

export function emailText(f: Feedback): string {
  return [
    `${KINDS[f.kind]}${f.about ? ` · ${f.about}` : ""}`,
    "",
    f.message || "(no message)",
    "",
    "———",
    f.email ? `Reply to: ${f.email} (press Reply)` : "No email given: they can’t be answered.",
    ...(f.details ? ["", f.details] : []),
  ].join("\n");
}

/** Short stable key for a network address. The address itself is never stored. */
export async function idOf(ip: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mempo-feedback:${ip}`));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

const ipOf = (request: Request) =>
  request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

// ---------- counters: Upstash Redis over its REST API, or memory when running locally ----------

interface Counter {
  /** Adds one and returns the new count. The count starts when first added and disappears after `ttl` seconds. */
  hit(key: string, ttl: number): Promise<number>;
}

const memory = new Map<string, { n: number; until: number }>();
const memoryCounter: Counter = {
  hit: async (key, ttl) => {
    const now = Date.now();
    const e = memory.get(key);
    const next = e && e.until > now ? { n: e.n + 1, until: e.until } : { n: 1, until: now + ttl * 1000 };
    memory.set(key, next);
    return next.n;
  },
};

function redisCounter(url: string, token: string): Counter {
  return {
    hit: async (key, ttl) => {
      // INCR, then set the expiry only if there isn't one yet, in one round trip.
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify([
          ["INCR", PREFIX + key],
          ["EXPIRE", PREFIX + key, ttl, "NX"],
        ]),
      });
      const json = (await res.json()) as { result?: unknown; error?: string }[];
      if (!res.ok || !Array.isArray(json) || json[0]?.error) throw new Error(`Redis: ${json?.[0]?.error ?? res.status}`);
      return Number(json[0].result);
    },
  };
}

function counter(): Counter | null {
  const env = process.env;
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisCounter(url, token);
  return env.VERCEL ? null : memoryCounter; // on Vercel, memory would forget everything between calls
}

// ---------- sending ----------

async function send(f: Feedback): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.VERCEL) return false;
    console.info(`\n[feedback] Not sent (no RESEND_API_KEY). It would say:\nSubject: ${subject(f)}\n${emailText(f)}\n`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], subject: subject(f), text: emailText(f), ...(f.email ? { reply_to: f.email } : {}) }),
  });
  if (!res.ok) console.error(`[feedback] Resend ${res.status}: ${await res.text()}`);
  return res.ok;
}

// ---------- HTTP ----------

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_MESSAGE + MAX_DETAILS + 2000) return json({ error: "This message is too long." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  if (isBot(body)) return json({ ok: true });
  const f = parseFeedback(body);
  if (!f) return json({ error: "Please check the form and try again." }, 400);

  const db = counter();
  if (!db) return json({ error: "Feedback isn’t set up on the server yet." }, 503);
  const day = new Date().toISOString().slice(0, 10);
  if ((await db.hit(await idOf(ipOf(request)), 3600)) > PER_HOUR) return json({ error: "That’s a lot of messages! Please wait a bit." }, 429);
  if ((await db.hit(`day:${day}`, 86400)) > PER_DAY) return json({ error: "Too many messages today. Please try again tomorrow." }, 429);

  if (!(await send(f))) return json({ error: "Couldn’t send it right now." }, 502);
  return json({ ok: true });
}
