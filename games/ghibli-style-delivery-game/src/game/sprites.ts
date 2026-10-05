import type { RNG } from "./rng";
import { pick, range } from "./rng";

const touchDevice = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
export const SPRITE_SCALE = touchDevice ? 1.5 : 2;

export interface Sprite {
  canvas: HTMLCanvasElement;
  ox: number; // offset from anchor to sprite top-left (world units)
  oy: number;
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function mk(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * SPRITE_SCALE);
  c.height = Math.ceil(h * SPRITE_SCALE);
  const ctx = c.getContext("2d")!;
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE);
  return { c, ctx };
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  }
  return `rgb(${r},${g},${b})`;
}

export const ROOFS = ["#c8553d", "#3f7f88", "#d98e3a", "#7a5c9a", "#4f7a4a", "#b8463f", "#2f5f7a", "#a8633a"];
export const WALLS = ["#f6ead0", "#f3dcc0", "#efe4cf", "#f7e8c8", "#e8dccb", "#f4d9c6", "#dfe8d8", "#f1e6d6"];
const SHUTTERS = ["#4f7a6a", "#3f6f8f", "#a8553d", "#6a8a4a", "#7a5a8a", "#c98a3a"];

export type BuildingKind = "house" | "post" | "bakery" | "shop" | "tower";

export interface BuildingSpriteResult extends Sprite {
  windows: Rect[]; // local to footprint origin
  doorX: number; // local
}

export function makeBuildingSprite(w: number, footH: number, wallH: number, rise: number, kind: BuildingKind, r: RNG): BuildingSpriteResult {
  const wallTop0 = footH - wallH;
  const roofTop = kind === "tower" ? wallTop0 - 40 : -rise;
  const padL = 14,
    padR = 26,
    padT = -roofTop + (kind === "tower" ? 56 : 48),
    padB = 14;
  const W = w + padL + padR;
  const H = footH + padT + padB;
  const { c, ctx } = mk(W, H);
  ctx.translate(padL, padT);

  const roof = kind === "post" ? "#c8463a" : kind === "tower" ? "#3f6f7a" : pick(r, ROOFS);
  const wall = kind === "post" ? "#f6ead0" : kind === "tower" ? "#efe2c6" : pick(r, WALLS);
  const shutter = pick(r, SHUTTERS);
  const timber = kind === "house" && r() < 0.35;
  const wallTop = footH - wallH;
  const windows: Rect[] = [];

  // ground shadow
  ctx.fillStyle = "rgba(35,55,35,0.24)";
  rr(ctx, 8, 10, w + 14, footH - 4, 14);
  ctx.fill();

  // front wall
  const wg = ctx.createLinearGradient(0, wallTop, 0, footH);
  wg.addColorStop(0, shade(wall, -0.12));
  wg.addColorStop(0.25, wall);
  wg.addColorStop(1, shade(wall, -0.04));
  ctx.fillStyle = wg;
  ctx.fillRect(0, wallTop, w, wallH);
  // side wall hint (right)
  ctx.fillStyle = shade(wall, -0.22);
  ctx.fillRect(w - 5, wallTop, 5, wallH);
  // stone base
  ctx.fillStyle = "#b9ab92";
  ctx.fillRect(0, footH - 8, w, 8);
  ctx.fillStyle = "#a29479";
  for (let x = 2; x < w - 4; x += 11) {
    rr(ctx, x, footH - 7, 9, 6, 2);
    ctx.fill();
  }

  if (timber) {
    ctx.fillStyle = "#7a5638";
    const n = Math.max(2, Math.round(w / 40));
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * (w - 5);
      ctx.fillRect(x - 2, wallTop, 4, wallH - 8);
    }
    ctx.fillRect(0, wallTop + (wallH - 8) / 2 - 2, w, 4);
  }

  // door
  const doorW = kind === "post" ? 26 : 18;
  const doorH = kind === "post" ? 32 : 28;
  const doorX = kind === "tower" ? w / 2 : w / 2 + (kind === "house" ? pick(r, [-0.18, 0, 0.18]) * w : 0);
  const dx = doorX - doorW / 2;
  const dy = footH - 8 - doorH + 4;
  ctx.fillStyle = "#5a3a26";
  ctx.beginPath();
  ctx.moveTo(dx - 2, dy + doorH);
  ctx.lineTo(dx - 2, dy + doorW / 2);
  ctx.arc(doorX, dy + doorW / 2, doorW / 2 + 2, Math.PI, 0);
  ctx.lineTo(dx + doorW + 2, dy + doorH);
  ctx.fill();
  ctx.fillStyle = kind === "post" ? "#2f5d50" : pick(r, ["#8a5a3a", "#3f6f6a", "#a8463a", "#4a5a8a", "#6a7a3a"]);
  ctx.beginPath();
  ctx.moveTo(dx, dy + doorH);
  ctx.lineTo(dx, dy + doorW / 2);
  ctx.arc(doorX, dy + doorW / 2, doorW / 2, Math.PI, 0);
  ctx.lineTo(dx + doorW, dy + doorH);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(doorX, dy + 3);
  ctx.lineTo(doorX, dy + doorH);
  ctx.stroke();
  ctx.fillStyle = "#f2c94c";
  ctx.beginPath();
  ctx.arc(doorX + doorW / 2 - 4, dy + doorH * 0.6, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // step
  ctx.fillStyle = "#cfc2a8";
  rr(ctx, dx - 4, footH - 4, doorW + 8, 6, 2);
  ctx.fill();

  // windows
  const drawWindow = (cx: number, cy: number, ww: number, wh: number, round = false) => {
    ctx.fillStyle = shutter;
    ctx.fillRect(cx - ww / 2 - 6, cy - wh / 2, 5, wh);
    ctx.fillRect(cx + ww / 2 + 1, cy - wh / 2, 5, wh);
    ctx.fillStyle = "#fbf5e6";
    if (round) {
      ctx.beginPath();
      ctx.arc(cx, cy, ww / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(cx - ww / 2 - 2, cy - wh / 2 - 2, ww + 4, wh + 4);
    const gg = ctx.createLinearGradient(cx - ww / 2, cy - wh / 2, cx + ww / 2, cy + wh / 2);
    gg.addColorStop(0, "#a8d4e0");
    gg.addColorStop(1, "#5f8fa8");
    ctx.fillStyle = gg;
    if (round) {
      ctx.beginPath();
      ctx.arc(cx, cy, ww / 2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.fillRect(cx - ww / 2, cy - wh / 2, ww, wh);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - ww / 2 + 2, cy + 2);
    ctx.lineTo(cx - 1, cy - wh / 2 + 2);
    ctx.stroke();
    ctx.strokeStyle = "#fbf5e6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - wh / 2);
    ctx.lineTo(cx, cy + wh / 2);
    ctx.moveTo(cx - ww / 2, cy);
    ctx.lineTo(cx + ww / 2, cy);
    ctx.stroke();
    windows.push({ x: cx - ww / 2, y: cy - wh / 2, w: ww, h: wh });
    // flower box
    if (!round && r() < 0.7) {
      ctx.fillStyle = "#8a5a3a";
      ctx.fillRect(cx - ww / 2 - 3, cy + wh / 2 + 2, ww + 6, 4);
      const fc = pick(r, ["#e75a6b", "#f2c94c", "#f19ad0", "#ffffff", "#e8743a"]);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? "#5a9a4a" : fc;
        ctx.beginPath();
        ctx.arc(cx - ww / 2 + i * (ww / 4), cy + wh / 2 + 1, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const stories = wallH > 70 ? 2 : 1;
  const winW = 14,
    winH = 16;
  const slots = Math.max(1, Math.floor((w - 10) / 38));
  for (let s = 0; s < stories; s++) {
    const cy = stories === 2 ? (s === 0 ? wallTop + 22 : footH - 30) : wallTop + wallH * 0.42;
    for (let i = 0; i < slots; i++) {
      const cx = ((i + 0.5) / slots) * (w - 5);
      if (s === stories - 1 && Math.abs(cx - doorX) < 24) continue;
      if (kind === "tower") continue;
      drawWindow(cx, cy, winW, winH, stories === 2 && s === 0 && r() < 0.25);
    }
  }

  // ivy
  if (kind === "house" && r() < 0.4) {
    const ix = r() < 0.5 ? 2 : w - 18;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = pick(r, ["#4f8a42", "#5f9a4f", "#3f7a3a"]);
      ctx.beginPath();
      ctx.arc(ix + range(r, 0, 16), footH - 8 - range(r, 0, wallH * 0.9) * Math.sqrt(r()), range(r, 2, 4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // awnings
  if (kind === "bakery" || kind === "shop") {
    const ac = kind === "bakery" ? ["#e8743a", "#fff3dc"] : [pick(r, ["#3f7f88", "#7a5c9a", "#4f7a4a"]), "#fff3dc"];
    const ay = wallTop + 6;
    const stripes = Math.floor(w / 12);
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = ac[i % 2];
      ctx.beginPath();
      const x0 = (i / stripes) * w,
        x1 = ((i + 1) / stripes) * w;
      ctx.moveTo(x0, ay);
      ctx.lineTo(x1, ay);
      ctx.lineTo(x1 + 2, ay + 14);
      ctx.arc((x0 + x1) / 2 + 2, ay + 14, (x1 - x0) / 2, 0, Math.PI);
      ctx.fill();
    }
  }

  // roof
  const eave = wallTop + 6;
  const top = roofTop;
  const ridge = top + (eave - top) * 0.32;
  // back slope
  ctx.fillStyle = shade(roof, -0.25);
  rr(ctx, -8, top, w + 16, ridge - top + 6, 8);
  ctx.fill();
  // front slope
  const fg = ctx.createLinearGradient(0, ridge, 0, eave);
  fg.addColorStop(0, shade(roof, 0.12));
  fg.addColorStop(1, shade(roof, -0.08));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-6, ridge);
  ctx.lineTo(w + 6, ridge);
  ctx.lineTo(w + 10, eave - 4);
  ctx.quadraticCurveTo(w + 10, eave, w + 6, eave);
  ctx.lineTo(-6, eave);
  ctx.quadraticCurveTo(-10, eave, -10, eave - 4);
  ctx.closePath();
  ctx.fill();
  // shingles
  ctx.strokeStyle = shade(roof, -0.2);
  ctx.lineWidth = 1;
  for (let y = ridge + 7; y < eave - 2; y += 7) {
    ctx.beginPath();
    for (let x = -6; x < w + 6; x += 8) {
      ctx.moveTo(x, y);
      ctx.arc(x + 4, y, 4, Math.PI, 0, true);
    }
    ctx.stroke();
  }
  // ridge highlight
  ctx.fillStyle = shade(roof, 0.3);
  rr(ctx, -6, ridge - 2, w + 12, 4, 2);
  ctx.fill();
  // eave shadow on wall
  const es = ctx.createLinearGradient(0, eave, 0, eave + 9);
  es.addColorStop(0, "rgba(40,30,20,0.35)");
  es.addColorStop(1, "rgba(40,30,20,0)");
  ctx.fillStyle = es;
  ctx.fillRect(0, eave, w, 9);

  // chimney
  if (kind === "house" || kind === "bakery") {
    const chx = w * range(r, 0.15, 0.75);
    ctx.fillStyle = "#9a6a4a";
    ctx.fillRect(chx, top - 12, 12, ridge - top + 8);
    ctx.fillStyle = "#7a4a32";
    ctx.fillRect(chx - 2, top - 14, 16, 5);
  }
  // dormer
  if (kind === "house" && w > 110 && r() < 0.6) {
    const dxx = w * 0.5 - 12;
    const dyy = ridge + 4;
    ctx.fillStyle = wall;
    ctx.fillRect(dxx, dyy + 6, 24, 16);
    ctx.fillStyle = "#6f9fb8";
    ctx.fillRect(dxx + 6, dyy + 9, 12, 11);
    windows.push({ x: dxx + 6, y: dyy + 9, w: 12, h: 11 });
    ctx.fillStyle = shade(roof, -0.1);
    ctx.beginPath();
    ctx.moveTo(dxx - 4, dyy + 8);
    ctx.lineTo(dxx + 12, dyy - 4);
    ctx.lineTo(dxx + 28, dyy + 8);
    ctx.closePath();
    ctx.fill();
  }

  // post office extras
  if (kind === "post") {
    // sign
    ctx.fillStyle = "#5a3a26";
    rr(ctx, w / 2 - 40, wallTop + 6, 80, 22, 6);
    ctx.fill();
    ctx.fillStyle = "#f6e7c4";
    rr(ctx, w / 2 - 37, wallTop + 9, 74, 16, 4);
    ctx.fill();
    ctx.fillStyle = "#c8463a";
    ctx.font = "900 11px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✉ POST", w / 2, wallTop + 17.5);
    // flag
    ctx.fillStyle = "#6a5a4a";
    ctx.fillRect(w - 30, top - 40, 3, 44);
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.moveTo(w - 27, top - 40);
    ctx.quadraticCurveTo(w - 10, top - 36, w - 4, top - 32);
    ctx.quadraticCurveTo(w - 12, top - 28, w - 27, top - 26);
    ctx.fill();
  }
  if (kind === "bakery") {
    ctx.fillStyle = "#5a3a26";
    ctx.fillRect(w - 18, wallTop + 22, 2, 10);
    ctx.fillStyle = "#d99a4a";
    ctx.beginPath();
    ctx.ellipse(w - 17, wallTop + 36, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a8632a";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w - 21, wallTop + 34);
    ctx.lineTo(w - 19, wallTop + 39);
    ctx.moveTo(w - 17, wallTop + 33);
    ctx.lineTo(w - 15, wallTop + 39);
    ctx.stroke();
  }
  if (kind === "tower") {
    // clock face area
    ctx.fillStyle = "#fbf5e6";
    ctx.beginPath();
    ctx.arc(w / 2, wallTop + 34, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a3a26";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#5a3a26";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * 15, wallTop + 34 + Math.sin(a) * 15, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // tall slits
    ctx.fillStyle = "#6f9fb8";
    rr(ctx, w / 2 - 5, wallTop + 66, 10, 22, 5);
    ctx.fill();
    windows.push({ x: w / 2 - 5, y: wallTop + 66, w: 10, h: 22 });
    // spire
    ctx.fillStyle = shade(roof, 0.05);
    ctx.beginPath();
    ctx.moveTo(-6, top + 18);
    ctx.lineTo(w / 2, top - 44);
    ctx.lineTo(w + 6, top + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(roof, -0.2);
    ctx.beginPath();
    ctx.moveTo(w / 2, top - 44);
    ctx.lineTo(w + 6, top + 18);
    ctx.lineTo(w / 2 + 4, top + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f2c94c";
    ctx.beginPath();
    ctx.arc(w / 2, top - 44, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return { canvas: c, ox: padL, oy: padT, w: W, h: H, windows, doorX };
}

export type TreeKind = 0 | 1 | 2 | 3; // round, blossom, cypress, big camphor

export function makeTreeSprite(kind: TreeKind, r: RNG): Sprite {
  const big = kind === 3;
  const W = big ? 170 : 96;
  const H = big ? 190 : kind === 2 ? 120 : 112;
  const { c, ctx } = mk(W, H);
  const bx = W / 2,
    by = H - 10;
  // shadow
  ctx.fillStyle = "rgba(35,55,35,0.25)";
  ctx.beginPath();
  ctx.ellipse(bx + 8, by, big ? 62 : kind === 2 ? 18 : 34, big ? 16 : 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // trunk
  ctx.fillStyle = "#7a5638";
  const tw = big ? 22 : kind === 2 ? 6 : 9;
  ctx.beginPath();
  ctx.moveTo(bx - tw / 2 - 2, by);
  ctx.quadraticCurveTo(bx - tw / 2, by - 20, bx - tw / 3, by - (big ? 60 : 34));
  ctx.lineTo(bx + tw / 3, by - (big ? 60 : 34));
  ctx.quadraticCurveTo(bx + tw / 2, by - 20, bx + tw / 2 + 2, by);
  ctx.fill();
  ctx.fillStyle = "#5e4029";
  ctx.fillRect(bx + 1, by - (big ? 50 : 28), tw / 3, big ? 46 : 26);

  const palettes: Record<number, string[]> = {
    0: ["#3f7a3e", "#55934a", "#6fae55", "#9acd6f"],
    1: ["#d77a9a", "#eb9cb6", "#f5bfd0", "#fde4ec"],
    2: ["#2f5f3a", "#3f7446", "#558a52", "#76a868"],
    3: ["#356b3a", "#4b8a46", "#66a654", "#94c96c"],
  };
  const p = palettes[kind];
  if (kind === 2) {
    const cy = by - 62;
    ctx.fillStyle = p[0];
    ctx.beginPath();
    ctx.ellipse(bx, cy, 20, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p[1];
    ctx.beginPath();
    ctx.ellipse(bx - 3, cy - 4, 16, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p[2];
    ctx.beginPath();
    ctx.ellipse(bx - 6, cy - 10, 9, 32, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p[3];
    ctx.beginPath();
    ctx.ellipse(bx - 8, cy - 18, 4, 16, -0.05, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const cr = big ? 66 : 34;
    const cy = by - (big ? 100 : 56);
    const blob = (col: string, n: number, spread: number, rad: number, oy: number, ox = 0) => {
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.5;
        const d = spread * (0.5 + r() * 0.5);
        ctx.beginPath();
        ctx.arc(bx + ox + Math.cos(a) * d, cy + oy + Math.sin(a) * d * 0.75, rad * (0.7 + r() * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    blob(p[0], 9, cr * 0.62, cr * 0.5, 6);
    blob(p[1], 8, cr * 0.5, cr * 0.42, -2, -3);
    blob(p[2], 6, cr * 0.36, cr * 0.32, -10, -8);
    blob(p[3], 5, cr * 0.2, cr * 0.16, -18, -12);
    if (kind === 1) {
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = r() < 0.5 ? "#fff3f6" : "#e57a9a";
        ctx.beginPath();
        ctx.arc(bx + range(r, -cr, cr) * 0.9, cy + range(r, -cr, cr) * 0.7, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (big) {
      // shimenawa rope - sacred tree
      ctx.strokeStyle = "#e8d6a0";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bx - 13, by - 30);
      ctx.quadraticCurveTo(bx, by - 24, bx + 13, by - 30);
      ctx.stroke();
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(bx - 4, by - 27, 3, 8);
      ctx.fillRect(bx + 4, by - 27, 3, 8);
    }
  }
  return { canvas: c, ox: bx, oy: by, w: W, h: H };
}

export function makeGlow(color: string, size = 128): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function makeCloudShadow(r: RNG): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 420;
  c.height = 260;
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < 7; i++) {
    const x = range(r, 110, 310),
      y = range(r, 90, 170),
      rad = range(r, 60, 100);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "rgba(30,50,70,0.5)");
    g.addColorStop(1, "rgba(30,50,70,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 420, 260);
  }
  return c;
}
