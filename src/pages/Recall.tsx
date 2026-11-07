import { useEffect, useRef, useState, type ReactNode } from "react";
import Mascot from "../components/Mascot";
import QuizHeader from "../components/QuizHeader";
import ScreenHeader from "../components/ScreenHeader";
import SpeakButton from "../components/SpeakButton";
import { POS_LABEL } from "../components/WordCard";
import { meaning, type TestLang } from "../lib/leveltest";
import { buildRecall, checkSpelling, clozeFor, letterHint, promptMeanings, recallPool, ROUND, type RecallKind, type RecallQuestion } from "../lib/recall";
import { playWord, preloadWord } from "../lib/speech";
import { markDontKnow } from "../lib/srs";
import type { Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
  onStudy: () => void;
}

const LANG_LABEL: Record<TestLang, string> = { zh: "中文", es: "Español" };
/** How long a right answer stays before the next question (meaning and spelling). Wrong answers, and every listening answer, wait for "Next". */
const RIGHT_MS = 800;

const KINDS: { kind: RecallKind; title: string; sub: string; icon: ReactNode }[] = [
  {
    kind: "meaning",
    title: "Meaning → word",
    sub: "Read the translation, pick the English word.",
    icon: <path d="M4 6h9M8.5 4v2c0 4-2 7-4.5 8.5M6 10c1.2 2 3 3.4 5 4M13 20l4-9 4 9M14.5 17h5" />,
  },
  {
    kind: "listen",
    title: "Listen → word",
    sub: "Hear the word, pick how it’s written.",
    icon: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
  },
  {
    kind: "spell",
    title: "Spell it",
    sub: "Read the translation and type the word. The hardest one!",
    icon: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  },
];

type Result = { word: Word; right: boolean };

export default function Recall({ progress, setProgress, onExit, onStudy }: Props) {
  const { settings } = progress;
  const langs: TestLang[] = [...(settings.showZh ? ["zh" as const] : []), ...(settings.showEs ? ["es" as const] : [])];
  const [all, setAll] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<RecallKind>();
  const [questions, setQuestions] = useState<RecallQuestion[]>();
  const [results, setResults] = useState<Result[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    loadAllWords()
      .then(setAll)
      .catch((e: Error) => setError(e.message));
  }, []);

  const studied = all?.filter((w) => progress.cards[w.id]).length ?? 0;

  const start = (k: RecallKind) => {
    if (!all) return;
    setKind(k);
    setQuestions(buildRecall(recallPool(all, progress), all, k, langs));
    setResults([]);
    setAdded(false);
  };

  // ---------- Pick an exercise ----------
  if (!questions || !kind) {
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title="Recall" onBack={onExit} />
        <p className="mt-3 font-medium text-muted">
          Test yourself on words you’ve already studied, weakest first. {ROUND} words a round. Your review schedule isn’t changed.
        </p>

        {error ? (
          <p className="mt-10 text-center font-semibold text-dontknow">{error}</p>
        ) : !all ? (
          <p className="mt-10 text-center font-semibold text-muted">Loading words…</p>
        ) : studied === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <Mascot className="size-24" />
            <p className="mt-3 font-display text-2xl font-extrabold">Study a few words first</p>
            <p className="mt-2 max-w-xs font-medium text-muted">Recall asks words you’ve already seen. Do today’s session, then come back!</p>
            <button
              type="button"
              onClick={onStudy}
              className="press mt-6 rounded-3xl bg-brand px-8 py-3.5 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
            >
              Start studying
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {KINDS.map((k) => (
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
                  <span className="block font-display text-xl font-extrabold">{k.title}</span>
                  <span className="block text-sm font-medium text-muted">{k.sub}</span>
                </span>
              </button>
            ))}
            <p className="mt-2 text-center text-xs font-semibold text-muted">
              {studied.toLocaleString()} studied word{studied === 1 ? "" : "s"} to practise.
            </p>
          </div>
        )}
      </main>
    );
  }

  // ---------- Result ----------
  if (results.length === questions.length) {
    const right = results.filter((r) => r.right).length;
    const missed = results.filter((r) => !r.right).map((r) => r.word);
    const newlyMissed = missed.filter((w) => !progress.cards[w.id]?.inDontKnow);
    return (
      <main className="flex flex-1 flex-col">
        <ScreenHeader title="Round done" onBack={onExit} />
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood={right === questions.length ? "cheer" : "happy"} className="size-24" />
          <p className="mt-3 font-display text-6xl leading-none font-extrabold text-brand-ink tabular-nums">
            {right}/{questions.length}
          </p>
          <p className="mt-2 font-semibold text-muted">{right === questions.length ? "Perfect round!" : "right answers"}</p>
        </div>

        {missed.length > 0 && (
          <section className="raised mt-6 rounded-[28px] border-2 border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold">Missed</h2>
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
              <p className="mt-3 text-sm font-semibold text-muted">{missed.length === 1 ? "It’s" : "They’re"} already on your “Don’t know” list.</p>
            ) : (
              (added ? (
                <p className="mt-3 font-semibold text-know-ink">Added to your “Don’t know” list.</p>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setProgress((p) => markDontKnow(p, newlyMissed.map((w) => w.id)));
                    setAdded(true);
                  }}
                  className="press mt-3 w-full rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow-ink [--edge:var(--color-dontknow)]"
                >
                  Add {newlyMissed.length === 1 ? "it" : `these ${newlyMissed.length}`} to “Don’t know”
                </button>
              ))
            )}
          </section>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <button type="button" onClick={() => start(kind)} className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark">
            Another round
          </button>
          <button
            type="button"
            onClick={() => setQuestions(undefined)}
            className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40"
          >
            Other exercise
          </button>
        </div>
      </main>
    );
  }

  // ---------- Question ----------
  const i = results.length;
  return (
    <main className="flex flex-1 flex-col">
      <QuizHeader done={i} total={questions.length} onClose={() => setQuestions(undefined)} closeLabel="Stop this round" />
      <Question
        key={i}
        q={questions[i]}
        next={questions[i + 1]}
        kind={kind}
        langs={langs}
        onDone={(right) => setResults((r) => [...r, { word: questions[i].word, right }])}
      />
    </main>
  );
}

function MeaningPrompt({ word, langs }: { word: Word; langs: TestLang[] }) {
  const pos = word.pos[0];
  return (
    <div className="flex flex-col items-center gap-2">
      {pos && <span className="rounded-full border-2 border-line px-2.5 py-0.5 text-xs font-bold text-muted">{POS_LABEL[pos] ?? pos}</span>}
      {promptMeanings(word, langs).map((l) => (
        <p key={l.lang} lang={l.lang} className="text-[22px] leading-snug font-bold">
          <span className="sr-only">{LANG_LABEL[l.lang]}: </span>
          {l.text}
        </p>
      ))}
    </div>
  );
}

/** One question. Its own component (keyed by index) so the answer state resets for the next one. */
function Question({ q, next, kind, langs, onDone }: { q: RecallQuestion; next?: RecallQuestion; kind: RecallKind; langs: TestLang[]; onDone: (right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(); // undefined = not answered, null = "I don't know"
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<"right" | "close" | "wrong">();
  const timer = useRef<number>(undefined);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const word = q.word;
  const answered = kind === "spell" ? verdict !== undefined : picked !== undefined;
  const right = kind === "spell" ? verdict === "right" : picked === q.correct;
  // Listening always waits for "Next", so there is time to read the meaning that appears.
  const waitForNext = !right || kind === "listen";

  useEffect(() => {
    if (kind === "listen") playWord(word.id, word.word);
    if (next) preloadWord(next.word.id);
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
    if (kind === "spell") return;
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

  return (
    <>
      <section className="raised mt-6 flex flex-col items-center rounded-[28px] border-2 border-line bg-card px-5 py-7 text-center">
        {kind === "listen" ? (
          <>
            <button
              type="button"
              onClick={() => playWord(word.id, word.word)}
              aria-label="Play the word again"
              className="press grid size-20 place-items-center rounded-full bg-unsure text-deep [--depth:5px] [--edge:var(--color-unsure-edge)] hover:brightness-105"
            >
              <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            </button>
            <p className="mt-3 text-sm font-semibold text-muted">Tap to hear it again</p>
            {answered && (
              <div className="mt-3">
                <MeaningPrompt word={word} langs={langs} />
              </div>
            )}
          </>
        ) : (
          <MeaningPrompt word={word} langs={langs} />
        )}
        {kind === "spell" && (
          <>
            {cloze && <p className="mt-4 text-[16px] leading-relaxed text-ink/80">{cloze}</p>}
            <p className="mt-4 font-mono text-xl font-bold tracking-wider text-muted" aria-label={`Starts with ${word.word[0]}, ${word.word.length} letters`}>
              {letterHint(word.word)}
            </p>
          </>
        )}
      </section>

      {kind === "spell" ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (answered) {
              if (!right) onDone(false);
            }
            else if (typed.trim()) setVerdict(checkSpelling(typed, word));
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
            aria-label="Type the English word"
            placeholder="Type the word…"
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
                Show answer
              </button>
              <button
                type="submit"
                disabled={!typed.trim()}
                className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-40"
              >
                Check
              </button>
            </div>
          )}
          {answered && !right && (
            <Reveal word={word} note={verdict === "close" ? "Almost! Check the spelling:" : "The answer:"}>
              <button ref={nextBtn} type="submit" className={NEXT_CLASS}>
                Next
              </button>
            </Reveal>
          )}
        </form>
      ) : (
        <>
          <p className="mt-6 mb-2.5 font-display text-lg font-bold">{kind === "listen" ? "Which word did you hear?" : "Which word is it?"}</p>
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
              I don’t know
            </button>
          ) : (
            waitForNext && (
              <button ref={nextBtn} type="button" onClick={() => onDone(right)} className={`mt-4 ${NEXT_CLASS}`}>
                Next
              </button>
            )
          )}
        </>
      )}
    </>
  );
}

const NEXT_CLASS =
  "press w-full rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark";

function Reveal({ word, note, children }: { word: Word; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl border-2 border-know/30 bg-know/10 px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-muted">{note}</span>
          <span className="block font-display text-2xl font-extrabold text-know-ink">{word.word}</span>
          {word.phonetic && <span className="block text-sm font-medium text-muted">/{word.phonetic}/</span>}
        </span>
        <SpeakButton id={word.id} text={word.word} className="shrink-0" />
      </div>
      {children}
    </div>
  );
}
