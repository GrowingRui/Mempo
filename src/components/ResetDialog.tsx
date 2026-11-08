import { useT } from "../i18n";
import ConfirmDialog from "./ConfirmDialog";

/** "Start over" confirmation. */
export default function ResetDialog({ words, onCancel, onConfirm }: { words: number; onCancel: () => void; onConfirm: () => void }) {
  const t = useT();
  return (
    <ConfirmDialog title={t.reset.title} cancelLabel={t.reset.keep} confirmLabel={t.reset.delete} onCancel={onCancel} onConfirm={onConfirm}>
      <p>{t.reset.body(words)}</p>
    </ConfirmDialog>
  );
}
