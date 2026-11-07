import { useState, type ReactNode } from "react";
import ResetDialog from "../components/ResetDialog";
import ScreenHeader from "../components/ScreenHeader";
import type { Progress, Settings as SettingsT, SwipeKnow, Theme } from "../lib/types";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  onBack: () => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm font-medium text-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Row of mutually exclusive choices, styled like the level picker on Home. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`press min-w-0 flex-1 rounded-2xl border-2 px-2 py-2.5 font-display text-base font-bold ${
              active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, sub, checked, disabled, onChange }: { label: string; sub: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold">{label}</span>
        <span className="block text-sm font-medium text-muted">{sub}</span>
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative h-8 w-14 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-know peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-brand after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow-[0_2px_0_rgb(0_0_0/0.15)] after:transition-transform peer-checked:after:translate-x-6"
      />
    </label>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

export default function Settings({ progress, setProgress, onBack }: Props) {
  const { settings, cards } = progress;
  const [confirmReset, setConfirmReset] = useState(false);
  const words = Object.keys(cards).length;
  const update = (patch: Partial<SettingsT>) => setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const swipeOption = (side: SwipeKnow) => {
    const left = side === "left" ? "Know" : "Don’t know";
    const right = side === "left" ? "Don’t know" : "Know";
    return (
      <span className="flex flex-col items-center leading-tight">
        <span>Know on the {side}</span>
        <span className="mt-0.5 text-xs font-semibold opacity-80">
          ← {left} · {right} →
        </span>
      </span>
    );
  };

  return (
    <main className="flex flex-1 flex-col pb-4">
      <ScreenHeader title="Settings" onBack={onBack} />

      <Section title="Theme" hint="Auto follows your phone or computer.">
        <Segmented label="Theme" value={settings.theme} options={THEMES} onChange={(theme) => update({ theme })} />
      </Section>

      <Section title="Translations" hint="Shown on the back of the card and in the word lists.">
        <div className="raised divide-y-2 divide-line rounded-[20px] border-2 border-line bg-card">
          <Toggle
            label="中文"
            sub="Chinese"
            checked={settings.showZh}
            disabled={settings.showZh && !settings.showEs}
            onChange={(showZh) => update({ showZh })}
          />
          <Toggle
            label="Español"
            sub="Spanish"
            checked={settings.showEs}
            disabled={settings.showEs && !settings.showZh}
            onChange={(showEs) => update({ showEs })}
          />
        </div>
        {!(settings.showZh && settings.showEs) && <p className="mt-2 text-xs font-semibold text-muted">At least one language stays on.</p>}
      </Section>

      <Section title="Swiping" hint="Swipe up is always “Not sure”. The buttons follow the same order.">
        <Segmented
          label="Swipe direction"
          value={settings.swipeKnow}
          options={[
            { value: "left", label: swipeOption("left") },
            { value: "right", label: swipeOption("right") },
          ]}
          onChange={(swipeKnow) => update({ swipeKnow })}
        />
      </Section>

      <Section title="Your progress" hint="Saved in this browser only.">
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          disabled={words === 0}
          className="press w-full rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow-ink [--edge:var(--color-dontknow)] disabled:opacity-50"
        >
          Start over
        </button>
        <p className="mt-2 text-xs font-semibold text-muted">
          {words === 0 ? "Nothing to delete yet." : "Deletes all your words and daily history. Your settings stay."}
        </p>
      </Section>

      {confirmReset && (
        <ResetDialog
          words={words}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setProgress((p) => ({ settings: p.settings, cards: {}, history: {} }));
            setConfirmReset(false);
          }}
        />
      )}
    </main>
  );
}
