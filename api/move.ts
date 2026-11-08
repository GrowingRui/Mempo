// "Move to another device". Runs as a Vercel serverless function at /api/move.
//
//   POST   body = the backup, gzipped and base64-encoded by the app   → { code: "K7M2QX9D", expiresIn: 600 }
//   GET    ?code=K7M2QX9D   → { data } (the same base64 text), or 404 when the code is wrong or has expired
//
// The backup is kept for 10 minutes under "mempo:move:<code>" in the same Upstash Redis as the reminders,
// then Redis deletes it by itself. Nothing else is stored: no account, no device address.
// The code is 8 letters/digits (Crockford base32, about 1 trillion choices), so it can't be guessed in 10 minutes.
// Running locally without the Redis settings, codes are kept in memory.
//
// Only erasable TypeScript here: `npm run preview` loads this file with Node's own type stripping.

const PREFIX = "mempo:move:"; // prefixed: the database may be shared with other projects
export const TTL_SECONDS = 600;
/** Base64 of a gzipped backup. A full backup of every word in the app is far smaller than this. */
export const MAX_DATA = 1_500_000;
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U
const CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// ---------- pure logic (tested in _move.test.ts) ----------

export function newCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return [...random(8)].map((b) => ALPHABET[b & 31]).join("");
}

export const validCode = (code: unknown): code is string => typeof code === "string" && CODE.test(code);

export const validData = (data: unknown): data is string =>
  typeof data === "string" && data.length > 0 && data.length <= MAX_DATA && BASE64.test(data);

// ---------- storage: Upstash Redis over its REST API, or memory when running locally ----------

interface Store {
  /** Saves only if the code is free. Returns false if it was taken. */
  add(code: string, data: string): Promise<boolean>;
  get(code: string): Promise<string | null>;
}

const memory = new Map<string, { data: string; until: number }>();
const memoryStore: Store = {
  add: async (code, data) => {
    const old = memory.get(code);
    if (old && old.until > Date.now()) return false;
    memory.set(code, { data, until: Date.now() + TTL_SECONDS * 1000 });
    return true;
  },
  get: async (code) => {
    const e = memory.get(code);
    return e && e.until > Date.now() ? e.data : null;
  },
};

function redisStore(url: string, token: string): Store {
  const call = async (command: (string | number)[]): Promise<any> => {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) });
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (!res.ok || json.error) throw new Error(`Redis: ${json.error ?? res.status}`);
    return json.result;
  };
  return {
    add: async (code, data) => (await call(["SET", PREFIX + code, data, "EX", TTL_SECONDS, "NX"])) === "OK",
    get: async (code) => {
      const v = await call(["GET", PREFIX + code]);
      return typeof v === "string" ? v : null;
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
const notReady = () => json({ error: "Moving to another device isn’t set up on the server yet." }, 503);
const codeOf = (request: Request) => new URL(request.url).searchParams.get("code");

/** Keep a backup for 10 minutes and return its code. */
export async function POST(request: Request): Promise<Response> {
  const db = store();
  if (!db) return notReady();
  const data = await request.text();
  if (data.length > MAX_DATA) return json({ error: "This backup is too big to send." }, 413);
  if (!validData(data)) return json({ error: "Bad backup." }, 400);
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    if (await db.add(code, data)) return json({ code, expiresIn: TTL_SECONDS });
  }
  return json({ error: "Couldn’t make a code. Try again." }, 500);
}

/** Fetch a backup by its code. It stays until it expires, so a cancelled restore can be tried again. */
export async function GET(request: Request): Promise<Response> {
  const db = store();
  if (!db) return notReady();
  const code = codeOf(request);
  const data = validCode(code) ? await db.get(code) : null;
  if (!data) return json({ error: "not found" }, 404);
  return json({ data });
}

