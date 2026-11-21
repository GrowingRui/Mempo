import type { Word } from "./types";

// Word families (decide → decision → decisive), built from the `base` links that scripts/families.ts
// puts on the cards. A family is every card that leads back to the same root word.

export interface FamilyMember {
  /** The word as shown. */
  text: string;
  /** The card's id when this is a Mempo card (the root can be a word that isn't one). */
  id?: string;
  pos?: string;
  level?: Word["level"];
}

export interface FamilyIndex {
  /** root word (lower case) → the cards built from it, root first. */
  families: Map<string, FamilyMember[]>;
  /** card id → its root word. */
  rootOf: Map<string, string>;
}

const MAX_STEPS = 5;

export function buildFamilies(words: Word[]): FamilyIndex {
  const cards = words.filter((w) => !w.lemma && !w.phrasal);
  const byText = new Map<string, Word>();
  for (const w of cards) {
    const k = w.word.toLowerCase();
    if (!byText.has(k)) byText.set(k, w);
  }

  const rootOf = new Map<string, string>();
  const families = new Map<string, FamilyMember[]>();
  const member = (w: Word): FamilyMember => ({ text: w.word, id: w.id, pos: w.pos[0], level: w.level });

  for (const w of cards) {
    if (!w.base) continue;
    let root: string = w.base.toLowerCase();
    for (let i = 0; i < MAX_STEPS; i++) {
      const up: string | undefined = byText.get(root)?.base?.toLowerCase();
      if (!up || up === root || up === w.word.toLowerCase()) break;
      root = up;
    }
    rootOf.set(w.id, root);
    let list = families.get(root);
    if (!list) {
      const rootCard = byText.get(root);
      list = [rootCard ? member(rootCard) : { text: root }];
      families.set(root, list);
    }
    list.push(member(w));
  }
  // A root card belongs to its own family too.
  for (const [root] of families) {
    const rc = byText.get(root);
    if (rc) rootOf.set(rc.id, root);
  }
  return { families, rootOf };
}

/** The other words in this card's family (not the card itself), root first. Empty when it has none. */
export function familyOf(index: FamilyIndex, word: Word): FamilyMember[] {
  const root = index.rootOf.get(word.id);
  if (!root) return [];
  const list = index.families.get(root) ?? [];
  const seen = new Set<string>();
  return list.filter((m) => {
    const k = m.text.toLowerCase();
    if (k === word.word.toLowerCase() || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
