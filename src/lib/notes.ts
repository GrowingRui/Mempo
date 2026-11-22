// My notes: a memory trick, picture or sentence the user writes on a word. Stored in Progress (`notes`), so
// backups and "Move to another device" carry them, and "Start over" keeps them like My list.
import type { Progress } from "./types";

export const MAX_NOTE = 200;

/** Trims the text, folds line breaks and runs of spaces into single spaces, and cuts it to MAX_NOTE characters. */
export function cleanNote(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE).trim();
}

export function noteOf(p: Progress, id: string): string {
  return p.notes[id] ?? "";
}

/** Saves the note; an empty note takes it away. */
export function setNote(p: Progress, id: string, text: string): Progress {
  const notes = { ...p.notes };
  const clean = cleanNote(text);
  if (clean) notes[id] = clean;
  else delete notes[id];
  return { ...p, notes };
}
