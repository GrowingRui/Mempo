import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NewBadges } from "../components/Badges";
import Mascot from "../components/Mascot";
import { CloseButton } from "../components/ScreenHeader";
import SwipeCard, { answerDir, dirAnswers, type SwipeDir } from "../components/SwipeCard";
import { useT } from "../i18n";
import { badgesOf, byLevel, newBadges } from "../lib/badges";
import { toDay } from "../lib/date";
import { buildSession, requeue, type SessionMode } from "../lib/session";
import { inMyList, toggleMyList } from "../lib/mylist";
import { answer, nextReview } from "../lib/srs";
import type { Answer, Level, Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

interface Props {
  mode: SessionMode;
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
  /** Leaving goes Home (otherwise back to the screen it was opened from, e.g. the "Don't know" list). */
  backToHome: boolean;
}

/** One turn in the queue. The same word can appear more than once (it comes back after a miss), so each turn has its own key. */
interface Turn {
  word: Word;
  key: number;
}

export default function Study({ mode, progress, setProgress, onExit, backToHome }: Props) {
  const t = useT();
  const { settings } = progress;
  const [queue, setQueue] = useState<Turn[]>();
  const [error, setError] = useState<string>();
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState<SwipeDir>("left");
  const [firstAnswer, setFirstAnswer] = useState<Record<string, Answer>>({});
  const nextKey = useRef(0);
  const levels = useRef<Partial<Record<Level, Word[]>>>({});

  // Build the session once, from progress as it was when the screen opened.
  const startProgress = useRef(progress);
  useEffect(() => {
    loadAllWords()
      .then((ws) => {
        levels.current = byLevel(ws);
        setQueue(buildSession(ws, startProgress.current, mode).map((word) => ({ word, key: nextKey.current++ })));
      })
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
        <Mascot mood="sad" className="size-20" />
        <p className="mt-3 font-semibold text-dontknow">{error}</p>
        <BackButton onClick={onExit} toHome={backToHome} />
      </Centered>
    );
  }

  if (!queue) {
    return (
      <Centered>
        <Mascot className="size-16 animate-bounce" />
        <p className="mt-3 font-semibold text-muted">{t.common.loadingWords}</p>
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
          <>
            <Mascot className="size-24" />
            <p className="mt-4 max-w-xs font-display text-3xl leading-tight font-extrabold">{t.study.empty[mode]}</p>
          </>
        ) : (
          <>
            <Mascot mood="cheer" className="size-28" />
            <p className="mt-3 font-display text-5xl font-extrabold">{t.study.niceWork}</p>
            <p className="mt-2 text-lg font-semibold text-muted">{t.study.wentThrough(unique)}</p>
            <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
              <Tally tone="bg-know text-white [--edge:var(--color-know-edge)]" n={tally.know} label={t.study.knew} />
              <Tally tone="bg-unsure text-deep [--edge:var(--color-unsure-edge)]" n={tally.unsure} label={t.study.notSure} />
              <Tally tone="bg-dontknow text-white [--edge:var(--color-dontknow-edge)]" n={tally.dontknow} label={t.study.didntKnow} />
            </div>
            {tally.know < unique && <p className="mt-5 max-w-xs font-medium text-muted">{t.study.cameBack}</p>}
            <NewBadges badges={newBadges(badgesOf(startProgress.current, levels.current), badgesOf(progress, levels.current))} />
          </>
        )}
        {next && (
          <p className="mt-6 rounded-full bg-card px-4 py-2 text-sm font-semibold text-muted">
            {t.study.nextReview(t.when(next.day, toDay()), <span className="text-ink">{t.common.words(next.count)}</span>)}
          </p>
        )}
        <BackButton onClick={onExit} toHome={backToHome} />
      </Centered>
    );
  }

  const remaining = new Set(queue.slice(pos).map((t) => t.word.id)).size;
  const answers = dirAnswers(settings);
  const prevCard = startProgress.current.cards[turn.word.id];
  const kind = mode === "dontknow" || prevCard?.inDontKnow ? t.answer.dontknow : prevCard ? t.study.review : t.study.newWord;
  const again = queue.slice(0, pos).some((x) => x.word.id === turn.word.id);
  const pct = ((unique - remaining) / unique) * 100;
  const label = (a: Answer) => t.answer[a];

  const btn = (a: Answer) => (
    <AnswerButton key={a} tone={a} onClick={() => respond(a)}>
      {label(a)}
    </AnswerButton>
  );

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-2">
        <CloseButton onClick={onExit} label={backToHome ? undefined : t.common.back} />
        {/* progress bar with Mempo riding along it */}
        <div className="relative flex-1 py-3">
          <div className="h-4 overflow-hidden rounded-full bg-card p-[3px] shadow-[inset_0_0_0_2px_var(--color-line)]">
            <div
              className="relative h-full rounded-full bg-know transition-[width] duration-500 after:absolute after:inset-x-1.5 after:top-[2px] after:h-[3px] after:rounded-full after:bg-white/40"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500"
            style={{ left: `clamp(14px, ${pct}%, calc(100% - 14px))` }}
          >
            <Mascot className="size-9" mood={again ? "sad" : "happy"} />
          </div>
        </div>
        <span className="min-w-16 text-right font-display font-bold whitespace-nowrap text-muted tabular-nums">{t.study.left(remaining)}</span>
      </header>

      <p className="mt-2 text-center">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${again ? "bg-dontknow/12 text-dontknow" : "bg-card text-muted"}`}>
          {kind}
          {again && t.study.onceMore}
        </span>
      </p>

      <div className="relative mt-4 min-h-[300px] flex-1 [@media(min-height:720px)]:min-h-[440px]">
        {/* the next card peeking out behind */}
        {pos + 1 < queue.length && (
          <div aria-hidden className="absolute inset-0 translate-y-3.5 scale-[0.94] rounded-[32px] border-2 border-line bg-card/70" />
        )}
        <AnimatePresence custom={exitDir} initial={false}>
          <SwipeCard
            key={turn.key}
            word={turn.word}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
            settings={settings}
            onSwipe={(dir) => respond(answers[dir], dir)}
            star={{ starred: inMyList(progress, turn.word.id), onToggle: () => setProgress((p) => toggleMyList(p, turn.word.id)) }}
          />
        </AnimatePresence>
      </div>

      <div className="mt-7 flex gap-2.5">
        {settings.swipeKnow === "left" ? [btn("know"), btn("unsure"), btn("dontknow")] : [btn("dontknow"), btn("unsure"), btn("know")]}
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-muted">
        {t.study.swipeHint(label(answers.left), label(answers.right))}
      </p>
    </main>
  );
}

function Tally({ tone, n, label }: { tone: string; n: number; label: string }) {
  return (
    <div className={`press rounded-[20px] px-3 py-3 ${tone}`}>
      <div className="font-display text-3xl font-extrabold tabular-nums">{n}</div>
      <div className="text-sm font-bold">{label}</div>
    </div>
  );
}

const TONE_CLASS: Record<Answer, string> = {
  know: "bg-know text-white [--edge:var(--color-know-edge)]",
  unsure: "bg-unsure text-deep [--edge:var(--color-unsure-edge)]",
  dontknow: "bg-dontknow text-white [--edge:var(--color-dontknow-edge)]",
};

const ICON: Record<Answer, ReactNode> = {
  know: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  unsure: <path d="M9.2 9a3 3 0 1 1 4 2.8c-.8.4-1.2 1-1.2 1.9v.3M12 17.6v.1" />,
  dontknow: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
};

function AnswerButton({ tone, onClick, children }: { tone: Answer; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press flex flex-1 flex-col items-center gap-0.5 rounded-[22px] px-1 pt-2.5 pb-2 font-display text-[17px] font-extrabold whitespace-nowrap [--depth:6px] hover:brightness-105 ${TONE_CLASS[tone]}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON[tone]}
      </svg>
      {children}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex flex-1 flex-col items-center justify-center text-center">{children}</main>;
}

function BackButton({ onClick, toHome }: { onClick: () => void; toHome: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="press mt-8 rounded-2xl border-2 border-line bg-card px-7 py-3 font-display text-lg font-bold hover:border-brand/40"
    >
      {toHome ? t.common.backToHome : t.common.back}
    </button>
  );
}
