import { useT } from "../i18n";
import type { ClozeItem } from "../lib/exam";
import { QUESTION_TOPIC_LABEL, questionReportBody, type QuestionTopic } from "../lib/report";
import FeedbackDialog from "./FeedbackDialog";

const TOPICS: QuestionTopic[] = ["fits", "answer", "note", "other"];

/**
 * "Report this question" after answering an exam question: another choice also fits, the answer or the
 * explanation is wrong. Sent by email through the feedback form with the question's id and text, so it can be
 * found in src/data and fixed. What reaches the developer stays in English.
 */
export default function QuestionReportDialog({ item, shown, onClose }: { item: ClozeItem; shown?: string; onClose: () => void }) {
  const t = useT();
  return (
    <FeedbackDialog<QuestionTopic>
      title={t.report.questionTitle}
      subtitle={<span className="font-bold text-ink">{item.id}</span>}
      legend={t.report.legend}
      choices={TOPICS.map((topic) => ({ value: topic, label: t.report.questionTopics[topic] }))}
      initial="fits"
      screen="exam question"
      build={(topic, message) => ({
        kind: "question",
        message,
        about: `${item.id} · ${QUESTION_TOPIC_LABEL[topic]}`,
        details: questionReportBody(item, topic, message, shown),
      })}
      messageLabel={(topic) => (topic === "fits" ? t.report.whichFits : t.report.questionComment)}
      lang={() => "en"}
      optional={(topic) => topic !== "other"}
      onClose={onClose}
    />
  );
}
