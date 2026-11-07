import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Screen } from "../App";
import Mascot from "../components/Mascot";
import { site } from "../config/site";
import { toDay } from "../lib/date";
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

/** "a", "a and b", "a, b and c" */
const listJoin = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

function GoalChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`press min-w-0 flex-1 rounded-2xl border-2 py-2.5 font-display text-lg font-bold tabular-nums ${
        active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

function NavTile({ onClick, n, label, tone }: { onClick: () => void; n: number | undefined; label: string; tone: string }) {
  return (
    <button type="button" onClick={onClick} className="press rounded-[20px] border-2 border-line bg-card px-3 pt-2.5 pb-3 text-left hover:border-brand/40">
      <span className={`block font-display text-[26px] leading-tight font-extrabold tabular-nums ${tone}`}>
        {n === undefined ? "…" : n.toLocaleString()}
      </span>
      <span className="flex items-center justify-between gap-1 text-[13px] font-semibold text-muted">
        {label}
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  const [confirmReset, setConfirmReset] = useState(false);

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

  const seen = levelIds?.filter((id) => cards[id]).length ?? 0;
  const total = index?.counts[settings.level] ?? levelIds?.length ?? 0;
  const allSeen = levelIds !== undefined && seen >= levelIds.length;

  // Today's session: due reviews → "Don't know" words → new words (reviews come from every level).
  const parts = sessionParts(progress, today);
  const newCount = levelIds ? Math.min(left, levelIds.length - seen) : left;
  const sessionSize = parts.reviews.length + parts.dontKnow.length + newCount;
  const breakdown = [
    parts.reviews.length ? plural(parts.reviews.length, "review") : "",
    parts.dontKnow.length ? `${parts.dontKnow.length} don’t know` : "",
    newCount ? `${newCount} new` : "",
  ].filter(Boolean);
  const started = doneToday > 0 || (progress.history[today]?.reviewed ?? 0) > 0;
  const hasProgress = Object.keys(cards).length > 0;

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
        <Mascot className="size-14 shrink-0" />
        <div>
          <h1 className="font-display text-[32px] leading-none font-extrabold tracking-tight">{site.name}</h1>
          <p className="mt-1 font-semibold text-muted">{site.tagline}</p>
        </div>
      </header>

      {/* Today */}
      <section aria-label="Today" className="raised mt-7 rounded-[28px] border-2 border-line bg-card p-5">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-6xl leading-none font-extrabold text-brand tabular-nums">{doneToday}</span>
          <span className="font-display text-xl font-bold text-ink">of {settings.dailyNew} new words today</span>
        </p>
        <div className="mt-4 h-5 overflow-hidden rounded-full bg-brand-soft p-1">
          <div
            className="relative h-full rounded-full bg-brand transition-[width] duration-500 after:absolute after:inset-x-2 after:top-[3px] after:h-[3px] after:rounded-full after:bg-white/35"
            style={{ width: goalPct > 0 ? `max(${goalPct}%, 1.5rem)` : 0 }}
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-muted">
          Seen in {settings.level}: <span className="text-ink tabular-nums">{levelIds ? seen.toLocaleString() : "…"}</span> of{" "}
          {total.toLocaleString()} words
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
        <h2 className="mb-2.5 font-display text-lg font-bold">Your level</h2>
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
                className={`press rounded-[20px] border-2 px-3 py-2.5 text-left ${
                  active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
                }`}
              >
                <span className="block font-display text-2xl font-extrabold">{lv}</span>
                <span className={`block text-xs leading-tight font-semibold ${active ? "text-white/80" : "text-muted"}`}>{LEVEL_NAME[lv]}</span>
                {index && (
                  <span className={`mt-0.5 block text-xs tabular-nums ${active ? "text-white/70" : "text-muted"}`}>
                    {index.counts[lv].toLocaleString()} words
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Daily goal */}
      <section className="mt-6">
        <h2 className="mb-2.5 font-display text-lg font-bold">New words per day</h2>
        <div className="flex gap-2" role="radiogroup" aria-label="New words per day">
          {GOALS.map((g) => (
            <GoalChip
              key={g}
              active={!editingGoal && g === settings.dailyNew}
              onClick={() => {
                setEditingGoal(false);
                update({ dailyNew: g });
              }}
            >
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
            {isCustomGoal && !editingGoal ? settings.dailyNew : <span className="text-base">Custom</span>}
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
              className="w-24 rounded-2xl border-2 border-line bg-card px-4 py-2.5 text-center font-display text-lg font-bold tabular-nums outline-none focus:border-brand"
            />
            <span className="font-semibold text-muted">words a day</span>
            <button
              type="submit"
              disabled={!goalValid}
              className="press ml-auto rounded-2xl bg-ink px-5 py-2.5 font-bold text-white [--edge:#000] disabled:opacity-40"
            >
              Save
            </button>
          </form>
        )}
        {editingGoal && !goalValid && goalDraft !== "" && (
          <p className="mt-2 text-sm font-semibold text-dontknow">
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
            className="press w-full rounded-3xl bg-brand py-3.5 text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-60"
          >
            <span className="block font-display text-2xl font-extrabold">{started ? "Keep going" : "Start"}</span>
            <span className="block text-sm font-semibold text-white/85">{listJoin(breakdown)}</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-3xl border-2 border-know/30 bg-know/10 px-4 py-3">
            <Mascot mood="cheer" className="size-12 shrink-0" />
            <p className="font-display text-lg leading-snug font-bold text-know-edge">
              {allSeen && left > 0 ? `You’ve seen every ${settings.level} word. Try another level!` : "All done for today. See you tomorrow!"}
            </p>
          </div>
        )}
        <p className="mt-4 text-center text-xs font-semibold text-muted">
          Your progress is saved in this browser.
          {hasProgress && (
            <>
              {" "}
              <button type="button" onClick={() => setConfirmReset(true)} className="underline decoration-2 underline-offset-2 hover:text-dontknow">
                Start over
              </button>
            </>
          )}
        </p>
      </div>

      {confirmReset && (
        <ResetDialog
          words={Object.keys(cards).length}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setProgress((p) => ({ settings: p.settings, cards: {}, history: {} }));
            setConfirmReset(false);
          }}
        />
      )}
    </main>
  );
}

function ResetDialog({ words, onCancel, onConfirm }: { words: number; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-5" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 text-center shadow-[0_8px_0_var(--color-line-edge)]"
      >
        <Mascot mood="sad" className="mx-auto size-20" />
        <h2 id="reset-title" className="mt-3 font-display text-2xl font-extrabold">
          Start over from zero?
        </h2>
        <p id="reset-desc" className="mt-2 text-muted">
          This deletes your progress on {plural(words, "word")} in this browser: reviews, your “Don’t know” list and daily history. Your
          level and daily goal stay. This can’t be undone.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)]"
          >
            Keep my progress
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="press rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow [--edge:var(--color-dontknow)]"
          >
            Delete everything
          </button>
        </div>
      </div>
    </div>
  );
}
