import { useRef } from "react";
import type { Game } from "../game/engine";

const R = 56;

export default function TouchControls({ game, canInteract }: { game: Game | null; canInteract: boolean }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const state = useRef<{ id: number; ox: number; oy: number } | null>(null);

  const setKnob = (dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state.current) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    state.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    if (base.current) {
      base.current.style.left = `${e.clientX - R}px`;
      base.current.style.top = `${e.clientY - R}px`;
      base.current.style.opacity = "1";
    }
    setKnob(0, 0);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    if (!s || s.id !== e.pointerId) return;
    let dx = e.clientX - s.ox,
      dy = e.clientY - s.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob(dx, dy);
    const mag = Math.min(1, d / R);
    const dead = 0.12;
    const m = mag < dead ? 0 : (mag - dead) / (1 - dead);
    game?.setJoy(d > 0 ? (dx / Math.min(d, R)) * m : 0, d > 0 ? (dy / Math.min(d, R)) * m : 0);
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = state.current;
    if (!s || s.id !== e.pointerId) return;
    state.current = null;
    game?.setJoy(0, 0);
    setKnob(0, 0);
    if (base.current) base.current.style.opacity = "0.45";
  };

  return (
    <div className="absolute inset-0 z-10">
      <div className="absolute inset-y-0 left-0 w-[60%]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      <div
        ref={base}
        className="pointer-events-none absolute rounded-full border-4 border-white/70 bg-white/20 shadow-lg backdrop-blur-[2px] transition-opacity"
        style={{ width: R * 2, height: R * 2, left: 40, top: "calc(100% - 200px)", opacity: 0.45 }}
      >
        <div ref={knob} className="absolute rounded-full bg-[#fffaf0] shadow-md ring-4 ring-[#e3cfa4]" style={{ width: 52, height: 52, left: R - 26, top: R - 26 }} />
      </div>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          game?.interact();
        }}
        className={`btn-ghibli absolute grid h-24 w-24 place-items-center text-4xl ${canInteract ? "glow-pulse" : "opacity-75"}`}
        style={{ right: "max(1.5rem, env(safe-area-inset-right))", bottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Talk"
      >
        ✉
      </button>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white/80 drop-shadow">Push stick fully to run</div>
    </div>
  );
}
