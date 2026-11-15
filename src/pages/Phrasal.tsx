import { useEffect, useState } from "react";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { useT } from "../i18n";
import { inMyList, toggleMyList } from "../lib/mylist";
import { PHRASAL_ROUND } from "../lib/session";
import type { Progress, Word } from "../lib/types";
import { loadWords } from "../lib/words";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onPractise: () => void;
  onBack: () => void;
}

/** Phrasal verbs (Practice tab): the ones of your level, A–Z, and "Practise N phrasal verbs" (weakest first, see phrasalOrder). */
export default function Phrasal({ progress, setProgress, onPractise, onBack }: Props) {
  const t = useT();
  const { level } = progress.settings;
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    loadWords(level)
      .then((ws) => setWords(ws.filter((w) => w.phrasal).sort((a, b) => a.word.localeCompare(b.word))))
      .catch((e: Error) => setError(e.message));
  }, [level]);

  const { cards } = progress;
  const studied = (words ?? []).filter((w) => cards[w.id]).length;

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.phrasal.title} onBack={onBack} />
      <p className="mt-3 font-medium text-muted">{t.phrasal.intro}</p>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
      ) : (
        <>
          <p className="mt-6 flex flex-wrap justify-between gap-x-4 text-sm font-semibold text-muted tabular-nums">
            <span>{t.phrasal.count(level, words.length)}</span>
            <span>{t.phrasal.studied(studied, words.length)}</span>
          </p>
          <ul className="mt-2 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
            {words.map((w) => (
              <WordRow
                key={w.id}
                word={w}
                card={cards[w.id]}
                settings={progress.settings}
                star={{ starred: inMyList(progress, w.id), onToggle: () => setProgress((p) => toggleMyList(p, w.id)) }}
              />
            ))}
          </ul>
          <p className="mt-5 pb-28 text-center text-sm font-medium text-muted">{t.phrasal.others}</p>
          {words.length > 0 && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper-2 via-paper-2/90 to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:left-[88px] lg:left-60">
              <div className="pointer-events-auto mx-auto max-w-md px-5 md:max-w-sm">
                <button
                  type="button"
                  onClick={onPractise}
                  className="press w-full rounded-3xl bg-brand py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
                >
                  {t.phrasal.practise(Math.min(PHRASAL_ROUND, words.length))}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
