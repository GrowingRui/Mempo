import { useEffect, useState, type ReactNode } from "react";
import { site } from "../config/site";
import { toDay } from "../lib/date";
import type { Screen } from "../App";
import { newWordsLeftToday, sessionParts } from "../lib/session";
import { LEVELS, type Level, type Progress } from "../lib/types";
import { loadIndex, loadWords, type LevelIndex } from "../lib/words";

const LEVEL_NAME: Record<Level, string> = {
  B2: "Upper-intermediate",
  C1: "Advanced",
  C2: "Proficiency",
};

const GOALS = [10, 20, 30, 50];
const MIN_GOAL = 1;
const MAX_GOAL = 500;

function GoalChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`min-w-0 flex-1 rounded-full border py-2.5 font-semibold tabular-nums transition active:scale-95 ${
        active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-ink/30"
      }`}
    >
      {children}
    </button>
  );
}

function NavTile({ onClick, n, label, tone }: { onClick: () => void; n: number | undefined; label: string; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-line bg-card px-3 py-3 text-left transition hover:border-ink/30 active:scale-[0.97]"
    >
      <span className={`block text-xl font-semibold tabular-nums ${tone}`}>{n === undefined ? "…" : n.toLocaleString()}</span>
      <span className="flex items-center justify-between text-xs text-muted">
        {label}
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  go: (s: Screen) => void;
}

export default function Home({ progress, setProgress, go }: Props) {
  const { settings, cards } = progress;
  const [index, setIndex] = useState<LevelIndex>();
  const [levelIds, setLevelIds] = useState<string[]>();

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => {});
  }, []);

  useEffect(() => {
    setLevelIds(undefined);
    loadWords(settings.level)
      .then((ws) => setLevelIds(ws.map((w) => w.id)))
      .catch(() => {});
  }, [settings.level]);

  const today = toDay();
  const doneToday = progress.history[today]?.new ?? 0;
  const left = newWordsLeftToday(progress, today);
  const goalPct = Math.min(100, (doneToday / settings.dailyNew) * 100);

  const levelCards = levelIds?.map((id) => cards[id]).filter(Boolean) ?? [];
  const seen = levelCards.length;
  const total = index?.counts[settings.level] ?? levelIds?.length ?? 0;
  const allSeen = levelIds !== undefined && seen >= levelIds.length;

  // Today's session: due reviews → "Don't know" words → new words (reviews come from every level).
  const parts = sessionParts(progress, today);
  const newCount = levelIds ? Math.min(left, levelIds.length - seen) : left;
  const sessionSize = parts.reviews.length + parts.dontKnow.length + newCount;
  const breakdown = [
    parts.reviews.length && `${parts.reviews.length} review${parts.reviews.length === 1 ? "" : "s"}`,
    parts.dontKnow.length && `${parts.dontKnow.length} don’t know`,
    newCount && `${newCount} new`,
  ].filter(Boolean);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const goalNum = Number(goalDraft);
  const goalValid = Number.isInteger(goalNum) && goalNum >= MIN_GOAL && goalNum <= MAX_GOAL;
  const isCustomGoal = !GOALS.includes(settings.dailyNew);

  const update = (patch: Partial<Progress["settings"]>) =>
    setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-brand font-display text-2xl font-bold text-paper shadow-[0_6px_16px_-6px_var(--color-brand)]">
          m
        </div>
        <div>
          <h1 className="font-display text-2xl leading-none font-semibold">{site.name}</h1>
          <p className="mt-1 text-sm text-muted">{site.tagline}</p>
        </div>
      </header>

      {/* Today */}
      <section className="mt-8 rounded-[28px] border border-line bg-card p-6">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Today</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold tabular-nums">{doneToday}</span>
          <span className="text-lg text-muted">/ {settings.dailyNew} new words</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="mt-4 text-sm text-muted">
          Seen in {settings.level}:{" "}
          <span className="font-semibold text-ink tabular-nums">{levelIds ? seen.toLocaleString() : "…"}</span> / {total.toLocaleString()}
        </p>
      </section>

      {/* Other screens */}
      <nav className="mt-4 grid grid-cols-3 gap-2.5" aria-label="Practice">
        <NavTile onClick={() => go({ name: "study", mode: "review" })} n={parts.allDue} label="Reviews due" tone="text-brand" />
        <NavTile onClick={() => go({ name: "dontknow" })} n={parts.dontKnowTotal} label="Don’t know" tone="text-dontknow" />
        <NavTile onClick={() => go({ name: "words" })} n={index?.counts.total} label="All words" tone="text-ink" />
      </nav>

      {/* Level */}
      <section className="mt-7">
        <h2 className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">Level</h2>
        <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Level">
          {LEVELS.map((lv) => {
            const active = lv === settings.level;
            return (
              <button
                key={lv}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ level: lv })}
                className={`rounded-2xl border px-3 py-3 text-left transition active:scale-[0.97] ${
                  active ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink/30"
                }`}
              >
                <span className="block font-display text-xl font-semibold">{lv}</span>
                <span className={`block text-[11px] leading-tight ${active ? "text-paper/70" : "text-muted"}`}>{LEVEL_NAME[lv]}</span>
                {index && (
                  <span className={`mt-1 block text-[11px] tabular-nums ${active ? "text-paper/70" : "text-muted"}`}>
                    {index.counts[lv].toLocaleString()} words
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Daily goal */}
      <section className="mt-7">
        <h2 className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">New words per day</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="New words per day">
          {GOALS.map((g) => (
            <GoalChip key={g} active={!editingGoal && g === settings.dailyNew} onClick={() => { setEditingGoal(false); update({ dailyNew: g }); }}>
              {g}
            </GoalChip>
          ))}
          <GoalChip
            active={editingGoal || isCustomGoal}
            onClick={() => {
              setGoalDraft(String(settings.dailyNew));
              setEditingGoal(true);
            }}
          >
            {isCustomGoal && !editingGoal ? settings.dailyNew : "Custom"}
          </GoalChip>
        </div>
        {editingGoal && (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (goalValid) {
                update({ dailyNew: goalNum });
                setEditingGoal(false);
              }
            }}
          >
            <input
              type="number"
              inputMode="numeric"
              min={MIN_GOAL}
              max={MAX_GOAL}
              autoFocus
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              aria-label="Your own number of new words per day"
              className="w-24 rounded-full border border-line bg-card px-4 py-2.5 text-center font-semibold tabular-nums outline-none focus:border-brand"
            />
            <span className="text-sm text-muted">words a day</span>
            <button
              type="submit"
              disabled={!goalValid}
              className="ml-auto rounded-full bg-ink px-5 py-2.5 font-semibold text-paper transition active:scale-95 disabled:opacity-40"
            >
              Save
            </button>
          </form>
        )}
        {editingGoal && !goalValid && goalDraft !== "" && (
          <p className="mt-2 text-sm text-dontknow">
            Choose a number from {MIN_GOAL} to {MAX_GOAL}.
          </p>
        )}
      </section>

      <div className="mt-auto pt-8">
        {sessionSize > 0 ? (
          <button
            type="button"
            onClick={() => go({ name: "study", mode: "today" })}
            disabled={!levelIds}
            className="w-full rounded-full bg-brand py-3.5 text-white shadow-[0_10px_24px_-10px_var(--color-brand)] transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-60"
          >
            <span className="block text-lg font-semibold">{doneToday === 0 && !progress.history[today]?.reviewed ? "Start" : "Continue"}</span>
            <span className="block text-sm text-white/80">{breakdown.join(" · ")}</span>
          </button>
        ) : (
          <p className="rounded-2xl bg-know/10 px-5 py-4 text-center font-semibold text-know">
            {allSeen && left > 0 ? `You’ve seen every ${settings.level} word. Try another level!` : "All done for today. See you tomorrow!"}
          </p>
        )}
        <p className="mt-3 text-center text-xs text-muted">Your progress is saved automatically in this browser.</p>
      </div>
    </main>
  );
}
