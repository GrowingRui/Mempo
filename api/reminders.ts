// Daily reminders (web push). Runs as a Vercel serverless function at /api/reminders.
//
//   POST   { subscription, time: "19:00", tz: "Europe/Madrid", lastStudied?: "2026-11-08", streak?: 5 }
//          Saves or updates this device's reminder. The app sends it again when the time changes and
//          after the first study of the day, so no reminder goes out on a day already done.
//   DELETE { endpoint }   Removes this device's reminder.
//   GET    with "Authorization: Bearer <CRON_SECRET>"   Sends every reminder that's due now.
//          Called every 15 minutes by .github/workflows/reminders.yml.
//
// Stored per device (in Upstash Redis, hash "reminders"): the push address the browser gave us, the
// chosen time and time zone, the last day studied with the streak then, and the last day we sent one.
// No account, no words, no progress.
//
// Settings (Vercel → Settings → Environment Variables):
//   VAPID_PRIVATE_KEY   pairs with the public key in src/config/site.ts
//   CRON_SECRET         any long random string, also saved as a GitHub Actions secret
//   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//                       added by the Upstash for Redis integration in the Vercel dashboard
// Running locally (npm run preview), without the Redis settings, reminders are kept in memory.
//
// Only erasable TypeScript here: `npm run preview` loads this file with Node's own type stripping.

import * as webpush from "web-push";

const VAPID_PUBLIC_KEY = "BMhBIKnghu4HzXgeNCoUhKOs7zhyTI1mfUGbAGqfzm_s19AKcCmo4oFtpewWGZ7kXCN2gv6073hmyY3jAIIwwDc"; // same as site.vapidPublicKey
const VAPID_SUBJECT = "https://mempo.vercel.app";
const HASH = "reminders";
/** A reminder that's late (scheduler hiccup) still goes out, but not more than 3 hours after the chosen time. */
const LATE_LIMIT_MIN = 180;

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Reminder {
  sub: PushSub;
  time: string; // "HH:MM", local time
  tz: string; // IANA time zone
  lastStudied?: string; // YYYY-MM-DD, local
  streak?: number; // streak on lastStudied
  lastSent?: string; // YYYY-MM-DD, local
}

// ---------- pure logic (tested in reminders.test.ts) ----------

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const validTz = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Checks what the app sent. Returns null if anything looks wrong. */
export function parseReminder(body: unknown): Reminder | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, any>;
  const s = b.subscription;
  if (
    typeof s?.endpoint !== "string" ||
    !s.endpoint.startsWith("https://") ||
    s.endpoint.length > 1000 ||
    typeof s.keys?.p256dh !== "string" ||
    typeof s.keys?.auth !== "string" ||
    s.keys.p256dh.length > 200 ||
    s.keys.auth.length > 100
  )
    return null;
  if (typeof b.time !== "string" || !TIME.test(b.time) || !validTz(b.tz)) return null;
  const r: Reminder = { sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, time: b.time, tz: b.tz };
  if (typeof b.lastStudied === "string" && DAY.test(b.lastStudied)) r.lastStudied = b.lastStudied;
  if (Number.isInteger(b.streak) && b.streak >= 0 && b.streak < 100000) r.streak = b.streak;
  return r;
}

/** Local date ("YYYY-MM-DD") and minutes since midnight in a time zone. */
export function localNow(now: Date, tz: string): { day: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const previousDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** The local day to mark as sent if this reminder should go out now, otherwise null. */
export function dueDay(r: Reminder, now: Date): string | null {
  const { day, minutes } = localNow(now, r.tz);
  const [h, m] = r.time.split(":").map(Number);
  const late = minutes - (h * 60 + m);
  if (late < 0 || late > LATE_LIMIT_MIN) return null;
  if (r.lastSent === day || r.lastStudied === day) return null;
  return day;
}

/** What the notification says. A streak that's still alive (studied yesterday) gets a mention. */
export function message(r: Reminder, today: string): { title: string; body: string } {
  if (r.streak && r.streak > 0 && r.lastStudied === previousDay(today))
    return { title: `Keep your ${r.streak}-day streak going 🔥`, body: "A few minutes with your words today keeps it alive." };
  return { title: "Time for your words ✨", body: "A few minutes today makes them stick." };
}

/** Short stable key for a push address. */
export async function idOf(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- storage: Upstash Redis over its REST API, or memory when running locally ----------

interface Store {
  get(id: string): Promise<Reminder | null>;
  set(id: string, r: Reminder): Promise<void>;
  setMany(entries: [string, Reminder][]): Promise<void>;
  del(id: string): Promise<void>;
  all(): Promise<[string, Reminder][]>;
}

const memory = new Map<string, Reminder>();
const memoryStore: Store = {
  get: async (id) => memory.get(id) ?? null,
  set: async (id, r) => void memory.set(id, r),
  setMany: async (entries) => entries.forEach(([id, r]) => memory.set(id, r)),
  del: async (id) => void memory.delete(id),
  all: async () => [...memory.entries()],
};

function redisStore(url: string, token: string): Store {
  const call = async (command: (string | number)[]): Promise<any> => {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) });
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis: ${json.error ?? res.status}`);
    return json.result;
  };
  const parse = (v: unknown): Reminder | null => {
    try {
      return typeof v === "string" ? (JSON.parse(v) as Reminder) : null;
    } catch {
      return null;
    }
  };
  return {
    get: async (id) => parse(await call(["HGET", HASH, id])),
    set: async (id, r) => void (await call(["HSET", HASH, id, JSON.stringify(r)])),
    setMany: async (entries) => {
      if (entries.length) await call(["HSET", HASH, ...entries.flatMap(([id, r]) => [id, JSON.stringify(r)])]);
    },
    del: async (id) => void (await call(["HDEL", HASH, id])),
    all: async () => {
      const flat = ((await call(["HGETALL", HASH])) ?? []) as string[];
      const out: [string, Reminder][] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const r = parse(flat[i + 1]);
        if (r) out.push([flat[i], r]);
      }
      return out;
    },
  };
}

function store(): Store | null {
  const env = process.env;
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(url, token);
  return env.VERCEL ? null : memoryStore; // on Vercel, memory would forget everything between calls
}

// ---------- HTTP ----------

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const notReady = () => json({ error: "Reminders aren’t set up on the server yet." }, 503);

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 5000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Save or update this device's reminder. Keeps the server's "last sent" day. */
export async function POST(request: Request): Promise<Response> {
  const db = store();
  if (!db) return notReady();
  const r = parseReminder(await readJson(request));
  if (!r) return json({ error: "Bad reminder." }, 400);
  const id = await idOf(r.sub.endpoint);
  const old = await db.get(id);
  if (old?.lastSent) r.lastSent = old.lastSent;
  await db.set(id, r);
  return json({ ok: true });
}

/** Turn this device's reminder off. */
export async function DELETE(request: Request): Promise<Response> {
  const db = store();
  if (!db) return notReady();
  const body = (await readJson(request)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return json({ error: "Bad request." }, 400);
  await db.del(await idOf(body.endpoint));
  return json({ ok: true });
}

/** Send the reminders that are due. Only for the scheduler. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!secret || !privateKey) return notReady();
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "Not allowed." }, 401);
  const db = store();
  if (!db) return notReady();

  const now = new Date();
  const due: [string, Reminder, string][] = [];
  for (const [id, r] of await db.all()) {
    const day = dueDay(r, now);
    if (day) due.push([id, r, day]);
  }
  // Mark them sent first: if the scheduler runs twice at once, the second run finds nothing to do.
  await db.setMany(due.map(([id, r, day]) => [id, { ...r, lastSent: day }]));

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, privateKey);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  const queue = [...due];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const [id, r, day] = item;
      try {
        await webpush.sendNotification(r.sub, JSON.stringify(message(r, day)), { TTL: 4 * 60 * 60, urgency: "normal", topic: "daily-reminder" });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.del(id); // the browser dropped this subscription (app removed, permission taken away)
          removed++;
        } else {
          failed++;
          console.error("push failed", status, (e as Error).message);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(10, queue.length) }, worker));
  return json({ due: due.length, sent, removed, failed });
}
