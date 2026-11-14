import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Mascot from "../components/Mascot";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { useT } from "../i18n";
import { inMyList, myListIds, toggleMyList } from "../lib/mylist";
import { norm, searchIndex, searchWords } from "../lib/search";
import type { Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

/** How many search results "Add a word" shows. */
const RESULTS = 6;

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onPractise: () => void;
  onBack: () => void;
}

/** My list: the words the user starred (most recent first), a search to add more, and "Practise these". */
export default function MyList({ progress, setProgress, onPractise, onBack }: Props) {
  const t = useT();
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const q = norm(useDeferredValue(query).trim());

  useEffect(() => {
    loadAllWords()
      .then((ws) => setWords([...ws].sort((a, b) => a.word.localeCompare(b.word))))
      .catch((e: Error) => setError(e.message));
  }, []);

  const index = useMemo(() => searchIndex(words ?? []), [words]);
  const byId = useMemo(() => new Map((words ?? []).map((w) => [w.id, w])), [words]);
  const results = q && words ? searchWords(words, index, q).slice(0, RESULTS) : [];
  const list = myListIds(progress)
    .map((id) => byId.get(id))
    .filter((w): w is Word => w !== undefined);

  const row = (w: Word) => (
    <WordRow
      key={w.id}
      word={w}
      card={progress.cards[w.id]}
      settings={progress.settings}
      star={{ starred: inMyList(progress, w.id), onToggle: () => setProgress((p) => toggleMyList(p, w.id)) }}
    />
  );

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.myList.title} onBack={onBack} />
      <p className="mt-3 font-medium text-muted">{t.myList.intro}</p>

      <section className="mt-5">
        <h2 className="font-display text-lg font-bold">{t.myList.add}</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.myList.search}
          aria-label={t.myList.add}
          className="mt-2 w-full rounded-2xl border-2 border-line bg-card px-5 py-3 font-semibold outline-none placeholder:font-medium placeholder:text-muted focus:border-brand"
        />
        {q && words && (
          results.length === 0 ? (
            <p className="mt-3 text-center font-semibold text-muted">{t.myList.noMatch}</p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">{results.map(row)}</ul>
          )
        )}
      </section>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
      ) : list.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Mascot className="size-24" />
          <p className="mt-3 font-display text-2xl font-extrabold">{t.myList.emptyTitle}</p>
          <p className="mt-2 max-w-xs font-medium text-muted">{t.myList.empty}</p>
        </div>
      ) : (
        <>
          <p className="mt-7 text-sm font-semibold text-muted tabular-nums">{t.common.words(list.length)}</p>
          <ul className="mt-2 grid grid-cols-1 items-start gap-3 pb-28 md:grid-cols-2">{list.map(row)}</ul>
          <div className="pointer-events-none fixed inset-x-0 bottom-0 bg-gradient-to-t from-paper-2 via-paper-2/90 to-transparent pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:left-[88px] lg:left-60">
            <div className="pointer-events-auto mx-auto max-w-md px-5 md:max-w-sm">
              <button
                type="button"
                onClick={onPractise}
                className="press w-full rounded-3xl bg-brand py-4 font-display text-xl font-extrabold text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark"
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
