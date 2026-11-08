import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { offlineSupported, saveAudio, savedAudio } from "../lib/offline";
import { loadAllWords } from "../lib/words";

const KB_PER_WORD = 8.5; // public/audio is ~51 MB for ~6,100 words
const mb = (words: number) => Math.max(1, Math.round((words * KB_PER_WORD) / 1024));

type State =
  | { kind: "loading" }
  | { kind: "idle"; ids: string[]; saved: number }
  | { kind: "saving"; ids: string[]; saved: number; todo: string[]; done: number }
  | { kind: "error" };

/** Settings block: how many pronunciations are saved on this device, and a button to save the rest. */
export default function OfflineAudio() {
  const t = useT();
  const [state, setState] = useState<State>({ kind: "loading" });
  // Kept as a kind (not text), so it follows a language change.
  const [note, setNote] = useState<{ kind: "stopped" } | { kind: "failed"; n: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const alive = useRef(true);

  const count = async () => {
    const ids = (await loadAllWords()).map((w) => w.id);
    const saved = await savedAudio(ids);
    return { ids, saved };
  };

  useEffect(() => {
    alive.current = true;
    if (!offlineSupported) return;
    count().then(
      ({ ids, saved }) => setState({ kind: "idle", ids, saved: saved.size }),
      () => setState({ kind: "error" }),
    );
    return () => {
      alive.current = false;
      abort.current?.abort();
    };
  }, []);

  if (!offlineSupported) return <p className="text-sm font-medium text-muted">{t.offline.cantSave}</p>;
  if (state.kind === "loading") return <p className="text-sm font-medium text-muted">{t.offline.checking}</p>;
  if (state.kind === "error") return <p className="text-sm font-medium text-muted">{t.offline.checkFailed}</p>;

  const { ids, saved } = state;
  const missing = ids.length - saved;

  const start = async () => {
    setNote(null);
    const { saved: have } = await count();
    const todo = ids.filter((id) => !have.has(id));
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ kind: "saving", ids, saved: have.size, todo, done: 0 });
    const failed = await saveAudio(todo, (done) => setState((s) => (s.kind === "saving" ? { ...s, done } : s)), ctrl.signal);
    abort.current = null;
    if (!alive.current) return; // left Settings: the download stopped
    const after = await savedAudio(ids);
    setState({ kind: "idle", ids, saved: after.size });
    if (ctrl.signal.aborted) setNote({ kind: "stopped" });
    else if (failed > 0) setNote({ kind: "failed", n: failed });
  };

  const pct = state.kind === "saving" ? (state.saved + state.done) / ids.length : saved / ids.length;

  return (
    <div className="raised rounded-[20px] border-2 border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">{t.offline.title}</span>
        <span className="text-sm font-bold text-muted tabular-nums">
          {t.num(state.kind === "saving" ? state.saved + state.done : saved)} / {t.num(ids.length)}
        </span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label={t.offline.savedAria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <div className="h-full rounded-full bg-know transition-[width]" style={{ width: `${pct * 100}%` }} />
      </div>

      {state.kind === "saving" ? (
        <button
          type="button"
          onClick={() => abort.current?.abort()}
          className="press mt-4 w-full rounded-2xl border-2 border-line bg-card py-2.5 font-display text-base font-bold"
        >
          {t.offline.stop}
        </button>
      ) : missing > 0 ? (
        <button
          type="button"
          onClick={() => void start()}
          className="press mt-4 w-full rounded-2xl bg-brand py-2.5 font-display text-base font-bold text-white [--edge:var(--color-brand-edge)]"
        >
          {t.offline.save(saved > 0, mb(missing))}
        </button>
      ) : (
        <p className="mt-3 text-sm font-semibold text-know-ink">{t.offline.allSaved}</p>
      )}
      <p className="mt-2 text-xs font-semibold text-muted">
        {note?.kind === "stopped" ? t.offline.stopped : note?.kind === "failed" ? t.offline.failed(note.n) : t.offline.note}
      </p>
    </div>
  );
}
