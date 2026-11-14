// The app's main navigation, shaped like the popular learning apps:
// - phones: a tab bar fixed at the bottom (Today, Practice, Words, Stats; Settings is the gear on Today)
// - tablets and computers: a sidebar on the left (icons only on tablets, icons + names on computers)
import type { ReactNode } from "react";
import { site } from "../config/site";
import { useT } from "../i18n";
import type { Screen } from "../lib/nav";
import Mascot from "./Mascot";

export type Tab = "home" | "practice" | "words" | "stats" | "settings";

/** Which tab is lit on a screen (the "Don't know" list belongs to Practice). */
export function tabOf(screen: Screen): Tab | undefined {
  if (screen.name === "dontknow") return "practice";
  return (["home", "practice", "words", "stats", "settings"] as const).find((n) => n === screen.name);
}

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M3.5 10.5L12 4l8.5 6.5V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />,
  practice: <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z" />,
  words: <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6" />,
  stats: <path d="M5 20v-8M12 20V5M19 20v-5" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
};

function Icon({ tab, className }: { tab: Tab; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[tab]}
    </svg>
  );
}

function useLabels(): Record<Tab, string> {
  const t = useT();
  return { home: t.nav.today, practice: t.nav.practice, words: t.nav.words, stats: t.nav.stats, settings: t.nav.settings };
}

/** Left sidebar, tablets and computers only. */
export function Sidebar({ active, onTab }: { active: Tab | undefined; onTab: (tab: Tab) => void }) {
  const t = useT();
  const labels = useLabels();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col border-r-2 border-line px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5 md:flex lg:w-60 lg:px-4">
      <button type="button" onClick={() => onTab("home")} className="mb-6 flex items-center justify-center gap-2.5 lg:justify-start lg:px-2">
        <Mascot className="size-11 shrink-0" />
        <span className="hidden font-display text-[28px] leading-none font-extrabold tracking-tight lg:block">{site.name}</span>
      </button>
      <nav aria-label={t.nav.aria} className="flex flex-col gap-1.5">
        {(["home", "practice", "words", "stats", "settings"] as const).map((tab) => {
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTab(tab)}
              aria-current={on ? "page" : undefined}
              title={labels[tab]}
              className={`flex items-center justify-center gap-3.5 rounded-2xl border-2 px-3 py-2.5 font-display text-[17px] font-bold transition-colors lg:justify-start ${
                on ? "border-brand/40 bg-brand-soft text-brand-ink" : "border-transparent text-muted hover:bg-brand-soft/50 hover:text-ink"
              }`}
            >
              <Icon tab={tab} className="size-[26px] shrink-0" />
              <span className="hidden lg:inline">{labels[tab]}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/** Bottom tab bar, phones only. */
export function TabBar({ active, onTab }: { active: Tab | undefined; onTab: (tab: Tab) => void }) {
  const t = useT();
  const labels = useLabels();
  return (
    <nav
      aria-label={t.nav.aria}
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {(["home", "practice", "words", "stats"] as const).map((tab) => {
          const on = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTab(tab)}
              aria-current={on ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-bold ${on ? "text-brand-ink" : "text-muted"}`}
            >
              <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? "bg-brand-soft" : ""}`}>
                <Icon tab={tab} className="size-6" />
              </span>
              <span className="max-w-full truncate px-1">{labels[tab]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
