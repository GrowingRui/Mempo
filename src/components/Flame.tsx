/** Streak flame: lit in warm colours, or grey when there is nothing to celebrate yet. */
export default function Flame({ lit, className = "size-6" }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5c.6 3.2 2.4 4.9 4.1 6.6 1.6 1.6 3.1 3.4 3.1 6.2A7.2 7.2 0 0 1 12 22.5a7.2 7.2 0 0 1-7.2-7.2c0-2.6 1.3-4.6 3-5.9-.1 1.8.5 3.2 1.7 4 0-4.6 1.4-8.3 2.5-10.9Z"
        fill={lit ? "var(--color-dontknow)" : "var(--color-line)"}
      />
      <path d="M12 13c1.9 1.5 3.4 2.9 3.4 5a3.4 3.4 0 0 1-6.8 0c0-1.6.8-2.7 2-3.5.2.9.6 1.4 1.2 1.6-.2-1.2-.1-2.2.2-3.1Z" fill={lit ? "var(--color-unsure)" : "var(--color-card)"} />
    </svg>
  );
}
