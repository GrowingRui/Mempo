import { useEffect, useRef, useState } from "react";
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
  const [state, setState] = useState<State>({ kind: "loading" });
  const [note, setNote] = useState("");
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

  if (!offlineSupported) return <p className="text-sm font-medium text-muted">This browser can’t save the app for offline use.</p>;
  if (state.kind === "loading") return <p className="text-sm font-medium text-muted">Checking what’s saved…</p>;
  if (state.kind === "error") return <p className="text-sm font-medium text-muted">Couldn’t check the saved pronunciations. Are you online?</p>;

  const { ids, saved } = state;
  const missing = ids.length - saved;

  const start = async () => {
    setNote("");
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
    if (ctrl.signal.aborted) setNote("Stopped. Tap again to continue where you left off.");
    else if (failed > 0) setNote(`${failed.toLocaleString()} couldn’t be saved (connection lost?). Tap again to retry.`);
  };

  const pct = state.kind === "saving" ? (state.saved + state.done) / ids.length : saved / ids.length;

  return (
    <div className="raised rounded-[20px] border-2 border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">Pronunciations</span>
        <span className="text-sm font-bold text-muted tabular-nums">
          {(state.kind === "saving" ? state.saved + state.done : saved).toLocaleString()} / {ids.length.toLocaleString()}
        </span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label="Pronunciations saved on this device"
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
          Stop
        </button>
      ) : missing > 0 ? (
        <button
          type="button"
          onClick={() => void start()}
          className="press mt-4 w-full rounded-2xl bg-brand py-2.5 font-display text-base font-bold text-white [--edge:var(--color-brand-edge)]"
        >
          Save {saved > 0 ? "the rest" : "all"} for offline · about {mb(missing)} MB
        </button>
      ) : (
        <p className="mt-3 text-sm font-semibold text-know-ink">All saved. Every word plays without internet.</p>
      )}
      <p className="mt-2 text-xs font-semibold text-muted">
        {note || "Words you’ve already heard are saved automatically. Without a saved file, your device’s own voice reads the word."}
      </p>
    </div>
  );
}
