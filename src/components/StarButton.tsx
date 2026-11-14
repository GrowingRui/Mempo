import { useT } from "../i18n";

/** ☆ / ★: puts a word on My list or takes it off. Doesn't flip or swipe the card it sits on. */
export default function StarButton({ word, starred, onToggle, className = "" }: { word: string; starred: boolean; onToggle: () => void; className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? t.card.unstar(word) : t.card.star(word)}
      title={starred ? t.card.unstar(word) : t.card.star(word)}
      onClick={(e) => {
        e.stopPropagation(); // don't flip the card
        onToggle();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()} // don't start a swipe
      className={`press grid size-11 place-items-center rounded-full border-2 [--depth:3px] ${
        starred ? "border-unsure-edge bg-unsure text-deep [--edge:var(--color-unsure-edge)]" : "border-line bg-card text-muted hover:text-unsure-dark"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill={starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden>
        <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
      </svg>
    </button>
  );
}
