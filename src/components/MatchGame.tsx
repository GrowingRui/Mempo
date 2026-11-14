import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { formatTime, loadBest, MATCH_PAIRS, PENALTY_S, saveBest, type MatchBoard } from "../lib/match";
import { playWord } from "../lib/speech";
import { markDontKnow } from "../lib/srs";
import type { Progress, Word } from "../lib/types";
import Mascot from "./Mascot";
import { CloseButton } from "./ScreenHeader";
import SpeakButton from "./SpeakButton";

interface Props {
  /** Makes a fresh board (also for "Play again"). */
  newBoard: () => MatchBoard | undefined;
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  /** Back to the list of exercises. */
  onClose: () => void;
}

/** How long a wrong pair stays red before the tiles can be tapped again. */
const WRONG_MS = 450;

/**
 * Match: words on the left, meanings on the right. Tap one of each; a right pair disappears, a wrong
 * one shakes and adds PENALTY_S seconds. The clock starts at the first tap.
 */
export default function MatchGame({ newBoard, progress, setProgress, onClose }: Props) {
  const t = useT();
  const level = progress.settings.level;
  const [board, setBoard] = useState(newBoard);
  const [startedAt, setStartedAt] = useState<number>();
  const [now, setNow] = useState(0);
  const [penalties, setPenalties] = useState(0);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selWord, setSelWord] = useState<number>();
  const [selMeaning, setSelMeaning] = useState<number>();
  const [wrong, setWrong] = useState<{ w: number; m: number; n: number }>();
  const [missed, setMissed] = useState<Word[]>([]);
  const [result, setResult] = useState<{ ms: number; best?: number; newBest: boolean }>();
  const [added, setAdded] = useState(false);
  const wrongTimer = useRef<number>(undefined);

  const running = startedAt !== undefined && !result;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => () => window.clearTimeout(wrongTimer.current), []);

  const restart = () => {
    setBoard(newBoard());
    setStartedAt(undefined);
    setNow(0);
    setPenalties(0);
    setMatched(new Set());
    setSelWord(undefined);
    setSelMeaning(undefined);
    setWrong(undefined);
    setMissed([]);
    setResult(undefined);
    setAdded(false);
  };

  if (!board) {
    // Not enough words any more (shouldn't happen: the exercise is only offered when a board can be made).
    return (
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <Mascot mood="sad" className="size-24" />
        <p className="mt-3 font-display text-2xl font-extrabold">{t.recall.studyFirst}</p>
        <button type="button" onClick={onClose} className="press mt-6 rounded-2xl border-2 border-line bg-card px-6 py-3 font-display text-lg font-bold">
          {t.recall.otherExercise}
        </button>
      </main>
    );
  }

  const { pairs, meaningOrder } = board;
  const elapsed = (startedAt === undefined ? 0 : now - startedAt) + penalties * PENALTY_S * 1000;

  const check = (w: number, m: number) => {
    setSelWord(undefined);
    setSelMeaning(undefined);
    if (w === m) {
      const next = new Set(matched).add(w);
      setMatched(next);
      playWord(pairs[w].word.id, pairs[w].word.word);
      if (next.size === pairs.length) {
        const ms = performance.now() - (startedAt ?? performance.now()) + penalties * PENALTY_S * 1000;
        const before = loadBest(level);
        // Only a full board counts for the best time: a smaller one would be unfairly quick.
        const newBest = pairs.length === MATCH_PAIRS && saveBest(level, ms);
        setResult({ ms, best: newBest ? ms : before, newBest });
      }
    } else {
      setPenalties((n) => n + 1);
      // You said A means B's meaning: both words are worth another look.
      setMissed((xs) => [...xs, pairs[w].word, pairs[m].word].filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i));
      setWrong((x) => ({ w, m, n: (x?.n ?? 0) + 1 }));
      window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrong(undefined), WRONG_MS);
    }
  };

  const tap = (side: "word" | "meaning", i: number) => {
    if (matched.has(i) || result) return;
    if (startedAt === undefined) {
      const t0 = performance.now();
      setStartedAt(t0);
      setNow(t0);
    }
    if (side === "word") {
      if (selMeaning !== undefined) check(i, selMeaning);
      else setSelWord(selWord === i ? undefined : i);
    } else {
      if (selWord !== undefined) check(selWord, i);
      else setSelMeaning(selMeaning === i ? undefined : i);
    }
  };

  const tileClass = (side: "word" | "meaning", i: number) => {
    if (matched.has(i)) return "pointer-events-none scale-90 border-know bg-know/10 opacity-0";
    if (wrong && (side === "word" ? wrong.w : wrong.m) === i) return "shake border-dontknow bg-dontknow/10 text-dontknow-ink";
    if ((side === "word" ? selWord : selMeaning) === i) return "border-brand bg-brand-soft text-brand-ink";
    return "border-line bg-card hover:border-brand/40";
  };

  // ---------- Result ----------
  if (result) {
    const newlyMissed = missed.filter((w) => progress.cards[w.id] && !progress.cards[w.id].inDontKnow);
    const listed = missed.filter((w) => progress.cards[w.id]?.inDontKnow).length;
    return (
      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-2">
          <CloseButton onClick={onClose} label={t.recall.otherExercise} />
          <h1 className="font-display text-2xl font-extrabold">{t.recall.roundDone}</h1>
        </header>
        <div className="mt-6 flex flex-col items-center text-center">
          <Mascot mood={result.newBest || penalties === 0 ? "cheer" : "happy"} className="size-24" />
          <p className="mt-3 font-display text-6xl leading-none font-extrabold text-brand-ink tabular-nums">{t.match.seconds(formatTime(result.ms))}</p>
          <p className="mt-2 font-semibold text-muted">
            {result.newBest ? (
              <span className="font-bold text-know-ink">{t.match.newBest}</span>
            ) : result.best !== undefined ? (
              t.match.best(formatTime(result.best))
            ) : (
              t.match.smallBoard
            )}
          </p>
          <p className="mt-1 text-sm font-medium text-muted">{penalties === 0 ? t.match.noMistakes : t.match.mistakes(penalties, penalties * PENALTY_S)}</p>
        </div>

        {missed.length > 0 && (
          <section className="raised mt-6 rounded-[28px] border-2 border-line bg-card p-5">
            <h2 className="font-display text-lg font-bold">{t.match.mixedUp}</h2>
            <ul className="mt-2 divide-y-2 divide-line">
              {missed.map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold">{w.word}</span>
                    <span className="block truncate text-sm font-medium text-muted">
                      {pairs
                        .find((p) => p.word.id === w.id)
                        ?.lines.map((l) => l.text)
                        .join(" · ")}
                    </span>
                  </span>
                  <SpeakButton id={w.id} text={w.word} className="size-10 shrink-0" />
                </li>
              ))}
            </ul>
            {newlyMissed.length === 0 ? (
              listed > 0 && <p className="mt-3 text-sm font-semibold text-muted">{t.recall.alreadyListed(listed)}</p>
            ) : added ? (
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
            )}
          </section>
        )}

        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <button type="button" onClick={restart} className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark">
            {t.match.playAgain}
          </button>
          <button type="button" onClick={onClose} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold hover:border-brand/40">
            {t.recall.otherExercise}
          </button>
        </div>
      </main>
    );
  }

  // ---------- Board ----------
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-2">
        <CloseButton onClick={onClose} label={t.recall.stopRound} />
        <div className="relative flex-1 text-center">
          <span className="font-display text-3xl font-extrabold tabular-nums" role="timer" aria-label={t.match.clockAria}>
            {t.match.seconds(formatTime(elapsed))}
          </span>
          {wrong && (
            <span key={wrong.n} className="float-up absolute top-0 ml-2 font-display text-lg font-extrabold text-dontknow" aria-hidden>
              +{PENALTY_S}s
            </span>
          )}
        </div>
        <span className="w-16 text-right font-display font-bold text-muted tabular-nums">
          {matched.size}/{pairs.length}
        </span>
      </header>
      <p className="mt-3 text-center text-sm font-semibold text-muted">{startedAt === undefined ? t.match.howTo : t.match.howToShort}</p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {pairs.map((p, i) => {
          const m = meaningOrder[i];
          return [
            <button
              key={`w${i}-${wrong?.w === i ? wrong.n : 0}`}
              type="button"
              onClick={() => tap("word", i)}
              aria-pressed={selWord === i}
              aria-hidden={matched.has(i) || undefined}
              className={`press flex min-h-[72px] items-center justify-center rounded-2xl border-2 px-2 py-2 text-center font-display text-lg leading-tight font-bold break-words transition-[opacity,transform] duration-300 ${tileClass("word", i)}`}
            >
              {p.word.word}
            </button>,
            <button
              key={`m${m}-${wrong?.m === m ? wrong.n : 0}`}
              type="button"
              onClick={() => tap("meaning", m)}
              aria-pressed={selMeaning === m}
              aria-hidden={matched.has(m) || undefined}
              className={`press flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2 text-center leading-snug transition-[opacity,transform] duration-300 ${tileClass("meaning", m)}`}
            >
              {/* One line per shown language; the second is a little smaller so the tile stays compact. */}
              {pairs[m].lines.map((l, k) => (
                <span key={l.lang} lang={l.lang} className={`line-clamp-2 ${k === 0 ? "text-[15px] font-semibold" : "text-[13px] font-medium opacity-80"}`}>
                  {l.text}
                </span>
              ))}
            </button>,
          ];
        })}
      </div>
    </main>
  );
}
