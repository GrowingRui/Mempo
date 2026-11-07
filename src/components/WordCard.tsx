import type { Gloss, Settings, Word } from "../lib/types";
import Highlight from "./Highlight";
import SpeakButton from "./SpeakButton";

const POS_LABEL: Record<string, string> = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition",
  conj: "conjunction", pron: "pronoun", interj: "interjection", num: "number",
  det: "determiner", phr: "phrase", abbr: "abbreviation",
};

function GlossList({ label, glosses }: { label: string; glosses: Gloss[] }) {
  if (glosses.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</h3>
      <ul className="space-y-1.5">
        {glosses.map((g, i) => (
          <li key={i} className="flex items-baseline gap-2">
            {g.pos && (
              <span
                className="shrink-0 rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-muted"
                title={POS_LABEL[g.pos] ?? g.pos}
              >
                {g.pos}
              </span>
            )}
            <span className="text-[17px] leading-snug">{g.gloss.join("; ")}</span>
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
        <div
          aria-hidden={flipped}
          className="flip-face flex flex-col rounded-[28px] border border-line bg-card p-6 shadow-[0_18px_40px_-18px_rgb(60_40_20/0.35)]"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold tracking-wider text-brand">{word.level}</span>
            <span className="truncate text-xs text-muted">{word.pos.map((p) => POS_LABEL[p] ?? p).join(" · ")}</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <h2 className="font-display text-[clamp(2.25rem,11vw,3.25rem)] leading-[1.05] font-semibold tracking-tight [overflow-wrap:anywhere]">
              {word.word}
            </h2>
            {word.phonetic && <p className="mt-2 text-[15px] text-muted">/{word.phonetic}/</p>}
            <SpeakButton text={word.word} className="mt-4" />
          </div>

          {example && (
            <p className="font-display text-[17px] leading-relaxed text-ink/75 italic">
              <Highlight text={example.text} terms={terms} />
            </p>
          )}
          <p className="mt-4 text-center text-xs text-muted">Tap to see the meaning</p>
        </div>

        {/* Back */}
        <div
          aria-hidden={!flipped}
          className="flip-face flip-back flex flex-col overflow-y-auto rounded-[28px] border border-line bg-card p-6 shadow-[0_18px_40px_-18px_rgb(60_40_20/0.35)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-2xl leading-tight font-semibold [overflow-wrap:anywhere]">{word.word}</h2>
              {word.phonetic && <p className="text-sm text-muted">/{word.phonetic}/</p>}
            </div>
            <SpeakButton text={word.word} className="shrink-0" />
          </div>

          <div className="mt-5 space-y-5">
            {settings.showZh && <GlossList label="中文" glosses={word.zh} />}
            {settings.showEs && <GlossList label="Español" glosses={word.es} />}
          </div>

          {extra.length > 0 && <p className="mt-5 text-sm text-muted">{extra.join(" ")}</p>}

          {word.examples.length > 0 && (
            <div className="mt-auto space-y-2 border-t border-line pt-4">
              {word.examples.slice(0, 2).map((ex, i) => (
                <p key={i} className="font-display text-[15px] leading-relaxed text-ink/75 italic">
                  <Highlight text={ex.text} terms={terms} />
                  {ex.source && (
                    <a
                      href={ex.source}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1.5 font-sans text-[11px] text-muted not-italic underline decoration-line underline-offset-2 hover:text-brand"
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
