import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import UpdatePrompt from "./components/UpdatePrompt";
import { HTML_LANG, LangProvider } from "./i18n";
import { takeCodeFromUrl } from "./lib/move";
import { nav, type Screen } from "./lib/nav";
import { syncReminder, studyInfo } from "./lib/reminder";
import { loadProgress, saveProgress } from "./lib/storage";
import { applyTheme } from "./lib/theme";
import { countUsage } from "./lib/usage";
import { savePrefsForReminder } from "./lib/wotd";
import { toDay } from "./lib/date";
import type { Progress } from "./lib/types";
import DontKnow from "./pages/DontKnow";
import Home from "./pages/Home";
import LevelTest from "./pages/LevelTest";
import Recall from "./pages/Recall";
import Settings from "./pages/Settings";
import Skip from "./pages/Skip";
import Stats from "./pages/Stats";
import Study from "./pages/Study";
import WordList from "./pages/WordList";

export type { Screen };

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  // Opened from a "Move to another device" QR code: go straight to Settings, which asks before replacing anything.
  const [moveCode] = useState(takeCodeFromUrl);
  // Screens live in the browser history, so the phone's Back button goes back inside the app (src/lib/nav.ts).
  const [screen, setScreen] = useState<Screen>(() => nav().start(moveCode !== null ? { name: "settings" } : undefined));
  useEffect(() => nav().listen(setScreen), []);
  const go = (next: Screen) => nav().go(next);

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
  // The reminder shows the word of the day; the service worker needs the level and languages for it.
  const { level, showZh, showEs } = progress.settings;
  useEffect(() => {
    void savePrefsForReminder(progress.settings).catch(() => {});
  }, [level, showZh, showEs, progress.settings.lang]);
  const lang = progress.settings.lang;
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang];
  }, [lang]);
  // (braces matter: scrollTo returns a Promise in newer browsers, and React treats an effect's return value as its cleanup)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // The app's own back / close buttons do what the phone's Back does: one screen back (Practise → the "Don't know" list).
  const back = () => nav().back();

  return (
    <LangProvider lang={lang}>
    <MotionConfig reducedMotion="user">
      <UpdatePrompt />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {screen.name === "study" ? (
          <Study key={screen.mode} mode={screen.mode} progress={progress} setProgress={setProgress} onExit={back} backToHome={nav().previous().name === "home"} />
        ) : screen.name === "dontknow" ? (
          <DontKnow progress={progress} onPractise={() => go({ name: "study", mode: "dontknow" })} onBack={back} />
        ) : screen.name === "test" ? (
          <LevelTest progress={progress} setProgress={setProgress} onExit={back} />
        ) : screen.name === "skip" ? (
          <Skip key={progress.settings.level} progress={progress} setProgress={setProgress} onExit={back} />
        ) : screen.name === "recall" || screen.name === "exam" ? (
          <Recall
            key={screen.name}
            section={screen.name}
            progress={progress}
            setProgress={setProgress}
            onExit={back}
            onStudy={() => go({ name: "study", mode: "today" })}
          />
        ) : screen.name === "stats" ? (
          <Stats progress={progress} onBack={back} />
        ) : screen.name === "settings" ? (
          <Settings progress={progress} setProgress={setProgress} moveCode={moveCode} onBack={back} />
        ) : screen.name === "words" ? (
          <WordList progress={progress} onBack={back} />
        ) : (
          <Home progress={progress} setProgress={setProgress} go={go} />
        )}
      </div>
    </MotionConfig>
    </LangProvider>
  );
}
