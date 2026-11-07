import { useSyncExternalStore } from "react";
import { site } from "../config/site";

/**
 * "Install app" support.
 * - Chrome, Edge, Samsung Internet (Android and computers) fire `beforeinstallprompt`: we keep the event and
 *   show the browser's own install dialog when the user taps our button.
 * - iPhone / iPad have no such event: we show the steps (Share → Add to Home Screen).
 * - Android browsers without the event (e.g. Firefox): we show the steps (menu → Install).
 * - Safari on a Mac: we show the steps (File → Add to Dock, macOS 14 Sonoma or later).
 * - Already running as an installed app, or a browser that can't install (desktop Firefox): no button.
 * This module starts listening as soon as it's imported (main.tsx imports it before React renders),
 * because the event can fire before the first screen is drawn.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallMode =
  | "installed" // running as the installed app
  | "prompt" // the browser's install dialog is ready
  | "ios" // iPhone / iPad: show Share → Add to Home Screen
  | "android" // Android without the event: show menu → Install
  | "mac" // Safari on a Mac (macOS 14+): show File → Add to Dock
  | "done" // just installed from this tab
  | "later" // the browser's dialog was closed without installing (desktop): it's still in the browser menu
  | "none"; // can't install here

const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
// iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
const isAndroid = /android/i.test(ua);
const isMacSafari = !isIOS && /macintosh/i.test(ua) && /version\/\d+.*safari/i.test(ua) && !/chrome|chromium|crios|edg|firefox|opr/i.test(ua);

const standalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

let deferred: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
let promptClosed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini bar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    justInstalled = true;
    emit();
  });
}

function mode(): InstallMode {
  if (standalone()) return "installed";
  if (justInstalled) return "done";
  if (deferred) return "prompt";
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  if (isMacSafari) return "mac";
  if (promptClosed) return "later";
  return "none";
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    mode,
    () => "none",
  );
}

/** Opens the browser's install dialog. Returns true if the user installed. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null; // an event can be used only once
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome !== "accepted") {
    promptClosed = true;
    emit();
  }
  return outcome === "accepted";
}

/** Home's install banner can be hidden with ×; the button in Settings stays. */
const DISMISS_KEY = `${site.storageKey}:install-dismissed`;
export const bannerDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};
export const dismissBanner = () => {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
};
