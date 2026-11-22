import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { buildFamilies, familyOf, type FamilyIndex, type FamilyMember } from "../lib/family";
import type { Word } from "../lib/types";
import { loadAllWords } from "../lib/words";
import { usePeek } from "./WordPeek";

let indexPromise: Promise<FamilyIndex> | undefined;
function loadFamilies(): Promise<FamilyIndex> {
  indexPromise ??= loadAllWords().then(buildFamilies);
  indexPromise.catch(() => (indexPromise = undefined)); // retry after a network error
  return indexPromise;
}

/** The other words built from the same root (decide → decision, decisive). Nothing is shown for a word with no family. */
export default function WordFamily({ word, className = "" }: { word: Word; className?: string }) {
  const t = useT();
  const peek = usePeek();
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    let live = true;
    setMembers([]);
    loadFamilies()
      .then((index) => live && setMembers(familyOf(index, word)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [word]);

  if (members.length === 0) return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <section lang="en" className={className}>
      <h3 className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-ink">{t.card.family}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {members.map((m) => {
          const inner = (
            <>
              <span className="font-display text-base font-bold">{m.text}</span>
              {m.pos && <span className="text-[11px] font-bold text-muted">{m.pos}</span>}
            </>
          );
          const chip = "flex items-baseline gap-1.5 rounded-xl border-2 px-2.5 py-1";
          // A Mempo card opens on top of the screen; a root that isn't a card (dashed) is only a label.
          return (
            <li key={m.text}>
              {m.id && peek ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // don't flip the card
                    peek(m.id!);
                  }}
                  onKeyDown={stop}
                  onPointerDown={stop} // don't start a swipe
                  aria-label={t.card.openWord(m.text)}
                  className={`${chip} border-line bg-card text-left hover:border-brand/50 hover:bg-brand-soft/40`}
                >
                  {inner}
                </button>
              ) : (
                <span className={`${chip} ${m.id ? "border-line bg-card" : "border-dashed border-line bg-paper"}`}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
