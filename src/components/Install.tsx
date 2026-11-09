import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { bannerDismissed, dismissBanner, promptInstall, useInstallMode, type InstallMode } from "../lib/install";
import { useCloseOnBack } from "../lib/nav";
import Mascot from "./Mascot";

/** Mode + one action: the browser's dialog when available, otherwise our steps sheet. */
function useInstall() {
  const mode = useInstallMode();
  const [steps, setSteps] = useState(false);
  const start = () => {
    if (mode === "prompt") void promptInstall();
    else setSteps(true);
  };
  const sheet = steps && (mode === "ios" || mode === "android" || mode === "mac") ? <InstallSteps mode={mode} onClose={() => setSteps(false)} /> : null;
  return { mode, canInstall: mode === "prompt" || mode === "ios" || mode === "android" || mode === "mac", start, sheet };
}

const ShareIcon = ({ label }: { label: string }) => (
  <svg viewBox="0 0 24 24" className="inline size-5 -translate-y-px align-middle text-brand-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label={label}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);
const AddIcon = () => (
  <svg viewBox="0 0 24 24" className="inline size-5 -translate-y-px align-middle text-brand-ink" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);
const MenuIcon = ({ label }: { label: string }) => (
  <svg viewBox="0 0 24 24" className="inline size-5 -translate-y-px align-middle text-brand-ink" fill="currentColor" aria-label={label}>
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

function InstallSteps({ mode, onClose }: { mode: "ios" | "android" | "mac"; onClose: () => void }) {
  const t = useT();
  const okRef = useRef<HTMLButtonElement>(null);
  useCloseOnBack(onClose);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const steps = t.install.steps({ share: <ShareIcon label={t.install.share} />, add: <AddIcon />, menu: <MenuIcon label={t.install.menu} /> })[mode];
  const note = t.install.notes[mode];

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-deep/55 p-4 min-[480px]:place-items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_8px_0_var(--color-line-edge)]"
      >
        <Mascot mood="cheer" className="mx-auto size-16" />
        <h2 id="install-title" className="mt-2 text-center font-display text-2xl font-extrabold">
          {t.install.sheetTitle(mode === "mac")}
        </h2>
        <ol className="mt-5 flex flex-col gap-3.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand font-display text-sm font-extrabold text-white">{i + 1}</span>
              <span className="pt-0.5 leading-snug">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm font-medium text-muted">{note}</p>
        <button
          ref={okRef}
          type="button"
          onClick={onClose}
          className="press mt-6 w-full rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)]"
        >
          {t.install.gotIt}
        </button>
      </div>
    </div>
  );
}

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="6" y="2.5" width="12" height="19" rx="3" />
    <path d="M12 8v6M9.5 11.5 12 14l2.5-2.5" />
  </svg>
);

/** Home: a small card under the Start button. Hidden once installed or after ×. */
export function InstallBanner() {
  const t = useT();
  const { canInstall, start, sheet } = useInstall();
  const [hidden, setHidden] = useState(bannerDismissed);
  if (!canInstall || hidden) return sheet;
  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-[20px] border-2 border-line bg-card/70 py-2 pr-2 pl-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-ink">
          <PhoneIcon />
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug font-semibold">
          {t.install.getApp}
          <span className="hidden text-muted min-[360px]:inline">{t.install.worksOffline}</span>
        </p>
        <button
          type="button"
          onClick={start}
          className="press shrink-0 rounded-xl bg-brand px-3.5 py-2 font-display text-sm font-bold text-white [--depth:3px] [--edge:var(--color-brand-edge)]"
        >
          {t.common.install}
        </button>
        <button
          type="button"
          aria-label={t.install.hide}
          onClick={() => {
            dismissBanner();
            setHidden(true);
          }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-lg font-bold text-muted hover:text-ink"
        >
          ×
        </button>
      </div>
      {sheet}
    </>
  );
}

/** Settings: always visible, explains why when installing isn't possible. */
export function InstallRow() {
  const t = useT();
  const { mode, canInstall, start, sheet } = useInstall();
  const rowText: Record<InstallMode, string> = t.install.row;
  return (
    <div className="raised mb-3 flex items-center gap-3 rounded-[20px] border-2 border-line bg-card p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-ink">
        {mode === "installed" || mode === "done" ? <Mascot className="size-8" /> : <PhoneIcon />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold">{mode === "installed" || mode === "done" ? t.install.installed : t.install.installTheApp}</span>
        <span className="block text-sm font-medium text-muted">{rowText[mode]}</span>
      </span>
      {canInstall && (
        <button
          type="button"
          onClick={start}
          className="press shrink-0 rounded-xl bg-brand px-4 py-2.5 font-display text-base font-bold text-white [--depth:4px] [--edge:var(--color-brand-edge)]"
        >
          {t.common.install}
        </button>
      )}
      {sheet}
    </div>
  );
}
