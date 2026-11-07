import ConfirmDialog from "./ConfirmDialog";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** "Start over" confirmation. */
export default function ResetDialog({ words, onCancel, onConfirm }: { words: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog title="Start over from zero?" cancelLabel="Keep my progress" confirmLabel="Delete everything" onCancel={onCancel} onConfirm={onConfirm}>
      <p>
        This deletes your progress on {plural(words, "word")} in this browser: reviews, your “Don’t know” list and daily history. Your settings
        stay. This can’t be undone.
      </p>
    </ConfirmDialog>
  );
}
