import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { buildFamilies, familyOf, type FamilyIndex, type FamilyMember } from "../lib/family";
import type { Word } from "../lib/types";
import { loadAllWords } from "../lib/words";

let indexPromise: Promise<FamilyIndex> | undefined;
function loadFamilies(): Promise<FamilyIndex> {
  indexPromise ??= loadAllWords().then(buildFamilies);
  indexPromise.catch(() => (indexPromise = undefined)); // retry after a network error
  return indexPromise;
}

/** The other words built from the same root (decide → decision, decisive). Nothing is shown for a word with no family. */
export default function WordFamily({ word, className = "" }: { word: Word; className?: string }) {
  const t = useT();
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
  return (
    <section lang="en" className={className}>
      <h3 className="mb-2 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-ink">{t.card.family}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {members.map((m) => (
          <li
            key={m.text}
            className={`flex items-baseline gap-1.5 rounded-xl border-2 px-2.5 py-1 ${m.id ? "border-line bg-card" : "border-dashed border-line bg-paper"}`}
          >
            <span className="font-display text-base font-bold">{m.text}</span>
            {m.pos && <span className="text-[11px] font-bold text-muted">{m.pos}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
