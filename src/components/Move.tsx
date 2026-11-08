import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { encode } from "uqr";
import type { Backup } from "../lib/backup";
import { formatCode, moveLink, normalizeCode, receiveProgress, sendProgress, supportsMove, type Sent } from "../lib/move";
import type { Progress } from "../lib/types";

const button = "press min-w-0 flex-1 rounded-2xl border-2 border-line bg-card px-2 py-3 font-display text-base font-bold min-[400px]:text-lg disabled:opacity-50";
const primary = "press w-full rounded-2xl bg-brand py-3 font-display text-lg font-bold text-white [--edge:var(--color-brand-edge)] disabled:opacity-60";
const secondary = "press w-full rounded-2xl border-2 border-line bg-card py-3 font-display text-lg font-bold [--edge:var(--color-line-edge)]";

/** Settings → "Move to another device": the two buttons and their dialogs. */
export default function MoveRow({ progress, incoming, onReceived }: { progress: Progress; incoming: string | null; onReceived: (b: Backup) => void }) {
  const [open, setOpen] = useState<"send" | "receive" | null>(incoming !== null ? "receive" : null);
  const words = Object.keys(progress.cards).length;
  if (!supportsMove()) return <p className="text-sm font-semibold text-muted">This browser is too old for this. Use “Download backup” below instead.</p>;
  return (
    <>
      <div className="flex gap-3">
        <button type="button" disabled={words === 0} onClick={() => setOpen("send")} className={button}>
          Show QR code
        </button>
        <button type="button" onClick={() => setOpen("receive")} className={button}>
          Enter a code
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">
        {words === 0 ? "Nothing to send yet. On the device you want to copy from, tap “Show QR code”." : "Your words, history and settings. They replace what’s on the other device."}
      </p>
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
  const [sent, setSent] = useState<Sent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const left = useCountdown(sent?.expires);
  // The progress as it was when the dialog opened: studying meanwhile isn't possible, it's a modal.
  const snapshot = useRef(progress).current;

  const make = useCallback(() => {
    setSent(null);
    setError(null);
    sendProgress(snapshot).then(setSent, (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong. Try again."));
  }, [snapshot]);
  useEffect(make, [make]);

  const expired = sent !== null && left === 0;
  return (
    <Dialog title="Move to another device" onClose={onClose}>
      {error ? (
        <p role="alert" className="mt-4 font-semibold text-dontknow-ink">
          {error}
        </p>
      ) : !sent ? (
        <p role="status" className="mt-4 py-16 font-semibold text-muted">
          Making a code…
        </p>
      ) : expired ? (
        <p role="status" className="mt-4 py-10 font-semibold text-muted">
          This code has expired.
        </p>
      ) : (
        <>
          <p className="mt-2 text-muted">Scan this with the other device’s camera.</p>
          <QrCode text={moveLink(sent.code)} label={`QR code with the link to Mempo and the code ${formatCode(sent.code)}`} />
          <p className="mt-4 text-sm font-semibold text-muted">Or open Mempo there, go to Settings → Enter a code:</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-widest" aria-label={`Code ${sent.code.split("").join(" ")}`}>
            {formatCode(sent.code)}
          </p>
          <p className="mt-3 text-xs font-semibold text-muted">
            Works for {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} more. Until then your progress waits on Mempo’s server, then it’s deleted.
          </p>
          <p className="mt-2 text-xs font-semibold text-muted">On an iPhone or iPad with Mempo on the Home Screen, enter the code in that app: the camera opens Safari, which keeps its own copy.</p>
        </>
      )}
      <div className="mt-6 flex flex-col gap-3">
        {(error || expired) && (
          <button type="button" onClick={make} className={primary}>
            Make a new code
          </button>
        )}
        <button type="button" autoFocus onClick={onClose} className={error || expired ? secondary : primary}>
          {error || expired ? "Close" : "Done"}
        </button>
      </div>
    </Dialog>
  );
}

function ReceiveDialog({ initial, onClose, onReceived }: { initial: string; onClose: () => void; onReceived: (b: Backup) => void }) {
  const [text, setText] = useState(initial.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(
    async (input: string) => {
      const code = normalizeCode(input);
      if (!code) return setError("A code has 8 letters and numbers, like K7M2-QX9D.");
      setBusy(true);
      setError(null);
      try {
        onReceived(await receiveProgress(code));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        setBusy(false);
      }
    },
    [onReceived],
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
    <Dialog title="Get your progress" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void get(text);
        }}
      >
        <p className="mt-2 text-muted">On the other device: Settings → Show QR code. Type the code shown under it.</p>
        <label className="mt-4 block">
          <span className="sr-only">Code</span>
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
            {busy ? "Getting it…" : "Get my progress"}
          </button>
          <button type="button" onClick={onClose} className={secondary}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}
