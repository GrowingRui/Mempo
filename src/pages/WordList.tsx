import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { useT } from "../i18n";
import { inMyList, toggleMyList } from "../lib/mylist";
import { norm, searchIndex, searchWords } from "../lib/search";
import { statusOf, type WordStatus } from "../lib/srs";
import { LEVELS, type Level, type Progress, type Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

const PAGE = 50;
const STATUSES: WordStatus[] = ["new", "learning", "review", "mastered", "dontknow"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`press shrink-0 rounded-xl border-2 px-3 py-1 text-sm font-bold whitespace-nowrap [--depth:3px] ${
        active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function WordList({ progress, setProgress }: { progress: Progress; setProgress: (fn: (p: Progress) => Progress) => void }) {
  const t = useT();
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [level, setLevel] = useState<Level | "all">("all");
  const [status, setStatus] = useState<WordStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const q = norm(useDeferredValue(query).trim());

  useEffect(() => {
    loadAllWords()
      .then((ws) => setWords([...ws].sort((a, b) => a.word.localeCompare(b.word))))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setShown(PAGE);
  }, [level, status, q]);

  const searchable = useMemo(() => searchIndex(words ?? []), [words]);

  const { cards } = progress;
  const inLevel = (words ?? []).filter((w) => level === "all" || w.level === level);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<WordStatus, number>;
  for (const w of inLevel) counts[statusOf(cards[w.id])]++;

  let list = inLevel.filter((w) => status === "all" || statusOf(cards[w.id]) === status);
  list = searchWords(list, searchable, q);

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.wordList.title} />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.wordList.search}
        aria-label={t.wordList.searchAria}
        className="mt-5 w-full rounded-2xl border-2 border-line bg-card px-5 py-3 font-semibold outline-none placeholder:font-medium placeholder:text-muted focus:border-brand"
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.wordList.levelAria}>
        <Chip active={level === "all"} onClick={() => setLevel("all")}>
          {t.wordList.allLevels}
        </Chip>
        {LEVELS.map((lv) => (
          <Chip key={lv} active={level === lv} onClick={() => setLevel(lv)}>
            {lv}
          </Chip>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label={t.wordList.statusAria}>
        <Chip active={status === "all"} onClick={() => setStatus("all")}>
          {t.wordList.anyStatus}
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {t.status[s]} <span className="font-semibold opacity-70 tabular-nums">{words ? t.num(counts[s]) : ""}</span>
          </Chip>
        ))}
      </div>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center text-muted">{t.common.loadingWords}</p>
      ) : (
        <>
          <p className="mt-5 text-sm font-semibold text-muted tabular-nums">{t.common.words(list.length)}</p>
          {list.length === 0 ? (
            <p className="mt-10 text-center font-semibold text-muted">{t.wordList.noMatch}</p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {list.slice(0, shown).map((w) => (
                <WordRow
                  key={w.id}
                  word={w}
                  card={cards[w.id]}
                  settings={progress.settings}
                  star={{ starred: inMyList(progress, w.id), onToggle: () => setProgress((p) => toggleMyList(p, w.id)) }}
                />
              ))}
            </ul>
          )}
          {shown < list.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE * 2)}
              className="press mx-auto mt-5 rounded-2xl border-2 border-line bg-card px-6 py-3 font-display font-bold hover:border-brand/40"
            >
              {t.wordList.showMore(list.length - shown)}
            </button>
          )}
        </>
      )}
    </main>
  );
}
