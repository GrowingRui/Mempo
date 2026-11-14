import { useRef, useState, type ReactNode } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import FeedbackDialog from "../components/FeedbackDialog";
import { InstallRow } from "../components/Install";
import MoveRow from "../components/Move";
import OfflineAudio from "../components/OfflineAudio";
import ReminderRow from "../components/Reminder";
import ResetDialog from "../components/ResetDialog";
import ScreenHeader from "../components/ScreenHeader";
import { LANGS, messagesFor, useT } from "../i18n";
import { downloadBackup, parseBackup, type Backup } from "../lib/backup";
import type { FeedbackKind } from "../lib/feedback";
import { studied } from "../lib/stats";
import { setUsageOn, usageOn } from "../lib/usage";
import type { Progress, Settings as SettingsT, SwipeKnow, Theme } from "../lib/types";

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  /** Code from a "Move to another device" QR code this page was opened with. */
  moveCode?: string | null;
  onBack: () => void;
}

function Section({ title, icon, hint, children }: { title: string; icon?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        {icon}
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm font-medium text-muted">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** Globe: marks the language picker, so it can be found even in a language you can't read. */
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5 text-brand-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
);

/** Row of mutually exclusive choices, styled like the level picker on Home. */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; lang?: string }[]; onChange: (v: T) => void }) {
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
            lang={o.lang}
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

function Toggle({ label, sub, checked, disabled, onChange, lang }: { label: string; sub: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; lang?: string }) {
  return (
    <label className={`flex items-center gap-3 px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1">
        <span lang={lang} className="block font-display text-lg font-bold">
          {label}
        </span>
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

const THEMES: Theme[] = ["light", "dark", "system"];

const REVIEW_CAPS = [50, 100, 200, 0];

const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "idea", "word", "other"];

export default function Settings({ progress, setProgress, moveCode = null, onBack }: Props) {
  const t = useT();
  const { settings, cards } = progress;
  const [confirmReset, setConfirmReset] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [usage, setUsage] = useState(usageOn);
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
      setMessage({ ok: false, text: e instanceof Error ? e.message : t.settings.readFailed });
    }
  };

  const swipeOption = (side: SwipeKnow) => {
    const left = side === "left" ? t.answer.know : t.answer.dontknow;
    const right = side === "left" ? t.answer.dontknow : t.answer.know;
    return (
      <span className="flex flex-col items-center leading-tight">
        <span>{side === "left" ? t.settings.knowOnLeft : t.settings.knowOnRight}</span>
        <span className="mt-0.5 text-xs font-semibold opacity-80">
          ← {left} · {right} →
        </span>
      </span>
    );
  };

  return (
    <main className="flex flex-1 flex-col pb-4">
      <ScreenHeader title={t.settings.title} onBack={onBack} backOnPhoneOnly />

      <div className="md:grid md:grid-cols-2 md:gap-x-10">
      <div>

      <Section title={t.settings.language} icon={<GlobeIcon />} hint={t.settings.languageHint}>
        <Segmented
          label={t.settings.language}
          value={settings.lang}
          options={LANGS.map((l) => ({ value: l.value, label: l.label, lang: l.value }))}
          onChange={(lang) => {
            update({ lang });
            setMessage(null); // it was in the old language
          }}
        />
      </Section>

      <Section title={t.settings.theme} hint={t.settings.themeHint}>
        <Segmented label={t.settings.theme} value={settings.theme} options={THEMES.map((v) => ({ value: v, label: t.settings.themes[v] }))} onChange={(theme) => update({ theme })} />
      </Section>

      <Section title={t.settings.meanings} hint={t.settings.meaningsHint}>
        <div className="raised divide-y-2 divide-line rounded-[20px] border-2 border-line bg-card">
          <Toggle
            label="中文"
            lang="zh"
            sub={t.settings.zhSub}
            checked={settings.showZh}
            disabled={settings.showZh && !settings.showEs}
            onChange={(showZh) => update({ showZh })}
          />
          <Toggle
            label="Español"
            lang="es"
            sub={t.settings.esSub}
            checked={settings.showEs}
            disabled={settings.showEs && !settings.showZh}
            onChange={(showEs) => update({ showEs })}
          />
        </div>
        {!(settings.showZh && settings.showEs) && <p className="mt-2 text-xs font-semibold text-muted">{t.settings.oneStaysOn}</p>}
        <div className="raised mt-3 rounded-[20px] border-2 border-line bg-card">
          <Toggle label="English" lang="en" sub={t.settings.enSub} checked={settings.showEn} onChange={(showEn) => update({ showEn })} />
        </div>
      </Section>

      <Section title={t.settings.swiping} hint={t.settings.swipingHint}>
        <Segmented
          label={t.settings.swipeAria}
          value={settings.swipeKnow}
          options={[
            { value: "left", label: swipeOption("left") },
            { value: "right", label: swipeOption("right") },
          ]}
          onChange={(swipeKnow) => update({ swipeKnow })}
        />
      </Section>

      <Section title={t.settings.reviewsPerDay} hint={t.settings.reviewsHint}>
        <Segmented
          label={t.settings.reviewsPerDay}
          value={String(settings.maxReviews)}
          options={REVIEW_CAPS.map((n) => ({ value: String(n), label: n ? n : t.settings.noLimit }))}
          onChange={(v) => update({ maxReviews: Number(v) })}
        />
      </Section>

      </div>
      <div>
      <Section title={t.settings.reminder}>
        <ReminderRow history={progress.history} lang={settings.lang} />
      </Section>

      <Section title={t.settings.offline} hint={t.settings.offlineHint}>
        <InstallRow />
        <OfflineAudio />
      </Section>

      <Section title={t.settings.move} hint={t.settings.moveHint}>
        <MoveRow progress={progress} incoming={moveCode} onReceived={(backup) => setPending({ backup, moved: true })} />
      </Section>

      <Section title={t.settings.progress} hint={t.settings.progressHint}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              downloadBackup(progress);
              setMessage({ ok: true, text: t.settings.downloaded });
            }}
            className="press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg"
          >
            {t.settings.download}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg"
          >
            {t.settings.restore}
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
          {t.settings.startOver}
        </button>
        <p className="mt-2 text-xs font-semibold text-muted">{words === 0 ? t.settings.nothingToDelete : t.settings.startOverNote}</p>
      </Section>

      <Section title={t.settings.feedback} hint={t.settings.feedbackHint}>
        <button
          type="button"
          onClick={() => setFeedback(true)}
          className="press w-full rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold [--edge:var(--color-line-edge)]"
        >
          {t.settings.sendFeedback}
        </button>
      </Section>

      <Section title={t.settings.privacy}>
        <div className="raised rounded-[20px] border-2 border-line bg-card">
          <Toggle
            label={t.settings.usage}
            sub={t.settings.usageSub}
            checked={usage}
            onChange={(on) => {
              setUsageOn(on);
              setUsage(on);
            }}
          />
        </div>
      </Section>

      </div>
      </div>

      {feedback && (
        <FeedbackDialog<FeedbackKind>
          title={t.settings.sendFeedback}
          legend={t.feedback.legend}
          choices={FEEDBACK_KINDS.map((k) => ({ value: k, label: t.feedback.kinds[k] }))}
          initial="idea"
          screen="settings"
          build={(kind, message) => ({ kind, message })}
          messageLabel={(k) => (k === "bug" ? t.feedback.bugLabel : k === "word" ? t.feedback.wordLabel : t.feedback.messageLabel)}
          onClose={() => setFeedback(false)}
        />
      )}

      {pending && (
        <ConfirmDialog
          mood="happy"
          tone="normal"
          title={pending.moved ? t.settings.moveTitle : t.settings.restoreTitle}
          cancelLabel={t.common.cancel}
          confirmLabel={t.settings.replace}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            // Settings come along too, the interface language included (the message is already in it).
            setProgress(() => pending.backup.progress);
            const n = Object.keys(pending.backup.progress.cards).length;
            const tNew = messagesFor(pending.backup.progress.settings.lang);
            setMessage({ ok: true, text: pending.moved ? tNew.settings.moved(n) : tNew.settings.restored(n) });
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
            setProgress((p) => ({ settings: p.settings, cards: {}, history: {}, myList: p.myList })); // My list is the user's own, so it stays
            setConfirmReset(false);
          }}
        />
      )}
    </main>
  );
}

function BackupSummary({ backup, moved, currentWords }: { backup: Backup; moved: boolean; currentWords: number }) {
  const t = useT();
  const n = Object.keys(backup.progress.cards).length;
  const days = Object.values(backup.progress.history).filter(studied).length;
  const made = backup.exportedAt ? new Date(backup.exportedAt) : undefined;
  return (
    <>
      <p>
        {!moved && made && !Number.isNaN(made.getTime()) && t.settings.madeOn(made)}
        {t.settings.backupHas(n, days)}
      </p>
      <p className="mt-2">{currentWords > 0 ? t.settings.replaces(currentWords) : t.settings.noProgressHere}</p>
      {backup.dropped > 0 && <p className="mt-2 text-sm">{t.settings.broken(backup.dropped)}</p>}
    </>
  );
}
