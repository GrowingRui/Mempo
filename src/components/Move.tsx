import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { encode } from "uqr";
import { useT } from "../i18n";
import type { Backup } from "../lib/backup";
import { formatCode, moveLink, normalizeCode, receiveProgress, sendProgress, supportsMove, type Sent } from "../lib/move";
import type { Progress } from "../lib/types";
import { useCloseOnBack } from "../lib/nav";

const button = "press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg disabled:opacity-50";
const primary = "press w-full rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] disabled:opacity-60";
const secondary = "press w-full rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold [--edge:var(--color-line-edge)]";

/** Settings → "Move to another device": the two buttons and their dialogs. */
export default function MoveRow({ progress, incoming, onReceived }: { progress: Progress; incoming: string | null; onReceived: (b: Backup) => void }) {
  const t = useT();
  const [open, setOpen] = useState<"send" | "receive" | null>(incoming !== null ? "receive" : null);
  const words = Object.keys(progress.cards).length;
  if (!supportsMove()) return <p className="text-sm font-semibold text-muted">{t.move.tooOld}</p>;
  return (
    <>
      <div className="flex gap-3">
        <button type="button" disabled={words === 0} onClick={() => setOpen("send")} className={button}>
          {t.move.showQr}
        </button>
        <button type="button" onClick={() => setOpen("receive")} className={button}>
          {t.move.enterCode}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">{words === 0 ? t.move.nothingToSend : t.move.whatMoves}</p>
      {open === "send" && <SendDialog progress={progress} onClose={() => setOpen(null)} />}
      {open === "receive" && (
        <ReceiveDialog
          initial={incoming ?? ""}
          onClose={() => setOpen(null)}
          onReceived={(b) => {
            setOpen(null);
            onReceived(b);
          }}
        />
      )}
    </>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useCloseOnBack(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-deep/55 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] border-2 border-line bg-card p-6 text-center shadow-[0_8px_0_var(--color-line-edge)]"
      >
        <h2 id="move-title" className="font-display text-2xl font-extrabold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Black squares on white, always (also in dark mode): phone cameras read that best. */
function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(text, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
    return { size: qr.size, path: d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className="mx-auto mt-4 w-full max-w-60 rounded-2xl bg-white">
      <path d={path} fill="#000" />
    </svg>
  );
}

function useCountdown(until: number | undefined): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

function SendDialog({ progress, onClose }: { progress: Progress; onClose: () => void }) {
  const t = useT();
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(sent?.expires);
  // The progress as it was when the dialog opened: studying meanwhile isn't possible, it's a modal.
  const snapshot = useRef(progress).current;

  const make = useCallback(() => {
    setSent(null);
    setError(null);
    sendProgress(snapshot).then(setSent, (e: unknown) => setError(e instanceof Error ? e.message : t.common.somethingWrong));
  }, [snapshot]); // not on `t`: switching language mustn't make a new code
  useEffect(make, [make]);

  const expired = sent !== null && left === 0;
  return (
    <Dialog title={t.settings.move} onClose={onClose}>
      {error ? (
        <p role="alert" className="mt-4 font-semibold text-dontknow-ink">
          {error}
        </p>
      ) : !sent ? (
        <p role="status" className="mt-4 py-16 font-semibold text-muted">
          {t.move.making}
        </p>
      ) : expired ? (
        <p role="status" className="mt-4 py-10 font-semibold text-muted">
          {t.move.expired}
        </p>
      ) : (
        <>
          <p className="mt-2 text-muted">{t.move.scan}</p>
          <QrCode text={moveLink(sent.code)} label={t.move.qrLabel(formatCode(sent.code))} />
          <p className="mt-4 text-sm font-semibold text-muted">{t.move.orType}</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-widest" aria-label={t.move.codeAria(sent.code.split("").join(" "))}>
            {formatCode(sent.code)}
          </p>
          <p className="mt-3 text-xs font-semibold text-muted">{t.move.worksFor(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`)}</p>
          <p className="mt-2 text-xs font-semibold text-muted">{t.move.iphoneNote}</p>
        </>
      )}
      <div className="mt-6 flex flex-col gap-3">
        {(error || expired) && (
          <button type="button" onClick={make} className={primary}>
            {t.move.makeNew}
          </button>
        )}
        <button type="button" autoFocus onClick={onClose} className={error || expired ? secondary : primary}>
          {error || expired ? t.common.close : t.common.done}
        </button>
      </div>
    </Dialog>
  );
}

function ReceiveDialog({ initial, onClose, onReceived }: { initial: string; onClose: () => void; onReceived: (b: Backup) => void }) {
  const t = useT();
  const [text, setText] = useState(initial.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(
    async (input: string) => {
      const code = normalizeCode(input);
      if (!code) return setError(t.move.badCode);
      setBusy(true);
      setError(null);
      try {
        onReceived(await receiveProgress(code));
      } catch (e) {
        setError(e instanceof Error ? e.message : t.common.somethingWrong);
        setBusy(false);
      }
    },
    [onReceived, t],
  );
  // Opened from a QR code: fetch straight away.
  const started = useRef(false);
  useEffect(() => {
    if (initial && !started.current) {
      started.current = true;
      void get(initial);
    }
  }, [initial, get]);

  return (
    <Dialog title={t.move.getTitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void get(text);
        }}
      >
        <p className="mt-2 text-muted">{t.move.getIntro}</p>
        <label className="mt-4 block">
          <span className="sr-only">{t.move.code}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            autoFocus={!initial}
            disabled={busy}
            placeholder="K7M2-QX9D"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            className="w-full rounded-2xl border-2 border-line bg-card px-4 py-3 text-center font-display text-2xl font-extrabold tracking-widest placeholder:text-muted/50 focus-visible:border-brand focus-visible:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-dontknow-ink">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3">
          <button type="submit" disabled={busy || !text.trim()} className={primary}>
            {busy ? t.move.getting : t.move.getMine}
          </button>
          <button type="button" onClick={onClose} className={secondary}>
            {t.common.cancel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
