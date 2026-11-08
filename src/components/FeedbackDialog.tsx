import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "../i18n";
import { mailtoUrl, sendFeedback, withDevice, type FeedbackForm } from "../lib/feedback";
import Mascot from "./Mascot";

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  title: string;
  subtitle?: ReactNode;
  legend: string;
  choices: Choice<T>[];
  initial: T;
  /** Which screen it was opened from, for the details. */
  screen: string;
  /** The form for a choice and message (kind, about, extra details). */
  build: (choice: T, message: string) => Omit<FeedbackForm, "email" | "website">;
  messageLabel: (choice: T) => string;
  placeholder?: (choice: T) => string;
  lang?: (choice: T) => string;
  /** Whether the message can be left empty. */
  optional?: (choice: T) => boolean;
  /** Extra line under the form, e.g. another way to report. */
  footer?: (choice: T, message: string) => ReactNode;
  onClose: () => void;
}

type State = { step: "edit" } | { step: "sending" } | { step: "sent" } | { step: "failed"; error: string; form: FeedbackForm };

const field = "w-full rounded-2xl border-2 border-line bg-paper px-3 py-2 font-medium outline-none focus:border-brand";
const primary = "press rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] disabled:opacity-60";
const secondary = "press rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold";

/**
 * The "Send feedback" form, used from Settings and from a word card ("Report a problem").
 * Rendered into <body>: a card it's opened from is 3D-transformed, which would trap a fixed overlay,
 * and every event is stopped here so typing or clicking never flips, swipes or answers the card behind.
 */
export default function FeedbackDialog<T extends string>(props: Props<T>) {
  const { title, subtitle, legend, choices, initial, screen, build, messageLabel, placeholder, lang, optional, footer, onClose } = props;
  const t = useT();
  const appLang = useLang();
  const [choice, setChoice] = useState<T>(initial);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // the trap
  const [state, setState] = useState<State>({ step: "edit" });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    // Capture phase on window: runs before the study screen's own key handler (arrows answer, Esc leaves).
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (state.step === "sent") doneRef.current?.focus();
  }, [state.step]);

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const canSend = state.step !== "sending" && (message.trim() !== "" || !!optional?.(choice));

  const submit = async () => {
    if (!canSend) return;
    const form = withDevice({ ...build(choice, message), message: message.trim(), email: email.trim() || undefined, website: website || undefined }, screen, appLang);
    setState({ step: "sending" });
    try {
      await sendFeedback(form);
      setState({ step: "sent" });
    } catch (e) {
      setState({ step: "failed", error: e instanceof Error ? e.message : t.feedback.cantSend, form });
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/55 p-5"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={stop}
      onKeyDown={stop}
    >
      {state.step === "sent" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 text-center shadow-[0_8px_0_var(--color-line-edge)]"
        >
          <Mascot mood="cheer" className="mx-auto size-20" />
          <h2 id="feedback-title" className="mt-3 font-display text-2xl font-extrabold">
            {t.feedback.thanks}
          </h2>
          <p className="mt-2 font-medium text-muted">{email.trim() ? t.feedback.replyByEmail : t.feedback.everyRead}</p>
          <button ref={doneRef} type="button" onClick={onClose} className={`${primary} mt-6 w-full`}>
            {t.common.done}
          </button>
        </div>
      ) : (
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 shadow-[0_8px_0_var(--color-line-edge)]"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 id="feedback-title" className="font-display text-2xl font-extrabold">
            {title}
          </h2>
          {subtitle && <p className="mt-1 font-medium text-muted">{subtitle}</p>}

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-bold">{legend}</legend>
            <div className="grid grid-cols-2 gap-2">
              {choices.map((c) => (
                <label
                  key={c.value}
                  className={`press cursor-pointer rounded-2xl border-2 px-2 py-2 text-center text-sm font-bold has-focus-visible:outline-3 has-focus-visible:outline-brand ${
                    c.value === choice ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card"
                  }`}
                >
                  <input type="radio" name="choice" value={c.value} checked={c.value === choice} onChange={() => setChoice(c.value)} className="sr-only" />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold">{messageLabel(choice)}</span>
            <textarea
              ref={textRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={4000}
              lang={lang?.(choice)}
              placeholder={placeholder?.(choice)}
              className={`${field} resize-none`}
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-bold">
              {t.feedback.email} <span className="font-semibold text-muted">{t.feedback.optional}</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={200}
              placeholder={t.feedback.emailPlaceholder}
              className={field}
            />
          </label>

          {/* Trap for bots: hidden from people and screen readers, never focused. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          {state.step === "failed" ? (
            <div role="alert" className="mt-3 rounded-2xl bg-dontknow/10 px-3 py-2 text-sm font-semibold text-dontknow-ink">
              {state.error}{" "}
              <a href={mailtoUrl(state.form)} className="underline underline-offset-2">
                {t.feedback.byEmail}
              </a>
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-muted">{t.feedback.detailsNote}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} className={secondary}>
              {t.common.cancel}
            </button>
            <button type="submit" disabled={!canSend} className={primary}>
              {state.step === "sending" ? t.feedback.sending : state.step === "failed" ? t.feedback.tryAgain : t.feedback.send}
            </button>
          </div>
          {footer && <p className="mt-4 text-center text-xs font-semibold text-muted">{footer(choice, message)}</p>}
        </form>
      )}
    </div>,
    document.body,
  );
}
