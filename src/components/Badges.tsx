import { useT } from "../i18n";
import type { Badge, BadgeKind } from "../lib/badges";

/** Streak freeze: an icy snowflake, grey when none is ready. */
export function Snowflake({ on = true, className = "size-5" }: { on?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke={on ? "var(--color-ice)" : "var(--color-line)"} strokeWidth={2.4} strokeLinecap="round">
      <path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" />
      <path d="M9.3 4.3 12 6.6l2.7-2.3M9.3 19.7 12 17.4l2.7 2.3M4 11l3.4 1-1 3.3M20 13l-3.4-1 1-3.3M4.6 8.2l3 1.6.5-3.4M19.4 15.8l-3-1.6-.5 3.4" />
    </svg>
  );
}

const TONES: Record<BadgeKind, { fill: string; edge: string; ink: string }> = {
  streak: { fill: "var(--color-dontknow)", edge: "var(--color-dontknow-edge)", ink: "var(--color-unsure)" },
  words: { fill: "var(--color-brand)", edge: "var(--color-brand-edge)", ink: "#ffffff" },
  level: { fill: "var(--color-know)", edge: "var(--color-know-edge)", ink: "#ffffff" },
};

/** A round medal with a ribbon. The middle shows the goal (7, 500, B2); grey until earned. */
export function BadgeIcon({ badge, className = "size-14" }: { badge: Badge; className?: string }) {
  const t = useT();
  const tone = badge.earned ? TONES[badge.kind] : { fill: "var(--color-line)", edge: "var(--color-line-edge)", ink: "var(--color-muted)" };
  const label = badge.kind === "level" ? badge.level! : badge.kind === "words" && badge.goal >= 1000 ? `${badge.goal / 1000}k` : t.num(badge.goal);
  return (
    <svg viewBox="0 0 48 56" className={className} aria-hidden>
      {/* ribbon */}
      <path d="M14 34 9 54l8-4 5 6 4-18Z" fill={badge.earned ? "var(--color-brand-dark)" : "var(--color-line-edge)"} />
      <path d="M34 34l5 20-8-4-5 6-4-18Z" fill={badge.earned ? "var(--color-brand)" : "var(--color-line)"} />
      {/* medal with a darker bottom edge */}
      <circle cx="24" cy="23" r="20" fill={tone.edge} />
      <circle cx="24" cy="21" r="20" fill={tone.fill} />
      <circle cx="24" cy="21" r="15" fill="none" stroke={tone.ink} strokeOpacity={0.35} strokeWidth="2" />
      {badge.kind === "streak" && (
        <path d="M24 6.5c.4 2.2 1.6 3.3 2.7 4.4 1 1 2 2.2 2 4a4.7 4.7 0 0 1-9.4 0c0-1.7.9-3 2-3.8 0 1.2.3 2 1.1 2.6 0-3 .9-5.4 1.6-7.2Z" fill={tone.ink} opacity={0.9} />
      )}
      <text
        x="24"
        y={badge.kind === "streak" ? 33 : 27.5}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="800"
        fontSize={label.length > 3 ? 11 : 15}
        fill={tone.ink}
      >
        {label}
      </text>
    </svg>
  );
}

export function badgeName(t: ReturnType<typeof useT>, b: Badge) {
  return b.kind === "streak" ? t.badges.streak(b.goal) : b.kind === "words" ? t.badges.words(b.goal) : t.badges.level(b.level!);
}

/** All badges on the Stats screen: earned ones in colour, the rest grey with how far along you are. */
export function BadgeGrid({ badges }: { badges: Badge[] }) {
  const t = useT();
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section aria-labelledby="badges-title" className="raised rounded-[28px] border-2 border-line bg-card p-5 md:col-span-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="badges-title" className="font-display text-lg font-bold">
          {t.badges.title}
        </h2>
        <span className="text-sm font-semibold text-muted">{t.badges.earnedOf(earned, badges.length)}</span>
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-11">
        {badges.map((b) => (
          <li key={b.id} className="flex flex-col items-center text-center">
            <BadgeIcon badge={b} className={`size-14 ${b.earned ? "" : "opacity-80"}`} />
            <span className={`mt-1 text-[13px] leading-tight font-bold ${b.earned ? "" : "text-muted"}`}>{badgeName(t, b)}</span>
            {b.earned ? (
              <span className="sr-only">{t.badges.earned}</span>
            ) : b.goal > 0 ? (
              <>
                <span className="mt-1 h-1.5 w-12 overflow-hidden rounded-full bg-brand-soft" aria-hidden>
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(b.have / b.goal) * 100}%` }} />
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-muted tabular-nums">{t.badges.progress(b.have, b.goal)}</span>
              </>
            ) : (
              <span className="mt-0.5 text-[11px] font-semibold text-muted">…</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Badges just earned, at the end of a session. */
export function NewBadges({ badges }: { badges: Badge[] }) {
  const t = useT();
  if (!badges.length) return null;
  return (
    <div role="status" className="raised mt-6 w-full rounded-[24px] border-2 border-line bg-card px-4 py-3.5">
      <p className="font-display text-lg font-extrabold text-brand-ink">{t.badges.newTitle(badges.length)}</p>
      <ul className="mt-2 flex flex-wrap justify-center gap-4">
        {badges.map((b) => (
          <li key={b.id} className="flex flex-col items-center">
            <BadgeIcon badge={b} className="size-16" />
            <span className="mt-1 text-sm font-bold">{badgeName(t, b)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
