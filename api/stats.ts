// Usage stats: do people come back? Runs as a Vercel serverless function at /api/stats.
//
//   POST { id, event: "open" | "study" }   → { ok: true }   (sent by the app at most once a day per event)
//   GET  ?key=<STATS_KEY>                  → a small private report page (add &format=json for the numbers)
//
// Privacy: "id" is a random number the app makes up (src/lib/usage.ts). No account, no IP address, no device
// details, no words or answers. Users can switch it off in Settings → Privacy. Days are UTC.
//
// Stored in the shared Upstash Redis, every key prefixed "mempo:stats:":
//   first              hash   id → first day seen (one short entry per device)
//   new:<day>          set    devices first seen that day
//   open:<day>         set    devices that opened the app that day
//   study:<day>        set    devices that answered at least one card that day
// The day sets expire after a bit more than a year.
//
// Settings (Vercel → Settings → Environment Variables, and .env.local):
//   STATS_KEY   the password for the report (if missing, CRON_SECRET is used)
//   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_*)   same database as the reminders
// Running locally without the Redis settings, everything is kept in memory.
//
// Only erasable TypeScript here: `npm run preview` loads this file with Node's own type stripping.

const PREFIX = "mempo:stats:"; // prefixed: the database may be shared with other projects
export const KEEP_DAYS = 400;
/** New devices accepted per day: stops anyone from filling the database with made-up ids. */
export const MAX_NEW_PER_DAY = 500;
/** Days the report looks back over. */
export const REPORT_DAYS = 90;
const ID = /^[0-9a-f]{16}$/;

export type Event = "open" | "study";

// ---------- pure logic (tested in _stats.test.ts) ----------

export function parsePing(body: unknown): { id: string; event: Event } | null {
  if (typeof body !== "object" || body === null) return null;
  const { id, event } = body as Record<string, unknown>;
  if (typeof id !== "string" || !ID.test(id)) return null;
  if (event !== "open" && event !== "study") return null;
  return { id, event };
}

export const utcDay = (d: Date = new Date()) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDay(d);
}

export interface DayData {
  day: string;
  open: string[];
  study: string[];
  new: string[];
}

export interface Return {
  /** Devices whose window is over. */
  devices: number;
  /** Of those, how many opened the app again inside the window. */
  back: number;
}

export interface Report {
  today: string;
  devicesEver: number;
  /** Unique devices that opened the app in the last 7 / 30 days (today included). */
  active7: number;
  active30: number;
  /** Newest first. "returning" = opened that day but first seen on an earlier day. */
  days: { day: string; open: number; study: number; new: number; returning: number }[];
  /** New devices that came back: the next day, within a week (days 1–7), in weeks 2–4 (days 8–30). */
  nextDay: Return;
  week: Return;
  month: Return;
}

/**
 * Turns the raw day sets into the report. `days` may come in any order and may miss days (= nobody came).
 * A return window only counts once it's over, so today's unfinished numbers don't drag the rates down.
 */
export function summarize(days: DayData[], devicesEver: number, today: string): Report {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const openOn = (day: string) => new Set(byDay.get(day)?.open ?? []);
  const uniqueOpen = (from: number) => {
    const s = new Set<string>();
    for (let i = 0; i < from; i++) for (const id of byDay.get(addDays(today, -i))?.open ?? []) s.add(id);
    return s.size;
  };

  const ret = (first: number, last: number): Return => {
    const r: Return = { devices: 0, back: 0 };
    for (let i = 1; i <= REPORT_DAYS; i++) {
      const cohortDay = addDays(today, -i);
      if (addDays(cohortDay, last) >= today) continue; // window not over yet
      const cohort = byDay.get(cohortDay)?.new ?? [];
      if (!cohort.length) continue;
      const seen = new Set<string>();
      for (let k = first; k <= last; k++) for (const id of openOn(addDays(cohortDay, k))) seen.add(id);
      r.devices += cohort.length;
      r.back += cohort.filter((id) => seen.has(id)).length;
    }
    return r;
  };

  const rows: Report["days"] = [];
  for (let i = 0; i < 30; i++) {
    const day = addDays(today, -i);
    const d = byDay.get(day);
    const open = new Set(d?.open ?? []);
    const fresh = new Set(d?.new ?? []);
    rows.push({ day, open: open.size, study: d?.study.length ?? 0, new: fresh.size, returning: [...open].filter((id) => !fresh.has(id)).length });
  }

  return { today, devicesEver, active7: uniqueOpen(7), active30: uniqueOpen(30), days: rows, nextDay: ret(1, 1), week: ret(1, 7), month: ret(8, 30) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (r: Return) => (r.devices ? `${Math.round((100 * r.back) / r.devices)}%` : "–");
const of = (r: Return) => (r.devices ? `${r.back} of ${r.devices} new devices` : "not enough data yet");

export function reportHtml(r: Report): string {
  const tile = (label: string, value: string | number, note = "") =>
    `<div class="tile"><div class="v">${esc(String(value))}</div><div class="l">${esc(label)}</div>${note ? `<div class="n">${esc(note)}</div>` : ""}</div>`;
  const row = (d: Report["days"][number]) =>
    `<tr${d.day === r.today ? ' class="today"' : ""}><td>${d.day}${d.day === r.today ? " (so far)" : ""}</td><td>${d.open}</td><td>${d.study}</td><td>${d.new}</td><td>${d.returning}</td></tr>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Mempo usage</title>
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0 auto; max-width: 44rem; padding: 1.25rem; color: #1f1a4d; background: #f6f5ff; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem } h2 { font-size: 1.1rem; margin: 1.75rem 0 .5rem }
  .muted, .n, .l { color: #5d5890 } .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr)); gap: .6rem }
  .tile { background: #fff; border: 2px solid #e2e0f5; border-radius: 14px; padding: .7rem .85rem }
  .v { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums } .l { font-weight: 600 } .n { font-size: .8rem }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 14px; overflow: hidden; font-variant-numeric: tabular-nums }
  th, td { padding: .4rem .6rem; text-align: right; border-bottom: 1px solid #eceaf8 } th:first-child, td:first-child { text-align: left }
  th { font-size: .8rem; color: #5d5890 } tr.today td { color: #5d5890 }
</style></head><body>
<h1>Mempo usage</h1>
<p class="muted">Counts devices (a browser or installed app), not people. Days are UTC; today is ${r.today}.</p>
<div class="tiles">
  ${tile("devices ever", r.devicesEver)}
  ${tile("active, last 7 days", r.active7)}
  ${tile("active, last 30 days", r.active30)}
</div>
<h2>Do new devices come back?</h2>
<div class="tiles">
  ${tile("back the next day", pct(r.nextDay), of(r.nextDay))}
  ${tile("back within a week", pct(r.week), of(r.week))}
  ${tile("back in weeks 2–4", pct(r.month), of(r.month))}
</div>
<p class="muted">Only devices first seen in the last ${REPORT_DAYS} days whose window is already over are counted.</p>
<h2>Last 30 days</h2>
<table><thead><tr><th>Day</th><th>Opened</th><th>Studied</th><th>New</th><th>Returning</th></tr></thead>
<tbody>${r.days.map(row).join("")}</tbody></table>
</body></html>`;
}

// ---------- storage: Upstash Redis over its REST API, or memory when running locally ----------

type Command = (string | number)[];
type Run = (commands: Command[]) => Promise<unknown[]>;

const sets = new Map<string, Set<string>>();
const hashes = new Map<string, Map<string, string>>();
/** Just the commands this file uses. Expiry is ignored: local memory is gone after a restart anyway. */
export const memoryRun: Run = async (commands) =>
  commands.map(([cmd, key, ...args]) => {
    const k = String(key);
    const set = () => sets.get(k) ?? sets.set(k, new Set()).get(k)!;
    const hash = () => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
    switch (cmd) {
      case "SADD": {
        const s = set(), before = s.size;
        for (const a of args) s.add(String(a));
        return s.size - before;
      }
      case "SCARD": return sets.get(k)?.size ?? 0;
      case "SMEMBERS": return [...(sets.get(k) ?? [])];
      case "HSETNX": {
        const h = hash();
        if (h.has(String(args[0]))) return 0;
        h.set(String(args[0]), String(args[1]));
        return 1;
      }
      case "HEXISTS": return hashes.get(k)?.has(String(args[0])) ? 1 : 0;
      case "HLEN": return hashes.get(k)?.size ?? 0;
      case "EXPIRE": return 1;
      default: throw new Error(`memory store: ${cmd} not supported`);
    }
  });

function redisRun(url: string, token: string): Run {
  return async (commands) => {
    const res = await fetch(`${url}/pipeline`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(commands) });
    const json = (await res.json()) as { result?: unknown; error?: string }[];
    if (!res.ok || !Array.isArray(json)) throw new Error(`Redis: ${res.status}`);
    const bad = json.find((r) => r.error);
    if (bad) throw new Error(`Redis: ${bad.error}`);
    return json.map((r) => r.result);
  };
}

function runner(): Run | null {
  const env = process.env;
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisRun(url, token);
  return env.VERCEL ? null : memoryRun; // on Vercel, memory would forget everything between calls
}

// ---------- HTTP ----------

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const TTL = KEEP_DAYS * 86400;

/** Records one "open" or "study" for today. A "study" counts as an "open" too. */
export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > 500) return json({ error: "Bad request." }, 400);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const ping = parsePing(body);
  if (!ping) return json({ error: "Bad request." }, 400);
  const run = runner();
  if (!run) return json({ error: "Usage stats aren’t set up on the server yet." }, 503);

  const day = utcDay();
  const k = (name: string) => `${PREFIX}${name}:${day}`;
  const [known, newToday] = (await run([["HEXISTS", PREFIX + "first", ping.id], ["SCARD", k("new")]])) as number[];
  if (!known && newToday >= MAX_NEW_PER_DAY) return json({ error: "Too many new devices today." }, 429);

  const commands: Command[] = [
    ["HSETNX", PREFIX + "first", ping.id, day],
    ["SADD", k("open"), ping.id],
    ["EXPIRE", k("open"), TTL],
  ];
  if (!known) commands.push(["SADD", k("new"), ping.id], ["EXPIRE", k("new"), TTL]);
  if (ping.event === "study") commands.push(["SADD", k("study"), ping.id], ["EXPIRE", k("study"), TTL]);
  await run(commands);
  return json({ ok: true });
}

/** Constant-time comparison, so the key can't be guessed letter by letter from response times. */
function sameKey(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The private report. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.STATS_KEY || process.env.CRON_SECRET;
  if (!secret) return json({ error: "Set STATS_KEY on the server to see the report." }, 503);
  const url = new URL(request.url);
  const given = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!sameKey(given, secret)) return json({ error: "Wrong or missing key." }, 401);
  const run = runner();
  if (!run) return json({ error: "Usage stats aren’t set up on the server yet." }, 503);

  const today = utcDay();
  const dayList = Array.from({ length: REPORT_DAYS + 1 }, (_, i) => addDays(today, -i));
  const results = await run([
    ["HLEN", PREFIX + "first"],
    ...dayList.flatMap((d): Command[] => [["SMEMBERS", `${PREFIX}open:${d}`], ["SMEMBERS", `${PREFIX}study:${d}`], ["SMEMBERS", `${PREFIX}new:${d}`]]),
  ]);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const days = dayList.map((day, i) => ({ day, open: list(results[1 + 3 * i]), study: list(results[2 + 3 * i]), new: list(results[3 + 3 * i]) }));
  const report = summarize(days, Number(results[0]) || 0, today);

  if (url.searchParams.get("format") === "json") return json(report);
  return new Response(reportHtml(report), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" },
  });
}
