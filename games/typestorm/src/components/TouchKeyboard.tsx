import { useEffect, useRef, useState } from "react";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

interface Props {
  onKey: (ch: string) => void;
  onBackspace: () => void;
  onRelease: () => void;
  target?: string;
  typed?: number;
}

interface KeyProps {
  id: string;
  label: string;
  active: boolean;
  needed: boolean;
  wide?: boolean;
  danger?: boolean;
  onPress: () => void;
}

function Key({ id, label, active, needed, wide, danger, onPress }: KeyProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-key={id}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress();
      }}
      className={[
        "relative flex items-center justify-center rounded-lg border font-mono font-bold uppercase",
        "select-none touch-manipulation transition-[transform,background-color,color] duration-75",
        "origin-bottom active:scale-90",
        wide ? "flex-[1.6]" : "flex-1",
        "h-[clamp(38px,5vh,50px)] text-[clamp(13px,3.6vw,17px)]",
        active
          ? "scale-90 border-cyan-200 bg-cyan-300/50 text-white shadow-[0_0_20px_rgba(34,211,238,0.95)]"
          : danger
            ? "border-rose-400/25 bg-rose-500/10 text-rose-200/90"
            : "border-cyan-200/15 bg-white/[0.07] text-cyan-50/90",
      ].join(" ")}
    >
      <span className="drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]">{label}</span>
      {needed && !active && (
        <span className="pointer-events-none absolute inset-0 animate-pulse rounded-lg ring-2 ring-amber-300/90" />
      )}
    </button>
  );
}

export default function TouchKeyboard({ onKey, onBackspace, onRelease, target = "", typed = 0 }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const hit = (id: string, fn: () => void) => {
    setPressed(id);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPressed(null), 100);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(6);
      } catch {
        /* noop */
      }
    }
    fn();
  };

  const neededChar = target && typed < target.length ? target[typed] : "";

  return (
    <div className="w-full px-1.5 pb-[max(6px,env(safe-area-inset-bottom))] pt-1">
      <div className="mx-auto flex max-w-md flex-col gap-[5px]">
        {ROWS.map((row, ri) => (
          <div key={row} className="flex gap-[5px]" style={{ paddingInline: ri === 1 ? "4%" : 0 }}>
            {ri === 2 && (
              <Key
                id="backspace"
                label="⌫"
                wide
                danger
                active={pressed === "backspace"}
                needed={false}
                onPress={() => hit("backspace", onBackspace)}
              />
            )}
            {row.split("").map((c) => (
              <Key
                key={c}
                id={c}
                label={c}
                active={pressed === c}
                needed={neededChar === c}
                onPress={() => hit(c, () => onKey(c))}
              />
            ))}
            {ri === 2 && (
              <Key
                id="release"
                label="⎋"
                wide
                active={pressed === "release"}
                needed={false}
                onPress={() => hit("release", onRelease)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
