import Mascot from "./Mascot";
import { CloseButton } from "./ScreenHeader";

/** Close button, a progress bar with Mempo riding along it, and "3/15". Used by the level test and active recall. */
export default function QuizHeader({ done, total, onClose, closeLabel }: { done: number; total: number; onClose: () => void; closeLabel: string }) {
  const pct = (done / total) * 100;
  return (
    <header className="flex items-center gap-2">
      <CloseButton onClick={onClose} label={closeLabel} />
      <div className="relative flex-1 py-3">
        <div className="h-4 overflow-hidden rounded-full bg-card p-[3px] shadow-[inset_0_0_0_2px_var(--color-line)]">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500"
          style={{ left: `clamp(14px, ${pct}%, calc(100% - 14px))` }}
        >
          <Mascot className="size-9" />
        </div>
      </div>
      <span className="w-16 text-right font-display font-bold text-muted tabular-nums">
        {Math.min(done + 1, total)}/{total}
      </span>
    </header>
  );
}
