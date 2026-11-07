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

export interface Word {
  id: string;
  word: string;
  level: Level;
  phonetic?: string;
  pos: string[];
  zh: Gloss[];
  es: Gloss[];
  variants?: string[];
  forms?: string[];
  lemma?: string;
  examples: Example[];
}

export type CardState = "new" | "learning" | "review" | "mastered";

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

export interface Settings {
  level: Level;
  dailyNew: number;
  showZh: boolean;
  showEs: boolean;
  swipeKnow: SwipeKnow;
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
