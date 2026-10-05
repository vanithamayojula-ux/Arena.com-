import { useCallback, useEffect, useRef, useState } from "react";
import { TypingGame, type Difficulty, type HudState, type Result } from "./game/engine";
import { sfx } from "./game/audio";
import { addScore, loadScores, qualifies, type ScoreEntry } from "./game/storage";
import Hud from "./components/Hud";
import TouchKeyboard from "./components/TouchKeyboard";
import { GameOverScreen, PauseOverlay, StartScreen } from "./components/Overlays";

type Phase = "menu" | "playing" | "paused" | "over";

const INITIAL_HUD: HudState = {
  score: 0,
  combo: 0,
  mult: 1,
  hp: 5,
  maxHp: 5,
  level: 1,
  words: 0,
  wpm: 0,
  acc: 100,
  time: 0,
  danger: 0,
  overdrive: false,
  target: "",
  targetTyped: 0,
  banner: null,
};

const NAME_KEY = "typestorm.name";
const DIFF_KEY = "typestorm.diff";
const TOUCH_KEY = "typestorm.touch";

const readDiff = (): Difficulty => {
  const v = localStorage.getItem(DIFF_KEY);
  return v === "chill" || v === "blitz" ? v : "standard";
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<TypingGame | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [difficulty, setDifficulty] = useState<Difficulty>(readDiff);
  const [muted, setMuted] = useState(false);
  const [touchMode, setTouchMode] = useState(
    () =>
      localStorage.getItem(TOUCH_KEY) === "1" ||
      (localStorage.getItem(TOUCH_KEY) === null &&
        typeof window !== "undefined" &&
        (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window)),
  );

  const [entryName, setEntryName] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const [saved, setSaved] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [rank, setRank] = useState(-1);

  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const saveDateRef = useRef(0);

  /* ------------------------------------------------------------- bootstrap */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new TypingGame(canvas, {
      onHud: setHud,
      onOver: (r) => {
        setResult(r);
        setPhase("over");
        setCanSave(qualifies(scoresRef.current, r.score));
        setSaved(false);
        setRank(-1);
      },
    });
    gameRef.current = game;

    const ro = new ResizeObserver(() => game.resize());
    ro.observe(canvas);
    const onOrient = () => window.setTimeout(() => game.resize(), 120);
    window.addEventListener("orientationchange", onOrient);
    window.addEventListener("resize", onOrient);

    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("resize", onOrient);
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sfx.muted = muted;
  }, [muted]);

  useEffect(() => {
    try {
      localStorage.setItem(DIFF_KEY, difficulty);
    } catch {
      /* noop */
    }
  }, [difficulty]);

  useEffect(() => {
    try {
      localStorage.setItem(TOUCH_KEY, touchMode ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [touchMode]);

  /* ----------------------------------------------------------- game actions */
  const start = useCallback(
    (d: Difficulty) => {
      sfx.unlock();
      setResult(null);
      setSaved(false);
      setCanSave(false);
      setRank(-1);
      gameRef.current?.startGame(d);
      setPhase("playing");
    },
    [],
  );

  const restart = useCallback(() => start(result?.difficulty ?? difficulty), [start, result, difficulty]);

  const quit = useCallback(() => {
    gameRef.current?.goAmbient();
    setPhase("menu");
  }, []);

  const pause = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (g.mode !== "playing") return;
    g.pause();
    setResult(g.result());
    setPhase("paused");
  }, []);

  const resume = useCallback(() => {
    gameRef.current?.resume();
    setPhase((p) => (p === "paused" ? "playing" : p));
  }, []);

  const saveScore = useCallback(() => {
    const r = result;
    if (!r || saved || !canSave) return;
    const name = (entryName.trim() || "PLAYER").slice(0, 12).toUpperCase();
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* noop */
    }
    const date = Date.now();
    saveDateRef.current = date;
    const next = addScore(scoresRef.current, {
      name,
      score: r.score,
      wpm: r.wpm,
      level: r.level,
      words: r.words,
      acc: r.acc,
      diff: r.difficulty,
      date,
    });
    setScores(next);
    setRank(Math.max(0, next.findIndex((e) => e.date === date)));
    setSaved(true);
    setCanSave(false);
    sfx.bonus();
  }, [result, saved, canSave, entryName]);

  /* --------------------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const g = gameRef.current;
      if (!g) return;
      const k = e.key;

      if (phase === "playing") {
        if (k === "Escape" || k === "p" || k === "P") {
          e.preventDefault();
          pause();
        } else if (k === "Backspace" || k === " " || k === "Tab") {
          e.preventDefault();
          g.backspace();
        } else if (k.length === 1) {
          e.preventDefault();
          g.key(k);
        }
        return;
      }
      if (phase === "menu") {
        if (k === "Enter" || k === " ") {
          e.preventDefault();
          start(difficulty);
        } else if (k === "1") setDifficulty("chill");
        else if (k === "2") setDifficulty("standard");
        else if (k === "3") setDifficulty("blitz");
        return;
      }
      if (phase === "paused") {
        if (k === "Escape" || k === "p" || k === "P" || k === "Enter" || k === " ") {
          e.preventDefault();
          resume();
        } else if (k === "r" || k === "R") {
          e.preventDefault();
          restart();
        }
        return;
      }
      if (phase === "over") {
        if (k === "Enter") {
          e.preventDefault();
          if (canSave && !saved) saveScore();
          else restart();
        } else if (k === "Escape") {
          e.preventDefault();
          quit();
        } else if (k === "r" || k === "R") {
          e.preventDefault();
          restart();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, difficulty, canSave, saved, start, restart, quit, pause, resume, saveScore]);

  /* auto-pause when the tab or window loses focus */
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) pause();
    };
    const onBlur = () => pause();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("blur", onBlur);
    };
  }, [pause]);

  /* ------------------------------------------------------------------ view */
  const bestBeat = result ? result.score > (scores[0]?.score ?? 0) : false;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#05060f]">
      <div className="vignette scanlines relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <Hud
          hud={hud}
          playing={phase === "playing"}
          muted={muted}
          touchMode={touchMode}
          onPause={() => (phase === "playing" ? pause() : phase === "paused" ? resume() : undefined)}
          onToggleMute={() => setMuted((m) => !m)}
          onToggleTouch={() => setTouchMode((t) => !t)}
        />

        {phase === "menu" && (
          <StartScreen
            difficulty={difficulty}
            setDifficulty={(d) => {
              setDifficulty(d);
              sfx.ui();
            }}
            onStart={() => start(difficulty)}
            scores={scores}
            muted={muted}
            toggleMute={() => setMuted((m) => !m)}
            touchMode={touchMode}
            toggleTouch={() => setTouchMode((t) => !t)}
          />
        )}

        {phase === "paused" && (
          <PauseOverlay onResume={resume} onRestart={restart} onQuit={quit} result={result} />
        )}

        {phase === "over" && result && (
          <GameOverScreen
            result={result}
            scores={scores}
            canSave={canSave}
            saved={saved}
            name={entryName}
            setName={setEntryName}
            onSave={saveScore}
            onRestart={restart}
            onQuit={quit}
            rank={rank}
          />
        )}

        {bestBeat && phase === "over" && !saved && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/50 bg-amber-300/15 px-3 py-1 font-mono text-[10px] tracking-[0.25em] text-amber-200">
            ★ PERSONAL BEST
          </div>
        )}
      </div>

      {touchMode && (phase === "playing" || phase === "paused") && (
        <div className="relative z-30 shrink-0 border-t border-cyan-300/10 bg-slate-950/80 backdrop-blur-sm">
          <TouchKeyboard
            onKey={(c) => gameRef.current?.key(c)}
            onBackspace={() => gameRef.current?.backspace()}
            onRelease={() => gameRef.current?.backspace()}
            target={hud.target}
            typed={hud.targetTyped}
          />
        </div>
      )}
    </div>
  );
}
