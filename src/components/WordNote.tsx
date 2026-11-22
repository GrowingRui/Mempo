import { createContext, useContext, useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { cleanNote, MAX_NOTE } from "../lib/notes";

interface NotesApi {
  notes: Record<string, string>;
  save: (id: string, text: string) => void;
}
const NotesContext = createContext<NotesApi | null>(null);

/** Lets any word card or row show and edit the user's note without every screen passing it down. */
export function NotesProvider({ notes, save, children }: NotesApi & { children: ReactNode }) {
  return <NotesContext.Provider value={{ notes, save }}>{children}</NotesContext.Provider>;
}

/** The user's note on a word ("" when there's none). */
export function useNote(id: string): string {
  return useContext(NotesContext)?.notes[id] ?? "";
}

/** The note as a plain line (Recall, after answering). Nothing when the word has no note. */
export function NoteLine({ id, className = "" }: { id: string; className?: string }) {
  const t = useT();
  const note = useNote(id);
  if (!note) return null;
  return (
    <p className={`rounded-2xl border-2 border-brand/30 bg-brand-soft/50 px-3.5 py-2.5 text-left text-[15px] leading-snug font-medium [overflow-wrap:anywhere] ${className}`}>
      <span className="mr-1.5 text-xs font-extrabold text-brand-ink">{t.card.note.title}</span>
      {note}
    </p>
  );
}

/**
 * Front of the study card: a "Show my note" link that reveals the note, as a hint before flipping.
 * Hidden until tapped, because a note often gives the meaning away. Give it `key={word.id}` so it closes again on the next card.
 */
export function NoteHint({ id, className = "" }: { id: string; className?: string }) {
  const t = useT();
  const note = useNote(id);
  const [shown, setShown] = useState(false);
  if (!note) return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return shown ? (
    <NoteLine id={id} className={`max-h-28 overflow-y-auto ${className}`} />
  ) : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // don't flip the card
        setShown(true);
      }}
      onKeyDown={stop}
      onPointerDown={stop} // don't start a swipe
      className={`self-center text-sm font-bold text-brand-ink underline decoration-line decoration-2 underline-offset-2 hover:decoration-brand ${className}`}
    >
      💡 {t.card.note.show}
    </button>
  );
}

/**
 * "My note" on a word: shows the note with Edit, or an "Add my note" link. Typing, tapping and dragging here
 * must not flip or swipe the card around it, so the events stop at this box.
 */
export default function WordNote({ id, className = "" }: { id: string; className?: string }) {
  const t = useT();
  const api = useContext(NotesContext);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!api) return null;
  const note = api.notes[id] ?? "";

  const open = () => {
    setDraft(note);
    setEditing(true);
  };
  const commit = () => {
    api.save(id, draft);
    setEditing(false);
  };

  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {editing ? (
        <div className="rounded-2xl border-2 border-brand/40 bg-brand-soft/50 p-3">
          <label htmlFor={`note-${id}`} className="text-xs font-extrabold text-brand-ink">
            {t.card.note.title}
          </label>
          <textarea
            id={`note-${id}`}
            autoFocus
            rows={3}
            value={draft}
            maxLength={MAX_NOTE}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") setEditing(false);
              else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
            }}
            placeholder={t.card.note.placeholder}
            className="mt-1 w-full resize-none rounded-xl border-2 border-line bg-card px-3 py-2 text-[15px] leading-snug font-medium outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="mr-auto text-xs font-semibold text-muted">{draft.length}/{MAX_NOTE}</span>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-sm font-bold text-muted hover:text-ink">
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={commit}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-extrabold text-white"
            >
              {cleanNote(draft) || !note ? t.card.note.save : t.card.note.remove}
            </button>
          </div>
        </div>
      ) : note ? (
        <div className="flex items-start gap-2 rounded-2xl border-2 border-brand/30 bg-brand-soft/50 px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[15px] leading-snug font-medium [overflow-wrap:anywhere]">
            <span className="mr-1.5 text-xs font-extrabold text-brand-ink">{t.card.note.title}</span>
            {note}
          </p>
          <button type="button" onClick={open} className="shrink-0 text-xs font-bold text-brand-ink underline decoration-2 underline-offset-2">
            {t.card.note.edit}
          </button>
        </div>
      ) : (
        <button type="button" onClick={open} className="text-sm font-bold text-brand-ink underline decoration-line decoration-2 underline-offset-2 hover:decoration-brand">
          + {t.card.note.add}
        </button>
      )}
    </div>
  );
}
