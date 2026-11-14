import { useEffect, useMemo, useState } from "react";
import Mascot from "../components/Mascot";
import MeaningQuestion from "../components/MeaningQuestion";
import QuizHeader from "../components/QuizHeader";
import ScreenHeader from "../components/ScreenHeader";
import { useT } from "../i18n";
import { makeQuestion, meaning, type Question } from "../lib/leveltest";
import { upcomingNew } from "../lib/session";
import { checkLang, cursorAfter, loadCursor, markKnown, pageFrom, pickChecks, saveCursor, skipResult, unmarkKnown, type SkipResult } from "../lib/skip";
import type { Progress, Word } from "../lib/types";
import { loadWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
}

type Phase =
  | { name: "pick" }
  | { name: "check"; ticked: string[]; questions: Question[]; answers: Record<string, boolean> }
  | { name: "result"; result: SkipResult; undone: boolean };

/** "Skip words you know": tick the next new words of your level you know, a quick check, then they're skipped (src/lib/skip.ts). */
export default function Skip({ progress, setProgress, onExit }: Props) {
  const t = useT();
  const { settings } = progress;
  const lang = checkLang(settings);
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [batch, setBatch] = useState<Word[]>();
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadWords(settings.level)
      .then(setWords)
      .catch((e: Error) => setError(e.message));
  }, [settings.level]);

  const pool = useMemo(() => words?.filter((w) => meaning(w, lang)) ?? [], [words, lang]);

  // Shows the page that starts at the saved place; the place moves on once a page is done (checked or passed over).
  const nextBatch = () => {
    if (!words) return;
    setBatch(pageFrom(upcomingNew(words, progress), loadCursor(settings.level)));
    setTicked(new Set());
    setPhase({ name: "pick" });
  };
  // The first page, once the words are loaded.
  useEffect(() => {
    if (words && !batch) nextBatch();
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (tickedIds: string[], answers: Record<string, boolean>) => {
    const result = skipResult(tickedIds, answers);
    setProgress((p) => markKnown(p, result.skip));
    saveCursor(settings.level, cursorAfter(batch!)); // the whole page is done, ticked or not
    setPhase({ name: "result", result, undone: false });
  };

  const startCheck = () => {
    const tickedIds = [...ticked];
    const checks = pickChecks(batch!.filter((w) => ticked.has(w.id)), lang);
    if (!checks.length) return finish(tickedIds, {});
    setPhase({ name: "check", ticked: tickedIds, questions: checks.map((w) => makeQuestion(w, pool, lang)), answers: {} });
  };

  // ---------- Check ----------
  if (phase.name === "check") {
    const { questions, answers } = phase;
    const i = Object.keys(answers).length;
    const q = questions[i];
    return (
      <main className="flex flex-1 flex-col">
        <QuizHeader done={i} total={questions.length} onClose={onExit} closeLabel={t.skip.stop} />
        <MeaningQuestion
          key={q.word.id}
          q={q}
          lang={lang}
          onAnswer={(choice) => {
            const next = { ...answers, [q.word.id]: choice === q.correct };
            if (Object.keys(next).length === questions.length) finish(phase.ticked, next);
            else setPhase({ ...phase, answers: next });
          }}
        />
      </main>
    );
  }

  // ---------- Result ----------
  if (phase.name === "result") {
    const { result, undone } = phase;
    const note = !result.passed ? t.skip.failedNote(result.keep.length) : result.keep.length ? t.skip.missedNote(result.keep.length) : null;
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title={t.skip.resultTitle} onBack={onExit} />
        <div className="mt-8 flex flex-col items-center text-center">
          <Mascot mood={result.passed ? "cheer" : "happy"} className="size-24" />
          <p className="mt-4 font-display text-4xl font-extrabold text-brand-ink">{t.skip.skipped(undone ? 0 : result.skip.length)}</p>
          {result.asked > 0 && <p className="mt-2 font-semibold text-muted">{t.skip.checkScore(result.right, result.asked)}</p>}
        </div>
        <div className="mt-6 space-y-3 text-center font-medium text-muted">
          {undone ? (
            <p>{t.skip.undone}</p>
          ) : (
            <>
              {note && <p>{note}</p>}
              {result.skip.length > 0 && <p>{t.skip.passedNote}</p>}
            </>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          <button
            type="button"
            onClick={() => nextBatch()}
            className="press w-full rounded-3xl bg-brand py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
          >
            {t.skip.next}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={undone || !result.skip.length}
              onClick={() => {
                setProgress((p) => unmarkKnown(p, result.skip));
                setPhase({ ...phase, undone: true });
              }}
              className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40 disabled:opacity-40"
            >
              {t.skip.undo}
            </button>
            <button type="button" onClick={onExit} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
              {t.common.done}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Pick ----------
  const toggle = (id: string) =>
    setTicked((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.skip.title} onBack={onExit} />
      {error && <p className="mt-6 text-center font-semibold text-dontknow">{error}</p>}
      {!batch ? (
        !error && <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
      ) : !batch.length ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <Mascot className="size-24" />
          <p className="mt-4 font-display text-xl font-bold">{t.skip.noneLeft(settings.level)}</p>
        </div>
      ) : (
        <>
          <p className="mt-4 font-medium text-muted">{t.skip.intro(settings.level)}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-muted tabular-nums">{t.skip.ticked(ticked.size)}</span>
            <button
              type="button"
              onClick={() => setTicked(ticked.size === batch.length ? new Set() : new Set(batch.map((w) => w.id)))}
              className="text-sm font-bold text-brand-ink underline decoration-2 underline-offset-2 hover:text-ink"
            >
              {ticked.size === batch.length ? t.skip.clear : t.skip.tickAll}
            </button>
          </div>
          <ul className="mt-2.5 grid grid-cols-2 gap-2">
            {batch.map((w) => {
              const on = ticked.has(w.id);
              return (
                <li key={w.id} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(w.id)}
                    className={`press flex w-full items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left [--depth:4px] ${
                      on ? "border-know bg-know text-white [--edge:var(--color-know-edge)]" : "border-line bg-card hover:border-brand/40"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${on ? "border-white bg-white text-know" : "border-line"}`}
                      aria-hidden
                    >
                      {on && (
                        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 font-display text-lg leading-tight font-bold [overflow-wrap:anywhere]">{w.word}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {batch && batch.length > 0 && (
        <div className="mt-auto pt-6">
          {ticked.size > 0 ? (
            <>
              <button
                type="button"
                onClick={startCheck}
                className="press w-full rounded-3xl bg-brand py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
              >
                {t.skip.check(ticked.size)}
              </button>
              <p className="mt-3 text-center text-xs font-semibold text-muted">{t.skip.checkNote}</p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                saveCursor(settings.level, cursorAfter(batch));
                nextBatch();
              }}
              className="press w-full rounded-3xl border-2 border-line bg-card py-4 font-display text-xl font-extrabold hover:border-brand/40"
            >
              {t.skip.showNext}
            </button>
          )}
          <p className="mt-3 text-center text-xs font-semibold text-muted">{t.skip.untickedNote}</p>
        </div>
      )}
    </main>
  );
}
