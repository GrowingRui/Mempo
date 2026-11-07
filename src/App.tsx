import { useEffect, useState } from "react";
import { loadProgress, saveProgress } from "./lib/storage";
import type { Progress } from "./lib/types";
import Home from "./pages/Home";
import Study from "./pages/Study";

type Screen = "home" | "study";

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>("home");

  useEffect(() => saveProgress(progress), [progress]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      {screen === "home" ? (
        <Home progress={progress} setProgress={setProgress} onStart={() => setScreen("study")} />
      ) : (
        <Study progress={progress} setProgress={setProgress} onExit={() => setScreen("home")} />
      )}
    </div>
  );
}
