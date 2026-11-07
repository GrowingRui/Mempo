/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function toDay(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "today", "tomorrow", or e.g. "Tue 10 Nov". */
export function formatDay(day: string, today = toDay()): string {
  if (day <= today) return "today";
  if (day === addDays(today, 1)) return "tomorrow";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return toDay(new Date(y, m - 1, d + n));
}

/** For days in the past: "Today", "Yesterday", or e.g. "Fri 6 Nov". */
export function formatPastDay(day: string, today = toDay()): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
