import { useEffect, useState } from "react";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { LEAVE_DONT_KNOW_AFTER } from "../lib/srs";
import type { Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

interface Props {
  progress: Progress;
  onPractise: () => void;
  onBack: () => void;
}

export default function DontKnow({ progress, onPractise, onBack }: Props) {
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadAllWords()
      .then(setWords)
      .catch((e: Error) => setError(e.message));
  }, []);

  const { cards } = progress;
  // Most recently missed first.
  const list = (words ?? [])
    .filter((w) => cards[w.id]?.inDontKnow)
    .sort((a, b) => (cards[b.id].lastSeen ?? "").localeCompare(cards[a.id].lastSeen ?? "") || a.word.localeCompare(b.word));

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title="Don’t know" onBack={onBack} />
      <p className="mt-3 text-sm text-muted">
        Words you swiped “Don’t know”. A word leaves this list after you know it {LEAVE_DONT_KNOW_AFTER} days in a row.
      </p>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center text-muted">Loading words…</p>
      ) : list.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-display text-3xl font-semibold">All clear!</p>
          <p className="mt-2 text-muted">No words on your “Don’t know” list.</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2 pb-28">
            {list.map((w) => (
              <WordRow key={w.id} word={w} card={cards[w.id]} settings={progress.settings} />
            ))}
          </ul>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper via-paper/90 to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto mx-auto max-w-md px-5">
              <button
                type="button"
                onClick={onPractise}
                className="w-full rounded-full bg-dontknow py-4 text-lg font-semibold text-white shadow-[0_10px_24px_-10px_var(--color-dontknow)] transition active:scale-[0.98]"
              >
                Practise these · {list.length} word{list.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
