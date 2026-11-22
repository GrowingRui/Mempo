import { useT } from "../i18n";
import { countdownPlan, MAX_DAILY_GOAL } from "../lib/countdown";
import { toDay } from "../lib/date";
import type { Level } from "../lib/types";

/** Plan card block: set the exam date, see the days to go and how many new words a day finish the level in time. */
export default function ExamCountdown({
  examDate,
  level,
  left,
  goal,
  onDate,
  onGoal,
}: {
  examDate: string;
  level: Level;
  /** Words of the level not seen yet (undefined while the list loads). */
  left: number | undefined;
  goal: number;
  onDate: (day: string) => void;
  onGoal: (n: number) => void;
}) {
  const t = useT();
  const today = toDay();
  const plan = examDate && left !== undefined ? countdownPlan(examDate, today, left, goal) : undefined;

  return (
    <div className="mt-5">
      <h3 className="mb-2 font-display text-lg font-bold">{t.home.examTitle}</h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={examDate}
          min={today}
          onChange={(e) => onDate(e.target.value)}
          aria-label={t.home.examTitle}
          className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-3 py-2.5 font-semibold outline-none focus:border-brand"
        />
        {examDate && (
          <button type="button" onClick={() => onDate("")} className="shrink-0 text-sm font-bold text-brand-ink underline decoration-2 underline-offset-2 hover:text-ink">
            {t.home.examClear}
          </button>
        )}
      </div>
      {!examDate && <p className="mt-2 text-sm font-medium text-muted">{t.home.examHint}</p>}
      {plan && (
        <div className="mt-3 rounded-2xl bg-brand-soft/60 px-3.5 py-3">
          <p className="font-display text-xl font-extrabold text-brand-ink">{plan.status === "past" ? t.home.examPast : t.home.examIn(plan.days)}</p>
          {plan.status === "done" && <p className="mt-1 text-sm font-semibold">{t.home.examDone(level)}</p>}
          {(plan.status === "ontrack" || plan.status === "behind") && (
            <>
              <p className="mt-1 text-sm leading-snug font-semibold">{(plan.status === "ontrack" ? t.home.examOnTrack : t.home.examBehind)(left ?? 0, level, plan.need, goal)}</p>
              {plan.status === "behind" && (
                <button
                  type="button"
                  onClick={() => onGoal(Math.min(plan.need, MAX_DAILY_GOAL))}
                  className="press mt-2 rounded-xl bg-brand px-3.5 py-1.5 text-sm font-extrabold text-white [--depth:3px] [--edge:var(--color-brand-edge)]"
                >
                  {t.home.examSetGoal(Math.min(plan.need, MAX_DAILY_GOAL))}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
