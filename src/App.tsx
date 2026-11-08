import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import UpdatePrompt from "./components/UpdatePrompt";
import { HTML_LANG, LangProvider } from "./i18n";
import type { SessionMode } from "./lib/session";
import { takeCodeFromUrl } from "./lib/move";
import { syncReminder, studyInfo } from "./lib/reminder";
import { loadProgress, saveProgress } from "./lib/storage";
import { applyTheme } from "./lib/theme";
import { countUsage } from "./lib/usage";
import { toDay } from "./lib/date";
import type { Progress } from "./lib/types";
import DontKnow from "./pages/DontKnow";
import Home from "./pages/Home";
import LevelTest from "./pages/LevelTest";
import Recall from "./pages/Recall";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";
import Study from "./pages/Study";
import WordList from "./pages/WordList";

export type Screen = { name: "home" } | { name: "study"; mode: SessionMode } | { name: "dontknow" } | { name: "words" } | { name: "test" } | { name: "recall" } | { name: "stats" } | { name: "settings" };

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // Opened from a "Move to another device" QR code: go straight to Settings, which asks before replacing anything.
  const [moveCode] = useState(takeCodeFromUrl);
  const [screen, setScreen] = useState<Screen>(moveCode !== null ? { name: "settings" } : { name: "home" });

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);
  // Tells the reminder server about the first study of the day, so no reminder comes on a day already done.
  const info = studyInfo(progress.history);
  useEffect(() => {
    void syncReminder({ lastStudied: info.lastStudied, streak: info.streak }, progress.settings.lang);
  }, [info.lastStudied, info.streak, progress.settings.lang]);
  // Anonymous usage counts (Settings → Privacy): opened today, studied today. Also when an open app comes back into view.
  useEffect(() => {
    void countUsage("open");
    const onShow = () => document.visibilityState === "visible" && void countUsage("open");
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
  // (sends only once a day; checked on every answer so it still works when the app stays open past midnight)
  useEffect(() => {
    if (studyInfo(progress.history).lastStudied === toDay()) void countUsage("study");
  }, [progress.history]);
  useEffect(() => applyTheme(progress.settings.theme), [progress.settings.theme]);
  const lang = progress.settings.lang;
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);
  // (braces matter: scrollTo returns a Promise in newer browsers, and React treats an effect's return value as its cleanup)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const home = () => setScreen({ name: "home" });

  return (
    <LangProvider lang={lang}>
    <MotionConfig reducedMotion="user">
      <UpdatePrompt />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {screen.name === "study" ? (
          <Study key={screen.mode} mode={screen.mode} progress={progress} setProgress={setProgress} onExit={home} />
        ) : screen.name === "dontknow" ? (
          <DontKnow progress={progress} onPractise={() => setScreen({ name: "study", mode: "dontknow" })} onBack={home} />
        ) : screen.name === "test" ? (
          <LevelTest progress={progress} setProgress={setProgress} onExit={home} />
        ) : screen.name === "recall" ? (
          <Recall progress={progress} setProgress={setProgress} onExit={home} onStudy={() => setScreen({ name: "study", mode: "today" })} />
        ) : screen.name === "stats" ? (
          <Stats progress={progress} onBack={home} />
        ) : screen.name === "settings" ? (
          <Settings progress={progress} setProgress={setProgress} moveCode={moveCode} onBack={home} />
        ) : screen.name === "words" ? (
          <WordList progress={progress} onBack={home} />
        ) : (
          <Home progress={progress} setProgress={setProgress} go={setScreen} />
        )}
      </div>
    </MotionConfig>
    </LangProvider>
  );
}
