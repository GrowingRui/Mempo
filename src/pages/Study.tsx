import { useEffect, useRef, useState, type ReactNode } from "react";
import WordCard from "../components/WordCard";
import { answer, buildSession } from "../lib/session";
import type { Progress, Word } from "../lib/types";
import { loadWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onExit: () => void;
}

export default function Study({ progress, setProgress, onExit }: Props) {
  const { settings } = progress;
  const [queue, setQueue] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState({ know: 0, dontKnow: 0 });

  // Build the session once, from progress as it was when the screen opened.
  const startProgress = useRef(progress);
  useEffect(() => {
    loadWords(settings.level)
      .then((ws) => setQueue(buildSession(ws, startProgress.current)))
      .catch((e: Error) => setError(e.message));
  }, [settings.level]);

  const word = queue?.[pos];

  const respond = (know: boolean) => {
    if (!word) return;
    setProgress((p) => answer(p, word.id, know));
    setTally((t) => (know ? { ...t, know: t.know + 1 } : { ...t, dontKnow: t.dontKnow + 1 }));
    setFlipped(false);
    setPos((i) => i + 1);
  };

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

  if (!word) {
    return (
      <Centered>
        <p className="font-display text-4xl font-semibold">Nice work!</p>
        <p className="mt-2 text-muted">
          {queue.length === 0 ? "No new words left for today." : `You went through ${queue.length} new word${queue.length === 1 ? "" : "s"}.`}
        </p>
        {queue.length > 0 && (
          <div className="mt-6 flex gap-3">
            <div className="rounded-2xl bg-know/10 px-5 py-3 text-know">
              <div className="text-2xl font-semibold tabular-nums">{tally.know}</div>
              <div className="text-sm">knew</div>
            </div>
            <div className="rounded-2xl bg-dontknow/10 px-5 py-3 text-dontknow">
              <div className="text-2xl font-semibold tabular-nums">{tally.dontKnow}</div>
              <div className="text-sm">to practise</div>
            </div>
          </div>
        )}
        <BackButton onClick={onExit} />
      </Centered>
    );
  }

  const knowBtn = (
    <AnswerButton key="know" tone="know" onClick={() => respond(true)}>
      Know
    </AnswerButton>
  );
  const dontBtn = (
    <AnswerButton key="dont" tone="dontknow" onClick={() => respond(false)}>
      Don’t know
    </AnswerButton>
  );

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to home"
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
        <span className="w-14 text-right text-sm text-muted tabular-nums">
          {pos + 1} / {queue.length}
        </span>
      </header>

      <div className="relative mt-5 min-h-[440px] flex-1">
        {/* key: a fresh card for each word, so the next word never animates in showing its back */}
        <WordCard key={word.id} word={word} flipped={flipped} onFlip={() => setFlipped((f) => !f)} settings={settings} />
      </div>

      <div className="mt-5 flex gap-3">{settings.swipeKnow === "left" ? [knowBtn, dontBtn] : [dontBtn, knowBtn]}</div>
    </main>
  );
}

function AnswerButton({ tone, onClick, children }: { tone: "know" | "dontknow"; onClick: () => void; children: ReactNode }) {
  const cls =
    tone === "know"
      ? "bg-know text-white shadow-[0_10px_22px_-12px_var(--color-know)]"
      : "bg-dontknow text-white shadow-[0_10px_22px_-12px_var(--color-dontknow)]";
  return (
    <button type="button" onClick={onClick} className={`flex-1 rounded-full py-4 text-lg font-semibold transition active:scale-[0.97] ${cls}`}>
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
