import { site } from "../config/site";
import { tr } from "../i18n";
import { standalone } from "./install";

/**
 * "Send feedback": the form posts to api/feedback.ts, which emails it to the developer.
 * The app adds details by itself (version, device, screen, the word), so a problem can be reproduced
 * without asking back. If sending fails, the form offers a pre-filled email (mailto:) instead.
 */

export type FeedbackKind = "bug" | "idea" | "word" | "other";

/** For the email subject, which the developer reads: always English. The form shows the app language's names. */
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
export function deviceDetails(screen: string, appLang?: string): string {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const lines = [
    `Version: ${appVersion()}`,
    `Screen: ${screen}`,
    `Installed app: ${standalone() ? "yes" : "no"}`,
    ...(appLang ? [`App language: ${appLang}`] : []),
    ...(typeof window !== "undefined" ? [`Window: ${window.innerWidth}×${window.innerHeight}`] : []),
    ...(nav ? [`Language: ${nav.language}`, `Browser: ${nav.userAgent}`] : []),
  ];
  return lines.join("\n");
}

export const withDevice = (f: FeedbackForm, screen: string, appLang?: string): FeedbackForm => ({
  ...f,
  details: [f.details, deviceDetails(screen, appLang)].filter(Boolean).join("\n\n"),
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
    throw new Error(navigator.onLine === false ? tr().feedback.offline : tr().feedback.noServer);
  }
  if (res.ok) return;
  // The server's messages are in English; show ours, in the app's language.
  const t = tr().feedback;
  const byStatus: Record<number, string> = { 400: t.checkForm, 413: t.tooLong, 429: t.tooMany, 503: t.notSetUp };
  throw new Error(byStatus[res.status] ?? t.cantSend);
}
