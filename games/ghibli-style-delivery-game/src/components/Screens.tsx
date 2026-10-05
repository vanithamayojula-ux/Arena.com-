import { useState } from "react";
import type { GameOverStats } from "../game/engine";
import type { ScoreEntry } from "../game/highscores";
import { PLAYER_LOOK } from "../game/characters";
import Portrait from "./Portrait";
import ScoreTable from "./ScoreTable";

const touch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export function StartScreen({ onStart, scores, muted, onMute }: { onStart: () => void; scores: ScoreEntry[]; muted: boolean; onMute: () => void }) {
  return (
    <div className="fade-in absolute inset-0 z-40 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#8ec5e8]/70 via-[#bfe3f2]/20 to-[#3b3a36]/30" />
      <button onClick={onMute} className="btn-soft absolute top-3 right-3 z-10 grid h-10 w-10 place-items-center text-lg" aria-label="Toggle sound">
        {muted ? "🔇" : "🔊"}
      </button>
      <div className="relative flex min-h-full flex-col items-center justify-center gap-4 p-4 py-8">
        <div className="text-center">
          <div className="text-xs font-black tracking-[0.35em] text-white uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] sm:text-sm">A little post boy · a big windy city</div>
          <h1 className="font-deco mt-1 text-5xl leading-none text-[#fffaf0] drop-shadow-[0_4px_0_rgba(140,70,40,0.55)] sm:text-7xl" style={{ WebkitTextStroke: "1.5px #8a4a32" }}>
            Letters on
            <br />
            the Wind
          </h1>
        </div>

        <div className="parchment pop-in flex w-full max-w-3xl flex-col gap-4 rounded-[28px] p-4 sm:flex-row sm:p-6">
          <div className="flex flex-1 flex-col items-center gap-3">
            <div className="floaty overflow-hidden rounded-full ring-8 ring-white/70">
              <Portrait look={PLAYER_LOOK} size={110} scale={2.4} letters={3} />
            </div>
            <p className="max-w-xs text-center text-sm font-bold text-[#5a4a36]">
              Run the cobbled streets, hand each neighbour their letter, and find the <span className="text-[#c94f35]">kindest words</span> before the sun goes down.
            </p>
            <button onClick={onStart} className="btn-ghibli px-10 py-3.5 text-xl">
              Start Delivering
            </button>
            <div className="text-xs font-bold text-[#a08560]">{touch ? "Tap to begin" : <>Press <span className="kbd">Enter</span> to begin</>}</div>

            <div className="mt-1 grid w-full grid-cols-3 gap-2 text-center text-[11px] font-bold text-[#5a4a36] sm:text-xs">
              <div className="rounded-xl bg-white/50 p-2">
                <div className="text-xl">🏃</div>
                {touch ? "Drag left side to walk, push far to run" : (
                  <>
                    <span className="kbd">WASD</span> walk
                    <br />
                    <span className="kbd">Shift</span> run
                  </>
                )}
              </div>
              <div className="rounded-xl bg-white/50 p-2">
                <div className="text-xl">💬</div>
                {touch ? "Tap ✉ near a client, pick a reply" : (
                  <>
                    <span className="kbd">E</span> talk
                    <br />
                    <span className="kbd">1</span>
                    <span className="kbd">2</span>
                    <span className="kbd">3</span> reply
                  </>
                )}
              </div>
              <div className="rounded-xl bg-white/50 p-2">
                <div className="text-xl">🌇</div>
                Refill at the ✉ Post Office. Beat the sunset!
              </div>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <ScoreTable scores={scores} compact />
            <div className="mt-3 space-y-1 rounded-xl bg-white/40 p-2.5 text-[11px] font-bold text-[#7a6a52]">
              <div>♥ Heartfelt replies build combos (×1.25 each)</div>
              <div>🔴 Express letters pay ×2 — hurry!</div>
              <div>🌰 Acorns: +25 pts and +1s of daylight</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onRestart, onMenu }: { onResume: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <div className="fade-in absolute inset-0 z-50 grid place-items-center bg-[#2a2440]/40 p-4 backdrop-blur-[3px]">
      <div className="parchment pop-in w-full max-w-sm rounded-[28px] p-6 text-center">
        <div className="text-4xl">☕</div>
        <h2 className="font-deco text-4xl text-[#8a4a32]">Tea Break</h2>
        <p className="mt-1 text-sm font-bold text-[#7a6a52]">The city waits patiently for you.</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button onClick={onResume} className="btn-ghibli py-3 text-lg">
            Resume {!touch && <span className="ml-1 text-sm opacity-80">(Esc)</span>}
          </button>
          <button onClick={onRestart} className="btn-soft py-2.5">
            Restart Day {!touch && <span className="text-xs opacity-70">(R)</span>}
          </button>
          <button onClick={onMenu} className="btn-soft py-2.5">
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOver({
  stats,
  scores,
  newId,
  name,
  onName,
  onRestart,
  onMenu,
}: {
  stats: GameOverStats;
  scores: ScoreEntry[];
  newId: string | null;
  name: string;
  onName: (n: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [draft, setDraft] = useState(name);
  const rank = newId ? scores.findIndex((s) => s.id === newId) : -1;
  const title = stats.deliveries >= 15 ? "Legend of the Wind" : stats.deliveries >= 9 ? "Beloved Postman" : stats.deliveries >= 4 ? "Trusty Courier" : "Apprentice Post Boy";
  return (
    <div className="fade-in absolute inset-0 z-50 overflow-y-auto bg-[#2a2440]/45 backdrop-blur-[2px]">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="parchment pop-in w-full max-w-2xl rounded-[28px] p-5 sm:p-7">
          <div className="text-center">
            <div className="text-xs font-black tracking-[0.3em] text-[#a08560] uppercase">The sun has set over the city</div>
            <h2 className="font-deco text-3xl text-[#8a4a32] sm:text-4xl">{title}</h2>
            <div className="mt-1 text-5xl font-black tabular-nums text-[#c94f35] sm:text-6xl">{stats.score.toLocaleString()}</div>
            {rank === 0 && <div className="bump mt-1 inline-block rounded-full bg-[#f2c94c] px-3 py-1 text-sm font-black text-[#5a3a12]">★ New Best Day! ★</div>}
            {rank > 0 && <div className="mt-1 inline-block rounded-full bg-[#ffe9a8] px-3 py-1 text-sm font-black text-[#8a5a12]">#{rank + 1} on the board!</div>}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["✉", stats.deliveries, "Delivered"],
              ["♥", stats.heartfelt, "Heartfelt"],
              ["🔥", stats.bestCombo, "Best combo"],
              ["🌰", stats.acorns, "Acorns"],
            ].map(([i, v, l]) => (
              <div key={l as string} className="rounded-2xl bg-white/60 p-2">
                <div className="text-lg">{i}</div>
                <div className="text-xl font-black text-[#4a3e32]">{v}</div>
                <div className="text-[10px] font-bold text-[#a08560] uppercase sm:text-[11px]">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <ScoreTable scores={scores} highlight={newId} />
            </div>
            <div className="flex flex-col gap-2.5 sm:w-56">
              {newId && (
                <label className="block">
                  <span className="text-xs font-black tracking-wider text-[#8a6a42] uppercase">Sign the logbook</span>
                  <input
                    value={draft}
                    maxLength={12}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => onName(draft.trim() || "Postie")}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="mt-1 w-full rounded-xl border-2 border-[#dcc597] bg-white/80 px-3 py-2 font-bold text-[#4a3e32] outline-none focus:border-[#e0a92f]"
                  />
                </label>
              )}
              <button onClick={onRestart} className="btn-ghibli py-3 text-lg">
                Deliver Again {!touch && <span className="text-sm opacity-80">(R)</span>}
              </button>
              <button onClick={onMenu} className="btn-soft py-2.5">
                Main Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
