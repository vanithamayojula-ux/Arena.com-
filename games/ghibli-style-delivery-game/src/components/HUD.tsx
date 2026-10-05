import type { HudState } from "../game/engine";

export default function HUD({ hud, onPause, muted, onMute }: { hud: HudState; onPause: () => void; muted: boolean; onMute: () => void }) {
  const t = hud.timeLeft;
  const icon = t > 45 ? "☀️" : t > 20 ? "🌤️" : t > 10 ? "🌇" : "🌙";
  const warn = t < 10;
  const sunFrac = Math.max(0, Math.min(1, 1 - t / 90));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2 sm:p-3" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
      {/* score */}
      <div className="parchment pointer-events-auto min-w-[88px] rounded-2xl px-3 py-1.5 sm:min-w-[140px] sm:px-4 sm:py-2">
        <div className="text-[10px] font-black tracking-[0.18em] text-[#a08560] uppercase sm:text-[11px]">Score</div>
        <div key={hud.score} className="bump origin-left text-xl font-black tabular-nums text-[#c94f35] sm:text-3xl">
          {hud.score.toLocaleString()}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7a6a52] sm:text-xs">
          <span>✉ {hud.deliveries}</span>
          {hud.combo > 0 && (
            <span key={hud.combo} className="bump rounded-full bg-[#ff9db2] px-1.5 text-white">
              ♥ x{hud.combo}
            </span>
          )}
        </div>
      </div>

      {/* clock */}
      <div className="parchment flex flex-col items-center rounded-2xl px-3 py-1.5 sm:px-5 sm:py-2">
        <div className="relative h-5 w-16 overflow-hidden sm:h-6 sm:w-32">
          <div className="absolute inset-x-1 bottom-0 h-[2px] rounded bg-[#e3cfa4]" />
          <div
            className="absolute text-base transition-all duration-300 sm:text-lg"
            style={{
              left: `calc(${sunFrac * 100}% - ${sunFrac * 20}px)`,
              bottom: `${Math.sin(sunFrac * Math.PI) * 6 - 2}px`,
            }}
          >
            {icon}
          </div>
        </div>
        <div className={`text-lg font-black tabular-nums sm:text-2xl ${warn ? "pulse-red" : "text-[#4a3e32]"}`}>
          {Math.ceil(t)}
          <span className="text-xs font-bold text-[#a08560]">s</span>
        </div>
      </div>

      {/* bag */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="pointer-events-auto flex gap-1.5">
          <button onClick={onMute} className="btn-soft grid h-9 w-9 place-items-center text-base" aria-label="Toggle sound">
            {muted ? "🔇" : "🔊"}
          </button>
          <button onClick={onPause} className="btn-soft grid h-9 w-9 place-items-center text-base font-black" aria-label="Pause">
            ❚❚
          </button>
        </div>
        <div className="parchment flex gap-1 rounded-2xl p-1.5 sm:flex-col sm:gap-1 sm:p-2">
          {[0, 1, 2].map((i) => {
            const l = hud.letters[i];
            return (
              <div
                key={l ? `${l.clientId}` : `e${i}`}
                className={`pop-in relative flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-bold sm:w-40 ${l ? (l.express ? "bg-[#ffe1d8]" : "bg-white/70") : "bg-black/5"}`}
              >
                <span className="relative grid h-6 w-7 shrink-0 place-items-center rounded-[4px] text-sm" style={{ background: l ? "#fffaf0" : "transparent", boxShadow: l ? "0 1px 0 #d8bf8c" : "none" }}>
                  {l ? "✉" : <span className="text-[#c9b48a]">·</span>}
                  {l && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: l.color }} />}
                </span>
                <span className="hidden truncate text-[#4a3e32] sm:block">{l ? l.name : "empty"}</span>
                {l?.express && (
                  <span className="absolute inset-x-1 bottom-0.5 h-[3px] overflow-hidden rounded bg-[#f5c2b5]">
                    <span className="block h-full bg-[#e0402f]" style={{ width: `${l.expressFrac * 100}%` }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {hud.prompt && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex justify-center px-4 max-sm:bottom-40">
          <div key={hud.prompt} className="pop-in rounded-full bg-[#3b3a36]/80 px-4 py-2 text-center text-sm font-bold text-[#fff8ec] shadow-lg backdrop-blur-sm">
            {hud.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
