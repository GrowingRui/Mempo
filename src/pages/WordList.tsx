import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import ScreenHeader from "../components/ScreenHeader";
import WordRow, { STATUS_LABEL } from "../components/WordRow";
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

/** Lower-case, accents removed, so "accion" finds "acción". */
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export default function WordList({ progress, onBack }: { progress: Progress; onBack: () => void }) {
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

  // Search text per word: headword, spellings and forms first (they rank higher), then the translations.
  const searchable = useMemo(
    () =>
      new Map(
        (words ?? []).map((w) => [
          w.id,
          {
            en: [w.word, ...(w.variants ?? []), ...(w.forms ?? [])].map(norm),
            tr: norm([...w.zh, ...w.es].flatMap((g) => g.gloss).join(" | ")),
          },
        ]),
      ),
    [words],
  );

  const { cards } = progress;
  const inLevel = (words ?? []).filter((w) => level === "all" || w.level === level);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<WordStatus, number>;
  for (const w of inLevel) counts[statusOf(cards[w.id])]++;

  let list = inLevel.filter((w) => status === "all" || statusOf(cards[w.id]) === status);
  if (q) {
    const rank = (w: Word) => {
      const s = searchable.get(w.id)!;
      if (s.en.some((e) => e === q)) return 0;
      if (s.en.some((e) => e.startsWith(q))) return 1;
      if (s.en.some((e) => e.includes(q))) return 2;
      if (s.tr.includes(q)) return 3;
      return 4;
    };
    list = list
      .map((w) => ({ w, r: rank(w) }))
      .filter((x) => x.r < 4)
      .sort((a, b) => a.r - b.r)
      .map((x) => x.w);
  }

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title="Word list" onBack={onBack} />

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search English, 中文 or español"
        aria-label="Search words"
        className="mt-5 w-full rounded-2xl border-2 border-line bg-card px-5 py-3 font-semibold outline-none placeholder:font-medium placeholder:text-muted focus:border-brand"
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Level">
        <Chip active={level === "all"} onClick={() => setLevel("all")}>
          All levels
        </Chip>
        {LEVELS.map((lv) => (
          <Chip key={lv} active={level === lv} onClick={() => setLevel(lv)}>
            {lv}
          </Chip>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Status">
        <Chip active={status === "all"} onClick={() => setStatus("all")}>
          Any status
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]} <span className="font-semibold opacity-70 tabular-nums">{words ? counts[s].toLocaleString() : ""}</span>
          </Chip>
        ))}
      </div>

      {error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center text-muted">Loading words…</p>
      ) : (
        <>
          <p className="mt-5 text-sm font-semibold text-muted tabular-nums">
            {list.length.toLocaleString()} word{list.length === 1 ? "" : "s"}
          </p>
          {list.length === 0 ? (
            <p className="mt-10 text-center font-semibold text-muted">No words match. Try fewer letters or another filter.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {list.slice(0, shown).map((w) => (
                <WordRow key={w.id} word={w} card={cards[w.id]} settings={progress.settings} />
              ))}
            </ul>
          )}
          {shown < list.length && (
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE * 2)}
              className="press mx-auto mt-5 rounded-2xl border-2 border-line bg-card px-6 py-3 font-display font-bold hover:border-brand/40"
            >
              Show more ({(list.length - shown).toLocaleString()} left)
            </button>
          )}
        </>
      )}
    </main>
  );
}
