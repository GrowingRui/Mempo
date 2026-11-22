// Exam countdown: from the exam date, how many new words a day it takes to have seen the whole level
// with a week left for revision.
import { daysBetween } from "./date";

/** The most new words a day the app allows (Today → Your plan). */
export const MAX_DAILY_GOAL = 500;

/** New words stop this many days before the exam, so the last week is for revising. */
export const REVISION_DAYS = 7;
/** Under this many days to go there is no week to spare: the new words just have to fit before the exam. */
const MIN_FOR_REVISION = REVISION_DAYS * 2;

export type CountdownPlan =
  | { status: "past"; days: number }
  | { status: "done"; days: number }
  | { status: "ontrack" | "behind"; days: number; need: number };

/** `left`: words of the level not seen yet. `goal`: the user's new words a day. */
export function countdownPlan(examDate: string, today: string, left: number, goal: number): CountdownPlan {
  const days = daysBetween(today, examDate);
  if (days < 0) return { status: "past", days };
  if (left <= 0) return { status: "done", days };
  const learning = days > MIN_FOR_REVISION ? days - REVISION_DAYS : Math.max(1, days);
  const need = Math.ceil(left / learning);
  return { status: need <= goal ? "ontrack" : "behind", days, need };
}
