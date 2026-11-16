/**
 * FSRS-6 (Free Spaced Repetition Scheduler), the method Anki uses, reduced to whole days.
 * Formulas from github.com/open-spaced-repetition (py-fsrs / ts-fsrs), with the default parameters.
 *
 * Every card has two numbers:
 * - stability S: days until the chance of remembering drops to 90 %
 * - difficulty D: 1 (easy) … 10 (hard); goes up with misses, down with easy answers
 */

/** 1 Again (don't know) · 2 Hard (not sure) · 3 Good (know) · 4 Easy (knew a brand-new word). */
export type Grade = 1 | 2 | 3 | 4;

export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
  1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

/** Wanted chance of still knowing a word on the day it comes back. */
export const RETENTION = 0.9;

const DECAY = -W[20];
const FACTOR = RETENTION ** (1 / DECAY) - 1;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Chance of remembering after `days` with stability `s`. */
export function retrievability(days: number, s: number): number {
  return (1 + (FACTOR * Math.max(0, days)) / s) ** DECAY;
}

/** Days until the chance of remembering falls to RETENTION (equals S at 90 %). */
export function intervalFor(s: number): number {
  return (s / FACTOR) * (RETENTION ** (1 / DECAY) - 1);
}

const initD = (g: Grade) => W[4] - Math.exp(W[5] * (g - 1)) + 1;

/** Stability and difficulty after the first answer to a word. */
export function first(g: Grade): { s: number; d: number } {
  return { s: W[g - 1], d: clampD(initD(g)) };
}

function nextD(d: number, g: Grade): number {
  const damped = d + (-W[6] * (g - 3) * (10 - d)) / 9;
  return clampD(W[7] * initD(4) + (1 - W[7]) * damped);
}

/** Stability and difficulty after answering a word last answered `days` ago (days ≥ 1). */
export function next(mem: { s: number; d: number }, days: number, g: Grade): { s: number; d: number } {
  const { s, d } = mem;
  const r = retrievability(days, s);
  let ns: number;
  if (g === 1) {
    const longTerm = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r));
    ns = Math.min(longTerm, s / Math.exp(W[17] * W[18]));
  } else {
    const hard = g === 2 ? W[15] : 1;
    const easy = g === 4 ? W[16] : 1;
    ns = s * (Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1);
  }
  return { s: Math.max(0.01, ns), d: nextD(d, g) };
}
