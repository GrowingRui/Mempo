import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reportUrl, TOPIC_LABEL, type ReportTopic } from "../lib/report";
import type { Word } from "../lib/types";

const TOPICS: ReportTopic[] = ["zh", "es", "example", "other"];

/**
 * "Report a translation" form. Sending opens a pre-filled GitHub issue in a new tab.
 * Rendered into <body>: the card it's opened from is 3D-transformed, which would trap a fixed overlay,
 * and every event is stopped here so typing or clicking never flips, swipes or answers the card behind.
 */
export default function ReportDialog({ word, initial = "zh", onClose }: { word: Word; initial?: ReportTopic; onClose: () => void }) {
  const [topic, setTopic] = useState<ReportTopic>(initial);
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    // Capture phase on window: runs before the study screen's own key handler (arrows answer, Esc leaves).
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/55 p-5"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={stop}
      onKeyDown={stop}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 shadow-[0_8px_0_var(--color-line-edge)]"
        onSubmit={(e) => {
          e.preventDefault();
          window.open(reportUrl(word, topic, text), "_blank", "noopener");
          onClose();
        }}
      >
        <h2 id="report-title" className="font-display text-2xl font-extrabold">
          Report a problem
        </h2>
        <p className="mt-1 font-medium text-muted">
          with <span className="font-bold text-ink">{word.word}</span>
        </p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-bold">What’s wrong?</legend>
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map((t) => (
              <label
                key={t}
                className={`press cursor-pointer rounded-2xl border-2 px-2 py-2 text-center text-sm font-bold has-focus-visible:outline-3 has-focus-visible:outline-brand ${
                  t === topic ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card"
                }`}
              >
                <input type="radio" name="topic" value={t} checked={t === topic} onChange={() => setTopic(t)} className="sr-only" />
                {TOPIC_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-bold">{topic === "zh" || topic === "es" ? "Better translation (optional)" : "What should it say? (optional)"}</span>
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            lang={topic === "zh" ? "zh" : topic === "es" ? "es" : "en"}
            placeholder={topic === "zh" ? "例如：通路，入口" : topic === "es" ? "p. ej.: acceso, entrada" : ""}
            className="w-full resize-none rounded-2xl border-2 border-line bg-paper px-3 py-2 font-medium outline-none focus:border-brand"
          />
        </label>
        <p className="mt-1 text-xs font-semibold text-muted">Opens GitHub in a new tab (a free account is needed). Reports there are public.</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold">
            Cancel
          </button>
          <button type="submit" className="press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)]">
            Send
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
