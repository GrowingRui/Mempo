import { describe, expect, it } from "vitest";
import { createNav, type NavHost, type Screen } from "./nav";

/** A browser history in memory. Like the real one, go() / Back arrive later (call flush()). */
function fakeBrowser(startState: unknown = null) {
  const entries: unknown[] = [startState];
  let index = 0;
  let listener: ((e: { state: unknown }) => void) | null = null;
  const later: (() => void)[] = [];
  const traverse = (n: number) => {
    index = Math.max(0, Math.min(entries.length - 1, index + n));
    listener?.({ state: entries[index] });
  };
  const host: NavHost = {
    history: {
      get state() {
        return entries[index];
      },
      pushState(state: unknown) {
        entries.splice(index + 1, entries.length, state);
        index++;
      },
      replaceState(state: unknown) {
        entries[index] = state;
      },
      go(n = 0) {
        later.push(() => traverse(n));
      },
    },
    addEventListener(_type, fn) {
      listener = fn;
    },
  };
  return {
    host,
    flush() {
      while (later.length) later.shift()!();
    },
    /** The user presses the phone's Back button. */
    pressBack() {
      if (index === 0) return "left the app";
      traverse(-1);
    },
    get length() {
      return entries.length;
    },
    get index() {
      return index;
    },
  };
}

function setup(startState?: unknown, forced?: Screen) {
  const b = fakeBrowser(startState);
  const nav = createNav<Screen>(b.host, { name: "home" });
  const first = nav.start(forced);
  const seen: Screen[] = [first];
  nav.listen((s) => seen.push(s));
  const now = () => seen[seen.length - 1];
  return { b, nav, now, seen };
}

describe("phone Back button", () => {
  it("goes back to Home from a screen, then leaves the app", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "settings" });
    expect(now()).toEqual({ name: "settings" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
    expect(b.pressBack()).toBe("left the app");
  });

  it("goes back one screen at a time (Don't know → Practise)", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "dontknow" });
    nav.go({ name: "study", mode: "dontknow" });
    b.pressBack();
    expect(now()).toEqual({ name: "dontknow" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("the app's own back / exit buttons go Home and leave nothing to go back to", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "dontknow" });
    nav.go({ name: "study", mode: "dontknow" });
    nav.go({ name: "home" });
    b.flush();
    expect(now()).toEqual({ name: "home" });
    expect(b.index).toBe(0);
    expect(b.pressBack()).toBe("left the app");
  });

  it("waits for a slow history.go before the next step", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "recall" });
    nav.go({ name: "home" }); // goes back, which arrives later…
    nav.go({ name: "words" }); // …so this waits for it
    b.flush();
    expect(now()).toEqual({ name: "words" });
    expect(b.index).toBe(1);
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("closes an open dialog first and stays on the screen", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "settings" });
    let closed = 0;
    const release = nav.openDialog(() => closed++);
    b.pressBack();
    expect(closed).toBe(1);
    expect(now()).toEqual({ name: "settings" });
    release(); // React unmounts the dialog
    b.flush();
    expect(now()).toEqual({ name: "settings" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("a dialog closed with its own button removes its history entry", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "settings" });
    const release = nav.openDialog(() => {});
    expect(b.index).toBe(2);
    release();
    b.flush();
    expect(b.index).toBe(1);
    expect(now()).toEqual({ name: "settings" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("one dialog closing as another opens (React dev mode mounts twice) leaves one entry", () => {
    const { b, nav } = setup();
    let closed = 0;
    const r1 = nav.openDialog(() => {});
    r1();
    nav.openDialog(() => closed++);
    b.flush();
    expect(b.index).toBe(1);
    b.pressBack();
    expect(closed).toBe(1);
  });

  it("a reload stays on the same screen", () => {
    const first = setup();
    first.nav.go({ name: "stats" });
    const reloaded = setup(first.b.host.history.state);
    expect(reloaded.now()).toEqual({ name: "stats" });
  });

  it("a Move QR link opens Settings, and Back goes Home", () => {
    const { b, now } = setup(null, { name: "settings" });
    expect(now()).toEqual({ name: "settings" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("start() only runs once (React dev mode calls it twice)", () => {
    const b = fakeBrowser();
    const nav = createNav<Screen>(b.host, { name: "home" });
    nav.start({ name: "settings" });
    expect(nav.start({ name: "settings" })).toEqual({ name: "settings" });
    expect(b.length).toBe(2);
  });

  it("the app's own back button also goes one screen back (Practise → the Don't know list)", () => {
    const { b, nav, now } = setup();
    nav.go({ name: "dontknow" });
    nav.go({ name: "study", mode: "dontknow" });
    expect(nav.previous()).toEqual({ name: "dontknow" });
    nav.back();
    b.flush();
    expect(now()).toEqual({ name: "dontknow" });
    expect(nav.previous()).toEqual({ name: "home" });
    nav.back();
    b.flush();
    expect(now()).toEqual({ name: "home" });
    expect(b.pressBack()).toBe("left the app");
  });
});

describe("tabs (bottom tab bar / sidebar)", () => {
  it("switching tabs doesn't pile up: Back from any tab goes Home, then leaves", () => {
    const { b, nav, now } = setup();
    nav.tab({ name: "practice" });
    nav.tab({ name: "words" });
    nav.tab({ name: "stats" });
    expect(now()).toEqual({ name: "stats" });
    expect(b.length).toBe(2);
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
    expect(b.pressBack()).toBe("left the app");
  });

  it("a screen opened from a tab goes back to that tab", () => {
    const { b, nav, now } = setup();
    nav.tab({ name: "practice" });
    nav.go({ name: "recall" });
    b.pressBack();
    expect(now()).toEqual({ name: "practice" });
    b.pressBack();
    expect(now()).toEqual({ name: "home" });
  });

  it("the Today tab goes back to Home's entry", () => {
    const { b, nav, now } = setup();
    nav.tab({ name: "words" });
    nav.tab({ name: "home" });
    b.flush();
    expect(now()).toEqual({ name: "home" });
    expect(b.index).toBe(0);
  });

  it("a tab reloaded stays, with Home below it", () => {
    const { b, nav } = setup();
    nav.tab({ name: "practice" });
    nav.tab({ name: "stats" });
    const again = createNav<Screen>(b.host, { name: "home" });
    expect(again.start()).toEqual({ name: "stats" });
    expect(again.previous()).toEqual({ name: "home" });
  });
});
