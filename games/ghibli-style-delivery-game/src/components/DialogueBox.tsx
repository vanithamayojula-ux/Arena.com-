import { useEffect, useRef, useState } from "react";
import type { DialogueState } from "../game/engine";
import Portrait from "./Portrait";
import { audio } from "../game/audio";

const CPS = 75;

export default function DialogueBox({ d, onChoose }: { d: DialogueState; onChoose: (i: number, readTime: number) => void }) {
  const [shown, setShown] = useState(0);
  const [sel, setSel] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const startRef = useRef(performance.now());
  const doneRef = useRef<number | null>(null);
  const done = shown >= d.line.length;

  useEffect(() => {
    setShown(0);
    setSel(0);
    setChosen(null);
    startRef.current = performance.now();
    doneRef.current = null;
  }, [d.key]);

  useEffect(() => {
    if (done) {
      if (doneRef.current === null) doneRef.current = performance.now();
      return;
    }
    const id = window.setTimeout(() => {
      setShown((s) => Math.min(d.line.length, s + 2));
      if (shown % 6 === 0) audio.play("talk");
    }, (1000 / CPS) * 2);
    return () => clearTimeout(id);
  }, [shown, done, d.line]);

  const choose = (i: number) => {
    if (chosen !== null) return;
    if (!done) {
      setShown(d.line.length);
      return;
    }
    setChosen(i);
    audio.play("select");
    const readTime = ((doneRef.current ?? performance.now()) - startRef.current) / 1000;
    window.setTimeout(() => onChoose(i, readTime), 110);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "1" || k === "2" || k === "3") {
        e.preventDefault();
        choose(Number(k) - 1);
      } else if (k === "arrowup" || k === "w") {
        e.preventDefault();
        setSel((s) => (s + 2) % 3);
        audio.play("tick");
      } else if (k === "arrowdown" || k === "s") {
        e.preventDefault();
        setSel((s) => (s + 1) % 3);
        audio.play("tick");
      } else if (k === " " || k === "enter" || k === "e") {
        e.preventDefault();
        choose(sel);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center p-2 sm:p-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div key={d.key} className="parchment pop-in w-full max-w-2xl rounded-3xl p-3 sm:p-4" onPointerDown={() => !done && setShown(d.line.length)}>
        <div className="flex gap-3">
          <div className="shrink-0 overflow-hidden rounded-2xl ring-4 ring-white/70">
            <Portrait look={d.look} size={64} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-deco text-lg text-[#8a4a32] sm:text-xl">{d.name}</span>
              {d.express && <span className="rounded-full bg-[#e0402f] px-2 py-0.5 text-[10px] font-black tracking-wider text-white uppercase">Express ×2</span>}
            </div>
            <p className="mt-0.5 min-h-[2.8em] text-[15px] leading-snug font-bold text-[#3b3a36] sm:text-base">
              {d.line.slice(0, shown)}
              {!done && <span className="animate-pulse text-[#c94f35]">▍</span>}
            </p>
          </div>
        </div>
        <div className={`mt-2 grid gap-1.5 transition-opacity duration-200 ${done ? "opacity-100" : "pointer-events-none opacity-40"}`}>
          {d.replies.map((r, i) => (
            <button
              key={i}
              onPointerDown={(e) => {
                e.stopPropagation();
                choose(i);
              }}
              onMouseEnter={() => setSel(i)}
              className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-bold transition-all sm:text-[15px] ${
                chosen === i
                  ? "scale-[1.02] border-[#c94f35] bg-[#ffe9d8] text-[#8a2f1e]"
                  : sel === i
                    ? "translate-x-1 border-[#e0a92f] bg-[#fff6dc] text-[#3b3a36]"
                    : "border-[#e8d6ae] bg-white/60 text-[#4a3e32]"
              }`}
            >
              <span className="kbd shrink-0">{i + 1}</span>
              <span className="flex-1">{r}</span>
              {sel === i && done && <span className="text-[#e0a92f]">◀</span>}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-center text-[11px] font-bold text-[#a08560]">Kind words earn hearts, combos &amp; extra daylight · answer quickly for Quick Wit!</div>
      </div>
    </div>
  );
}
