import { useEffect, useRef } from "react";
import { drawCharacter, type Look } from "../game/characters";

export default function Portrait({ look, size = 72, bg = true, scale = 2.2, letters = 0 }: { look: Look; size?: number; bg?: boolean; scale?: number; letters?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (bg) {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, "#bfe3f2");
      g.addColorStop(1, "#e9f5d8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#a8cf7b";
      ctx.beginPath();
      ctx.ellipse(size / 2, size * 1.05, size * 0.75, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const s = (scale * size) / 72 / (look.scale ?? 1);
    ctx.save();
    ctx.translate(size / 2, size * 0.98);
    ctx.scale(s, s);
    drawCharacter(ctx, 0, 0, look, "down", 0, false, 1, 1, 0, letters, false);
    ctx.restore();
  }, [look, size, bg, scale, letters]);
  return <canvas ref={ref} style={{ width: size, height: size }} className="block" />;
}
