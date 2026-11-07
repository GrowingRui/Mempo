import type { Theme } from "./types";

// Browser bar colour per theme (matches --color-paper in src/index.css).
const BAR = { light: "#eef0ff", dark: "#15122e" };

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Puts the "dark" class on <html> when the theme is dark (or "system" and the device is dark),
 * and keeps following the device while the setting is "system". Returns a cleanup function.
 * index.html runs the same check before the first paint, so the page never flashes light.
 */
export function applyTheme(theme: Theme): () => void {
  const mq = systemDark();
  const apply = () => {
    const dark = theme === "dark" || (theme === "system" && mq.matches);
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? BAR.dark : BAR.light);
  };
  apply();
  if (theme !== "system") return () => {};
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}
