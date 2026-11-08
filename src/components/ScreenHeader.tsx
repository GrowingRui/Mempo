import type { ReactNode } from "react";
import { useT } from "../i18n";

export function CloseButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? t.common.backToHome}
      className="press grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-line bg-card text-ink [--depth:4px] hover:border-brand/40"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** Back button + title, for the screens reached from Home. */
export default function ScreenHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      <CloseButton onClick={onBack} />
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <div className="ml-auto">{children}</div>
    </header>
  );
}
