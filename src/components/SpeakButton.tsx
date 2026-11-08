import { useEffect } from "react";
import { useT } from "../i18n";
import { playWord, preloadWord } from "../lib/speech";

export default function SpeakButton({ id, text, className = "" }: { id: string; text: string; className?: string }) {
  const t = useT();
  useEffect(() => {
    preloadWord(id);
  }, [id]);
  return (
    <button
      type="button"
      aria-label={t.card.hear(text)}
      onClick={(e) => {
        e.stopPropagation(); // don't flip the card
        playWord(id, text);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`press grid size-12 place-items-center rounded-full bg-unsure text-deep [--depth:4px] [--edge:var(--color-unsure-edge)] hover:brightness-105 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
