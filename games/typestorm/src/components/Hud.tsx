import { useEffect, useRef, useState } from "react";
import type { HudState } from "../game/engine";

interface Props {
  hud: HudState;
  playing: boolean;
  muted: boolean;
  touchMode: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleTouch: () => void;
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Hud({
  hud,
  playing,
  muted,
  touchMode,
  onPause,
  onToggleMute,
  onToggleTouch,
}: Props) {
  const [pop, setPop] = useState(0);
  const scoreRef = useRef(hud.score);
  useEffect(() => {
    if (hud.score !== scoreRef.current) {
      scoreRef.current = hud.score;
      setPop((p) => p + 1);
    }
  }, [hud.score]);

  const lowHp = hud.hp <= 2;
  const bannerTone =
    hud.banner?.tone === "bad"
      ? "text-rose-300 text-glow-red"
      : hud.banner?.tone === "level"
        ? "text-fuchsia-300 text-glow-magenta"
        : "text-cyan-200 text-glow-cyan";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
      {/* top bar */}
      <div className="flex items-start justify-between gap-2 p-2 sm:p-4">
        <div className="min-w-[92px]">
          <div className="font-display text-[9px] tracking-[0.28em] text-cyan-300/70 sm:text-[10px]">SCORE</div>
          <div
            key={pop}
            className="anim-score-pop font-display text-2xl font-black tabular-nums text-white text-glow-cyan sm:text-4xl"
          >
            {hud.score.toLocaleString()}
          </div>
        </div>

        {/* shield */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="font-display text-[9px] tracking-[0.28em] text-cyan-300/70 sm:text-[10px]">SHIELD</div>
          <div className="flex gap-1">
            {Array.from({ length: hud.maxHp }).map((_, i) => {
              const on = i < hud.hp;
              return (
                <span
                  key={i}
                  className={[
                    "h-2 w-3.5 rounded-[2px] transition-all duration-200 sm:h-2.5 sm:w-5",
                    on
                      ? lowHp
                        ? "bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.9)] animate-pulse"
                        : "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]"
                      : "bg-white/10",
                  ].join(" ")}
                />
              );
            })}
          </div>
          <div className="font-display text-[9px] tracking-[0.2em] text-white/40">
            {fmtTime(hud.time)} · LV{hud.level}
          </div>
        </div>

        {/* right stats */}
        <div className="flex items-start gap-1.5 sm:gap-2">
          <div className="hidden flex-col items-end sm:flex">
            {[
              ["WPM", hud.wpm],
              ["ACC", `${hud.acc}%`],
              ["WORDS", hud.words],
            ].map(([k, v]) => (
              <div key={k as string} className="font-mono text-[10px] leading-tight text-white/55">
                <span className="text-cyan-300/60">{k}</span> <span className="tabular-nums text-white/85">{v}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-auto flex flex-col gap-1.5">
            {[
              { label: playing ? "❚❚" : "▶", fn: onPause, title: "Pause (Esc)" },
              { label: muted ? "🔇" : "🔊", fn: onToggleMute, title: "Sound" },
              { label: "⌨", fn: onToggleTouch, title: "On-screen keyboard" },
            ].map((b) => (
              <button
                key={b.title}
                onClick={b.fn}
                title={b.title}
                className={[
                  "grid h-7 w-7 place-items-center rounded-md border text-[11px] transition active:scale-90 sm:h-8 sm:w-8 sm:text-xs",
                  b.label === "⌨" && touchMode
                    ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-100"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-cyan-300/50 hover:text-white",
                ].join(" ")}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* combo + target readout */}
      <div className="flex flex-col items-center gap-1">
        {hud.combo >= 2 && (
          <div className="flex flex-col items-center">
            <div
              className={[
                "font-display font-black leading-none",
                hud.mult >= 4 ? "text-3xl text-fuchsia-300 text-glow-magenta sm:text-5xl" : "text-xl text-cyan-200 text-glow-cyan sm:text-3xl",
              ].join(" ")}
              style={{ transform: `scale(${1 + Math.min(hud.combo % 4, 3) * 0.02})` }}
            >
              x{hud.mult}
            </div>
            <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/10 sm:w-32">
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-150",
                  hud.mult >= 4 ? "bg-fuchsia-400" : "bg-cyan-300",
                ].join(" ")}
                style={{ width: `${((hud.combo % 4) / 4) * 100}%` }}
              />
            </div>
            <div className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-white/45">
              {hud.combo} CHAIN
            </div>
          </div>
        )}
      </div>

      {/* center banner */}
      {hud.banner && (
        <div key={hud.banner.id} className="anim-banner flex flex-1 flex-col items-center justify-center">
          <div className={`font-display text-4xl font-black tracking-widest sm:text-6xl ${bannerTone}`}>
            {hud.banner.text}
          </div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/50 uppercase sm:text-xs">
            {hud.banner.sub}
          </div>
        </div>
      )}
    </div>
  );
}
