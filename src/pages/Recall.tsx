import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import MatchGame from "../components/MatchGame";
import Mascot from "../components/Mascot";
import QuizHeader from "../components/QuizHeader";
import ScreenHeader from "../components/ScreenHeader";
import SpeakButton from "../components/SpeakButton";
import { useT } from "../i18n";
import { meaning, type TestLang } from "../lib/leveltest";
import { buildMatch } from "../lib/match";
import { buildCloze, checkForm, CLOZE_ROUND, formGap, formPool, loadCloze, textLine, type ClozeItem } from "../lib/exam";
import { buildRecall, checkSpelling, clozeFor, GAP, letterHint, promptMeanings, recallPool, ROUND, type RecallKind, type RecallQuestion } from "../lib/recall";
import { playWord, preloadWord } from "../lib/speech";
import { markDontKnow } from "../lib/srs";
import { site } from "../config/site";
import { LEVELS, type Progress, type Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

/**
 * recall: test yourself on studied words (Home → Recall). exam: Cambridge exam tasks (Home → Exam practice),
 * which can also ask words you haven't studied. Both share this quiz screen.
 */
export type QuizSection = "recall" | "exam";

interface Props {
  section: QuizSection;
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
  onStudy: () => void;
}

const LANG_LABEL: Record<TestLang, string> = { zh: "中文", es: "Español" };
/** How long a right answer stays before the next question (meaning and spelling). Wrong answers, and every listening answer, wait for "Next". */
const RIGHT_MS = 800;

/** `part`: the task's number in the Cambridge Reading and Use of English paper (exam practice only). */
const KINDS: { kind: RecallKind; section: QuizSection; part?: number; icon: ReactNode }[] = [
  {
    kind: "meaning",
    section: "recall",
    icon: <path d="M4 6h9M8.5 4v2c0 4-2 7-4.5 8.5M6 10c1.2 2 3 3.4 5 4M13 20l4-9 4 9M14.5 17h5" />,
  },
  {
    kind: "listen",
    section: "recall",
    icon: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
  },
  {
    kind: "spell",
    section: "recall",
    icon: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  },
  {
    kind: "match",
    section: "recall",
    icon: (
      <>
        <rect x="3" y="4" width="7" height="6" rx="1.5" />
        <rect x="14" y="14" width="7" height="6" rx="1.5" />
        <path d="M10 7h2.5a1.5 1.5 0 0 1 1.5 1.5V14" />
        <circle cx="17.5" cy="7" r="3.5" />
        <path d="M17.5 5.5V7l1 1" />
      </>
    ),
  },
  {
    kind: "cloze",
    section: "exam",
    part: 1,
    icon: <path d="M3 7h5M16 7h5M9.5 5h5v4h-5zM3 13h18M3 19h11" />,
  },
  {
    kind: "form",
    section: "exam",
    part: 3,
    icon: <path d="M3 5h7v5H3zM14 14h7v5h-7zM6.5 10v6.5H11M9 14l2 2.5-2 2.5" />,
  },
];

type Result = { word: Word; right: boolean };

export default function Recall({ section, progress, setProgress, onExit, onStudy }: Props) {
  const t = useT();
  const exam = section === "exam";
  const { settings } = progress;
  const langs: TestLang[] = [...(settings.showZh ? ["zh" as const] : []), ...(settings.showEs ? ["es" as const] : [])];
  const [all, setAll] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<RecallKind>();
  const [questions, setQuestions] = useState<RecallQuestion[]>();
  const [results, setResults] = useState<Result[]>([]);
  const [added, setAdded] = useState(false);
  const [cloze, setCloze] = useState<ClozeItem[]>();

  useEffect(() => {
    loadAllWords()
      .then(setAll)
      .catch((e: Error) => setError(e.message));
    if (exam) loadCloze().then(setCloze, () => setCloze([]));
  }, [exam]);

  // Match: meanings on the tiles in every shown language, like the other exercises.
  const newBoard = () => (all ? buildMatch(recallPool(all, progress), langs) : undefined);
  // Checked once per change of words or progress, not on every render (recallPool shuffles).
  const matchReady = useMemo(() => !exam && !!newBoard(), [all, progress, langs.join(), exam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only tasks that work are shown: Part 1 once its questions have loaded, Match once a board can be made.
  const kinds = KINDS.filter((k) => k.section === section && (k.kind !== "cloze" || cloze?.length) && (k.kind !== "match" || matchReady));

  const studied = all?.filter((w) => progress.cards[w.id]).length ?? 0;

  // Exam tasks are listed before the word lists arrive; a task tapped meanwhile waits here and starts once they're in.
  const [pending, setPending] = useState<RecallKind>();
  useEffect(() => {
    if (all && pending) {
      setPending(undefined);
      start(pending);
    }
  }, [all, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (k: RecallKind) => {
    if (!all) return setPending(k);
    setKind(k);
    if (k === "match") return; // MatchGame makes its own boards
    setQuestions(
      k === "cloze"
        ? buildCloze(cloze ?? [], all, settings.level)
        : k === "form"
          ? buildRecall(formPool(all, progress), all, k, langs, CLOZE_ROUND) // 8 gaps, as in the paper
          : buildRecall(recallPool(all, progress), all, k, langs),
    );
    setResults([]);
    setAdded(false);
  };

  // ---------- Match (its own board and result screen) ----------
  if (kind === "match") {
    return <MatchGame newBoard={newBoard} progress={progress} setProgress={setProgress} onClose={() => setKind(undefined)} />;
  }

  // ---------- Pick an exercise ----------
  if (!questions || !kind) {
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title={exam ? t.exam.title : t.recall.title} onBack={onExit} />
        <p className="mt-3 font-medium text-muted">{exam ? t.exam.intro : t.recall.intro(ROUND)}</p>

        {error ? (
          <p className="mt-10 text-center font-semibold text-dontknow">{error}</p>
        ) : !all && !exam ? (
          <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
        ) : studied === 0 && !exam ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <Mascot className="size-24" />
            <p className="mt-3 font-display text-2xl font-extrabold">{t.recall.studyFirst}</p>
            <p className="mt-2 max-w-xs font-medium text-muted">{t.recall.studyFirstSub}</p>
            <button
              type="button"
              onClick={onStudy}
              className="press mt-6 rounded-3xl bg-brand px-8 py-3.5 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
            >
              {t.recall.startStudying}
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {kinds.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => start(k.kind)}
                className="press flex items-center gap-4 rounded-[24px] border-2 border-line bg-card px-4 py-4 text-left hover:border-brand/40"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {k.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  {k.part && <span className="block text-xs font-bold tracking-wide text-brand-ink uppercase">{t.exam.part(k.part)}</span>}
                  <span className="block font-display text-xl font-extrabold">{t.recall.kinds[k.kind].title}</span>
                  <span className="block text-sm font-medium text-muted">
                    {pending === k.kind ? t.common.loadingWords : t.recall.kinds[k.kind].sub}
                  </span>
                </span>
              </button>
            ))}
            {!exam && <p className="mt-2 text-center text-xs font-semibold text-muted">{t.recall.toPractise(studied)}</p>}
          </div>
        )}

        {exam && (
          <section className="mt-6 rounded-[24px] border-2 border-dashed border-line px-4 py-4">
            <h2 className="font-display text-lg font-extrabold">{t.exam.papers}</h2>
            <p className="mt-0.5 text-sm font-medium text-muted">{t.exam.papersSub}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Your level first and highlighted; the other two after it. */}
              {LEVELS.slice()
                .sort((a, b) => Number(b === settings.level) - Number(a === settings.level))
                .map((lv) => {
                  const mine = lv === settings.level;
                  return (
                    <a
                      key={lv}
                      href={site.samplePapers[lv]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold ${
                        mine ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink hover:border-brand/40"
                      }`}
                    >
                      {t.exam.paperNames[lv]}
                      {mine && <span className="font-semibold opacity-80">· {t.exam.yourLevel}</span>}
                      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                      </svg>
                    </a>
                  );
                })}
            </div>
          </section>
        )}
      </main>
    );
  }

  // ---------- Result ----------
  if (results.length === questions.length) {
    const right = results.filter((r) => r.right).length;
    const missed = results.filter((r) => !r.right).map((r) => r.word);
    // Word formation can ask words you haven't studied yet; those have no card to put on the list.
    const newlyMissed = missed.filter((w) => progress.cards[w.id] && !progress.cards[w.id].inDontKnow);
    const listed = missed.filter((w) => progress.cards[w.id]?.inDontKnow).length;
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title={t.recall.roundDone} onBack={onExit} />
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood={right === questions.length ? "cheer" : "happy"} className="size-24" />
          <p className="mt-3 font-display text-6xl leading-none font-extrabold text-brand-ink tabular-nums">
            {right}/{questions.length}
          </p>
          <p className="mt-2 font-semibold text-muted">{right === questions.length ? t.recall.perfect : t.recall.rightAnswers}</p>
        </div>

        {exam && (
          <section className="raised mt-6 rounded-[28px] border-2 border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t.exam.theText}</h2>
            <ExamText questions={questions} kind={kind} results={results.map((r) => r.right)} current={questions.length} />
          </section>
        )}

        {missed.length > 0 && (
          <section className="raised mt-6 rounded-[28px] border-2 border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t.recall.missed}</h2>
            <ul className="mt-2 divide-y-2 divide-line">
              {missed.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold">{w.word}</span>
                    <span className="block truncate text-sm font-medium text-muted">{langs.map((l) => meaning(w, l)).filter(Boolean).join(" · ")}</span>
                  </span>
                  <SpeakButton id={w.id} text={w.word} className="size-10 shrink-0" />
                </li>
              ))}
            </ul>
            {newlyMissed.length === 0 ? (
              listed > 0 && <p className="mt-3 text-sm font-semibold text-muted">{t.recall.alreadyListed(listed)}</p>
            ) : (
              (added ? (
                <p className="mt-3 font-semibold text-know-ink">{t.recall.added}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setProgress((p) => markDontKnow(p, newlyMissed.map((w) => w.id)));
                    setAdded(true);
                  }}
                  className="press mt-3 w-full rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow-ink [--edge:var(--color-dontknow)]"
                >
                  {t.recall.addThese(newlyMissed.length)}
                </button>
              ))
            )}
          </section>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <button type="button" onClick={() => start(kind)} className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark">
            {t.recall.anotherRound}
          </button>
          <button
            type="button"
            onClick={() => setQuestions(undefined)}
            className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40"
          >
            {t.recall.otherExercise}
          </button>
        </div>
      </main>
    );
  }

  // ---------- Question ----------
  const i = results.length;
  return (
    <main className="flex flex-1 flex-col">
      <QuizHeader done={i} total={questions.length} onClose={() => setQuestions(undefined)} closeLabel={t.recall.stopRound} />
      <Question
        key={i}
        q={questions[i]}
        next={questions[i + 1]}
        kind={kind}
        langs={langs}
        round={exam ? { questions, results: results.map((r) => r.right), index: i } : undefined}
        onDone={(right) => setResults((r) => [...r, { word: questions[i].word, right }])}
      />
    </main>
  );
}

/**
 * The meaning in the languages the user shows. As a question, a Spanish meaning that spells out the
 * answer (decisión) is left out; once answered (`revealed`) there's nothing to give away, so all are shown.
 */
function MeaningPrompt({ word, langs, revealed = false }: { word: Word; langs: TestLang[]; revealed?: boolean }) {
  const t = useT();
  const pos = word.pos[0];
  const lines = revealed
    ? langs.flatMap((lang) => {
        const text = meaning(word, lang);
        return text ? [{ lang, text }] : [];
      })
    : promptMeanings(word, langs);
  return (
    <div className="flex flex-col items-center gap-2">
      {pos && <span className="rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold text-muted">{t.pos[pos] ?? pos}</span>}
      {lines.map((l) => (
        <p key={l.lang} lang={l.lang} className="text-[22px] leading-snug font-bold">
          <span className="sr-only">{LANG_LABEL[l.lang]}: </span>
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** One question. Its own component (keyed by index) so the answer state resets for the next one. */
function Question({
  q,
  next,
  kind,
  langs,
  round,
  onDone,
}: {
  q: RecallQuestion;
  next?: RecallQuestion;
  kind: RecallKind;
  langs: TestLang[];
  /** Exam practice: the whole round, shown as one text with numbered gaps. */
  round?: { questions: RecallQuestion[]; results: boolean[]; index: number };
  onDone: (right: boolean) => void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<number | null>(); // undefined = not answered, null = "I don't know"
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<"right" | "form" | "close" | "wrong">();
  const timer = useRef<number>(undefined);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const word = q.word;
  const typing = kind === "spell" || kind === "form";
  const answered = typing ? verdict !== undefined : picked !== undefined;
  const right = typing ? verdict === "right" : picked === q.correct;
  // Listening and Part 1 always wait for "Next", so there is time to read the meaning or the explanation.
  const waitForNext = !right || kind === "listen" || kind === "cloze";

  useEffect(() => {
    if (kind === "listen") playWord(word.id, word.word);
    if (next && !next.word.id.startsWith("part1:")) preloadWord(next.word.id); // stand-ins have no recording
    return () => window.clearTimeout(timer.current);
  }, [kind, word, next]);

  useEffect(() => {
    if (!answered) return;
    if (kind !== "listen") playWord(word.id, word.word); // hear the answer
    if (right && !waitForNext) timer.current = window.setTimeout(() => onDone(true), RIGHT_MS);
    else nextBtn.current?.focus();
  }, [answered]); // runs once, when the question is answered

  const choose = (k: number | null) => {
    if (!answered) setPicked(k);
  };

  // Keys 1-4 pick an option.
  useEffect(() => {
    if (typing) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length && !e.ctrlKey && !e.metaKey && !e.altKey) choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const optionClass = (k: number) => {
    if (!answered) return "border-line bg-card hover:border-brand/40";
    if (k === q.correct) return "border-know bg-know text-white [--edge:var(--color-know-edge)]";
    if (k === picked) return "border-dontknow bg-dontknow text-white [--edge:var(--color-dontknow-edge)]";
    return "border-line bg-card opacity-50";
  };

  const cloze = kind === "spell" ? clozeFor(word) : undefined;
  const gap = kind === "form" ? formGap(word) : undefined;

  return (
    <>
      <section className="raised mt-6 flex flex-col items-center rounded-[28px] border-2 border-line bg-card px-5 py-7 text-center">
        {kind === "listen" ? (
          <>
            <button
              type="button"
              onClick={() => playWord(word.id, word.word)}
              aria-label={t.recall.playAgain}
              className="press grid size-20 place-items-center rounded-full bg-unsure text-deep [--depth:5px] [--edge:var(--color-unsure-edge)] hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            </button>
            <p className="mt-3 text-sm font-semibold text-muted">{t.recall.tapToHear}</p>
            {answered && (
              <div className="mt-3">
                <MeaningPrompt word={word} langs={langs} revealed />
              </div>
            )}
          </>
        ) : round && (kind === "cloze" || kind === "form") ? (
          <>
            <p className="text-sm font-semibold text-muted">{kind === "cloze" ? t.exam.clozePrompt : t.recall.formPrompt}</p>
            <ExamText questions={round.questions} kind={kind} results={round.results} current={round.index} answered={answered} right={right} scroll />
            {kind === "form" && (
              <p className="mt-4 flex items-baseline gap-2 rounded-2xl border-2 border-brand/30 bg-brand-soft px-5 py-2">
                <span className="text-sm font-bold text-muted">{t.exam.formGap(round.index + 1)}</span>
                <span className="font-display text-2xl font-extrabold tracking-[0.12em] text-brand-ink uppercase">{word.base}</span>
              </p>
            )}
            {answered && kind === "cloze" && q.cloze && (
              <p className="mt-5 rounded-2xl bg-brand-soft px-4 py-3 text-left text-[15px] leading-snug font-medium" lang="en">
                <span className="font-bold text-brand-ink">{t.exam.why} </span>
                {q.cloze.note}
              </p>
            )}
            {answered && word.zh.length + word.es.length > 0 && (
              <div className="mt-5">
                <MeaningPrompt word={word} langs={langs} revealed />
              </div>
            )}
          </>
        ) : (
          // Once answered, the full meanings in every language, look-alikes too (accesibilidad).
          <MeaningPrompt word={word} langs={langs} revealed={answered} />
        )}
        {kind === "spell" && (
          <>
            {cloze && <p className="mt-4 text-[16px] leading-relaxed text-ink/80">{cloze}</p>}
            <p className="mt-4 font-mono text-xl font-bold tracking-wider text-muted" aria-label={t.recall.startsWith(word.word[0], word.word.length)}>
              {letterHint(word.word)}
            </p>
          </>
        )}
      </section>

      {typing ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (answered) {
              if (!right) onDone(false);
            }
            else if (typed.trim()) setVerdict(gap ? checkForm(typed, gap, word) : checkSpelling(typed, word));
          }}
        >
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            readOnly={answered}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={kind === "form" ? t.recall.formAria : t.recall.typeAria}
            placeholder={t.recall.typePlaceholder}
            className={`rounded-2xl border-2 bg-card px-4 py-3 text-center font-display text-2xl font-bold outline-none ${
              !answered ? "border-line focus:border-brand" : right ? "border-know text-know-ink" : "border-dontknow text-dontknow-ink"
            }`}
          />
          {!answered && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVerdict("wrong")}
                className="press rounded-2xl border-2 border-unsure/50 bg-card py-3 font-display text-lg font-bold text-unsure-dark"
              >
                {t.recall.showAnswer}
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-40"
              >
                {t.recall.check}
              </button>
            </div>
          )}
          {answered && !right && (
            <Reveal
              word={word}
              answer={gap?.answer}
              note={verdict === "form" ? t.recall.wrongForm : verdict === "close" ? t.recall.almost : t.recall.theAnswer}
            >
              <button ref={nextBtn} type="submit" className={NEXT_CLASS}>
                {t.common.next}
              </button>
            </Reveal>
          )}
        </form>
      ) : (
        <>
          <p className="mt-6 mb-2.5 font-display text-lg font-bold">{kind === "listen" ? t.recall.whichHeard : kind === "cloze" ? t.exam.whichFits((round?.index ?? 0) + 1) : t.recall.whichIs}</p>
          <div className="flex flex-col gap-2.5">
            {q.options.map((opt, k) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => choose(k)}
                disabled={answered}
                className={`press flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-display text-xl font-bold disabled:cursor-default ${optionClass(k)}`}
              >
                <span className="text-sm font-bold opacity-50 tabular-nums">{k + 1}</span>
                {opt.word}
              </button>
            ))}
          </div>
          {!answered ? (
            <button
              type="button"
              onClick={() => choose(null)}
              className="press mt-4 rounded-2xl border-2 border-unsure/50 bg-card py-3 font-display text-lg font-bold text-unsure-dark"
            >
              {t.common.iDontKnow}
            </button>
          ) : (
            waitForNext && (
              <button ref={nextBtn} type="button" onClick={() => onDone(right)} className={`mt-4 ${NEXT_CLASS}`}>
                {t.common.next}
              </button>
            )
          )}
        </>
      )}
    </>
  );
}

/**
 * Exam practice as in the paper: the round's sentences as one text with numbered gaps (1)-(8); in
 * Part 3 the word in capitals sits at the end of its line. Gaps before `current` show the answer (green
 * if right, red if missed); the current gap is highlighted, or filled once `answered`.
 * `scroll`: the text scrolls inside its box and keeps the current gap in view.
 */
function ExamText({
  questions,
  kind,
  results,
  current,
  answered = false,
  right = false,
  scroll = false,
}: {
  questions: RecallQuestion[];
  kind: RecallKind;
  results: boolean[];
  current: number;
  answered?: boolean;
  right?: boolean;
  scroll?: boolean;
}) {
  const box = useRef<HTMLOListElement>(null);
  const cur = useRef<HTMLLIElement>(null);

  // Keep the current line in view (a third from the top), without scrolling the page.
  useLayoutEffect(() => {
    if (scroll && box.current && cur.current) box.current.scrollTop = cur.current.offsetTop - box.current.clientHeight / 3;
  }, [scroll, current]);

  return (
    <ol
      ref={box}
      className={`relative mt-4 w-full text-left text-[16px] leading-relaxed font-medium ${scroll ? "max-h-[38vh] overflow-y-auto overscroll-contain lg:max-h-[52vh]" : ""}`}
    >
      {questions.map((q, j) => {
        const line = textLine(q, kind);
        if (!line) return null;
        const [before, after = ""] = line.text.split(GAP);
        const done = j < current || (j === current && answered);
        const ok = j < current ? results[j] : right;
        const isCur = j === current;
        return (
          <li
            key={j}
            ref={isCur ? cur : undefined}
            className={`flex items-baseline gap-3 rounded-xl px-2 py-1.5 ${isCur ? "bg-brand-soft/60" : ""} ${j > current ? "text-ink/60" : ""}`}
          >
            <p className="min-w-0 flex-1">
              {before}
              {done ? (
                <span className={`rounded-md px-1 font-bold ${ok ? "bg-know/15 text-know-ink" : "bg-dontknow/15 text-dontknow-ink"}`}>
                  <span className="text-xs opacity-70">({j + 1})</span> {line.answer}
                </span>
              ) : (
                <span className={`rounded-md px-1 font-bold whitespace-nowrap ${isCur ? "bg-card text-brand-ink ring-2 ring-brand" : "text-muted"}`}>
                  ({j + 1}) {GAP}
                </span>
              )}
              {after}
            </p>
            {line.base && (
              <span className={`shrink-0 font-display text-sm font-extrabold tracking-wide uppercase ${isCur ? "text-brand-ink" : "text-muted"}`}>{line.base}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const NEXT_CLASS =
  "press w-full rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark";

/** The right answer after a wrong one. `answer` is the form the gap needed, if not the headword ("decisions"). */
function Reveal({ word, answer, note, children }: { word: Word; answer?: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-know/30 bg-know/10 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-muted">{note}</span>
          <span className="block font-display text-2xl font-extrabold text-know-ink">{answer ?? word.word}</span>
          {word.phonetic && (answer ?? word.word) === word.word && <span className="block text-sm font-medium text-muted">/{word.phonetic}/</span>}
        </span>
        <SpeakButton id={word.id} text={word.word} className="shrink-0" />
      </div>
      {children}
    </div>
  );
}
