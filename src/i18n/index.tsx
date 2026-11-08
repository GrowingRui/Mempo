// The app's interface language (Settings → Language). English is the default and is never switched
// automatically from the device's language (decided 2026-11-07).
// Adding a language: copy zh.tsx, translate it, add it to LANGS and MESSAGES below and to `Lang` in lib/types.ts.
import { createContext, use, type ReactNode } from "react";
import type { Lang } from "../lib/types";
import en, { type Messages } from "./en";
import es from "./es";
import zh from "./zh";

export type { Messages };

/** Picker order; each name is written in its own language. */
export const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Español" },
];

const MESSAGES: Record<Lang, Messages> = { en, zh, es };

/** HTML lang attribute (screen readers, Chinese font choice). */
export const HTML_LANG: Record<Lang, string> = { en: "en", zh: "zh-Hans", es: "es" };

let current: Lang = "en";

/**
 * Texts for code outside React (error messages thrown by lib/*.ts). Follows the language set by <LangProvider>.
 * Components use useT() instead, so they redraw when the language changes.
 */
export const tr = (): Messages => MESSAGES[current];

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  current = lang;
  return <LangContext value={lang}>{children}</LangContext>;
}

export const useLang = (): Lang => use(LangContext);
export const useT = (): Messages => MESSAGES[use(LangContext)];
export const messagesFor = (lang: Lang): Messages => MESSAGES[lang];
