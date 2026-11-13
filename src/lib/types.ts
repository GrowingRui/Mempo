export type Level = "B2" | "C1" | "C2";
export const LEVELS: Level[] = ["B2", "C1", "C2"];

export interface Gloss {
  pos: string;
  gloss: string[];
}

export interface Example {
  text: string;
  source?: string;
  form?: string;
}

/** offensive: the word is a slur or insult (tag on the front of the card). careful: a normal word with a rude or hurtful use. */
export interface Sensitive {
  level: "offensive" | "careful";
  note: string;
}

export interface Word {
  id: string;
  word: string;
  level: Level;
  phonetic?: string;
  pos: string[];
  zh: Gloss[];
  es: Gloss[];
  /** English definitions, grouped like the translations. */
  en?: Gloss[];
  /** Warning for an offensive or sensitive word: what it means, why it hurts, what to say instead. */
  sensitive?: Sensitive;
  variants?: string[];
  forms?: string[];
  lemma?: string;
  /** The word it's built from, for word formation (decision → "decide"). Set by scripts/families.ts. */
  base?: string;
  examples: Example[];
}

export type Answer = "know" | "unsure" | "dontknow";

export type CardState ="new" | "learning" | "review" | "mastered";

export interface CardProgress {
  state: CardState;
  box: number;
  due: string; // YYYY-MM-DD
  streak: number;
  lapses: number;
  inDontKnow: boolean;
  lastSeen?: string; // YYYY-MM-DD
}

export type SwipeKnow = "left" | "right";

/** Interface language (Settings → Language). Card meanings are separate (showZh / showEs / showEn). */
export type Lang = "en" | "zh" | "es";

/** "system" follows the phone or computer setting. */
export type Theme = "system" | "light" | "dark";

export interface Settings {
  level: Level;
  dailyNew: number;
  showZh: boolean;
  showEs: boolean;
  /** English definitions on the back of the card. */
  showEn: boolean;
  swipeKnow: SwipeKnow;
  theme: Theme;
  /** Language of buttons and messages. */
  lang: Lang;
  /** Most reviews in the daily session; 0 = no limit. */
  maxReviews: number;
}

export interface DayHistory {
  new: number;
  reviewed: number;
}

export interface Progress {
  settings: Settings;
  cards: Record<string, CardProgress>;
  history: Record<string, DayHistory>;
}
