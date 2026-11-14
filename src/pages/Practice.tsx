import { useEffect, useState, type ReactNode } from "react";
import ScreenHeader from "../components/ScreenHeader";
import { useT } from "../i18n";
import { toDay } from "../lib/date";
import type { Screen } from "../lib/nav";
import { sessionParts } from "../lib/session";
import type { Progress } from "../lib/types";
import { loadWords } from "../lib/words";

/** One practice mode: icon, title, one line of explanation, and a count when there is one. */
export function PracticeCard({
  onClick,
  title,
  sub,
  icon,
  tone = "brand",
  count,
}: {
  onClick: () => void;
  title: string;
  sub: string;
  icon: ReactNode;
  tone?: "brand" | "dontknow";
  count?: number;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="press flex items-center gap-3.5 rounded-[22px] border-2 border-line bg-card p-3.5 text-left hover:border-brand/40 md:flex-col md:items-start md:gap-3 md:p-5"
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tone === "dontknow" ? "bg-dontknow/12 text-dontknow-ink" : "bg-brand-soft text-brand-ink"}`}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-lg leading-tight font-extrabold">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-dontknow px-2 py-0.5 text-xs font-bold text-white tabular-nums">{t.num(count)}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm leading-snug font-semibold text-muted">{sub}</span>
      </span>
      <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-muted md:hidden" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export const PRACTICE_ICONS = {
  dontknow: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9M12 17h.01" />,
  recall: <path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3zM9.5 19.5h5M10.5 22h3" />,
  exam: <path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6" />,
  skip: <path d="M5 6l6 6-6 6M13 6l6 6-6 6" />,
  test: <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />,
};

/** The Practice tab: every extra way to learn, next to the daily session on Today. */
export default function Practice({ progress, go }: { progress: Progress; go: (s: Screen) => void }) {
  const t = useT();
  const { level } = progress.settings;
  const [levelIds, setLevelIds] = useState<string[]>();
  useEffect(() => {
    loadWords(level)
      .then((ws) => setLevelIds(ws.map((w) => w.id)))
      .catch(() => {});
  }, [level]);
  const parts = sessionParts(progress, toDay());
  // "Skip words you know" goes away once every word of the level has been seen.
  const canSkip = levelIds !== undefined && levelIds.some((id) => !progress.cards[id]);

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.practice.title} />
      <p className="mt-2 font-medium text-muted">{t.practice.intro}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 md:gap-4">
        <PracticeCard
          onClick={() => go({ name: "dontknow" })}
          title={t.answer.dontknow}
          sub={t.practice.dontKnowSub}
          icon={PRACTICE_ICONS.dontknow}
          tone="dontknow"
          count={parts.dontKnowTotal}
        />
        <PracticeCard onClick={() => go({ name: "recall" })} title={t.home.recall} sub={t.home.recallSub} icon={PRACTICE_ICONS.recall} />
        <PracticeCard onClick={() => go({ name: "exam" })} title={t.home.exam} sub={t.home.examSub} icon={PRACTICE_ICONS.exam} />
        {canSkip && <PracticeCard onClick={() => go({ name: "skip" })} title={t.home.skip} sub={t.home.skipSub} icon={PRACTICE_ICONS.skip} />}
        <PracticeCard onClick={() => go({ name: "test" })} title={t.practice.testTitle} sub={t.practice.testSub} icon={PRACTICE_ICONS.test} />
      </div>
    </main>
  );
}
