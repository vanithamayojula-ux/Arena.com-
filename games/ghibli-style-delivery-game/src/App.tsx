import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type DialogueState, type GameOverStats, type HudState } from "./game/engine";
import { audio } from "./game/audio";
import { getName, loadScores, renameEntry, submitScore, type ScoreEntry } from "./game/highscores";
import HUD from "./components/HUD";
import DialogueBox from "./components/DialogueBox";
import TouchControls from "./components/TouchControls";
import { GameOver, PauseMenu, StartScreen } from "./components/Screens";

type Screen = "title" | "playing" | "paused" | "over";
const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const EMPTY_HUD: HudState = { score: 0, timeLeft: 75, combo: 0, letters: [], deliveries: 0, canInteract: false, prompt: "", stamina: 1 };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const screenRef = useRef<Screen>("title");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [stats, setStats] = useState<GameOverStats | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [newId, setNewId] = useState<string | null>(null);
  const [muted, setMuted] = useState(audio.muted);
  const [loading, setLoading] = useState(true);

  const go = (s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  };

  useEffect(() => {
    // let first paint happen before heavy world generation
    const id = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const g = new Game(canvasRef.current, {
        onHud: setHud,
        onDialogue: setDialogue,
        onGameOver: (s) => {
          const [list, id2] = submitScore(s.score, s.deliveries);
          setScores(list);
          setNewId(id2);
          setStats(s);
          go("over");
        },
      });
      gameRef.current = g;
      setGame(g);
      setLoading(false);
    });
    return () => {
      cancelAnimationFrame(id);
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setStats(null);
    setNewId(null);
    setDialogue(null);
    g.startGame();
    go("playing");
  }, []);

  const pause = useCallback(() => {
    if (screenRef.current !== "playing") return;
    gameRef.current?.pause();
    go("paused");
  }, []);
  const resume = useCallback(() => {
    if (screenRef.current !== "paused") return;
    gameRef.current?.resume();
    go("playing");
  }, []);
  const toMenu = useCallback(() => {
    gameRef.current?.toTitle();
    setDialogue(null);
    setScores(loadScores());
    go("title");
  }, []);
  const toggleMute = useCallback(() => {
    audio.unlock();
    const m = !audio.muted;
    audio.setMuted(m);
    setMuted(m);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      const s = screenRef.current;
      if (k === "m") toggleMute();
      if (s === "title" && (k === "enter" || k === " ")) {
        e.preventDefault();
        start();
      } else if (s === "playing" && (k === "escape" || k === "p")) pause();
      else if (s === "paused") {
        if (k === "escape" || k === "p") resume();
        else if (k === "r") start();
      } else if (s === "over" && (k === "r" || k === "enter" || k === " ")) {
        e.preventDefault();
        start();
      }
    };
    const vis = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", h);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", h);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [start, pause, resume, toggleMute]);

  return (
    <div className="font-maru relative h-full w-full overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />

      {loading && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-[#8ec5e8]">
          <div className="text-center">
            <div className="floaty text-5xl">✉</div>
            <div className="font-deco mt-2 text-2xl text-white drop-shadow">Painting the city…</div>
          </div>
        </div>
      )}

      {(screen === "playing" || screen === "paused") && <HUD hud={hud} onPause={pause} muted={muted} onMute={toggleMute} />}

      {screen === "playing" && isTouch && !dialogue && <TouchControls game={game} canInteract={hud.canInteract} />}

      {screen === "playing" && dialogue && <DialogueBox d={dialogue} onChoose={(i, rt) => gameRef.current?.chooseReply(i, rt)} />}

      {screen === "title" && !loading && <StartScreen onStart={start} scores={scores} muted={muted} onMute={toggleMute} />}

      {screen === "paused" && <PauseMenu onResume={resume} onRestart={start} onMenu={toMenu} />}

      {screen === "over" && stats && (
        <GameOver
          stats={stats}
          scores={scores}
          newId={newId}
          name={getName()}
          onName={(n) => {
            if (newId) setScores(renameEntry(newId, n));
          }}
          onRestart={start}
          onMenu={toMenu}
        />
      )}
    </div>
  );
}
