import type { ScoreEntry } from "../game/highscores";

export default function ScoreTable({ scores, highlight, compact = false }: { scores: ScoreEntry[]; highlight?: string | null; compact?: boolean }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2 text-sm font-black tracking-wider text-[#8a6a42] uppercase">
        <span>✉</span> Best Post Days
      </div>
      {scores.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#e0cb9e] px-3 py-4 text-center text-sm text-[#9a8466]">No deliveries yet — be the first legend of the city!</div>
      ) : (
        <ol className="space-y-1">
          {scores.slice(0, compact ? 5 : 8).map((s, i) => (
            <li
              key={s.id}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-sm transition ${s.id === highlight ? "bg-[#ffe9a8] ring-2 ring-[#f2c94c]" : i % 2 ? "bg-white/30" : "bg-white/60"}`}
            >
              <span className="w-6 text-center font-black text-[#8a6a42]">{medals[i] ?? i + 1}</span>
              <span className="flex-1 truncate font-bold text-[#4a3e32]">{s.name}</span>
              <span className="text-xs text-[#9a8466]">{s.deliveries}✉</span>
              <span className="w-16 text-right font-black tabular-nums text-[#c94f35]">{s.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
