import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { site } from "../config/site";
import Mascot from "./Mascot";

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker (src/sw.ts) and shows a small toast at the top:
 *  - "Ready to work offline" once, after the first install (hides itself);
 *  - "New version" when an update is waiting. It waits for a tap, so a study session is never cut off.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url, reg) {
      // An app left open on a phone may never reload: look for a new version every hour while it's visible.
      if (!reg) return;
      setInterval(() => {
        if (document.visibilityState === "visible" && navigator.onLine) fetch(url, { cache: "no-store" }).then((r) => void (r.ok && reg.update()), () => {});
      }, HOUR);
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  const show = needRefresh || offlineReady;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]" aria-live="polite">
      <AnimatePresence>
        {show && (
          <motion.div
            role="status"
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-[20px] border-2 border-line bg-card py-2.5 pr-2.5 pl-3 shadow-[0_6px_0_var(--color-line-edge)]"
          >
            <Mascot mood={needRefresh ? "cheer" : "happy"} className="size-10 shrink-0" />
            <p className="min-w-0 flex-1 text-sm leading-snug font-semibold">
              {needRefresh ? `A new version of ${site.name} is ready.` : `${site.name} now works offline.`}
            </p>
            {needRefresh ? (
              <>
                <button type="button" onClick={() => setNeedRefresh(false)} className="rounded-xl px-2 py-2 text-sm font-bold text-muted hover:text-ink">
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => void updateServiceWorker(true)}
                  className="press rounded-xl bg-brand px-3.5 py-2 font-display text-sm font-bold text-white [--depth:3px] [--edge:var(--color-brand-edge)]"
                >
                  Update
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setOfflineReady(false)} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-lg font-bold text-muted hover:text-ink">
                ×
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
