import { useEffect, useState, type ReactNode } from "react";
import type { Screen } from "../App";
import Flame from "../components/Flame";
import Highlight from "../components/Highlight";
import { InstallBanner } from "../components/Install";
import Mascot from "../components/Mascot";
import type { Tab } from "../components/AppNav";
import { PRACTICE_ICONS, PracticeCard } from "./Practice";
import SpeakButton from "../components/SpeakButton";
import StarButton from "../components/StarButton";
import { inMyList, toggleMyList } from "../lib/mylist";
import { site } from "../config/site";
import { useT } from "../i18n";
import { toDay } from "../lib/date";
import { newWordsLeftToday, sessionParts } from "../lib/session";
import { streakOf } from "../lib/stats";
import { streakLine } from "./Stats";
import { meaning } from "../lib/leveltest";
import { LEVELS, type Progress, type Word } from "../lib/types";
import { loadAllWords, loadIndex, loadWords, type LevelIndex } from "../lib/words";
import { wordOfTheDay } from "../lib/wotd";

const GOALS = [10, 20, 30, 50];
const MIN_GOAL = 1;
const MAX_GOAL = 500;

function GoalChip({ active, onClick, children, wide }: { active: boolean; onClick: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`press min-w-0 ${wide ? "flex-[1.4]" : "flex-1"} rounded-2xl border-2 px-1 py-2.5 font-display text-lg font-bold tabular-nums ${
        active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

function NavTile({ onClick, n, label, tone }: { onClick: () => void; n: number | undefined; label: string; tone: string }) {
  const t = useT();
  return (
    <button type="button" onClick={onClick} className="press min-w-0 rounded-[20px] border-2 border-line bg-card px-2 pt-2.5 pb-3 text-left hover:border-brand/40 min-[360px]:px-3">
      <span className={`block font-display text-[22px] leading-tight font-extrabold tabular-nums min-[360px]:text-[26px] ${tone}`}>
        {n === undefined ? "…" : t.num(n)}
      </span>
      <span className="flex items-center justify-between gap-1 text-[13px] font-semibold text-muted">
        {label}
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}

/** Today's word for the chosen level (src/lib/wotd.ts): the same one the daily reminder shows. */
function WordOfTheDay({ word, progress, onStar }: { word: Word; progress: Progress; onStar: () => void }) {
  const t = useT();
  const { showZh, showEs } = progress.settings;
  const lines = [
    ...(showZh ? [{ lang: "zh", text: meaning(word, "zh") }] : []),
    ...(showEs ? [{ lang: "es", text: meaning(word, "es") }] : []),
  ].filter((l) => l.text);
  if (!lines.length && word.en?.[0]) lines.push({ lang: "en", text: word.en[0].gloss[0] });
  const example = word.examples[0];
  const terms = [word.word, ...(word.forms ?? []), ...(word.variants ?? []), example?.form ?? ""];
  return (
    <section aria-label={t.home.wotd} className="rounded-[24px] border-2 border-line bg-card px-4 pt-3 pb-4">
      <p className="text-xs font-bold tracking-wide text-brand-ink uppercase">{t.home.wotd}</p>
      <div className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] leading-tight font-extrabold [overflow-wrap:anywhere]">{word.word}</p>
          {word.phonetic && <p className="text-sm font-medium text-muted">/{word.phonetic}/</p>}
        </div>
        <StarButton word={word.word} starred={inMyList(progress, word.id)} onToggle={onStar} className="shrink-0" />
        <SpeakButton id={word.id} text={word.word} className="size-11 shrink-0" />
      </div>
      {lines.map((l) => (
        <p key={l.lang} lang={l.lang} className="mt-1.5 font-bold leading-snug">
          {l.text}
        </p>
      ))}
      {example && (
        <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
          <Highlight text={example.text} terms={terms} />
        </p>
      )}
    </section>
  );
}

interface Props {
  progress: Progress;
  setProgress: (fn: (p: Progress) => Progress) => void;
  go: (s: Screen) => void;
  /** Switch tab (Stats, Words), as the tab bar / sidebar does. */
  tab: (t: Tab) => void;
}

export default function Home({ progress, setProgress, go, tab }: Props) {
  const t = useT();
  const { settings, cards } = progress;
  const [index, setIndex] = useState<LevelIndex>();
  const [levelWords, setLevelWords] = useState<Word[]>();

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => {});
  }, []);

  useEffect(() => {
    setLevelWords(undefined);
    loadWords(settings.level)
      .then((ws) => {
        setLevelWords(ws);
        // Then fetch the other levels quietly, so Study, Recall and Exam practice open without waiting.
        const warm = () => loadAllWords().catch(() => {});
        if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 3000 });
        else setTimeout(warm, 1500);
      })
      .catch(() => {});
  }, [settings.level]);

  const today = toDay();
  const levelIds = levelWords?.map((w) => w.id);
  const wotd = levelWords && wordOfTheDay(levelWords, settings.level, today);
  const doneToday = progress.history[today]?.new ?? 0;
  const left = newWordsLeftToday(progress, today);
  const goalPct = Math.min(100, (doneToday / settings.dailyNew) * 100);

  const seen = levelIds?.filter((id) => cards[id]).length ?? 0;
  const total = index?.counts[settings.level] ?? levelIds?.length ?? 0;
  const allSeen = levelIds !== undefined && seen >= levelIds.length;

  // Today's session: due reviews → "Don't know" words → new words (reviews come from every level).
  const parts = sessionParts(progress, today);
  const newCount = levelIds ? Math.min(left, levelIds.length - seen) : left;
  const sessionSize = parts.reviews.length + parts.dontKnow.length + newCount;
  const breakdown = t.home.breakdown(parts.reviews.length, parts.dontKnow.length, newCount);
  const started = doneToday > 0 || (progress.history[today]?.reviewed ?? 0) > 0;
  const streak = streakOf(progress.history, today);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const goalNum = Number(goalDraft);
  const goalValid = Number.isInteger(goalNum) && goalNum >= MIN_GOAL && goalNum <= MAX_GOAL;
  const isCustomGoal = !GOALS.includes(settings.dailyNew);

  // Level and daily goal: open for someone new, folded into one line on phones once they've started (always open on wider screens).
  const [planOpen, setPlanOpen] = useState(() => Object.keys(cards).length === 0);

  const update = (patch: Partial<Progress["settings"]>) =>
    setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-2.5 min-[360px]:gap-3">
        <Mascot className="size-11 shrink-0 min-[360px]:size-14 md:hidden" />
        <div className="min-w-0 md:hidden">
          <h1 className="font-display text-[26px] leading-none font-extrabold tracking-tight min-[360px]:text-[32px]">{site.name}</h1>
          <p className="mt-1 text-sm leading-tight font-semibold text-muted min-[360px]:text-base">{t.home.tagline}</p>
        </div>
        <h1 className="hidden font-display text-3xl font-extrabold tracking-tight md:block">{t.nav.today}</h1>
        <div className="ml-auto flex shrink-0 gap-1.5 min-[360px]:gap-2 xl:hidden">
          <button
            type="button"
            onClick={() => tab("stats")}
            aria-label={t.home.statsAria(streak.current)}
            className="press flex h-11 items-center gap-1 rounded-2xl border-2 border-line bg-card pr-3 pl-2 [--depth:4px] hover:border-brand/40"
          >
            <Flame lit={streak.doneToday} className="size-6" />
            <span className="font-display text-lg font-extrabold tabular-nums">{streak.current}</span>
          </button>
          <button
            type="button"
            onClick={() => go({ name: "settings" })}
            aria-label={t.settings.title}
            className="press grid size-11 place-items-center rounded-2xl border-2 border-line bg-card [--depth:4px] hover:border-brand/40 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2.2" />
              <circle cx="9" cy="17" r="2.2" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-8">
        <div className="flex flex-col gap-4">
          {/* Today, with the main button inside, so it's on the first screen of a phone */}
          <section aria-label={t.home.todayAria} className="raised rounded-[28px] border-2 border-line bg-card p-5 md:p-6">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-6xl leading-none font-extrabold text-brand-ink tabular-nums">{doneToday}</span>
              <span className="font-display text-xl font-bold text-ink">{t.home.ofNewToday(settings.dailyNew)}</span>
            </p>
            <div className="mt-4 h-5 overflow-hidden rounded-full bg-brand-soft p-1">
              <div
                className="relative h-full rounded-full bg-brand transition-[width] duration-500 after:absolute after:inset-x-2 after:top-[3px] after:h-[3px] after:rounded-full after:bg-white/35"
                style={{ width: goalPct > 0 ? `max(${goalPct}%, 1.5rem)` : 0 }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-muted">
              {t.home.seenIn(settings.level, <span className="text-ink tabular-nums">{levelIds ? t.num(seen) : "…"}</span>, total)}
            </p>
            <div className="mt-5">
              {sessionSize > 0 ? (
                <button
                  type="button"
                  onClick={() => go({ name: "study", mode: "today" })}
                  disabled={!levelIds}
                  className="press w-full rounded-3xl bg-brand py-3 text-white [--depth:6px] [--edge:var(--color-brand-edge)] hover:bg-brand-dark disabled:opacity-60"
                >
                  <span className="block font-display text-2xl font-extrabold">{started ? t.home.keepGoing : t.home.start}</span>
                  <span className="block text-sm font-semibold text-white/85">{breakdown}</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-3xl border-2 border-know/30 bg-know/10 px-4 py-3">
                  <Mascot mood="cheer" className="size-12 shrink-0" />
                  <p className="font-display text-lg leading-snug font-bold text-know-ink">
                    {allSeen && left > 0 ? t.home.allSeen(settings.level) : t.home.allDone}
                  </p>
                </div>
              )}
              {parts.heldBack > 0 && sessionSize > 0 && (
                <p className="mt-3 text-center text-xs font-semibold text-muted">{t.home.heldBack(parts.heldBack, settings.maxReviews)}</p>
              )}
            </div>
          </section>

          {/* Other screens */}
          <nav className="grid grid-cols-3 gap-2 min-[360px]:gap-2.5" aria-label={t.home.practiceAria}>
            <NavTile onClick={() => go({ name: "study", mode: "review" })} n={parts.allDue} label={t.home.reviewsDue} tone="text-brand-ink" />
            <NavTile onClick={() => go({ name: "dontknow" })} n={parts.dontKnowTotal} label={t.answer.dontknow} tone="text-dontknow" />
            <NavTile onClick={() => tab("words")} n={index?.counts.total} label={t.home.allWords} tone="text-ink" />
          </nav>

          <section aria-labelledby="more-practice" className="mt-2 hidden md:block">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 id="more-practice" className="font-display text-xl font-bold">
                {t.home.morePractice}
              </h2>
              <button
                type="button"
                onClick={() => tab("practice")}
                className="text-sm font-bold text-brand-ink underline decoration-2 underline-offset-2 hover:text-ink"
              >
                {t.nav.practice} ›
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <PracticeCard onClick={() => go({ name: "recall" })} title={t.home.recall} sub={t.home.recallSub} icon={PRACTICE_ICONS.recall} />
              <PracticeCard onClick={() => go({ name: "exam" })} title={t.home.exam} sub={t.home.examSub} icon={PRACTICE_ICONS.exam} />
              {levelIds && seen < levelIds.length ? (
                <PracticeCard onClick={() => go({ name: "skip" })} title={t.home.skip} sub={t.home.skipSub} icon={PRACTICE_ICONS.skip} />
              ) : (
                <PracticeCard onClick={() => go({ name: "test" })} title={t.practice.testTitle} sub={t.practice.testSub} icon={PRACTICE_ICONS.test} />
              )}
            </div>
          </section>
        </div>

        {/* Right column on wide screens (below the rest on tablets and phones) */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => tab("stats")}
            aria-label={t.home.statsAria(streak.current)}
            className="press hidden items-center gap-3 rounded-[24px] border-2 border-line bg-card px-4 py-3.5 text-left hover:border-brand/40 xl:flex"
          >
            <Flame lit={streak.doneToday} className="size-11 shrink-0" />
            <span className="min-w-0">
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-3xl leading-none font-extrabold tabular-nums">{streak.current}</span>
                <span className="font-display text-lg font-bold">{t.stats.dayStreak(streak.current)}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug font-semibold text-muted">
                {streakLine(t, streak, today)}
              </span>
            </span>
          </button>
          {wotd && <WordOfTheDay word={wotd} progress={progress} onStar={() => setProgress((p) => toggleMyList(p, wotd.id))} />}

          {/* Level and daily goal */}
          <section aria-labelledby="your-plan" className="rounded-[24px] border-2 border-line bg-card px-4 pt-3 pb-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="your-plan" className="text-xs font-bold tracking-wide text-brand-ink uppercase">
                {t.home.yourPlan}
              </h2>
              <button
                type="button"
                onClick={() => setPlanOpen((o) => !o)}
                aria-expanded={planOpen}
                aria-controls="plan-body"
                className="text-sm font-bold text-brand-ink underline decoration-2 underline-offset-2 hover:text-ink md:hidden"
              >
                {planOpen ? t.common.done : t.home.change}
              </button>
            </div>

            {!planOpen && (
              <button type="button" onClick={() => setPlanOpen(true)} className="mt-1.5 flex w-full items-center gap-3 text-left md:hidden">
                <span className="rounded-xl bg-brand px-2.5 py-1 font-display text-xl font-extrabold text-white">{settings.level}</span>
                <span className="min-w-0">
                  <span className="block leading-tight font-bold">{t.levelName[settings.level]}</span>
                  <span className="block text-sm font-semibold text-muted">{t.home.planGoal(settings.dailyNew)}</span>
                </span>
              </button>
            )}

            <div id="plan-body" className={planOpen ? "" : "hidden md:block"}>
              <div className="mt-2 mb-2 flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold">{t.home.yourLevel}</h3>
                <button
                  type="button"
                  onClick={() => go({ name: "test" })}
                  className="text-right text-sm font-bold text-brand-ink underline decoration-2 underline-offset-2 hover:text-ink"
                >
                  {t.home.takeTest}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t.home.levelAria}>
                {LEVELS.map((lv) => {
                  const active = lv === settings.level;
                  return (
                    <button
                      key={lv}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => update({ level: lv })}
                      className={`press min-w-0 rounded-[18px] border-2 px-2 py-2 text-left min-[360px]:px-2.5 ${
                        active ? "border-brand bg-brand text-white [--edge:var(--color-brand-edge)]" : "border-line bg-card hover:border-brand/40"
                      }`}
                    >
                      <span className="block font-display text-2xl font-extrabold">{lv}</span>
                      <span className={`block text-[11px] leading-tight font-semibold min-[360px]:text-xs ${active ? "text-white/80" : "text-muted"}`}>{t.levelName[lv]}</span>
                      {index && (
                        <span className={`mt-0.5 block text-xs tabular-nums ${active ? "text-white/70" : "text-muted"}`}>
                          {t.common.words(index.counts[lv])}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-5 mb-2 font-display text-lg font-bold">{t.home.goalTitle}</h3>
              <div className="flex gap-1.5 min-[360px]:gap-2" role="radiogroup" aria-label={t.home.goalTitle}>
                {GOALS.map((g) => (
                  <GoalChip
                    key={g}
                    active={!editingGoal && g === settings.dailyNew}
                    onClick={() => {
                      setEditingGoal(false);
                      update({ dailyNew: g });
                    }}
                  >
                    {g}
                  </GoalChip>
                ))}
                <GoalChip
                  wide
                  active={editingGoal || isCustomGoal}
                  onClick={() => {
                    setGoalDraft(String(settings.dailyNew));
                    setEditingGoal(true);
                  }}
                >
                  {isCustomGoal && !editingGoal ? settings.dailyNew : <span className="text-sm min-[360px]:text-base">{t.home.custom}</span>}
                </GoalChip>
              </div>
              {editingGoal && (
                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (goalValid) {
                      update({ dailyNew: goalNum });
                      setEditingGoal(false);
                    }
                  }}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_GOAL}
                    max={MAX_GOAL}
                    autoFocus
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                    aria-label={t.home.goalInputAria}
                    className="w-24 rounded-2xl border-2 border-line bg-card px-4 py-2.5 text-center font-display text-lg font-bold tabular-nums outline-none focus:border-brand"
                  />
                  <span className="font-semibold text-muted">{t.home.wordsADay}</span>
                  <button
                    type="submit"
                    disabled={!goalValid}
                    className="press ml-auto rounded-2xl bg-brand px-5 py-2.5 font-bold text-white [--edge:var(--color-brand-edge)] disabled:opacity-40"
                  >
                    {t.common.save}
                  </button>
                </form>
              )}
              {editingGoal && !goalValid && goalDraft !== "" && (
                <p className="mt-2 text-sm font-semibold text-dontknow">{t.home.goalRange(MIN_GOAL, MAX_GOAL)}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <InstallBanner />
        <p className="mt-4 text-center text-xs font-semibold text-muted">{t.home.savedHere}</p>
      </div>
    </main>
  );
}

