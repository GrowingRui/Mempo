/** Helpers shared by the message tables (en.tsx, zh.tsx, es.tsx). */
export { addDays } from "../lib/date";

/** "YYYY-MM-DD" → e.g. "Tue 10 Nov" / "11月10日周二" / "mar, 10 nov". */
export function shortDate(day: string, locale: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/** e.g. "8 Nov 2026" / "2026年11月8日" / "8 nov 2026". */
export const longDate = (d: Date, locale: string) => d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

export const numberIn = (locale: string) => (n: number) => n.toLocaleString(locale);

/** "a", "a and b", "a, b and c" (with the language's own "and" and comma). */
export function joinList(xs: string[], and: string, comma = ", "): string {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(comma)}${and}${xs[xs.length - 1]}`;
}
