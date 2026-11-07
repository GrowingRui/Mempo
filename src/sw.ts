/// <reference lib="webworker" />
// Service worker (built by vite-plugin-pwa, "injectManifest" mode). It makes the app work offline:
//  - the app itself and the word lists (public/data/*.json) are saved on install (precache);
//  - pronunciation MP3s are saved the first time each one plays, or all at once from Settings.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { createPartialResponse } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { AUDIO_CACHE } from "./lib/offline-cache";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// One-page app: every page address opens index.html, also offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

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
