import { mulberry32, pick, range, shuffle, type RNG } from "./rng";
import { makeBuildingSprite, makeTreeSprite, rr, type BuildingKind, type Rect, type Sprite, type TreeKind } from "./sprites";
import { CLIENT_DEFS, type ClientDef } from "./dialogue";
import type { Facing } from "./characters";

export const T = 40;
export const COLS = 64;
export const ROWS = 48;
export const WORLD_W = COLS * T;
export const WORLD_H = ROWS * T;

export const GRASS = 0,
  ROAD = 1,
  WATER = 2,
  BRIDGE = 3,
  PLAZA = 4,
  MEADOW = 5;

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  sprite: Sprite;
  windows: Rect[]; // world coords
  doorX: number;
  doorY: number;
  kind: BuildingKind;
}

export type StaticKind = "building" | "tree" | "lamp" | "bench" | "fountain" | "windmill" | "mailbox";
export interface StaticObj {
  kind: StaticKind;
  x: number;
  y: number;
  sortY: number;
  sprite?: Sprite;
  phase: number;
  building?: Building;
  big?: boolean;
  // view bounds for culling
  bx: number;
  by: number;
  bw: number;
  bh: number;
}

export interface Client {
  id: number;
  def: ClientDef;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  facing: Facing;
  phase: number;
  jump: number; // 0..1 timer
  bubble: { text: string; t: number; w: number } | null;
  cooldown: number;
}

export interface World {
  tiles: Uint8Array;
  ground: HTMLCanvasElement;
  groundScale: number;
  statics: StaticObj[];
  colliders: Rect[];
  buildings: Building[];
  clients: Client[];
  lamps: { x: number; y: number }[];
  waterTiles: number[];
  postOffice: Building;
  postMat: { x: number; y: number };
  spawn: { x: number; y: number };
  fountain: { x: number; y: number };
  windmill: { x: number; y: number };
  tower: Building;
}

export const tileAt = (w: World, tx: number, ty: number) => {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return WATER;
  return w.tiles[ty * COLS + tx];
};

const H_ROADS = [6, 16, 26, 36];
const V_ROADS = [6, 18, 30, 42, 54];
const COL_BLOCKS: [number, number][] = [
  [8, 17],
  [20, 29],
  [32, 41],
  [56, 63],
];
const ROW_BLOCKS: [number, number][] = [
  [8, 15],
  [18, 25],
  [28, 35],
  [38, 46],
];

export function generateWorld(groundScale: number): World {
  const r: RNG = mulberry32(20240611);
  const tiles = new Uint8Array(COLS * ROWS);

  // meadows around edges
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      if (y < 6 || x < 6 || y >= 47) tiles[y * COLS + x] = MEADOW;
    }
  // roads
  for (const hy of H_ROADS) for (let x = 0; x < COLS; x++) for (let k = 0; k < 2; k++) tiles[(hy + k) * COLS + x] = ROAD;
  for (const vx of V_ROADS) for (let y = 0; y < ROWS; y++) for (let k = 0; k < 2; k++) tiles[y * COLS + vx + k] = ROAD;
  // plaza
  for (let y = 18; y <= 25; y++) for (let x = 20; x <= 29; x++) tiles[y * COLS + x] = PLAZA;
  // river
  for (let y = 0; y < ROWS; y++) {
    const cx = 47.5 + Math.sin(y * 0.22) * 1.6;
    for (let x = Math.floor(cx - 1.5); x <= Math.floor(cx + 1.5); x++) {
      const i = y * COLS + x;
      tiles[i] = tiles[i] === ROAD ? BRIDGE : WATER;
    }
  }
  // pond in park
  for (let y = 28; y <= 33; y++)
    for (let x = 8; x <= 13; x++) {
      const d = Math.hypot(x + 0.5 - 10.5, (y + 0.5 - 30.5) * 1.2);
      if (d < 2.3) tiles[y * COLS + x] = WATER;
    }

  const waterTiles: number[] = [];
  for (let i = 0; i < tiles.length; i++) if (tiles[i] === WATER) waterTiles.push(i);

  // ---------- ground ----------
  const ground = document.createElement("canvas");
  ground.width = Math.ceil(WORLD_W * groundScale);
  ground.height = Math.ceil(WORLD_H * groundScale);
  const g = ground.getContext("2d")!;
  g.scale(groundScale, groundScale);
  g.fillStyle = "#9cc56f";
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // mottling
  const greens = ["#90bc63", "#a8cf7b", "#8ab65d", "#b2d483", "#97c268"];
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.45;
    g.fillStyle = pick(r, greens);
    g.beginPath();
    g.ellipse(range(r, 0, WORLD_W), range(r, 0, WORLD_H), range(r, 12, 38), range(r, 8, 22), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // tufts
  g.strokeStyle = "rgba(60,110,50,0.45)";
  g.lineWidth = 1.2;
  for (let i = 0; i < 4200; i++) {
    const x = range(r, 0, WORLD_W),
      y = range(r, 0, WORLD_H);
    g.beginPath();
    g.moveTo(x - 2, y);
    g.lineTo(x - 3, y - 4);
    g.moveTo(x, y);
    g.lineTo(x, y - 5);
    g.moveTo(x + 2, y);
    g.lineTo(x + 3, y - 4);
    g.stroke();
  }
  // flowers (more in meadows)
  const flowerCols = ["#ffffff", "#f7e27a", "#f4a6c0", "#e8743a", "#b9a6f0", "#fff3a8"];
  for (let i = 0; i < 5200; i++) {
    const x = range(r, 0, WORLD_W),
      y = range(r, 0, WORLD_H);
    const t = tiles[Math.floor(y / T) * COLS + Math.floor(x / T)];
    if (t !== GRASS && t !== MEADOW) continue;
    if (t === GRASS && r() < 0.7) continue;
    g.fillStyle = pick(r, flowerCols);
    g.beginPath();
    g.arc(x, y, range(r, 1.4, 2.6), 0, Math.PI * 2);
    g.fill();
  }

  // water
  for (const i of waterTiles) {
    const x = (i % COLS) * T,
      y = Math.floor(i / COLS) * T;
    g.fillStyle = "#6ab4ca";
    g.fillRect(x, y, T, T);
  }
  const isWater = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const t = tiles[ty * COLS + tx];
    return t === WATER || t === BRIDGE;
  };
  for (const i of waterTiles) {
    const tx = i % COLS,
      ty = Math.floor(i / COLS);
    const x = tx * T,
      y = ty * T;
    const deep = isWater(tx - 1, ty) && isWater(tx + 1, ty) && isWater(tx, ty - 1) && isWater(tx, ty + 1);
    if (deep) {
      g.fillStyle = "rgba(60,130,170,0.35)";
      g.fillRect(x, y, T, T);
    }
    const edges: [number, number, number, number, number, number][] = [
      [-1, 0, x, y, 7, T],
      [1, 0, x + T - 7, y, 7, T],
      [0, -1, x, y, T, 7],
      [0, 1, x, y + T - 7, T, 7],
    ];
    for (const [ex, ey, rx, ry, rw, rh] of edges) {
      if (!isWater(tx + ex, ty + ey)) {
        g.fillStyle = "#c9b17c";
        g.fillRect(rx, ry, rw, rh);
        g.fillStyle = "rgba(220,245,250,0.85)";
        if (ex === -1) g.fillRect(x + 7, y, 2.5, T);
        if (ex === 1) g.fillRect(x + T - 9.5, y, 2.5, T);
        if (ey === -1) g.fillRect(x, y + 7, T, 2.5);
        if (ey === 1) g.fillRect(x, y + T - 9.5, T, 2.5);
      }
    }
  }
  // lily pads in pond
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2,
      d = r() * 55;
    const x = 10.5 * T + Math.cos(a) * d,
      y = 30.5 * T + Math.sin(a) * d * 0.8;
    g.fillStyle = "#5f9a4a";
    g.beginPath();
    g.arc(x, y, 6, 0.3, Math.PI * 2);
    g.lineTo(x, y);
    g.fill();
    if (r() < 0.4) {
      g.fillStyle = "#f7c6d6";
      g.beginPath();
      g.arc(x + 2, y - 1, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // roads
  const stoneCols = ["#d2c19c", "#dccdb0", "#e3d6bb", "#cbb891", "#d8c8a6"];
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      const t = tiles[ty * COLS + tx];
      if (t !== ROAD && t !== PLAZA) continue;
      const x = tx * T,
        y = ty * T;
      g.fillStyle = t === PLAZA ? "#e2d4b6" : "#c9b892";
      g.fillRect(x, y, T, T);
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const off = sy % 2 ? 6 : 0;
          const px = x + sx * 13.3 + off - 3 + range(r, -1, 1);
          const py = y + sy * 13.3 + range(r, -1, 1);
          g.fillStyle = t === PLAZA ? pick(r, ["#ebdfc6", "#e5d8bc", "#efe5cf", "#e0d1b2"]) : pick(r, stoneCols);
          rr(g, px + 1, py + 1, 11.5, 11.5, 4);
          g.fill();
        }
    }
  // curbs
  const walk = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    const t = tiles[ty * COLS + tx];
    return t === ROAD || t === PLAZA || t === BRIDGE;
  };
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      const t = tiles[ty * COLS + tx];
      if (t !== ROAD && t !== PLAZA) continue;
      const x = tx * T,
        y = ty * T;
      g.fillStyle = "rgba(110,95,70,0.35)";
      if (!walk(tx, ty - 1) && !isWater(tx, ty - 1)) g.fillRect(x, y, T, 3);
      if (!walk(tx, ty + 1) && !isWater(tx, ty + 1)) g.fillRect(x, y + T - 3, T, 3);
      if (!walk(tx - 1, ty) && !isWater(tx - 1, ty)) g.fillRect(x, y, 3, T);
      if (!walk(tx + 1, ty) && !isWater(tx + 1, ty)) g.fillRect(x + T - 3, y, 3, T);
    }
  // plaza rings
  const fountain = { x: 25 * T, y: 22.9 * T };
  g.strokeStyle = "rgba(160,140,100,0.35)";
  g.lineWidth = 3;
  for (let rad = 70; rad < 200; rad += 34) {
    g.beginPath();
    g.ellipse(fountain.x, fountain.y, rad, rad * 0.8, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // bridges
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = 0; tx < COLS; tx++) {
      if (tiles[ty * COLS + tx] !== BRIDGE) continue;
      const x = tx * T,
        y = ty * T;
      g.fillStyle = "#b5874f";
      g.fillRect(x, y, T, T);
      g.strokeStyle = "rgba(90,60,30,0.45)";
      g.lineWidth = 1.5;
      for (let px = 0; px <= T; px += 8) {
        g.beginPath();
        g.moveTo(x + px, y);
        g.lineTo(x + px, y + T);
        g.stroke();
      }
      const top = tiles[(ty - 1) * COLS + tx] !== BRIDGE;
      const bot = tiles[(ty + 1) * COLS + tx] !== BRIDGE;
      g.fillStyle = "#7a5032";
      if (top) {
        g.fillRect(x, y - 2, T, 5);
        g.fillRect(x + 4, y - 8, 4, 10);
        g.fillRect(x + 24, y - 8, 4, 10);
        g.fillRect(x, y - 9, T, 3);
      }
      if (bot) {
        g.fillStyle = "rgba(30,50,60,0.3)";
        g.fillRect(x, y + T + 2, T, 6);
        g.fillStyle = "#7a5032";
        g.fillRect(x, y + T - 4, T, 5);
        g.fillRect(x + 4, y + T - 10, 4, 10);
        g.fillRect(x + 24, y + T - 10, 4, 10);
        g.fillRect(x, y + T - 11, T, 3);
      }
    }

  // ---------- objects ----------
  const statics: StaticObj[] = [];
  const colliders: Rect[] = [];
  const buildings: Building[] = [];

  const addBuilding = (x: number, y: number, w: number, footH: number, wallH: number, rise: number, kind: BuildingKind) => {
    const s = makeBuildingSprite(w, footH, wallH, rise, kind, r);
    const b: Building = {
      x,
      y,
      w,
      h: footH,
      sprite: s,
      windows: s.windows.map((wr) => ({ x: wr.x + x, y: wr.y + y, w: wr.w, h: wr.h })),
      doorX: x + s.doorX,
      doorY: y + footH,
      kind,
    };
    buildings.push(b);
    colliders.push({ x, y: y + 6, w, h: footH - 6 });
    statics.push({ kind: "building", x, y, sortY: y + footH, sprite: s, phase: 0, building: b, bx: x - s.ox, by: y - s.oy, bw: s.w, bh: s.h });
    // garden path + flower beds
    g.fillStyle = "#e6dcc4";
    for (let py = y + footH + 2; py < y + footH + 40; py += 10) {
      rr(g, b.doorX - 8 + range(r, -1, 1), py, 16, 8, 3);
      g.fill();
    }
    for (const side of [-1, 1]) {
      const fx = b.doorX + side * 30;
      if (fx < x + 10 || fx > x + w - 10) continue;
      g.fillStyle = "#6a9a4a";
      g.beginPath();
      g.ellipse(fx, y + footH + 12, 18, 7, 0, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 9; k++) {
        g.fillStyle = pick(r, ["#f4a6c0", "#f7e27a", "#ffffff", "#e75a6b", "#b9a6f0"]);
        g.beginPath();
        g.arc(fx + range(r, -14, 14), y + footH + 12 + range(r, -4, 4), 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    return b;
  };

  const treeSprites: Sprite[][] = [0, 1, 2, 3].map((k) => (k === 3 ? [makeTreeSprite(3, r)] : [0, 1, 2].map(() => makeTreeSprite(k as TreeKind, r))));
  const addTree = (x: number, y: number, kind: TreeKind) => {
    const s = pick(r, treeSprites[kind]);
    const big = kind === 3;
    statics.push({ kind: "tree", x, y, sortY: y, sprite: s, phase: r() * 10, big, bx: x - s.ox, by: y - s.oy, bw: s.w, bh: s.h });
    colliders.push(big ? { x: x - 18, y: y - 12, w: 36, h: 16 } : { x: x - 7, y: y - 6, w: 14, h: 8 });
  };
  const addLamp = (x: number, y: number) => {
    for (const c of colliders) if (x + 14 > c.x && x - 14 < c.x + c.w && y + 10 > c.y && y - 16 < c.y + c.h) return;
    for (const cl of [postOffice, tower]) if (x > cl.x - 20 && x < cl.x + cl.w + 20 && y > cl.y - 20 && y < cl.y + cl.h + 40) return;
    statics.push({ kind: "lamp", x, y, sortY: y, phase: 0, bx: x - 12, by: y - 60, bw: 24, bh: 66 });
    colliders.push({ x: x - 4, y: y - 4, w: 8, h: 6 });
    lamps.push({ x, y: y - 44 });
  };
  const addBench = (x: number, y: number) => {
    statics.push({ kind: "bench", x, y, sortY: y, phase: 0, bx: x - 22, by: y - 22, bw: 44, bh: 28 });
    colliders.push({ x: x - 20, y: y - 8, w: 40, h: 10 });
  };
  const lamps: { x: number; y: number }[] = [];

  // houses
  const houses: Building[] = [];
  for (const [c0, c1] of COL_BLOCKS)
    for (const [r0, r1] of ROW_BLOCKS) {
      if (c0 === 20 && r0 === 18) continue; // plaza
      if (c0 === 8 && r0 === 28) continue; // park
      const footH = 120;
      const top = (r1 - 3) * T + 10;
      const startX = c0 * T + 8,
        endX = (c1 + 1) * T - 8;
      let x = startX + range(r, 0, 14);
      while (endX - x >= 96) {
        const w = Math.min(endX - x, pick(r, [100, 116, 132, 148]));
        if (w < 96) break;
        const two = r() < 0.35;
        const roll = r();
        const kind: BuildingKind = roll < 0.08 ? "bakery" : roll < 0.2 ? "shop" : "house";
        houses.push(addBuilding(x, top, w, footH, two ? 86 : 60, two ? 50 : 38, kind));
        x += w + range(r, 14, 30);
      }
      // back garden trees
      for (let tx = c0 * T + 26; tx < (c1 + 1) * T - 20; tx += range(r, 52, 84)) {
        const ty = r0 * T + range(r, 40, 90);
        addTree(tx, ty, r() < 0.15 ? 1 : r() < 0.25 ? 2 : 0);
      }
    }

  // post office & tower
  const postOffice = addBuilding(25 * T - 110, 18 * T + 4, 220, 100, 66, 44, "post");
  const tower = addBuilding(20 * T + 10, 18 * T + 10, 70, 70, 150, 36, "tower");
  const postMat = { x: postOffice.doorX, y: postOffice.doorY + 16 };
  // mailbox
  statics.push({ kind: "mailbox", x: postOffice.doorX + 52, y: postOffice.doorY + 18, sortY: postOffice.doorY + 18, phase: 0, bx: postOffice.doorX + 40, by: postOffice.doorY - 20, bw: 24, bh: 42 });
  colliders.push({ x: postOffice.doorX + 46, y: postOffice.doorY + 12, w: 12, h: 8 });

  // fountain
  statics.push({ kind: "fountain", x: fountain.x, y: fountain.y + 30, sortY: fountain.y + 30, phase: 0, bx: fountain.x - 60, by: fountain.y - 70, bw: 120, bh: 120 });
  colliders.push({ x: fountain.x - 46, y: fountain.y - 22, w: 92, h: 52 });
  addBench(fountain.x - 120, fountain.y + 100);
  addBench(fountain.x + 120, fountain.y + 100);
  addTree(21 * T, 25 * T + 20, 1);
  addTree(29 * T, 25 * T + 20, 1);
  addTree(29 * T + 10, 19 * T + 30, 0);

  // lamps at intersections
  for (const hy of H_ROADS)
    for (const vx of V_ROADS) {
      if (tiles[(hy - 1) * COLS + vx - 1] === WATER) continue;
      addLamp(vx * T - 10, hy * T - 6);
      if (tiles[(hy + 2) * COLS + vx + 2] !== WATER) addLamp(vx * T + 2 * T + 10, hy * T + 2 * T + 22);
    }

  // park: camphor + benches
  addTree(15 * T, 33 * T, 3);
  addBench(12 * T, 34.5 * T);
  addTree(9 * T, 34.6 * T, 1);
  addTree(16.6 * T, 29 * T, 0);

  // river park trees & meadow trees
  const canPlace = (x: number, y: number) => {
    const tx = Math.floor(x / T),
      ty = Math.floor(y / T);
    for (let dy = -1; dy <= 0; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const t = tileAt({ tiles } as unknown as World, tx + dx, ty + dy);
        if (t !== GRASS && t !== MEADOW) return false;
      }
    for (const c of colliders) if (x > c.x - 40 && x < c.x + c.w + 40 && y > c.y - 30 && y < c.y + c.h + 50) return false;
    return true;
  };
  let tries = 0,
    placed = 0;
  while (placed < 120 && tries < 3000) {
    tries++;
    const x = range(r, 40, WORLD_W - 40),
      y = range(r, 60, WORLD_H - 20);
    const tx = Math.floor(x / T);
    const inRiverPark = tx >= 44 && tx <= 53;
    const t = tiles[Math.floor(y / T) * COLS + tx];
    if (!(t === MEADOW || inRiverPark)) continue;
    if (x > 40 && x < 220 && y > 40 && y < 240) continue; // windmill spot
    if (!canPlace(x, y)) continue;
    addTree(x, y, r() < 0.2 ? 1 : r() < 0.3 ? 2 : 0);
    placed++;
  }

  // windmill
  const windmill = { x: 3 * T, y: 4.6 * T };
  statics.push({ kind: "windmill", x: windmill.x, y: windmill.y, sortY: windmill.y, phase: 0, bx: windmill.x - 90, by: windmill.y - 200, bw: 180, bh: 210 });
  colliders.push({ x: windmill.x - 30, y: windmill.y - 22, w: 60, h: 24 });

  // clients at houses
  const order = shuffle(houses.slice(), r);
  const clients: Client[] = CLIENT_DEFS.map((def, i) => {
    const h = order[i % order.length];
    const cx = h.doorX,
      cy = h.doorY + 22;
    return { id: i, def, x: cx, y: cy, homeX: cx, homeY: cy, facing: "down" as Facing, phase: r() * 10, jump: 0, bubble: null, cooldown: 0 };
  });

  const spawn = { x: postMat.x, y: postMat.y + 26 };

  return {
    tiles,
    ground,
    groundScale,
    statics,
    colliders,
    buildings,
    clients,
    lamps,
    waterTiles,
    postOffice,
    postMat,
    spawn,
    fountain,
    windmill,
    tower,
  };
}
