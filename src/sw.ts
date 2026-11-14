/// <reference lib="webworker" />
// Service worker (built by vite-plugin-pwa, "injectManifest" mode). It makes the app work offline:
//  - the app itself and the word lists (public/data/*.json) are saved on install (precache);
//  - pronunciation MP3s are saved the first time each one plays, or all at once from Settings.
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { createPartialResponse } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { toDay } from "./lib/date";
import { AUDIO_CACHE } from "./lib/offline-cache";
import type { Word } from "./lib/types";
import { readPrefsForReminder, reminderLine, wordOfTheDay } from "./lib/wotd";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// One-page app: every page address opens index.html, also offline. Except /api/…: the usage report
// (/api/stats?key=…) is a real page from the server.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

// Audio: cache first. <audio> asks for byte ranges, and a partial (206) answer can't be cached,
// so we always fetch and keep the whole file, then cut out the part the player asked for.
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && url.pathname.startsWith("/audio/") && request.method === "GET",
  async ({ request, url }) => {
    const cache = await caches.open(AUDIO_CACHE);
    let res = await cache.match(url.pathname);
    if (!res) {
      res = await fetch(url.pathname);
      if (res.ok && res.status === 200) await cache.put(url.pathname, res.clone());
    }
    return request.headers.has("range") ? createPartialResponse(request, res) : res;
  },
);

// The page tells a waiting new version to take over (after the user taps "Update").
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

/** Today's word line for the reminder (src/lib/wotd.ts), from the word list saved offline. Undefined if anything is missing. */
async function wordLine(): Promise<string | undefined> {
  try {
    const prefs = await readPrefsForReminder();
    if (!prefs) return undefined; // the app hasn't saved them yet (opened before this version)
    const path = `/data/${prefs.level.toLowerCase()}.json`;
    const res = (await matchPrecache(path)) ?? (await fetch(path));
    const w = wordOfTheDay((await res.json()) as Word[], prefs.level, toDay());
    return w && reminderLine(w, prefs);
  } catch {
    return undefined;
  }
}

// Daily reminder (sent by api/reminders.ts). The server's text, with the word of the day as the body when we
// have it. Tapping it opens Mempo, or brings an open window to the front.
self.addEventListener("push", (e) => {
  let data: { title?: string; body?: string } = {};
  try {
    data = e.data?.json() ?? {};
  } catch {
    // not JSON: use the defaults
  }
  e.waitUntil(
    (async () => {
      const word = await wordLine();
      await self.registration.showNotification(data.title || "Time for your words ✨", {
        body: word || data.body || "A few minutes today makes them stick.",
        icon: "/pwa-192x192.png",
        tag: "daily-reminder", // a new one replaces yesterday's if it's still there
        data: { url: "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return void (await open.focus());
      await self.clients.openWindow("/");
    })(),
  );
});
