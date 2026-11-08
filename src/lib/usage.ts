import { site } from "../config/site";

/**
 * Anonymous usage counts, so the developer can see whether people come back (api/stats.ts).
 * At most two tiny messages a day per device: "open" (the app was opened) and "study" (a card was answered).
 * Each carries only a random device id made up here; nothing about the words, answers or the person.
 * Switched off in Settings → Privacy; switching off also forgets the id. Per device, not in backups.
 */

export type UsageEvent = "open" | "study";

const ID_KEY = `${site.storageKey}:device`;
const SENT_KEY = `${site.storageKey}:usage-sent`; // { open: "2026-11-08", study: "2026-11-08" } (UTC days)
const OFF_KEY = `${site.storageKey}:usage-off`;
const API = "/api/stats";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // private mode or full storage: just don't count
  }
};

export const usageOn = () => read(OFF_KEY) !== "1";

export function setUsageOn(on: boolean) {
  write(OFF_KEY, on ? null : "1");
  if (!on) {
    write(ID_KEY, null);
    write(SENT_KEY, null);
  }
}

/** Random 16-hex-digit id for this device, made once. */
export function deviceId(): string {
  const old = read(ID_KEY);
  if (old && /^[0-9a-f]{16}$/.test(old)) return old;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  write(ID_KEY, id);
  return id;
}

function sent(): Partial<Record<UsageEvent, string>> {
  try {
    return JSON.parse(read(SENT_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

let inFlight: Promise<void> | null = null;

/** Counts today's "open" or "study", once per UTC day. Fails silently (offline: tried again next time). */
export function countUsage(event: UsageEvent): Promise<void> {
  if (!usageOn() || typeof fetch === "undefined") return Promise.resolve();
  const today = new Date().toISOString().slice(0, 10);
  if (sent()[event] === today) return Promise.resolve();
  // One at a time, so "open" and "study" at start-up don't race each other.
  const prev = inFlight ?? Promise.resolve();
  const next = prev.then(async () => {
    if (sent()[event] === today || !usageOn()) return;
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deviceId(), event }), keepalive: true });
      if (!res.ok) return;
      // A "study" counts as an "open" on the server too.
      write(SENT_KEY, JSON.stringify({ ...sent(), [event]: today, ...(event === "study" ? { open: today } : {}) }));
    } catch {
      // offline or blocked: never mind
    }
  });
  inFlight = next;
  return next;
}
