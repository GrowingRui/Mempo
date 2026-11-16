import { useEffect, useMemo, useState, type ReactNode } from "react";
import ScreenHeader from "../components/ScreenHeader";
import WordRow from "../components/WordRow";
import { site } from "../config/site";
import { useT } from "../i18n";
import { inMyList, toggleMyList } from "../lib/mylist";
import { useCloseOnBack } from "../lib/nav";
import { foundWords, markText, MAX_TEXT, readerIndex, SAMPLE_TEXT } from "../lib/reader";
import { statusOf } from "../lib/srs";
import type { CardProgress, Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";
import { Chip } from "./WordList";

/** The pasted text stays in this browser only (never sent anywhere), so it's still there after Back or a reload. */
const TEXT_KEY = `${site.storageKey}:reader-text`;
const readSaved = () => {
  try {
    return localStorage.getItem(TEXT_KEY) ?? "";
  } catch {
    return "";
  }
};
const save = (text: string) => {
  try {
    localStorage.setItem(TEXT_KEY, text);
  } catch {
    // storage full or blocked: the text just isn't kept
  }
};

/** Four colours are enough in a text: Reviewing counts as Learning. */
type Group = "new" | "dontknow" | "learning" | "known";
const GROUPS: Group[] = ["new", "dontknow", "learning", "known"];

function groupOf(card: CardProgress | undefined): Group {
  const s = statusOf(card);
  return s === "mastered" ? "known" : s === "review" ? "learning" : s;
}

const MARK: Record<Group, string> = {
  // the highlighter pen from the example sentences: words still to learn stand out most
  new: "bg-[linear-gradient(transparent_var(--marker-top),var(--color-marker)_var(--marker-top),var(--color-marker)_92%,transparent_92%)] font-bold text-deep",
  dontknow: "bg-dontknow/15 font-bold text-dontknow-ink",
  learning: "bg-brand-soft font-bold text-brand-ink",
  known: "underline decoration-know decoration-2 underline-offset-4",
};

/** Legend dot per colour. */
const DOT: Record<Group, string> = { new: "bg-marker", dontknow: "bg-dontknow", learning: "bg-brand-soft", known: "bg-know" };

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onBack: () => void;
}

/** Read a text: paste any English text, and Mempo marks the B2–C2 words in it by how well you know them. */
export default function Reader({ progress, setProgress, onBack }: Props) {
  const t = useT();
  const [text, setText] = useState(readSaved);
  const [draft, setDraft] = useState(text);
  const [editing, setEditing] = useState(text.trim() === "");
  const [words, setWords] = useState<Word[]>();
  const [error, setError] = useState<string>();
  const [hidden, setHidden] = useState<Set<Group>>(new Set());
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    loadAllWords()
      .then(setWords)
      .catch((e: Error) => setError(e.message));
  }, []);

  const index = useMemo(() => readerIndex(words ?? []), [words]);
  const byId = useMemo(() => new Map((words ?? []).map((w) => [w.id, w])), [words]);
  const segments = useMemo(() => (words ? markText(text, index) : []), [text, index, words]);
  const found = useMemo(() => foundWords(segments), [segments]);

  const groupOfId = (id: string) => groupOf(progress.cards[id]);
  const counts = Object.fromEntries(GROUPS.map((g) => [g, found.filter((f) => groupOfId(f.id) === g).length])) as Record<Group, number>;
  // The list under the text: words to work on first, each group in the order the words appear.
  const list = GROUPS.flatMap((g) => found.filter((f) => groupOfId(f.id) === g));
  const newToStar = found.filter((f) => groupOfId(f.id) === "new" && !inMyList(progress, f.id)).map((f) => f.id);
  const selectedWord = selected ? byId.get(selected) : undefined;

  const submit = (value: string) => {
    const next = value.slice(0, MAX_TEXT);
    setText(next);
    setDraft(next);
    save(next);
    setSelected(undefined);
    setEditing(next.trim() === "");
  };
  const canPaste = typeof navigator !== "undefined" && typeof navigator.clipboard?.readText === "function";
  const paste = () => {
    navigator.clipboard
      .readText()
      .then((s) => s.trim() && submit(s))
      .catch(() => {}); // permission refused: the user can still paste into the box
  };
  const toggleGroup = (g: Group) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  const starAll = () =>
    setProgress((p) => newToStar.reduce((acc, id) => (inMyList(acc, id) ? acc : toggleMyList(acc, id)), p));

  const star = (id: string) => ({ starred: inMyList(progress, id), onToggle: () => setProgress((p) => toggleMyList(p, id)) });

  return (
    <main className="flex flex-1 flex-col">
      <ScreenHeader title={t.reader.title} onBack={onBack} />

      {editing ? (
        <section className="mt-3">
          <p className="font-medium text-muted">{t.reader.intro}</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.reader.placeholder}
            aria-label={t.reader.placeholder}
            rows={10}
            maxLength={MAX_TEXT}
            className="mt-4 w-full resize-y rounded-2xl border-2 border-line bg-card px-4 py-3 text-[17px] leading-relaxed font-medium outline-none placeholder:text-muted focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => submit(draft)}
              className="press flex-1 rounded-2xl bg-brand px-5 py-3 font-display text-lg font-extrabold text-white [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-50"
            >
              {t.reader.mark}
            </button>
            {canPaste && (
              <button
                type="button"
                onClick={paste}
                className="press rounded-2xl border-2 border-line bg-card px-5 py-3 font-display font-bold [--edge:var(--color-line-edge)] hover:border-brand/40"
              >
                {t.reader.paste}
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted">{t.reader.private}</p>
            <button type="button" onClick={() => submit(SAMPLE_TEXT)} className="text-sm font-bold text-brand-ink underline-offset-4 hover:underline">
              {t.reader.example}
            </button>
          </div>
        </section>
      ) : error ? (
        <p className="mt-10 text-center text-dontknow">{error}</p>
      ) : !words ? (
        <p className="mt-10 text-center font-semibold text-muted">{t.common.loadingWords}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-muted">{found.length ? t.reader.found(found.length) : t.reader.none}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="press rounded-xl border-2 border-line bg-card px-3 py-1 text-sm font-bold [--depth:3px] hover:border-brand/40"
            >
              {t.reader.edit}
            </button>
          </div>

          {found.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.reader.legendAria}>
              {GROUPS.filter((g) => counts[g] > 0).map((g) => (
                <Chip key={g} active={!hidden.has(g)} onClick={() => toggleGroup(g)}>
                  <span className={`mr-1.5 inline-block size-3 rounded-full ring-2 ring-white/70 ${DOT[g]}`} aria-hidden />
                  {t.reader.groups[g]}{" "}
                  <span className="font-semibold opacity-70 tabular-nums">{t.num(counts[g])}</span>
                </Chip>
              ))}
            </div>
          )}

          <article className="mt-4 rounded-[22px] border-2 border-line bg-card px-5 py-4 text-[17px] leading-[1.9] whitespace-pre-wrap shadow-[0_4px_0_var(--color-line-edge)] md:px-7 md:py-6 md:text-lg">
            {text.length >= MAX_TEXT && <p className="mb-3 text-sm font-semibold text-muted">{t.reader.tooLong(MAX_TEXT)}</p>}
            {segments.map((s, i) => {
              if (!s.id) return <span key={i}>{s.text}</span>;
              const g = groupOfId(s.id);
              if (hidden.has(g)) return <span key={i}>{s.text}</span>;
              const id = s.id;
              return (
                <span
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(id);
                    }
                  }}
                  className={`cursor-pointer rounded-md px-0.5 [box-decoration-break:clone] outline-brand focus-visible:outline-2 ${MARK[g]} ${
                    selected === id ? "ring-2 ring-brand" : ""
                  }`}
                >
                  {s.text}
                </span>
              );
            })}
          </article>

          {found.length > 0 && (
            <section className={`mt-7 ${selectedWord ? "pb-72" : "pb-6"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">{t.reader.listTitle}</h2>
                {newToStar.length > 0 ? (
                  <button
                    type="button"
                    onClick={starAll}
                    className="press rounded-xl border-2 border-line bg-card px-3 py-1 text-sm font-bold [--depth:3px] hover:border-brand/40"
                  >
                    ☆ {t.reader.starNew(newToStar.length)}
                  </button>
                ) : (
                  counts.new > 0 && <p className="text-sm font-semibold text-muted">{t.reader.starred}</p>
                )}
              </div>
              <ul className="mt-3 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
                {list.map((f) => {
                  const w = byId.get(f.id);
                  return w && <WordRow key={f.id} word={w} card={progress.cards[f.id]} settings={progress.settings} star={star(f.id)} />;
                })}
              </ul>
            </section>
          )}

          {selectedWord && (
            <WordPanel onClose={() => setSelected(undefined)} label={t.reader.close} times={t.reader.times(found.find((f) => f.id === selectedWord.id)?.count ?? 1)}>
              <WordRow
                key={selectedWord.id}
                word={selectedWord}
                card={progress.cards[selectedWord.id]}
                settings={progress.settings}
                star={star(selectedWord.id)}
                defaultOpen
              />
            </WordPanel>
          )}
        </>
      )}
    </main>
  );
}

/** The tapped word, at the bottom of the screen over the text. Back, Esc or × closes it. */
function WordPanel({ onClose, label, times, children }: { onClose: () => void; label: string; times: string; children: ReactNode }) {
  useCloseOnBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:left-[88px] lg:left-60">
      <div className="mx-auto max-h-[60dvh] max-w-md overflow-y-auto rounded-t-[26px] border-2 border-b-0 border-line bg-paper-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.15)] md:max-w-lg">
        <div className="flex items-center justify-between pb-2 pl-1">
          <span className="text-sm font-semibold text-muted">{times}</span>
          <button type="button" onClick={onClose} aria-label={label} className="grid size-10 place-items-center rounded-xl text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul>{children}</ul>
      </div>
    </div>
  );
}
