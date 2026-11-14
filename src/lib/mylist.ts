// My list: words the user stars (on a card, in a word list, or by searching on the My list screen) to
// practise whenever they like. Stored in Progress, so backups and "Move to another device" carry it.
import { toDay } from "./date";
import type { Progress } from "./types";

export function inMyList(p: Progress, id: string): boolean {
  return id in p.myList;
}

/** Stars the word, or takes it off the list if it's already there. */
export function toggleMyList(p: Progress, id: string, today = toDay()): Progress {
  const myList = { ...p.myList };
  if (id in myList) delete myList[id];
  else myList[id] = today;
  return { ...p, myList };
}

/** The ids on the list, most recently added first (on the same day, by the order they were added: keys keep it). */
export function myListIds(p: Progress): string[] {
  const ids = Object.keys(p.myList);
  const at = new Map(ids.map((id, i) => [id, i]));
  return ids.sort((a, b) => p.myList[b].localeCompare(p.myList[a]) || at.get(b)! - at.get(a)!);
}
