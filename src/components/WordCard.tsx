import type { Gloss, Settings, Word } from "../lib/types";
import Highlight from "./Highlight";
import SpeakButton from "./SpeakButton";

export const POS_LABEL: Record<string, string> = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition",
  conj: "conjunction", pron: "pronoun", interj: "interjection", num: "number",
  det: "determiner", phr: "phrase", abbr: "abbreviation",
};

export function GlossList({ label, glosses }: { label: string; glosses: Gloss[] }) {
  if (glosses.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-ink">{label}</h3>
      <ul className="space-y-1.5">
        {glosses.map((g, i) => (
          <li key={i} className="flex items-baseline gap-2">
            {g.pos && (
              <span
                className="w-9 shrink-0 rounded-lg border-2 border-line py-px text-center text-[11px] font-bold text-muted"
                title={POS_LABEL[g.pos] ?? g.pos}
              >
                {g.pos}
              </span>
            )}
            <span className="text-[17px] leading-snug font-medium">{g.gloss.join("; ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Props {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
  settings: Settings;
}

const FACE = "flip-face flex flex-col rounded-[32px] border-2 border-line bg-card p-6 shadow-[0_8px_0_var(--color-line-edge)]";

export default function WordCard({ word, flipped, onFlip, settings }: Props) {
  const example = word.examples[0];
  const terms = [word.word, ...(word.forms ?? []), ...(word.variants ?? []), ...word.examples.map((e) => e.form ?? "")];
  const extra = [
    word.variants?.length ? `Also spelled ${word.variants.join(", ")}.` : "",
    word.forms?.length ? `Forms: ${word.forms.join(", ")}` : "",
  ].filter(Boolean);

  return (
    <div
      className="flip absolute inset-0 cursor-pointer select-none"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "Show the word" : "Show the meaning"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <div className={`flip-inner h-full w-full ${flipped ? "flipped" : ""}`}>
        {/* Front */}
        <div aria-hidden={flipped} className={FACE}>
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-brand px-3 py-1 font-display text-sm font-extrabold text-white">{word.level}</span>
            <span className="truncate text-sm font-semibold text-muted">{word.pos.map((p) => POS_LABEL[p] ?? p).join(", ")}</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="font-display text-[clamp(2.5rem,12vw,3.5rem)] leading-[1.02] font-extrabold tracking-tight [overflow-wrap:anywhere]">
              {word.word}
            </h2>
            {word.phonetic && <p className="mt-2 text-base font-medium text-muted">/{word.phonetic}/</p>}
            <SpeakButton id={word.id} text={word.word} className="mt-5" />
          </div>

          {example && (
            <p className="text-[17px] leading-relaxed text-ink/80">
              <Highlight text={example.text} terms={terms} />
            </p>
          )}
          <p className="mt-4 text-center text-sm font-semibold text-muted">Tap the card to see the meaning</p>
        </div>

        {/* Back */}
        <div aria-hidden={!flipped} className={`${FACE} flip-back overflow-y-auto`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-3xl leading-tight font-extrabold [overflow-wrap:anywhere]">{word.word}</h2>
              {word.phonetic && <p className="text-sm font-medium text-muted">/{word.phonetic}/</p>}
            </div>
            <SpeakButton id={word.id} text={word.word} className="shrink-0" />
          </div>

          <div className="mt-5 space-y-5">
            {settings.showZh && <GlossList label="中文" glosses={word.zh} />}
            {settings.showEs && <GlossList label="Español" glosses={word.es} />}
          </div>

          {extra.length > 0 && <p className="mt-5 text-sm font-medium text-muted">{extra.join(" ")}</p>}

          {word.examples.length > 0 && (
            <div className="mt-auto space-y-2 pt-5">
              {word.examples.slice(0, 2).map((ex, i) => (
                <p key={i} className="rounded-2xl bg-paper px-3.5 py-2.5 text-[15px] leading-relaxed text-ink/80">
                  <Highlight text={ex.text} terms={terms} />
                  {ex.source && (
                    <a
                      href={ex.source}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1.5 text-[11px] font-semibold text-muted underline decoration-line decoration-2 underline-offset-2 hover:text-brand-ink"
                    >
                      Tatoeba
                    </a>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
