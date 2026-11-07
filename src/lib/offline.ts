import { audioUrl } from "./speech";
import { AUDIO_CACHE } from "./offline-cache";

/** True when the browser can run the app offline (service worker + Cache Storage). */
export const offlineSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;

const pathOf = (id: string) => new URL(audioUrl(id), location.origin).pathname;

/** Which of these words already have their pronunciation saved on this device. */
export async function savedAudio(ids: string[]): Promise<Set<string>> {
  const cache = await caches.open(AUDIO_CACHE);
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  return new Set(ids.filter((id) => have.has(pathOf(id))));
}

/**
 * Saves the pronunciation of every word not saved yet. Calls onProgress(done) after each file.
 * Stops early when `signal` aborts. Files that fail (offline, missing) are skipped; returns how many failed.
 */
export async function saveAudio(ids: string[], onProgress: (done: number) => void, signal: AbortSignal): Promise<number> {
  // Ask the browser not to clear our storage when space runs low (installed apps usually get this anyway).
  void navigator.storage?.persist?.();
  const cache = await caches.open(AUDIO_CACHE);
  let next = 0;
  let done = 0;
  let failed = 0;
  const worker = async () => {
    while (next < ids.length && !signal.aborted) {
      const path = pathOf(ids[next++]);
      try {
        const res = await fetch(path, { signal });
        if (res.status === 200) await cache.put(path, res);
        else failed++;
      } catch {
        if (signal.aborted) return;
        failed++;
      }
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return failed;
}
