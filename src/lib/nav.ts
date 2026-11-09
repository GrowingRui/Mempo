// Screens in the browser history, so the phone's Back button (and the browser's) goes back inside Mempo
// instead of closing it. The address never changes; each screen is a history entry with its own state.
//
// - Opening a screen adds an entry; going Home jumps back to the first entry (Back on Home leaves the app).
// - An open dialog adds an entry too, so Back closes the dialog first. Closing it with its own buttons
//   removes that entry again.
// - A reload stays on the same screen (the entry's state survives it).
import { useEffect, useRef } from "react";
import type { SessionMode } from "./session";

export type Screen =
  | { name: "home" }
  | { name: "study"; mode: SessionMode }
  | { name: "dontknow" }
  | { name: "words" }
  | { name: "test" }
  | { name: "recall" }
  | { name: "stats" }
  | { name: "settings" };

/** What's stored in history.state. `i` = position counted from the app's first entry (Home = 0); `prev` = the screen below it. */
interface Entry<S> {
  mempo: 1;
  screen: S;
  i: number;
  prev?: S;
  dialog?: true;
}

/** The parts of `window` this uses (a fake one in tests). */
export interface NavHost {
  history: Pick<History, "state" | "pushState" | "replaceState" | "go">;
  addEventListener(type: "popstate", fn: (e: { state: unknown }) => void): void;
}

interface OpenDialog {
  close: () => void;
  pushed: boolean;
  released: boolean;
  closedByBack: boolean;
}

export function createNav<S extends { name: string }>(host: NavHost, home: S) {
  const h = host.history;
  let current: Entry<S> = { mempo: 1, screen: home, i: 0 };
  let shown: S = home;
  let started = false;
  let listener: ((s: S) => void) | null = null;
  // While a history.go() we started hasn't arrived yet, other steps wait (history.go is asynchronous).
  let pending = false;
  const queue: (() => void)[] = [];
  const dialogs: OpenDialog[] = [];

  const isEntry = (s: unknown): s is Entry<S> => typeof s === "object" && s !== null && (s as Entry<S>).mempo === 1;
  const same = (a: S, b: S) => JSON.stringify(a) === JSON.stringify(b);

  function show(screen: S) {
    if (same(screen, shown)) return;
    shown = screen;
    listener?.(screen);
  }
  function run(step: () => void) {
    queue.push(step);
    while (!pending && queue.length) queue.shift()!();
  }
  function push(entry: Entry<S>) {
    h.pushState(entry, "");
    current = entry;
  }
  function back(n: number) {
    pending = true;
    h.go(-n);
  }

  host.addEventListener("popstate", (e) => {
    const entry = isEntry(e.state) ? e.state : { mempo: 1 as const, screen: home, i: 0 };
    current = entry;
    if (pending) {
      pending = false;
    } else {
      // The user pressed Back (or Forward). An open dialog closes first and the screen stays.
      const top = dialogs.pop();
      if (top) {
        top.closedByBack = true;
        top.close();
      }
    }
    show(entry.screen);
    run(() => {});
  });

  return {
    /** Call once, before the first render. Returns the screen to show. `forced` wins over a reloaded screen. */
    start(forced?: S): S {
      if (started) return shown;
      started = true;
      if ("scrollRestoration" in h) (h as History).scrollRestoration = "manual"; // the app scrolls to the top itself
      const saved = h.state;
      if (!forced && isEntry(saved)) {
        // Reloaded: stay on that screen. A dialog doesn't survive a reload, so its entry becomes a plain one.
        current = { mempo: 1, screen: saved.screen, i: saved.i, prev: saved.prev };
        if (saved.dialog) h.replaceState(current, "");
      } else {
        current = { mempo: 1, screen: home, i: 0 };
        h.replaceState(current, "");
        if (forced && !same(forced, home)) push({ mempo: 1, screen: forced, i: 1, prev: home });
      }
      shown = current.screen;
      return shown;
    },

    /** Called with the new screen after every change, including Back. Returns an unsubscribe function. */
    listen(fn: (s: S) => void): () => void {
      listener = fn;
      return () => {
        if (listener === fn) listener = null;
      };
    },

    /** Open a screen. Home goes back to the first entry, so Back from Home then leaves the app. */
    go(next: S) {
      run(() => {
        if (same(next, home)) {
          if (current.i > 0) back(current.i);
          else show(next);
        } else {
          push({ mempo: 1, screen: next, i: current.i + 1, prev: current.screen });
          show(next);
        }
      });
    },

    /** The app's own back / close buttons: the same as the phone's Back (one screen back). */
    back() {
      run(() => {
        if (current.i > 0) back(1);
        else show(home);
      });
    },

    /** The screen that Back goes to (Home when there's none). */
    previous(): S {
      return current.prev ?? home;
    },

    /** A dialog opened: Back now calls `close`. Call the returned function when the dialog goes away. */
    openDialog(close: () => void): () => void {
      const d: OpenDialog = { close, pushed: false, released: false, closedByBack: false };
      dialogs.push(d);
      run(() => {
        if (d.released) return;
        push({ ...current, i: current.i + 1, dialog: true });
        d.pushed = true;
      });
      return () => {
        d.released = true;
        const at = dialogs.indexOf(d);
        if (at >= 0) dialogs.splice(at, 1);
        if (d.closedByBack) return; // its entry is already gone
        run(() => {
          if (d.pushed) back(1);
        });
      };
    },
  };
}

export type Nav<S extends { name: string }> = ReturnType<typeof createNav<S>>;

let app: Nav<Screen> | null = null;
/** The app's navigation (made on first use, so tests can import this file without a browser). */
export function nav(): Nav<Screen> {
  app ??= createNav<Screen>(window, { name: "home" });
  return app;
}

/** For dialogs: the phone's Back button closes the dialog instead of leaving the screen. */
export function useCloseOnBack(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => nav().openDialog(() => ref.current()), []);
}
