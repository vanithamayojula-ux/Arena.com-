import { useEffect, useState } from "react";
import type { Difficulty, Result } from "../game/engine";
import { DIFF_LABEL, type ScoreEntry } from "../game/storage";

/* ------------------------------------------------------------------ shared */

const DIFF_INFO: Record<Difficulty, { desc: string; tint: string }> = {
  chill: { desc: "Slow words · 6 shields · 0.8× score", tint: "from-emerald-400/80 to-teal-500/80" },
  standard: { desc: "Balanced · 5 shields · 1× score", tint: "from-cyan-400/80 to-sky-500/80" },
  blitz: { desc: "Fast words · 4 shields · 1.6× score", tint: "from-fuchsia-500/80 to-rose-500/80" },
};

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
      {children}
    </kbd>
  );
}

export function ScoreTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  if (!scores.length)
    return (
      <div className="rounded-lg border border-dashed border-white/15 p-4 text-center font-mono text-[11px] text-white/40">
        No runs yet — be the first legend.
      </div>
    );
  return (
    <ol className="thin-scroll max-h-[210px] space-y-1 overflow-y-auto pr-1">
      {scores.map((s, i) => {
        const hot = highlight === i;
        return (
          <li
            key={`${s.date}-${i}`}
            className={[
              "flex items-center gap-2 rounded-md border px-2 py-1.5 font-mono text-[11px] transition",
              hot
                ? "border-amber-300/70 bg-amber-300/15 text-amber-100 shadow-[0_0_20px_-4px_rgba(251,191,36,0.8)]"
                : i === 0
                  ? "border-cyan-300/30 bg-cyan-400/10 text-white"
                  : "border-white/10 bg-white/[0.03] text-white/70",
            ].join(" ")}
          >
            <span className={`w-4 text-center font-display text-[10px] ${hot ? "text-amber-200" : "text-cyan-300/70"}`}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold tracking-wide uppercase">{s.name}</span>
            <span className="hidden text-[9px] text-white/40 sm:inline">{DIFF_LABEL[s.diff]}</span>
            <span className="w-10 text-right tabular-nums text-white/50">{s.wpm}wpm</span>
            <span className="w-14 text-right font-display text-[12px] tabular-nums">
              {s.score.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CountUp({ value, ms = 750 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="tabular-nums">{v.toLocaleString()}</span>;
}

/* ------------------------------------------------------------------- start */

interface StartProps {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onStart: () => void;
  scores: ScoreEntry[];
  muted: boolean;
  toggleMute: () => void;
  touchMode: boolean;
  toggleTouch: () => void;
}

export function StartScreen(p: StartProps) {
  return (
    <div className="absolute inset-0 z-30 flex overflow-y-auto overscroll-contain p-2 sm:p-4">
      <div className="panel anim-pop scanlines relative m-auto w-full max-w-4xl overflow-hidden rounded-2xl p-4 sm:p-7">
        <div className="grid gap-5 md:grid-cols-[1.15fr_1fr] md:gap-8">
          <div>
            <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-300/70">
              ▚ NEON TYPING ARCADE ▞
            </div>
            <h1 className="anim-hue bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-cyan-300 bg-clip-text font-display text-4xl font-black tracking-tight text-transparent text-glow-cyan sm:text-6xl">
              TYPESTORM
            </h1>
            <p className="mt-2 max-w-md font-mono text-[12px] leading-relaxed text-white/60 sm:text-sm">
              Words rain from the sky. Type them out of the air before they slam into your shield.
              Chain hits for a score multiplier — one slip and the chain breaks.
            </p>

            <div className="mt-4">
              <div className="mb-1.5 font-display text-[10px] tracking-[0.3em] text-white/45">DIFFICULTY</div>
              <div className="grid grid-cols-3 gap-2">
                {(["chill", "standard", "blitz"] as Difficulty[]).map((d) => {
                  const on = p.difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => p.setDifficulty(d)}
                      className={[
                        "rounded-lg border px-2 py-2 text-left transition active:scale-95",
                        on
                          ? "border-cyan-300/70 bg-cyan-400/15 shadow-[0_0_24px_-6px_rgba(34,211,238,0.9)]"
                          : "border-white/12 bg-white/[0.03] hover:border-white/30",
                      ].join(" ")}
                    >
                      <div
                        className={`font-display text-[11px] font-bold tracking-widest sm:text-xs ${
                          on ? "text-white" : "text-white/70"
                        }`}
                      >
                        {DIFF_LABEL[d]}
                      </div>
                      <div className="mt-0.5 hidden font-mono text-[9px] leading-tight text-white/45 sm:block">
                        {DIFF_INFO[d].desc}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-white/40 sm:hidden">{DIFF_INFO[p.difficulty].desc}</div>
            </div>

            <button
              onClick={p.onStart}
              className="anim-pulse-ring mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-3.5 font-display text-lg font-black tracking-[0.2em] text-slate-950 shadow-[0_10px_40px_-10px_rgba(34,211,238,0.9)] transition active:scale-95 sm:text-xl"
            >
              ▶ START
            </button>
            <div className="mt-1.5 text-center font-mono text-[10px] text-white/35">
              press <Kbd>Enter</Kbd> to launch
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={p.toggleMute}
                className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] text-white/70 transition hover:border-cyan-300/50 active:scale-95"
              >
                {p.muted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
              </button>
              <button
                onClick={p.toggleTouch}
                className={[
                  "rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition active:scale-95",
                  p.touchMode
                    ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-cyan-300/50",
                ].join(" ")}
              >
                ⌨ ON-SCREEN KEYS {p.touchMode ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-display text-[10px] tracking-[0.3em] text-white/45">HIGH SCORES</span>
                <span className="font-mono text-[9px] text-white/30">local</span>
              </div>
              <ScoreTable scores={p.scores} />
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-white/45">LEGEND</div>
              <ul className="space-y-1.5 font-mono text-[10px] text-white/55">
                <li>
                  <span className="text-cyan-300">▉</span> <b className="text-white/80">Reticle</b> — your locked target.
                  Finish the word to detonate it.
                </li>
                <li>
                  <span className="text-amber-300">★</span> <b className="text-white/80">Gold word</b> — triple points.
                </li>
                <li>
                  <span className="text-emerald-300">+</span> <b className="text-white/80">Green word</b> — repairs one
                  shield.
                </li>
                <li>
                  <span className="text-rose-300">▬</span> <b className="text-white/80">Red line</b> — a word crossing it
                  costs a shield.
                </li>
              </ul>
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2 font-mono text-[9px] text-white/45">
                <span>
                  <Kbd>A</Kbd>
                  <Kbd>Z</Kbd> type
                </span>
                <span>
                  <Kbd>⌫</Kbd> release lock
                </span>
                <span>
                  <Kbd>Esc</Kbd> pause
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- pause */

interface PauseProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  result: Result | null;
}

export function PauseOverlay({ onResume, onRestart, onQuit, result }: PauseProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="panel anim-pop w-full max-w-sm rounded-2xl p-6 text-center">
        <div className="font-display text-3xl font-black tracking-[0.25em] text-cyan-200 text-glow-cyan">PAUSED</div>
        {result && (
          <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-white/60">
            {[
              ["SCORE", result.score.toLocaleString()],
              ["LEVEL", result.level],
              ["WORDS", result.words],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
                <div className="text-[9px] tracking-[0.2em] text-cyan-300/60">{k}</div>
                <div className="font-display text-sm tabular-nums text-white">{v}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onResume}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-4 py-3 font-display text-sm font-black tracking-[0.2em] text-slate-950 transition active:scale-95"
          >
            ▶ RESUME
          </button>
          <button
            onClick={onRestart}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-display text-xs tracking-[0.2em] text-white/80 transition hover:border-cyan-300/50 active:scale-95"
          >
            ↻ RESTART
          </button>
          <button
            onClick={onQuit}
            className="rounded-xl border border-white/10 px-4 py-2.5 font-display text-xs tracking-[0.2em] text-white/50 transition hover:border-rose-400/50 hover:text-rose-200 active:scale-95"
          >
            ⏻ MAIN MENU
          </button>
        </div>
        <div className="mt-3 font-mono text-[10px] text-white/35">
          <Kbd>Esc</Kbd> resume · <Kbd>R</Kbd> restart
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- game over */

interface OverProps {
  result: Result;
  scores: ScoreEntry[];
  canSave: boolean;
  saved: boolean;
  name: string;
  setName: (s: string) => void;
  onSave: () => void;
  onRestart: () => void;
  onQuit: () => void;
  rank: number;
}

export function GameOverScreen(p: OverProps) {
  const stats: [string, string | number][] = [
    ["WPM", p.result.wpm],
    ["ACCURACY", `${p.result.acc}%`],
    ["WORDS", p.result.words],
    ["BEST CHAIN", p.result.bestCombo],
    ["LEVEL", p.result.level],
    ["MODE", DIFF_LABEL[p.result.difficulty]],
  ];
  return (
    <div className="absolute inset-0 z-30 flex overflow-y-auto overscroll-contain bg-slate-950/60 p-2 backdrop-blur-[3px] sm:p-4">
      <div className="panel anim-pop scanlines relative m-auto w-full max-w-2xl overflow-hidden rounded-2xl p-4 sm:p-6">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-rose-300/70">SHIELD INTEGRITY ZERO</div>
          <h2 className="font-display text-3xl font-black tracking-widest text-rose-300 text-glow-red sm:text-5xl">
            GAME OVER
          </h2>
          <div className="mt-3 font-display text-5xl font-black tabular-nums text-white text-glow-cyan sm:text-6xl">
            <CountUp value={p.result.score} />
          </div>
          {p.saved && p.rank >= 0 && (
            <div className="mt-1 font-mono text-[11px] tracking-[0.2em] text-amber-300">
              ★ SAVED AT RANK #{p.rank + 1}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {stats.map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-center">
              <div className="font-mono text-[9px] tracking-[0.15em] text-cyan-300/60">{k}</div>
              <div className="font-display text-base tabular-nums text-white sm:text-lg">{v}</div>
            </div>
          ))}
        </div>

        {p.canSave && !p.saved && (
          <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3">
            <div className="mb-2 text-center font-mono text-[11px] tracking-[0.2em] text-amber-200">
              ★ NEW HIGH SCORE — ENTER YOUR CALLSIGN
            </div>
            <div className="flex gap-2">
              <input
                value={p.name}
                onChange={(e) => p.setName(e.target.value.toUpperCase().slice(0, 12))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    p.onSave();
                  }
                }}
                placeholder="PLAYER"
                maxLength={12}
                className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 font-mono text-sm tracking-[0.2em] text-white uppercase outline-none placeholder:text-white/25 focus:border-amber-300/70"
              />
              <button
                onClick={p.onSave}
                className="rounded-lg bg-amber-300 px-4 py-2 font-display text-xs font-black tracking-[0.15em] text-slate-950 transition active:scale-95"
              >
                SAVE
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 font-display text-[10px] tracking-[0.3em] text-white/45">HIGH SCORES</div>
          <ScoreTable scores={p.scores} highlight={p.saved ? p.rank : undefined} />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={p.onRestart}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-4 py-3 font-display text-sm font-black tracking-[0.2em] text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.9)] transition active:scale-95"
          >
            ↻ PLAY AGAIN
          </button>
          <button
            onClick={p.onQuit}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-display text-xs tracking-[0.2em] text-white/70 transition hover:border-white/40 active:scale-95"
          >
            MENU
          </button>
        </div>
        <div className="mt-2 text-center font-mono text-[10px] text-white/35">
          <Kbd>Enter</Kbd> instant restart · <Kbd>Esc</Kbd> menu
        </div>
      </div>
    </div>
  );
}
