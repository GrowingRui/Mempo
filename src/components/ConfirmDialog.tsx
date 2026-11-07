import { useEffect, useRef, type ReactNode } from "react";
import Mascot from "./Mascot";

interface Props {
  title: string;
  children: ReactNode;
  mood?: "happy" | "sad";
  /** The safe choice. It has focus; Esc or a tap outside does the same. */
  cancelLabel: string;
  confirmLabel: string;
  /** "danger" = coral outline (deletes data), otherwise a plain outlined button. */
  tone?: "danger" | "normal";
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({ title, children, mood = "sad", cancelLabel, confirmLabel, tone = "danger", onCancel, onConfirm }: Props) {
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/55 p-5" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 text-center shadow-[0_8px_0_var(--color-line-edge)]"
      >
        <Mascot mood={mood} className="mx-auto size-20" />
        <h2 id="confirm-title" className="mt-3 font-display text-2xl font-extrabold">
          {title}
        </h2>
        <div id="confirm-desc" className="mt-2 text-muted">
          {children}
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`press rounded-2xl border-2 bg-card py-3 font-display text-lg font-bold ${
              tone === "danger" ? "border-dontknow/40 text-dontknow-ink [--edge:var(--color-dontknow)]" : "border-line [--edge:var(--color-line-edge)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
