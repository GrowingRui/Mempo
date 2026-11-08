import { useState } from "react";
import { disableReminder, enableReminder, loadReminder, permission, reminderSupport, setReminderTime, studyInfo } from "../lib/reminder";
import type { Progress } from "../lib/types";

const HOURS = Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`); // 06:00 … 23:00

/** Settings → Daily reminder: a switch and a time. */
export default function ReminderRow({ history }: { history: Progress["history"] }) {
  const support = reminderSupport();
  const [state, setState] = useState(loadReminder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = state.on && support === "ok" && permission() === "denied";

  const run = async (fn: () => Promise<typeof state>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
    } catch (e) {
      setState(loadReminder());
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sub =
    support === "install-ios"
      ? "On iPhone and iPad, install Mempo first (Share → Add to Home Screen), then turn this on in the app."
      : support === "unsupported"
        ? "This browser can’t show reminders. Try Chrome, Edge, Firefox or Safari."
        : state.on
          ? `Every day at ${state.time}, unless you’ve already studied.`
          : "A nudge at the time you choose, only on days you haven’t studied yet.";

  return (
    <>
      <div className="raised divide-y-2 divide-line rounded-[20px] border-2 border-line bg-card">
        <label className={`flex items-center gap-3 px-4 py-3 ${support !== "ok" || busy ? "opacity-60" : "cursor-pointer"}`}>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold">Remind me to study</span>
            <span className="block text-sm font-medium text-muted">{sub}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={state.on && support === "ok"}
            disabled={support !== "ok" || busy}
            onChange={(e) => void run(() => (e.target.checked ? enableReminder(state.time, studyInfo(history)) : disableReminder()))}
          />
          <span
            aria-hidden
            className="relative h-8 w-14 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-know peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-brand after:absolute after:top-1 after:left-1 after:size-6 after:rounded-full after:bg-white after:shadow-[0_2px_0_rgb(0_0_0/0.15)] after:transition-transform peer-checked:after:translate-x-6"
          />
        </label>
        {state.on && support === "ok" && (
          <label className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 font-display text-lg font-bold">Time</span>
            <select
              value={state.time}
              disabled={busy}
              onChange={(e) => void run(() => setReminderTime(e.target.value, studyInfo(history)))}
              className="rounded-xl border-2 border-line bg-card px-3 py-2 font-display text-base font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {(HOURS.includes(state.time) ? HOURS : [state.time, ...HOURS]).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {(error || blocked) && (
        <p role="alert" className="mt-2 text-sm font-semibold text-dontknow-ink">
          {error ?? "Notifications are blocked for Mempo. Allow them in your browser’s or phone’s settings."}
        </p>
      )}
      {support === "ok" && (
        <p className="mt-2 text-xs font-semibold text-muted">
          To send it, Mempo’s server keeps this device’s notification address, the time, your time zone and the last day you studied. Nothing else. Turning it off deletes them.
        </p>
      )}
    </>
  );
}
