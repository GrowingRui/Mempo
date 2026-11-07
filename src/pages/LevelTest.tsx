import { useEffect, useRef, useState } from "react";
import Mascot from "../components/Mascot";
import ScreenHeader, { CloseButton } from "../components/ScreenHeader";
import SpeakButton from "../components/SpeakButton";
import { buildTest, estimateKnown, PASS, PER_LEVEL, recommendLevel, scoreByLevel, type Question, type TestLang } from "../lib/leveltest";
import { LEVELS, type Level, type Progress, type Word } from "../lib/types";
import { loadIndex, loadWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
}

const LANG_LABEL: Record<TestLang, string> = { zh: "中文", es: "Español" };
/** How long the right/wrong colours stay before the next word. */
const FEEDBACK_MS = { right: 700, wrong: 1500 };

export default function LevelTest({ progress, setProgress, onExit }: Props) {
  const { settings } = progress;
  const [lang, setLang] = useState<TestLang>(settings.showZh || !settings.showEs ? "zh" : "es");
  const [byLevel, setByLevel] = useState<Record<Level, Word[]>>();
  const [counts, setCounts] = useState<Record<Level | "total", number>>();
  const [error, setError] = useState<string>();
  const [questions, setQuestions] = useState<Question[]>();
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [picked, setPicked] = useState<number | null | undefined>(); // undefined = not answered yet, null = "I don't know"
  const timer = useRef<number>(undefined);

  useEffect(() => {
    Promise.all(LEVELS.map(loadWords))
      .then(([b2, c1, c2]) => setByLevel({ B2: b2, C1: c1, C2: c2 }))
      .catch((e: Error) => setError(e.message));
    loadIndex()
      .then((ix) => setCounts(ix.counts))
      .catch(() => {});
    return () => window.clearTimeout(timer.current);
  }, []);

  const start = () => {
    if (!byLevel) return;
    setQuestions(buildTest(byLevel, lang));
    setAnswers([]);
    setPicked(undefined);
  };

  // ---------- Intro ----------
  if (!questions) {
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title="Level test" onBack={onExit} />
        <div className="mt-10 flex flex-col items-center text-center">
          <Mascot className="size-24" />
          <h2 className="mt-4 font-display text-3xl font-extrabold">What’s your level?</h2>
          <p className="mt-2 max-w-xs font-medium text-muted">
            {PER_LEVEL * LEVELS.length} random words from B2, C1 and C2. Pick the right meaning, or tap “I don’t know”. No guessing, so the result is honest!
          </p>
        </div>

        <section className="mt-8">
          <h3 className="mb-2.5 font-display text-lg font-bold">Answer in</h3>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Answer language">
            {(["zh", "es"] as TestLang[]).map((l) => {
              const active = l === lang;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLang(l)}
                  className={`press rounded-2xl border-2 py-3 font-display text-xl font-bold ${
                    active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
                  }`}
                >
                  {LANG_LABEL[l]}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-auto pt-8">
          {error && <p className="mb-3 text-center font-semibold text-dontknow">{error}</p>}
          <button
            type="button"
            onClick={start}
            disabled={!byLevel}
            className="press w-full rounded-3xl bg-brand py-4 font-display text-2xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-60"
          >
            {byLevel ? "Start the test" : "Loading words…"}
          </button>
          <p className="mt-3 text-center text-xs font-semibold text-muted">About 3 minutes. Your learning progress isn’t changed.</p>
        </div>
      </main>
    );
  }

  // ---------- Result ----------
  if (answers.length === questions.length) {
    const scores = scoreByLevel(questions, answers);
    const rec = recommendLevel(scores);
    const right = scores.reduce((s, x) => s + x.right, 0);
    const known = counts ? estimateKnown(scores, counts) : undefined;
    const isCurrent = rec === settings.level;
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title="Your result" onBack={onExit} />
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood="cheer" className="size-24" />
          <p className="mt-3 font-semibold text-muted">We suggest you learn</p>
          <p className="font-display text-7xl leading-none font-extrabold text-brand">{rec}</p>
          <p className="mt-3 font-medium text-muted">
            {right} of {questions.length} right
            {known !== undefined && (
              <>
                {" "}
                · you probably know about <span className="font-bold text-ink">{known.toLocaleString()}</span> of {counts!.total.toLocaleString()} words
              </>
            )}
          </p>
        </div>

        <ul className="raised mt-6 space-y-3 rounded-[28px] border-2 border-line bg-card p-5">
          {scores.map((s) => {
            const pct = s.total ? s.right / s.total : 0;
            const tone = pct >= PASS ? "bg-know" : pct >= 0.5 ? "bg-unsure" : "bg-dontknow";
            return (
              <li key={s.level} className="flex items-center gap-3">
                <span className="w-9 font-display text-lg font-extrabold">{s.level}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-brand-soft p-[3px]">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: pct > 0 ? `max(${pct * 100}%, 0.75rem)` : 0 }} />
                </div>
                <span className="w-12 text-right font-display font-bold text-muted tabular-nums">
                  {s.right}/{s.total}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-sm font-medium text-muted">
          You “know” a level at {Math.round(PASS * 100)}% or more. We suggest the first level below that.
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          {isCurrent ? (
            <p className="rounded-3xl border-2 border-know/30 bg-know/10 px-4 py-3 text-center font-display text-lg font-bold text-know-edge">
              {rec} is already your level. Nice!
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setProgress((p) => ({ ...p, settings: { ...p.settings, level: rec } }));
                onExit();
              }}
              className="press w-full rounded-3xl bg-brand py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
            >
              Switch my level to {rec}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={start} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
              Test again
            </button>
            <button type="button" onClick={onExit} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
              {isCurrent ? "Back home" : `Keep ${settings.level}`}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Question ----------
  const i = answers.length;
  const q = questions[i];
  const pct = (i / questions.length) * 100;
  const answered = picked !== undefined;

  const choose = (choice: number | null) => {
    if (answered) return;
    setPicked(choice);
    timer.current = window.setTimeout(
      () => {
        setAnswers((a) => [...a, choice]);
        setPicked(undefined);
      },
      choice === q.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong,
    );
  };

  const optionClass = (k: number) => {
    if (!answered) return "border-line bg-card hover:border-brand/40";
    if (k === q.correct) return "border-know bg-know text-white [--edge:var(--color-know-edge)]";
    if (k === picked) return "border-dontknow bg-dontknow text-white [--edge:var(--color-dontknow-edge)]";
    return "border-line bg-card opacity-50";
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-2">
        <CloseButton onClick={onExit} label="Stop the test" />
        <div className="relative flex-1 py-3">
          <div className="h-4 overflow-hidden rounded-full bg-card p-[3px] shadow-[inset_0_0_0_2px_var(--color-line)]">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500"
            style={{ left: `clamp(14px, ${pct}%, calc(100% - 14px))` }}
          >
            <Mascot className="size-9" />
          </div>
        </div>
        <span className="w-16 text-right font-display font-bold text-muted tabular-nums">
          {i + 1}/{questions.length}
        </span>
      </header>

      <section className="raised mt-6 flex flex-col items-center rounded-[28px] border-2 border-line bg-card px-5 py-8 text-center">
        <p className="font-display text-[40px] leading-tight font-extrabold break-words">{q.word.word}</p>
        {q.word.phonetic && <p className="mt-1 font-medium text-muted">/{q.word.phonetic}/</p>}
        <SpeakButton key={q.word.id} id={q.word.id} text={q.word.word} className="mt-4" />
      </section>

      <p className="mt-6 mb-2.5 font-display text-lg font-bold">What does it mean?</p>
      <div className="flex flex-col gap-2.5" lang={lang}>
        {q.options.map((opt, k) => (
          <button
            key={`${i}-${k}`}
            type="button"
            onClick={() => choose(k)}
            disabled={answered}
            className={`press rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold disabled:cursor-default ${optionClass(k)}`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => choose(null)}
        disabled={answered}
        className={`press mt-4 rounded-2xl border-2 py-3 font-display text-lg font-bold disabled:cursor-default ${
          answered && picked === null ? "border-unsure bg-unsure text-ink [--edge:var(--color-unsure-edge)]" : "border-unsure/50 bg-card text-unsure-dark"
        } ${answered && picked !== null ? "opacity-50" : ""}`}
      >
        I don’t know
      </button>
    </main>
  );
}
