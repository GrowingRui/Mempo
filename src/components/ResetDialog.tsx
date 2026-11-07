import { useEffect, useRef } from "react";
import Mascot from "./Mascot";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** "Start over" confirmation. The safe choice has focus; Esc or a tap outside cancels. */
export default function ResetDialog({ words, onCancel, onConfirm }: { words: number; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/55 p-5" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 text-center shadow-[0_8px_0_var(--color-line-edge)]"
      >
        <Mascot mood="sad" className="mx-auto size-20" />
        <h2 id="reset-title" className="mt-3 font-display text-2xl font-extrabold">
          Start over from zero?
        </h2>
        <p id="reset-desc" className="mt-2 text-muted">
          This deletes your progress on {plural(words, "word")} in this browser: reviews, your “Don’t know” list and daily history. Your
          settings stay. This can’t be undone.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)]"
          >
            Keep my progress
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="press rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow [--edge:var(--color-dontknow)]"
          >
            Delete everything
          </button>
        </div>
      </div>
    </div>
  );
}
