import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import UpdatePrompt from "./components/UpdatePrompt";
import type { SessionMode } from "./lib/session";
import { syncReminder, studyInfo } from "./lib/reminder";
import { loadProgress, saveProgress } from "./lib/storage";
import { applyTheme } from "./lib/theme";
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
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);
  // Tells the reminder server about the first study of the day, so no reminder comes on a day already done.
  const info = studyInfo(progress.history);
  useEffect(() => {
    void syncReminder({ lastStudied: info.lastStudied, streak: info.streak });
  }, [info.lastStudied, info.streak]);
  useEffect(() => applyTheme(progress.settings.theme), [progress.settings.theme]);
  // (braces matter: scrollTo returns a Promise in newer browsers, and React treats an effect's return value as its cleanup)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const home = () => setScreen({ name: "home" });

  return (
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
          <Settings progress={progress} setProgress={setProgress} onBack={home} />
        ) : screen.name === "words" ? (
          <WordList progress={progress} onBack={home} />
        ) : (
          <Home progress={progress} setProgress={setProgress} go={setScreen} />
        )}
      </div>
    </MotionConfig>
  );
}
