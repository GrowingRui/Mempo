import { motion, useIsPresent, useMotionValue, useTransform, type MotionValue, type PanInfo, type Variants } from "motion/react";
import { useRef } from "react";
import { useT } from "../i18n";
import type { Answer, Settings, Word } from "../lib/types";
import WordCard, { type CardStar } from "./WordCard";

export type SwipeDir = "left" | "right" | "up";

/** Which answer each swipe direction means, from the "swipe direction" setting. */
export function dirAnswers(settings: Settings): Record<SwipeDir, Answer> {
  return settings.swipeKnow === "left"
    ? { left: "know", right: "dontknow", up: "unsure" }
    : { left: "dontknow", right: "know", up: "unsure" };
}

export function answerDir(settings: Settings, a: Answer): SwipeDir {
  const map = dirAnswers(settings);
  return (Object.keys(map) as SwipeDir[]).find((d) => map[d] === a)!;
}

/** Enter from slightly behind, leave by flying off in the answer's direction (passed as `custom`). */
export const cardVariants: Variants = {
  enter: { scale: 0.95, opacity: 0, y: 14 },
  center: { scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
  exit: (dir: SwipeDir) =>
    dir === "up"
      ? { y: -700, opacity: 0, transition: { duration: 0.34, ease: "easeIn" } }
      : { x: dir === "left" ? -600 : 600, opacity: 0, transition: { duration: 0.34, ease: "easeIn" } },
};

const DIST = 110; // px past which a released card counts as answered
const FLICK_SPEED = 600; // px/s: a quick flick also counts, even if shorter
const FLICK_MIN = 40;

const TONE: Record<Answer, string> = {
  know: "border-know text-know",
  unsure: "border-unsure text-unsure-dark",
  dontknow: "border-dontknow text-dontknow",
};

/** How strongly a drag points in `dir` (0–1). Only the dominant axis shows a hint. */
function useHint(x: MotionValue<number>, y: MotionValue<number>, dir: SwipeDir) {
  return useTransform([x, y], ([lx, ly]: number[]) => {
    const horizontal = Math.abs(lx) >= -ly;
    const amount = dir === "up" ? (horizontal ? 0 : -ly) : !horizontal ? 0 : dir === "left" ? -lx : lx;
    return Math.min(1, Math.max(0, (amount - 20) / (DIST - 20)));
  });
}

interface Props {
  word: Word;
  flipped: boolean;
  onFlip: () => void;
  settings: Settings;
  onSwipe: (dir: SwipeDir) => void;
  star?: CardStar;
}

export default function SwipeCard({ word, flipped, onFlip, settings, onSwipe, star }: Props) {
  const t = useT();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-16, 16]);
  const isPresent = useIsPresent();
  const dragged = useRef(false);
  const answers = dirAnswers(settings);
  const hints: Record<SwipeDir, MotionValue<number>> = {
    left: useHint(x, y, "left"),
    right: useHint(x, y, "right"),
    up: useHint(x, y, "up"),
  };

  const onDragEnd = (_: unknown, { offset: o, velocity: v }: PanInfo) => {
    const horizontal = Math.abs(o.x) >= Math.abs(o.y);
    if (horizontal && (Math.abs(o.x) > DIST || (Math.abs(v.x) > FLICK_SPEED && Math.abs(o.x) > FLICK_MIN))) {
      onSwipe(o.x < 0 ? "left" : "right");
    } else if (!horizontal && (o.y < -DIST || (v.y < -FLICK_SPEED && o.y < -FLICK_MIN))) {
      onSwipe("up");
    }
    // otherwise dragSnapToOrigin springs it back
  };

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, y, rotate, pointerEvents: isPresent ? "auto" : "none" }}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag
      dragSnapToOrigin
      dragTransition={{ bounceStiffness: 500, bounceDamping: 28 }}
      onPointerDown={() => (dragged.current = false)}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={onDragEnd}
      onClickCapture={(e) => {
        // a drag that springs back shouldn't also flip the card
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      <WordCard word={word} flipped={flipped} onFlip={onFlip} settings={settings} star={star} />

      {(Object.keys(hints) as SwipeDir[]).map((dir) => (
        <motion.div
          key={dir}
          aria-hidden
          style={{ opacity: hints[dir] }}
          className={`pointer-events-none absolute inset-0 rounded-[32px] border-4 ${TONE[answers[dir]]}`}
        >
          <span
            className={`absolute rounded-2xl border-[3px] bg-card px-3.5 py-1 font-display text-2xl font-extrabold shadow-[0_4px_0_currentColor] ${TONE[answers[dir]]} ${
              dir === "left" ? "top-6 right-6 rotate-12" : dir === "right" ? "top-6 left-6 -rotate-12" : "top-[62%] left-1/2 -translate-x-1/2"
            }`}
          >
            {t.answer[answers[dir]]}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}
