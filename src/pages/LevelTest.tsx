import { useEffect, useState } from "react";
import Mascot from "../components/Mascot";
import MeaningQuestion from "../components/MeaningQuestion";
import QuizHeader from "../components/QuizHeader";
import ScreenHeader from "../components/ScreenHeader";
import { useT } from "../i18n";
import { buildTest, estimateKnown, PASS, PER_LEVEL, recommendLevel, scoreByLevel, type Question, type TestLang } from "../lib/leveltest";
import { LEVELS, type Level, type Progress, type Word } from "../lib/types";
import { loadIndex, loadWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
}

const LANG_LABEL: Record<TestLang, string> = { zh: "中文", es: "Español" };

export default function LevelTest({ progress, setProgress, onExit }: Props) {
  const t = useT();
  const { settings } = progress;
  const [lang, setLang] = useState<TestLang>(settings.showZh || !settings.showEs ? "zh" : "es");
  const [byLevel, setByLevel] = useState<Record<Level, Word[]>>();
  const [counts, setCounts] = useState<Record<Level | "total", number>>();
  const [error, setError] = useState<string>();
  const [questions, setQuestions] = useState<Question[]>();
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  useEffect(() => {
    Promise.all(LEVELS.map(loadWords))
      .then(([b2, c1, c2]) => setByLevel({ B2: b2, C1: c1, C2: c2 }))
      .catch((e: Error) => setError(e.message));
    loadIndex()
      .then((ix) => setCounts(ix.counts))
      .catch(() => {});
  }, []);

  const start = () => {
    if (!byLevel) return;
    setQuestions(buildTest(byLevel, lang));
    setAnswers([]);
  };

  // ---------- Intro ----------
  if (!questions) {
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title={t.test.title} onBack={onExit} />
        <div className="mt-10 flex flex-col items-center text-center">
          <Mascot className="size-24" />
          <h2 className="mt-4 font-display text-3xl font-extrabold">{t.test.question}</h2>
          <p className="mt-2 max-w-xs font-medium text-muted">{t.test.intro(PER_LEVEL * LEVELS.length)}</p>
        </div>

        <section className="mt-8">
          <h3 className="mb-2.5 font-display text-lg font-bold">{t.test.answerIn}</h3>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t.test.answerLangAria}>
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
            {byLevel ? t.test.start : t.common.loadingWords}
          </button>
          <p className="mt-3 text-center text-xs font-semibold text-muted">{t.test.about}</p>
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
        <ScreenHeader title={t.test.resultTitle} onBack={onExit} />
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood="cheer" className="size-24" />
          <p className="mt-3 font-semibold text-muted">{t.test.weSuggest}</p>
          <p className="font-display text-7xl leading-none font-extrabold text-brand-ink">{rec}</p>
          <p className="mt-3 font-medium text-muted">
            {t.test.rightOf(right, questions.length)}
            {known !== undefined && (
              <>
                {" · "}
                {t.test.probablyKnow(<span className="font-bold text-ink">{t.num(known)}</span>, counts!.total)}
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
          {t.test.passNote(Math.round(PASS * 100))}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-8">
          {isCurrent ? (
            <p className="rounded-3xl border-2 border-know/30 bg-know/10 px-4 py-3 text-center font-display text-lg font-bold text-know-ink">
              {t.test.already(rec)}
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
              {t.test.switchTo(rec)}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={start} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
              {t.test.again}
            </button>
            <button type="button" onClick={onExit} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
              {isCurrent ? t.test.backHome : t.test.keep(settings.level)}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Question ----------
  const i = answers.length;
  return (
    <main className="flex flex-1 flex-col">
      <QuizHeader done={i} total={questions.length} onClose={onExit} closeLabel={t.test.stop} />
      <MeaningQuestion key={i} q={questions[i]} lang={lang} onAnswer={(choice) => setAnswers((a) => [...a, choice])} />
    </main>
  );
}
