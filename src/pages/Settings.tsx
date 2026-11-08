import { useRef, useState, type ReactNode } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import FeedbackDialog from "../components/FeedbackDialog";
import { InstallRow } from "../components/Install";
import MoveRow from "../components/Move";
import OfflineAudio from "../components/OfflineAudio";
import ReminderRow from "../components/Reminder";
import ResetDialog from "../components/ResetDialog";
import ScreenHeader from "../components/ScreenHeader";
import { downloadBackup, parseBackup, type Backup } from "../lib/backup";
import { KIND_LABEL, type FeedbackKind } from "../lib/feedback";
import { studied } from "../lib/stats";
import type { Progress, Settings as SettingsT, SwipeKnow, Theme } from "../lib/types";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  /** Code from a "Move to another device" QR code this page was opened with. */
  moveCode?: string | null;
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

const REVIEW_CAPS = [50, 100, 200, 0];

const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "idea", "word", "other"];

export default function Settings({ progress, setProgress, moveCode = null, onBack }: Props) {
  const { settings, cards } = progress;
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [pending, setPending] = useState<{ backup: Backup; moved: boolean } | null>(null); // waiting for "Replace"
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const words = Object.keys(cards).length;
  const update = (patch: Partial<SettingsT>) => setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      setPending({ backup: parseBackup(await file.text()), moved: false });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn’t read this file." });
    }
  };

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

      <Section title="Meanings" hint="Shown on the back of the card and in the word lists.">
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
        {!(settings.showZh && settings.showEs) && <p className="mt-2 text-xs font-semibold text-muted">Chinese or Spanish: at least one stays on.</p>}
        <div className="raised mt-3 rounded-[20px] border-2 border-line bg-card">
          <Toggle label="English" sub="Definitions in English" checked={settings.showEn} onChange={(showEn) => update({ showEn })} />
        </div>
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

      <Section title="Reviews per day" hint="After a break, the oldest reviews come first and the rest wait for the next days. “Reviews due” on Home still lets you do them all.">
        <Segmented
          label="Reviews per day"
          value={String(settings.maxReviews)}
          options={REVIEW_CAPS.map((n) => ({ value: String(n), label: n ? n : "No limit" }))}
          onChange={(v) => update({ maxReviews: Number(v) })}
        />
      </Section>

      <Section title="Daily reminder">
        <ReminderRow history={progress.history} />
      </Section>

      <Section title="Offline" hint="Once loaded, Mempo works without internet.">
        <InstallRow />
        <OfflineAudio />
      </Section>

      <Section title="Move to another device" hint="Copy your progress to another phone, tablet or browser with a QR code.">
        <MoveRow progress={progress} incoming={moveCode} onReceived={(backup) => setPending({ backup, moved: true })} />
      </Section>

      <Section title="Your progress" hint="Saved in this browser only. Download a backup to keep it safe.">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              downloadBackup(progress);
              setMessage({ ok: true, text: "Backup downloaded." });
            }}
            className="press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg"
          >
            Download backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg"
          >
            Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              e.target.value = ""; // picking the same file again still fires onChange
            }}
          />
        </div>
        {message && (
          <p role="status" className={`mt-2 text-sm font-semibold ${message.ok ? "text-know-ink" : "text-dontknow-ink"}`}>
            {message.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          disabled={words === 0}
          className="press mt-5 w-full rounded-2xl border-2 border-dontknow/40 bg-card py-3 font-display text-lg font-bold text-dontknow-ink [--edge:var(--color-dontknow)] disabled:opacity-50"
        >
          Start over
        </button>
        <p className="mt-2 text-xs font-semibold text-muted">
          {words === 0 ? "Nothing to delete yet." : "Deletes all your words and daily history. Your settings stay."}
        </p>
      </Section>

      <Section title="Feedback" hint="Found a problem, or have an idea? Tell us. It goes straight to the developer.">
        <button
          type="button"
          onClick={() => setFeedback(true)}
          className="press w-full rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold [--edge:var(--color-line-edge)]"
        >
          Send feedback
        </button>
      </Section>

      {feedback && (
        <FeedbackDialog<FeedbackKind>
          title="Send feedback"
          legend="What is it about?"
          choices={FEEDBACK_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          initial="idea"
          screen="settings"
          build={(kind, message) => ({ kind, message })}
          messageLabel={(k) => (k === "bug" ? "What happened? What did you expect?" : k === "word" ? "Which word, and what’s wrong?" : "Your message")}
          onClose={() => setFeedback(false)}
        />
      )}

      {pending && (
        <ConfirmDialog
          mood="happy"
          tone="normal"
          title={pending.moved ? "Bring over this progress?" : "Restore this backup?"}
          cancelLabel="Cancel"
          confirmLabel="Replace my progress"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setProgress(() => pending.backup.progress);
            const n = Object.keys(pending.backup.progress.cards).length;
            const w = `${n.toLocaleString()} word${n === 1 ? "" : "s"}`;
            setMessage({ ok: true, text: pending.moved ? `Progress moved: ${w}.` : `Backup restored: ${w}.` });
            setPending(null);
          }}
        >
          <BackupSummary backup={pending.backup} moved={pending.moved} currentWords={words} />
        </ConfirmDialog>
      )}

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

function BackupSummary({ backup, moved, currentWords }: { backup: Backup; moved: boolean; currentWords: number }) {
  const n = Object.keys(backup.progress.cards).length;
  const days = Object.values(backup.progress.history).filter(studied).length;
  const made = backup.exportedAt && new Date(backup.exportedAt);
  return (
    <>
      <p>
        {!moved && made && !Number.isNaN(made.getTime()) && <>Made on {made.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. </>}
        It has <b className="text-ink">{n.toLocaleString()} word{n === 1 ? "" : "s"}</b> and {days.toLocaleString()} day{days === 1 ? "" : "s"} of history, plus its
        settings.
      </p>
      <p className="mt-2">
        {currentWords > 0
          ? `It replaces what’s in this browser now (${currentWords.toLocaleString()} word${currentWords === 1 ? "" : "s"}).`
          : "This browser has no progress yet."}
      </p>
      {backup.dropped > 0 && <p className="mt-2 text-sm">{backup.dropped.toLocaleString()} broken {backup.dropped === 1 ? "entry" : "entries"} in the file will be skipped.</p>}
    </>
  );
}
