import { site } from "../config/site";
import { standalone } from "./install";

/**
 * "Send feedback": the form posts to api/feedback.ts, which emails it to the developer.
 * The app adds details by itself (version, device, screen, the word), so a problem can be reproduced
 * without asking back. If sending fails, the form offers a pre-filled email (mailto:) instead.
 */

export type FeedbackKind = "bug" | "idea" | "word" | "other";

export const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Suggestion",
  word: "Wrong word info",
  other: "Other",
};

export interface FeedbackForm {
  kind: FeedbackKind;
  message: string;
  email?: string;
  /** Short subject addition, e.g. "access · Chinese". */
  about?: string;
  /** Extra details from the app, already formatted. Device details are added by `withDevice`. */
  details?: string;
  /** Hidden trap field: people never see it, bots fill it in. */
  website?: string;
}

export const appVersion = () => (typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev");

/** The app version, device and screen, as "Name: value" lines. */
export function deviceDetails(screen: string): string {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const lines = [
    `Version: ${appVersion()}`,
    `Screen: ${screen}`,
    `Installed app: ${standalone() ? "yes" : "no"}`,
    ...(typeof window !== "undefined" ? [`Window: ${window.innerWidth}×${window.innerHeight}`] : []),
    ...(nav ? [`Language: ${nav.language}`, `Browser: ${nav.userAgent}`] : []),
  ];
  return lines.join("\n");
}

export const withDevice = (f: FeedbackForm, screen: string): FeedbackForm => ({
  ...f,
  details: [f.details, deviceDetails(screen)].filter(Boolean).join("\n\n"),
});

export const feedbackAddress = () => site.feedbackMail.join("@");

/** A pre-filled email with the same message, for when the server can't send it. */
export function mailtoUrl(f: FeedbackForm, address = feedbackAddress()): string {
  const subject = `[${site.name}] ${KIND_LABEL[f.kind]}${f.about ? `: ${f.about}` : ""}`;
  const body = [f.message.trim(), ...(f.details ? ["", "———", f.details] : [])].join("\n");
  // encodeURIComponent, not URLSearchParams: mail apps show "+" instead of spaces.
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Sends the form. Throws with a message for the user when it couldn't be sent. */
export async function sendFeedback(f: FeedbackForm): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
  } catch {
    throw new Error(navigator.onLine === false ? "You’re offline." : "Couldn’t reach Mempo’s server.");
  }
  if (res.ok) return;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error ?? "Couldn’t send it right now.");
}
