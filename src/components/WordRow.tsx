import { useState } from "react";
import { useT } from "../i18n";
import { toDay } from "../lib/date";
import { MAX_BOX, statusOf, type WordStatus } from "../lib/srs";
import type { CardProgress, Settings, Word } from "../lib/types";
import Highlight from "./Highlight";
import SpeakButton from "./SpeakButton";
import { GlossList, SensitiveNote } from "./WordCard";

const STATUS_CLASS: Record<WordStatus, string> = {
  new: "bg-paper text-muted",
  learning: "bg-unsure/25 text-unsure-dark",
  review: "bg-brand-soft text-brand-ink",
  mastered: "bg-know/15 text-know-ink",
  dontknow: "bg-dontknow/12 text-dontknow-ink",
};

/** A word in a list: tap to show its meanings and example. */
export default function WordRow({ word, card, settings }: { word: Word; card?: CardProgress; settings: Settings }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const status = statusOf(card);
  const summary = [settings.showZh && word.zh[0]?.gloss.slice(0, 2).join("；"), settings.showEs && word.es[0]?.gloss.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join("  /  ");
  const terms = [word.word, ...(word.forms ?? []), ...(word.variants ?? []), ...word.examples.map((e) => e.form ?? "")];

  return (
    <li className="rounded-[20px] border-2 border-line bg-card shadow-[0_4px_0_var(--color-line-edge)]">
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 py-1 text-left">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-display text-xl font-extrabold">{word.word}</span>
            <span className="shrink-0 rounded-md bg-brand px-1.5 font-display text-[11px] font-extrabold text-white">{word.level}</span>
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLASS[status]}`}>
              {t.status[status]}
            </span>
          </span>
          {!open && summary && <span className="mt-0.5 block truncate text-sm font-medium text-muted">{summary}</span>}
        </button>
        <SpeakButton id={word.id} text={word.word} className="shrink-0" />
      </div>

      {open && (
        <div className="space-y-4 border-t-2 border-line px-4 pt-3 pb-4">
          {word.phonetic && <p className="text-sm text-muted">/{word.phonetic}/</p>}
          {word.sensitive && <SensitiveNote sensitive={word.sensitive} />}
          {settings.showZh && <GlossList label="中文" glosses={word.zh} lang="zh" />}
          {settings.showEs && <GlossList label="Español" glosses={word.es} lang="es" />}
          {settings.showEn && word.en && <GlossList label="English" glosses={word.en} lang="en" />}
          {word.examples[0] && (
            <p className="rounded-2xl bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink/80">
              <Highlight text={word.examples[0].text} terms={terms} />
            </p>
          )}
          {card && card.state !== "mastered" && (
            <p className="text-xs font-semibold text-muted">{t.card.nextReviewStep(t.when(card.due, toDay()), card.box, MAX_BOX)}</p>
          )}
        </div>
      )}
    </li>
  );
}
