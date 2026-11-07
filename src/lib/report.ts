// "Report a translation": there's no server, so a report becomes a pre-filled GitHub issue.
// The issue includes a line ready to paste into scripts/manual.ts (hand fixes used by `npm run data:enrich`).
import { site } from "../config/site";
import type { Gloss, Word } from "./types";

export type ReportTopic = "zh" | "es" | "example" | "other";

export const TOPIC_LABEL: Record<ReportTopic, string> = {
  zh: "Chinese",
  es: "Spanish",
  example: "Example sentence",
  other: "Something else",
};

const glossLine = (gs: Gloss[]) => gs.map((g) => `${g.pos ? `${g.pos}. ` : ""}${g.gloss.join("; ")}`).join(" | ") || "(none)";
/** A single-quoted TS string literal. */
function quote(s: string): string {
  const bs = String.fromCharCode(92); // backslash
  const escaped = s.split(bs).join(bs + bs).split("'").join(bs + "'");
  return "'" + escaped + "'";
}

/** The suggestion as a scripts/manual.ts entry, e.g.  'access': { es: { n: ['acceso', 'entrada'] } }, */
export function manualLine(w: Word, topic: ReportTopic, suggestion: string): string | undefined {
  if (topic !== "zh" && topic !== "es") return undefined;
  const glosses = suggestion
    .split(/[,;，；、\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!glosses.length) return undefined;
  const pos = w[topic][0]?.pos || w.pos[0] || "";
  const key = pos || "''";
  return "  " + quote(w.id) + ": { " + topic + ": { " + key + ": [" + glosses.map(quote).join(", ") + "] } },";
}

export function reportUrl(w: Word, topic: ReportTopic, suggestion: string): string {
  const text = suggestion.trim();
  const line = manualLine(w, topic, text);
  const body = [
    `**Word:** ${w.word} (${w.level}, id \`${w.id}\`)`,
    `**Problem with:** ${TOPIC_LABEL[topic]}`,
    "",
    "**Shown now**",
    `- 中文: ${glossLine(w.zh)}`,
    `- Español: ${glossLine(w.es)}`,
    ...(topic === "example" ? w.examples.slice(0, 2).map((e) => `- Example: ${e.text}`) : []),
    "",
    "**Suggestion**",
    text || "(none given)",
    ...(line ? ["", "For `scripts/manual.ts`:", "```ts", line, "```"] : []),
  ].join("\n");
  const params = new URLSearchParams({ title: `Translation: ${w.word} (${TOPIC_LABEL[topic]})`, body });
  return `${site.repoUrl}/issues/new?${params}`;
}
