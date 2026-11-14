import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { Question, TestLang } from "../lib/leveltest";
import SpeakButton from "./SpeakButton";

/** How long the right/wrong colours stay before the next word. */
const FEEDBACK_MS = { right: 700, wrong: 1500 };

/**
 * "What does it mean?": the word, 4 meanings and "I don't know". Shows right / wrong for a moment, then calls
 * `onAnswer` with the chosen option (null = "I don't know"). Give it a new `key` for each question.
 * Used by the level test and the check in "Skip words you know".
 */
export default function MeaningQuestion({ q, lang, onAnswer }: { q: Question; lang: TestLang; onAnswer: (choice: number | null) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null | undefined>(); // undefined = not answered yet, null = "I don't know"
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const answered = picked !== undefined;

  const choose = (choice: number | null) => {
    if (answered) return;
    setPicked(choice);
    timer.current = window.setTimeout(() => onAnswer(choice), choice === q.correct ? FEEDBACK_MS.right : FEEDBACK_MS.wrong);
  };

  const optionClass = (k: number) => {
    if (!answered) return "border-line bg-card hover:border-brand/40";
    if (k === q.correct) return "border-know bg-know text-white [--edge:var(--color-know-edge)]";
    if (k === picked) return "border-dontknow bg-dontknow text-white [--edge:var(--color-dontknow-edge)]";
    return "border-line bg-card opacity-50";
  };

  return (
    <>
      <section className="raised mt-6 flex flex-col items-center rounded-[28px] border-2 border-line bg-card px-5 py-8 text-center">
        <p className="font-display text-[40px] leading-tight font-extrabold break-words">{q.word.word}</p>
        {q.word.phonetic && <p className="mt-1 font-medium text-muted">/{q.word.phonetic}/</p>}
        <SpeakButton key={q.word.id} id={q.word.id} text={q.word.word} className="mt-4" />
      </section>

      <p className="mt-6 mb-2.5 font-display text-lg font-bold">{t.test.whatMeans}</p>
      <div className="flex flex-col gap-2.5" lang={lang}>
        {q.options.map((opt, k) => (
          <button
            key={k}
            type="button"
            onClick={() => choose(k)}
            disabled={answered}
            className={`press rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold disabled:cursor-default ${optionClass(k)}`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => choose(null)}
        disabled={answered}
        className={`press mt-4 rounded-2xl border-2 py-3 font-display text-lg font-bold disabled:cursor-default ${
          answered && picked === null ? "border-unsure bg-unsure text-deep [--edge:var(--color-unsure-edge)]" : "border-unsure/50 bg-card text-unsure-dark"
        } ${answered && picked !== null ? "opacity-50" : ""}`}
      >
        {t.common.iDontKnow}
      </button>
    </>
  );
}
