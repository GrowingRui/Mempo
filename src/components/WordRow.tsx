import { useState } from "react";
import { formatDay } from "../lib/date";
import { MAX_BOX, statusOf, type WordStatus } from "../lib/srs";
import type { CardProgress, Settings, Word } from "../lib/types";
import Highlight from "./Highlight";
import SpeakButton from "./SpeakButton";
import { GlossList } from "./WordCard";

export const STATUS_LABEL: Record<WordStatus, string> = {
  new: "New",
  learning: "Learning",
  review: "Reviewing",
  mastered: "Mastered",
  dontknow: "Don’t know",
};

const STATUS_CLASS: Record<WordStatus, string> = {
  new: "bg-ink/[0.06] text-muted",
  learning: "bg-unsure/20 text-unsure-dark",
  review: "bg-brand/10 text-brand",
  mastered: "bg-know/12 text-know",
  dontknow: "bg-dontknow/10 text-dontknow",
};

/** A word in a list: tap to show its meanings and example. */
export default function WordRow({ word, card, settings }: { word: Word; card?: CardProgress; settings: Settings }) {
  const [open, setOpen] = useState(false);
  const status = statusOf(card);
  const summary = [settings.showZh && word.zh[0]?.gloss.slice(0, 2).join("；"), settings.showEs && word.es[0]?.gloss.slice(0, 2).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const terms = [word.word, ...(word.forms ?? []), ...(word.variants ?? []), ...word.examples.map((e) => e.form ?? "")];

  return (
    <li className="rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 py-1 text-left">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-display text-lg font-semibold">{word.word}</span>
            <span className="shrink-0 text-[11px] font-bold tracking-wider text-brand">{word.level}</span>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </span>
          {!open && summary && <span className="mt-0.5 block truncate text-sm text-muted">{summary}</span>}
        </button>
        <SpeakButton id={word.id} text={word.word} className="shrink-0" />
      </div>

      {open && (
        <div className="space-y-4 border-t border-line px-4 pt-3 pb-4">
          {word.phonetic && <p className="text-sm text-muted">/{word.phonetic}/</p>}
          {settings.showZh && <GlossList label="中文" glosses={word.zh} />}
          {settings.showEs && <GlossList label="Español" glosses={word.es} />}
          {word.examples[0] && (
            <p className="font-display text-[15px] leading-relaxed text-ink/75 italic">
              <Highlight text={word.examples[0].text} terms={terms} />
            </p>
          )}
          {card && card.state !== "mastered" && (
            <p className="text-xs text-muted">
              Next review: {formatDay(card.due)} · box {card.box} of {MAX_BOX}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
