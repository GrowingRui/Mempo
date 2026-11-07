import { useEffect, useState } from "react";
import { site } from "../config/site";
import { toDay } from "../lib/date";
import { newWordsLeftToday } from "../lib/session";
import { LEVELS, type Level, type Progress } from "../lib/types";
import { loadIndex, loadWords, type LevelIndex } from "../lib/words";

const LEVEL_NAME: Record<Level, string> = {
  B2: "Upper-intermediate",
  C1: "Advanced",
  C2: "Proficiency",
};

const GOALS = [10, 20, 30, 50];

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onStart: () => void;
}

export default function Home({ progress, setProgress, onStart }: Props) {
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
  const dontKnow = levelCards.filter((c) => c.inDontKnow).length;
  const total = index?.counts[settings.level] ?? levelIds?.length ?? 0;
  const allSeen = levelIds !== undefined && seen >= levelIds.length;

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
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-paper px-4 py-3">
            <dt className="text-muted">Seen in {settings.level}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">
              {levelIds ? seen.toLocaleString() : "…"}
              <span className="text-sm font-normal text-muted"> / {total.toLocaleString()}</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-paper px-4 py-3">
            <dt className="text-muted">Don’t know</dt>
            <dd className="mt-0.5 text-lg font-semibold text-dontknow tabular-nums">{levelIds ? dontKnow : "…"}</dd>
          </div>
        </dl>
      </section>

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
          {GOALS.map((g) => {
            const active = g === settings.dailyNew;
            return (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => update({ dailyNew: g })}
                className={`flex-1 rounded-full border py-2.5 font-semibold tabular-nums transition active:scale-95 ${
                  active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-ink/30"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-auto pt-8">
        {allSeen ? (
          <p className="rounded-2xl bg-know/10 px-5 py-4 text-center font-semibold text-know">
            You’ve seen every {settings.level} word. Try another level!
          </p>
        ) : left > 0 ? (
          <button
            type="button"
            onClick={onStart}
            disabled={!levelIds}
            className="w-full rounded-full bg-brand py-4 text-lg font-semibold text-white shadow-[0_10px_24px_-10px_var(--color-brand)] transition hover:bg-brand-dark active:scale-[0.98] disabled:opacity-60"
          >
            {doneToday === 0 ? "Start" : "Continue"} · {left} new word{left === 1 ? "" : "s"}
          </button>
        ) : (
          <p className="rounded-2xl bg-know/10 px-5 py-4 text-center font-semibold text-know">
            Today’s goal is done. See you tomorrow!
          </p>
        )}
      </div>
    </main>
  );
}
