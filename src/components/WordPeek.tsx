import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { inMyList, toggleMyList } from "../lib/mylist";
import { useCloseOnBack } from "../lib/nav";
import type { Progress, Word } from "../lib/types";
import { loadAllWords } from "../lib/words";
import WordRow from "./WordRow";

// A word opened on top of the current screen, e.g. from a chip in the "Word family" box. Any screen can open
// one, so it lives in a context next to the notes instead of being passed down.

const PeekContext = createContext<((id: string) => void) | null>(null);

/** Opens a word by id in a dialog; null outside the provider (then there's nothing to open). */
export function usePeek(): ((id: string) => void) | null {
  return useContext(PeekContext);
}

export function WordPeekProvider({
  progress,
  setProgress,
  children,
}: {
  progress: Progress;
  setProgress: Dispatch<SetStateAction<Progress>>;
  children: ReactNode;
}) {
  const [id, setId] = useState<string>();
  const close = useCallback(() => setId(undefined), []);
  return (
    <PeekContext.Provider value={setId}>
      {children}
      {id && <PeekDialog id={id} progress={progress} setProgress={setProgress} onClose={close} />}
    </PeekContext.Provider>
  );
}

function PeekDialog({
  id,
  progress,
  setProgress,
  onClose,
}: {
  id: string;
  progress: Progress;
  setProgress: Dispatch<SetStateAction<Progress>>;
  onClose: () => void;
}) {
  const t = useT();
  const [words, setWords] = useState<Map<string, Word>>();
  const closeRef = useRef<HTMLButtonElement>(null);
  useCloseOnBack(onClose);

  useEffect(() => {
    let live = true;
    loadAllWords()
      .then((ws) => live && setWords(new Map(ws.map((w) => [w.id, w]))))
      .catch(() => live && onClose());
    return () => {
      live = false;
    };
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [id]);

  const word = words?.get(id);
  // Every event stops here, so nothing reaches the card or the study screen's keys behind the dialog.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/55 p-5"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={stop}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={word?.word} className="w-full max-w-md">
        <div className="mb-2 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="press rounded-full border-2 border-line bg-card px-4 py-1.5 text-sm font-bold [--depth:3px]"
          >
            {t.common.close}
          </button>
        </div>
        {word ? (
          <ul>
            <WordRow
              key={word.id}
              word={word}
              card={progress.cards[word.id]}
              settings={progress.settings}
              star={{ starred: inMyList(progress, word.id), onToggle: () => setProgress((p) => toggleMyList(p, word.id)) }}
              defaultOpen
            />
          </ul>
        ) : (
          <p className="rounded-[20px] border-2 border-line bg-card p-5 text-center font-semibold text-muted">{t.common.loadingWords}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
