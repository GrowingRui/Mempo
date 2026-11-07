import type { ReactNode } from "react";

export function CloseButton({ onClick, label = "Back to home" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** Back arrow + title, for the screens reached from Home. */
export default function ScreenHeader({ title, onBack, children }: { title: string; onBack: () => void; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-2">
      <CloseButton onClick={onBack} />
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <div className="ml-auto">{children}</div>
    </header>
  );
}
