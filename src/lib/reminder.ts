import { site } from "../config/site";
import { tr } from "../i18n";
import { toDay } from "./date";
import { streakOf, studied } from "./stats";
import type { Lang, Progress } from "./types";

/**
 * Daily reminder, on this device only (not part of backups: each phone or browser turns it on itself).
 * The browser gives us a push address; we send it to api/reminders.ts with the chosen time, the time zone
 * and the last day studied. The server sends a notification at that time on days not studied yet.
 */

export type ReminderSupport =
  | "ok"
  | "install-ios" // iPhone / iPad in Safari: push works only in the installed app (iOS 16.4+)
  | "unsupported";

export interface ReminderState {
  on: boolean;
  time: string; // "HH:MM"
  /** What the server last confirmed, so we only send changes. */
  synced?: string;
}

export interface StudyInfo {
  lastStudied?: string;
  streak: number;
}

const KEY = `${site.storageKey}:reminder`;
const API = "/api/reminders";
export const DEFAULT_TIME = "19:00";

const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export function reminderSupport(): ReminderSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (isIOS && !standalone()) return "install-ios";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

export const permission = (): NotificationPermission => ("Notification" in window ? Notification.permission : "denied");

export function loadReminder(): ReminderState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (s && typeof s.on === "boolean" && typeof s.time === "string" && /^\d{2}:\d{2}$/.test(s.time)) return s;
  } catch {
    // fall through
  }
  return { on: false, time: DEFAULT_TIME };
}

function saveReminder(s: ReminderState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

/** The last day with study and the streak then. */
export function studyInfo(history: Progress["history"], today = toDay()): StudyInfo {
  const days = Object.keys(history).filter((d) => studied(history[d]) && d <= today);
  const lastStudied = days.sort().at(-1);
  return { lastStudied, streak: streakOf(history, today).current };
}

/** The service worker, or an error if there isn't one (e.g. `npm run dev`, which runs without it). */
async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 8000)),
  ]);
  if (!reg) throw new Error(tr().reminder.noWorker);
  return reg;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(site.vapidPublicKey) });
}

async function send(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    // The server's messages are in English; show ours, in the app's language.
    throw new Error(res.status === 503 ? tr().reminder.notSetUp : tr().reminder.noServer);
  }
}

async function push(state: ReminderState, info: StudyInfo, lang: Lang, create: boolean): Promise<ReminderState> {
  const sub = await subscription(create);
  if (!sub) throw new Error(tr().reminder.switchedOff);
  const body = {
    subscription: sub.toJSON(),
    time: state.time,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lastStudied: info.lastStudied,
    streak: info.streak,
    lang, // the notification's language
  };
  const signature = JSON.stringify(body);
  if (signature === state.synced) return state;
  await send("POST", body);
  const next = { ...state, synced: signature };
  saveReminder(next);
  return next;
}

/** Asks for permission (call from a tap) and turns the reminder on. Throws with a message for the user. */
export async function enableReminder(time: string, info: StudyInfo, lang: Lang): Promise<ReminderState> {
  const result = await Notification.requestPermission();
  if (result === "denied") throw new Error(tr().reminder.blockedRetry);
  if (result !== "granted") throw new Error(tr().reminder.allow);
  return push({ on: true, time }, info, lang, true);
}

export async function disableReminder(): Promise<ReminderState> {
  const off: ReminderState = { on: false, time: loadReminder().time };
  saveReminder(off);
  const sub = await subscription(false).catch(() => null);
  if (sub) {
    // If the server can't be reached now, it forgets this address the next time a push to it fails.
    await send("DELETE", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return off;
}

export async function setReminderTime(time: string, info: StudyInfo, lang: Lang): Promise<ReminderState> {
  const next = { ...loadReminder(), time };
  saveReminder(next);
  return next.on ? push(next, info, lang, true) : next;
}

/**
 * Keeps the server up to date: called at start and whenever the history or the app language changes. Sends only
 * when something changed (first study of the day, a new time zone, a new push address, another language).
 * Quiet on failure: it tries again later.
 */
export async function syncReminder(info: StudyInfo, lang: Lang): Promise<void> {
  const state = loadReminder();
  if (!state.on || reminderSupport() !== "ok" || permission() !== "granted") return;
  await push(state, info, lang, true).catch(() => {});
}
