import { useT } from "../i18n";
import { reportBody, reportUrl, TOPIC_LABEL, type ReportTopic } from "../lib/report";
import type { Word } from "../lib/types";
import FeedbackDialog from "./FeedbackDialog";

const TOPICS: ReportTopic[] = ["zh", "es", "example", "other"];

/**
 * "Report a problem" with a word, from the back of its card. Sent by email through the feedback form, with the
 * word, what's shown now and a ready-to-paste scripts/manual.ts line. A public GitHub issue is offered too.
 * The form speaks the app's language; what reaches the developer (subject, details, issue) stays in English.
 */
export default function ReportDialog({ word, initial = "zh", onClose }: { word: Word; initial?: ReportTopic; onClose: () => void }) {
  const t = useT();
  return (
    <FeedbackDialog<ReportTopic>
      title={t.report.title}
      subtitle={t.report.with(<span className="font-bold text-ink">{word.word}</span>)}
      legend={t.report.legend}
      choices={TOPICS.map((topic) => ({ value: topic, label: t.report.topics[topic] }))}
      initial={initial}
      screen="word card"
      build={(topic, message) => ({ kind: "word", message, about: `${word.word} · ${TOPIC_LABEL[topic]}`, details: reportBody(word, topic, message) })}
      messageLabel={(topic) => (topic === "zh" || topic === "es" ? t.report.betterTranslation : t.report.whatShouldSay)}
      placeholder={(topic) => (topic === "zh" ? "例如：通路，入口" : topic === "es" ? "p. ej.: acceso, entrada" : "")}
      lang={(topic) => (topic === "zh" ? "zh" : topic === "es" ? "es" : "en")}
      optional={() => true}
      footer={(topic, message) => (
        <>
          {t.report.public}{" "}
          <a href={reportUrl(word, topic, message)} target="_blank" rel="noopener" className="underline underline-offset-2">
            {t.report.issue}
          </a>
        </>
      )}
      onClose={onClose}
    />
  );
}
