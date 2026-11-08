import { reportBody, reportUrl, TOPIC_LABEL, type ReportTopic } from "../lib/report";
import type { Word } from "../lib/types";
import FeedbackDialog from "./FeedbackDialog";

const TOPICS: ReportTopic[] = ["zh", "es", "example", "other"];

/**
 * "Report a problem" with a word, from the back of its card. Sent by email through the feedback form, with the
 * word, what's shown now and a ready-to-paste scripts/manual.ts line. A public GitHub issue is offered too.
 */
export default function ReportDialog({ word, initial = "zh", onClose }: { word: Word; initial?: ReportTopic; onClose: () => void }) {
  return (
    <FeedbackDialog<ReportTopic>
      title="Report a problem"
      subtitle={
        <>
          with <span className="font-bold text-ink">{word.word}</span>
        </>
      }
      legend="What’s wrong?"
      choices={TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }))}
      initial={initial}
      screen="word card"
      build={(topic, message) => ({ kind: "word", message, about: `${word.word} · ${TOPIC_LABEL[topic]}`, details: reportBody(word, topic, message) })}
      messageLabel={(t) => (t === "zh" || t === "es" ? "Better translation (optional)" : "What should it say? (optional)")}
      placeholder={(t) => (t === "zh" ? "例如：通路，入口" : t === "es" ? "p. ej.: acceso, entrada" : "")}
      lang={(t) => (t === "zh" ? "zh" : t === "es" ? "es" : "en")}
      optional={() => true}
      footer={(topic, message) => (
        <>
          Prefer it public?{" "}
          <a href={reportUrl(word, topic, message)} target="_blank" rel="noopener" className="underline underline-offset-2">
            Open a GitHub issue
          </a>
        </>
      )}
      onClose={onClose}
    />
  );
}
