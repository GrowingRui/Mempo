import { useEffect, useState } from "react";
import Mascot from "../components/Mascot";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { useT } from "../i18n";
import { LEAVE_DONT_KNOW_AFTER } from "../lib/srs";
import type { Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

interface Props {
  progress: Progress;
  onPractise: () => void;
  onBack: () => void;
}

export default function DontKnow({ progress, onPractise, onBack }: Props) {
  const t = useT();
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
      <ScreenHeader title={t.answer.dontknow} onBack={onBack} />
      <p className="mt-3 font-medium text-muted">{t.dontKnow.intro(LEAVE_DONT_KNOW_AFTER)}</p>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
      ) : list.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <Mascot mood="cheer" className="size-24" />
          <p className="mt-3 font-display text-3xl font-extrabold">{t.dontKnow.allClear}</p>
          <p className="mt-2 font-medium text-muted">{t.dontKnow.empty}</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 grid grid-cols-1 items-start gap-3 pb-28 md:grid-cols-2">
            {list.map((w) => (
              <WordRow key={w.id} word={w} card={cards[w.id]} settings={progress.settings} />
            ))}
          </ul>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 md:left-[88px] lg:left-60 bg-gradient-to-t from-paper-2 via-paper-2/90 to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto mx-auto max-w-md px-5 md:max-w-sm">
              <button
                type="button"
                onClick={onPractise}
                className="press w-full rounded-3xl bg-dontknow py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-dontknow-edge)] hover:brightness-105"
              >
                {t.dontKnow.practise(list.length)}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
