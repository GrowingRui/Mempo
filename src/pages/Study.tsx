import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseButton } from "../components/ScreenHeader";
import SwipeCard, { answerDir, dirAnswers, type SwipeDir } from "../components/SwipeCard";
import { formatDay } from "../lib/date";
import { buildSession, requeue, type SessionMode } from "../lib/session";
import { answer, nextReview } from "../lib/srs";
import type { Answer, Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

interface Props {
  mode: SessionMode;
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
}

/** One turn in the queue. The same word can appear more than once (it comes back after a miss), so each turn has its own key. */
interface Turn {
  word: Word;
  key: number;
}

const EMPTY: Record<SessionMode, string> = {
  today: "Nothing left to study today.",
  review: "No reviews due right now.",
  dontknow: "Your “Don’t know” list is empty. Nice!",
};

export default function Study({ mode, progress, setProgress, onExit }: Props) {
  const { settings } = progress;
  const [queue, setQueue] = useState<Turn[]>();
  const [error, setError] = useState<string>();
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState<SwipeDir>("left");
  const [firstAnswer, setFirstAnswer] = useState<Record<string, Answer>>({});
  const nextKey = useRef(0);

  // Build the session once, from progress as it was when the screen opened.
  const startProgress = useRef(progress);
  useEffect(() => {
    loadAllWords()
      .then((ws) => setQueue(buildSession(ws, startProgress.current, mode).map((word) => ({ word, key: nextKey.current++ }))))
      .catch((e: Error) => setError(e.message));
  }, [mode]);

  const turn = queue?.[pos];

  const respond = (result: Answer, dir?: SwipeDir) => {
    if (!queue || !turn) return;
    const id = turn.word.id;
    setExitDir(dir ?? answerDir(settings, result));
    setProgress((p) => answer(p, id, result));
    setFirstAnswer((f) => (id in f ? f : { ...f, [id]: result }));
    setQueue(requeue(queue, pos, { word: turn.word, key: nextKey.current++ }, result));
    setPos(pos + 1);
    setFlipped(false);
  };

  // Keyboard: arrows answer (same directions as swiping), Space / Enter flips.
  const respondRef = useRef(respond);
  respondRef.current = respond;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      const dirs: Record<string, SwipeDir> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up" };
      const dir = dirs[e.key];
      if (dir) {
        e.preventDefault();
        respondRef.current(dirAnswers(settings)[dir], dir);
      } else if ((e.key === " " || e.key === "Enter") && !(e.target instanceof HTMLElement && e.target.closest("button, a"))) {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings, onExit]);

  if (error) {
    return (
      <Centered>
        <p className="text-dontknow">{error}</p>
        <BackButton onClick={onExit} />
      </Centered>
    );
  }

  if (!queue) {
    return (
      <Centered>
        <p className="text-muted">Loading words…</p>
      </Centered>
    );
  }

  const unique = new Set(queue.map((t) => t.word.id)).size;

  if (!turn) {
    const next = nextReview(progress);
    const tally = { know: 0, unsure: 0, dontknow: 0 };
    for (const a of Object.values(firstAnswer)) tally[a]++;
    return (
      <Centered>
        {queue.length === 0 ? (
          <p className="font-display text-3xl font-semibold">{EMPTY[mode]}</p>
        ) : (
          <>
            <p className="font-display text-4xl font-semibold">Nice work!</p>
            <p className="mt-2 text-muted">
              You went through {unique} word{unique === 1 ? "" : "s"}.
            </p>
            <div className="mt-6 flex gap-3">
              <Tally tone="bg-know/10 text-know" n={tally.know} label="knew" />
              <Tally tone="bg-unsure/15 text-unsure-dark" n={tally.unsure} label="not sure" />
              <Tally tone="bg-dontknow/10 text-dontknow" n={tally.dontknow} label="didn’t know" />
            </div>
            {tally.know < unique && <p className="mt-4 max-w-xs text-sm text-muted">Every word came back until you knew it.</p>}
          </>
        )}
        {next && (
          <p className="mt-6 text-sm text-muted">
            Next review: <span className="font-semibold text-ink">{formatDay(next.day)}</span> · {next.count} word{next.count === 1 ? "" : "s"}
          </p>
        )}
        <BackButton onClick={onExit} />
      </Centered>
    );
  }

  const remaining = new Set(queue.slice(pos).map((t) => t.word.id)).size;
  const answers = dirAnswers(settings);
  const prevCard = startProgress.current.cards[turn.word.id];
  const kind = mode === "dontknow" || prevCard?.inDontKnow ? "Don’t know" : prevCard ? "Review" : "New word";
  const again = queue.slice(0, pos).some((t) => t.word.id === turn.word.id);

  const btn = (a: Answer) => (
    <AnswerButton key={a} tone={a} onClick={() => respond(a)}>
      {a === "know" ? "Know" : a === "unsure" ? "Not sure" : "Don’t know"}
    </AnswerButton>
  );

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-3">
        <CloseButton onClick={onExit} />
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${((unique - remaining) / unique) * 100}%` }}
          />
        </div>
        <span className="w-14 text-right text-sm text-muted tabular-nums">{remaining} left</span>
      </header>

      <p className="mt-3 text-center text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        {kind}
        {again && <span className="text-dontknow"> · again</span>}
      </p>

      <div className="relative mt-3 min-h-[440px] flex-1">
        {/* the next card peeking out behind */}
        {pos + 1 < queue.length && (
          <div aria-hidden className="absolute inset-0 translate-y-3 scale-[0.95] rounded-[28px] border border-line bg-card opacity-80" />
        )}
        <AnimatePresence custom={exitDir} initial={false}>
          <SwipeCard
            key={turn.key}
            word={turn.word}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            settings={settings}
            onSwipe={(dir) => respond(answers[dir], dir)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-6 flex gap-2.5">
        {settings.swipeKnow === "left" ? [btn("know"), btn("unsure"), btn("dontknow")] : [btn("dontknow"), btn("unsure"), btn("know")]}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Swipe or use the arrow keys: ← {answers.left === "know" ? "Know" : "Don’t know"} · ↑ Not sure · {answers.right === "know" ? "Know" : "Don’t know"} →
      </p>
    </main>
  );
}

function Tally({ tone, n, label }: { tone: string; n: number; label: string }) {
  return (
    <div className={`rounded-2xl px-5 py-3 ${tone}`}>
      <div className="text-2xl font-semibold tabular-nums">{n}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

const TONE_CLASS: Record<Answer, string> = {
  know: "bg-know text-white shadow-[0_10px_22px_-12px_var(--color-know)]",
  unsure: "bg-unsure text-ink shadow-[0_10px_22px_-12px_var(--color-unsure)]",
  dontknow: "bg-dontknow text-white shadow-[0_10px_22px_-12px_var(--color-dontknow)]",
};

function AnswerButton({ tone, onClick, children }: { tone: Answer; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-2 py-4 text-base font-semibold whitespace-nowrap transition active:scale-[0.97] ${TONE_CLASS[tone]}`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex flex-1 flex-col items-center justify-center text-center">{children}</main>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-8 rounded-full border border-line bg-card px-6 py-3 font-semibold transition hover:border-ink/30 active:scale-95"
    >
      Back to home
    </button>
  );
}
