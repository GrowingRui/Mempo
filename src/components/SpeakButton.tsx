import { canSpeak, speak } from "../lib/speech";

export default function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  if (!canSpeak) return null;
  return (
    <button
      type="button"
      aria-label={`Hear “${text}”`}
      onClick={(e) => {
        e.stopPropagation(); // don't flip the card
        speak(text);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`grid size-11 place-items-center rounded-full bg-brand/10 text-brand transition hover:bg-brand/20 active:scale-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}
