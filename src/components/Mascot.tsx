export type Mood = "happy" | "cheer" | "sad";

const BODY = "M32 12c14.5 0 24 10.5 24 25.5C56 51 45.5 58 32 58S8 51 8 37.5C8 22.5 17.5 12 32 12Z";

/** Mempo, the app's little grape blob with a sprout (words growing). Decorative: hidden from screen readers. */
export default function Mascot({ mood = "happy", className = "size-12" }: { mood?: Mood; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      {/* sprout */}
      <path d="M32 13c0-4 0-6 1-8" stroke="var(--color-know-edge)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M33 6c4-4 10-3 11-1-3 4-8 4-11 1Z" fill="var(--color-know)" />
      <path d="M32 8c-3-4-9-4-11-2 3 4 8 5 11 2Z" fill="var(--color-know)" />
      {/* body with a darker 3D edge underneath */}
      <path d={BODY} transform="translate(0 3)" fill="var(--color-brand-edge)" />
      <path d={BODY} fill="var(--color-brand)" />
      <ellipse cx="25" cy="22" rx="7" ry="4" fill="#fff" opacity="0.22" transform="rotate(-20 25 22)" />
      {/* cheeks */}
      <ellipse cx="17.5" cy="41" rx="4.5" ry="3" fill="var(--color-cheek)" opacity="0.85" />
      <ellipse cx="46.5" cy="41" rx="4.5" ry="3" fill="var(--color-cheek)" opacity="0.85" />
      {/* eyes */}
      {mood === "cheer" ? (
        <g stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M20 35q4-5 8 0" />
          <path d="M36 35q4-5 8 0" />
        </g>
      ) : (
        <g>
          <g className="mascot-eye">
            <ellipse cx="24" cy="34" rx="4.6" ry="5.4" fill="#fff" />
            <circle cx={mood === "sad" ? 23.5 : 25} cy={mood === "sad" ? 36 : 35} r="2.6" fill="var(--color-ink)" />
          </g>
          <g className="mascot-eye">
            <ellipse cx="40" cy="34" rx="4.6" ry="5.4" fill="#fff" />
            <circle cx={mood === "sad" ? 40.5 : 41} cy={mood === "sad" ? 36 : 35} r="2.6" fill="var(--color-ink)" />
          </g>
        </g>
      )}
      {/* mouth */}
      {mood === "cheer" ? (
        <path d="M26 42h12q0 8-6 8t-6-8Z" fill="var(--color-ink)" />
      ) : mood === "sad" ? (
        <path d="M28 47q4-4 8 0" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M28 43q4 4.5 8 0" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
