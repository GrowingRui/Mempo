import { useEffect, useState } from "react";
import Flame from "../components/Flame";
import ScreenHeader from "../components/ScreenHeader";
import { useT } from "../i18n";
import { toDay } from "../lib/date";
import { breakdown, lastDays, streakOf, type DayBar, type LevelBreakdown } from "../lib/stats";
import type { WordStatus } from "../lib/srs";
import { LEVELS, type Level, type Progress, type Word } from "../lib/types";
import { loadWords } from "../lib/words";

const DAYS = 14;

function Tile({ n, label }: { n: number; label: string }) {
  const t = useT();
  return (
    <div className="raised rounded-[20px] border-2 border-line bg-card px-3 pt-2.5 pb-3">
      <div className="font-display text-[26px] leading-tight font-extrabold tabular-nums">{t.num(n)}</div>
      <div className="text-[13px] leading-tight font-semibold text-muted">{label}</div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block size-3 shrink-0 rounded-[4px]" style={{ background: `var(${color})` }} />;
}

/** Daily activity: one column per day, new words at the bottom and reviews stacked on top. Tap a day for its numbers. */
function DailyChart({ bars }: { bars: DayBar[] }) {
  const t = useT();
  const today = toDay();
  const [picked, setPicked] = useState<string>();
  const max = Math.max(1, ...bars.map((b) => b.new + b.reviewed));
  const sel = bars.find((b) => b.day === picked);
  const total = bars.reduce((s, b) => s + b.new + b.reviewed, 0);
  const H = 120; // px, plot height

  return (
    <section className="raised mt-4 rounded-[28px] border-2 border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{t.stats.lastDays(DAYS)}</h2>
        <div className="flex gap-3 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <Swatch color="--color-bar-new" /> {t.stats.new}
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch color="--color-bar-reviewed" /> {t.stats.reviewed}
          </span>
        </div>
      </div>

      <p className="mt-1 mb-6 h-5 text-sm font-semibold text-muted" aria-live="polite">
        {sel ? (
          <>
            <span className="text-ink">{t.pastDay(sel.day, today)}</span>: {t.stats.dayLine(sel.new, sel.reviewed)}
          </>
        ) : total ? (
          t.stats.tapDay
        ) : (
          t.stats.nothingYet
        )}
      </p>

      <div className="relative" style={{ height: H }} aria-hidden>
        {/* recessive top gridline with the scale */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="absolute -top-4.5 right-0 text-[11px] font-semibold text-muted tabular-nums">{max}</span>
        <div className="absolute inset-0 flex items-end gap-1">
          {bars.map((b) => {
            const n = b.new + b.reviewed;
            const active = picked === b.day;
            return (
              <button
                key={b.day}
                type="button"
                tabIndex={-1}
                onClick={() => setPicked(active ? undefined : b.day)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setPicked(b.day)}
                title={`${t.pastDay(b.day, today)}: ${t.stats.dayLine(b.new, b.reviewed)}`}
                className={`flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px] transition-opacity ${picked && !active ? "opacity-35" : ""}`}
              >
                {b.reviewed > 0 && (
                  <span
                    className="block w-full rounded-t-[4px]"
                    style={{ height: (b.reviewed / max) * (H - 4), background: "var(--color-bar-reviewed)" }}
                  />
                )}
                {b.new > 0 && (
                  <span
                    className={`block w-full ${b.reviewed > 0 ? "" : "rounded-t-[4px]"}`}
                    style={{ height: (b.new / max) * (H - 4), background: "var(--color-bar-new)" }}
                  />
                )}
                {n === 0 && <span className="block h-[3px] w-full rounded-full bg-line" />}
              </button>
            );
          })}
        </div>
      </div>
      {/* day labels: day of the month, today marked */}
      <div className="mt-1.5 flex gap-1" aria-hidden>
        {bars.map((b) => (
          <span key={b.day} className={`min-w-0 flex-1 text-center text-[10px] font-bold tabular-nums ${b.day === today ? "text-brand-ink" : "text-muted"}`}>
            {Number(b.day.slice(8))}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{t.stats.tableCaption(DAYS)}</caption>
        <thead>
          <tr>
            <th>{t.stats.day}</th>
            <th>{t.stats.new}</th>
            <th>{t.stats.reviewed}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.day}>
              <td>{t.pastDay(b.day, today)}</td>
              <td>{b.new}</td>
              <td>{b.reviewed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// Bar order goes from best to worst, so the filled part grows from the left as you learn.
const SEGMENTS: { key: Exclude<WordStatus, "new">; color: string }[] = [
  { key: "mastered", color: "--color-bar-mastered" },
  { key: "review", color: "--color-bar-review" },
  { key: "learning", color: "--color-bar-learning" },
  { key: "dontknow", color: "--color-bar-dontknow" },
];

function LevelRow({ level, b }: { level: Level; b: LevelBreakdown | undefined }) {
  const t = useT();
  const seen = b ? b.total - b.new : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-extrabold">{level}</span>
        <span className="text-sm font-semibold text-muted tabular-nums">
          {b ? (
            t.stats.seenOf(<span className="text-ink">{t.num(seen)}</span>, b.total)
          ) : (
            "…"
          )}
        </span>
      </div>
      <div className="mt-1.5 flex h-4 gap-[2px] overflow-hidden rounded-[6px] bg-brand-soft">
        {b &&
          SEGMENTS.filter((s) => b[s.key] > 0).map((s) => (
            <span
              key={s.key}
              title={`${t.status[s.key]}: ${t.num(b[s.key])}`}
              className="h-full min-w-[3px] first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{ width: `${(b[s.key] / b.total) * 100}%`, background: `var(${s.color})` }}
            />
          ))}
      </div>
      {b && seen > 0 && (
        <p className="mt-1.5 text-xs font-semibold text-muted">
          {SEGMENTS.filter((s) => b[s.key] > 0)
            .map((s) => t.stats.segment(b[s.key], t.status[s.key]))
            .join(" · ")}
        </p>
      )}
    </li>
  );
}

export default function Stats({ progress, onBack }: { progress: Progress; onBack: () => void }) {
  const t = useT();
  const { history, cards } = progress;
  const streak = streakOf(history);
  const [words, setWords] = useState<Partial<Record<Level, Word[]>>>({});

  useEffect(() => {
    for (const lv of LEVELS) loadWords(lv).then((ws) => setWords((w) => ({ ...w, [lv]: ws }))).catch(() => {});
  }, []);

  const all = Object.values(cards);
  const mastered = all.filter((c) => c.state === "mastered").length;
  const reviews = Object.values(history).reduce((s, h) => s + h.reviewed, 0);

  return (
    <main className="flex flex-1 flex-col pb-4">
      <ScreenHeader title={t.stats.title} onBack={onBack} />

      {/* Streak */}
      <section aria-label={t.stats.streakAria} className="raised mt-6 flex items-center gap-4 rounded-[28px] border-2 border-line bg-card p-5">
        <Flame lit={streak.current > 0} className="size-16 shrink-0" />
        <div>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-5xl leading-none font-extrabold tabular-nums">{streak.current}</span>
            <span className="font-display text-xl font-bold">{t.stats.dayStreak(streak.current)}</span>
          </p>
          <p className="mt-1.5 text-sm font-semibold text-muted">
            {streak.doneToday ? t.stats.studiedToday : streak.current > 0 ? t.stats.keepItGoing : t.stats.startStreak}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-muted">{t.stats.longest(<span className="text-ink">{t.common.days(streak.longest)}</span>)}</p>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Tile n={all.length} label={t.stats.wordsSeen} />
        <Tile n={mastered} label={t.stats.mastered} />
        <Tile n={streak.daysStudied} label={t.stats.daysStudied} />
      </div>

      <DailyChart bars={lastDays(history, DAYS)} />

      {/* Per level */}
      <section className="raised mt-4 rounded-[28px] border-2 border-line bg-card p-5">
        <h2 className="font-display text-lg font-bold">{t.stats.byLevel}</h2>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <Swatch color={s.color} /> {t.status[s.key]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <Swatch color="--color-brand-soft" /> {t.stats.notSeen}
          </span>
        </div>
        <ul className="mt-4 space-y-4">
          {LEVELS.map((lv) => (
            <LevelRow key={lv} level={lv} b={words[lv] && breakdown(words[lv], cards)} />
          ))}
        </ul>
        <p className="mt-4 text-xs font-semibold text-muted">{t.stats.reviewsTotal(reviews)}</p>
      </section>
    </main>
  );
}
