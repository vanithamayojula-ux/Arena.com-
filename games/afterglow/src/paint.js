/* AFTERGLOW — the painter. Everything "hand-painted" is brushed procedurally into
   offscreen strips once per scene, then composited with a darkness mask so lights
   genuinely carve the frame. Palette: glacial blues crushed to near-black, warm
   ambers where flame lives. */

import { rng, makeNoise1D, fbm1, clamp, lerp, TAU, hashStr, roughLine } from './util.js';

export const PAL = {
  nightTop: '#05070f', sky1: '#0b1220', sky2: '#15243a', sky3: '#243a52',
  dusk1: '#1c2b40', dusk2: '#33465c', dusk3: '#5a6a72',
  ridge: '#0a1120', hill: '#101b2c', near: '#060b14',
  snow: '#243243', snowLit: '#5d7185',
  wood: '#2a1f16', woodLit: '#8a5a2b', stone: '#1c2331',
  skin: '#c9a27b',
  ember: '#ffb45e', ember2: '#ff7828', lamp: '#ffd9a0',
  blood: '#8f2f28', wisp: '#9fc6ff', wispCore: '#e8f4ff',
  clothA: '#3d5a6b', clothB: '#6b3d4a', clothC: '#4a5d3a', gold: '#e8b64c',
};

/* ------------------------------------------------------------------ */
/* Backdrop generation                                                  */
/* ------------------------------------------------------------------ */

export function makeBackdrop(ctx2dLike, scene, worldW, W, H) {
  // ctx2dLike: a document.createElement('canvas') provider — kept abstract so the
  // boot test can stub it. We just need offscreen canvases.
  const mk = (w, h) => {
    const c = ctx2dLike(w, h);
    return c;
  };
  const seed = hashStr(scene.id || 'afterglow');
  const R = rng(seed);
  const dpr = 1;
  const layers = [];

  const add = (parallax, painter, height = H) => {
    const cw = Math.max(W, Math.min(worldW, Math.ceil(worldW * (0.35 + 0.65 * parallax))) );
    const c = mk(cw, height);
    const g = c.getContext('2d');
    painter(g, cw, height, seed);
    layers.push({ canvas: c, w: cw, h: height, parallax });
  };

  // --- sky -----------------------------------------------------------
  const sky = mk(W, H);
  paintSky(sky.getContext('2d'), W, H, scene, seed);
  const skyLayer = { canvas: sky, w: W, h: H, parallax: 0 };

  // --- far ridges -----------------------------------------------------
  if (scene.far !== false) add(0.22, (g, w, h) => paintRidge(g, w, h, scene, seed, 0.22));
  if (scene.mid !== false) add(0.45, (g, w, h) => paintRidge(g, w, h, scene, seed, 0.45));
  if (scene.near !== false) add(0.72, (g, w, h) => paintNearTrees(g, w, h, scene, seed));
  if (scene.decorFar) add(0.6, (g, w, h) => scene.decorFar(g, w, h, { R, seed, PAL, groundY: scene.groundY || H * 0.78 }));

  // --- ground strip ----------------------------------------------------
  const gw = Math.max(W, worldW);
  const ground = mk(gw, H);
  paintGround(ground.getContext('2d'), gw, H, scene, seed);
  if (scene.decor) add(1, (g, w, h) => scene.decor(g, w, h, { R, seed, PAL, groundY: scene.groundY || H * 0.78, worldW: gw }));

  return { layers: [skyLayer, ...layers], W, H, groundW: gw, parallaxTotal: 1, scene, dpr };
}

function paintSky(g, W, H, scene, seed) {
  const R = rng(seed ^ 0x51ab);
  const top = scene.skyTop || PAL.sky1;
  const mid = scene.skyMid || PAL.sky2;
  const bot = scene.skyBot || PAL.sky3;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, scene.top0 || top);
  grd.addColorStop(0.45, mid);
  grd.addColorStop(1, bot);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  // The dimmed sun: a cold coin, halo the size of a thumbnail.
  if (scene.sun) {
    const sx = W * scene.sun.x, sy = H * scene.sun.y;
    let rg = g.createRadialGradient(sx, sy, 2, sx, sy, 150);
    rg.addColorStop(0, scene.sun.halo || 'rgba(255,190,120,0.16)');
    rg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = rg; g.fillRect(sx - 160, sy - 160, 320, 320);
    g.beginPath(); g.arc(sx, sy, scene.sun.r || 14, 0, TAU);
    g.fillStyle = scene.sun.color || 'rgba(255,205,150,0.55)'; g.fill();
    g.beginPath(); g.arc(sx, sy, (scene.sun.r || 14) * 0.62, 0, TAU);
    g.fillStyle = 'rgba(255,228,190,0.5)'; g.fill();
  }

  // cloud banks — long lazy brush strokes
  const cloud = scene.clouds ?? 9;
  for (let i = 0; i < cloud; i++) {
    const y = H * (0.08 + R() * 0.5), w = 120 + R() * 380, h = 8 + R() * 22;
    const x = R() * (W + 200) - 100;
    g.save();
    g.globalAlpha = 0.06 + R() * 0.1;
    g.fillStyle = scene.cloudColor || '#8fa3c0';
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const yy = y + Math.sin(t * Math.PI * 2 + i) * h * 0.3;
      g.lineTo(x + w * t, yy - (k === 4 ? h * 0.45 : 0));
    }
    for (let k = 8; k >= 0; k--) {
      const t = k / 8;
      g.lineTo(x + w * t, y + h * 0.6 + Math.sin(t * 6 + i) * 2);
    }
    g.closePath(); g.fill();
    g.restore();
  }

  if (scene.stars) {
    g.save();
    for (let i = 0; i < 90; i++) {
      const x = R() * W, y = R() * H * 0.55;
      g.globalAlpha = 0.2 + R() * 0.6;
      g.fillStyle = '#cfe0ff';
      g.fillRect(x, y, 1.2, 1.2);
    }
    g.restore();
  }
  // faint aurora — the sun's leftovers
  if (scene.aurora) {
    g.save(); g.globalCompositeOperation = 'screen';
    for (let b = 0; b < 3; b++) {
      g.globalAlpha = 0.05;
      const grd2 = g.createLinearGradient(0, H * 0.1, 0, H * 0.5);
      grd2.addColorStop(0, 'rgba(90,150,140,0)');
      grd2.addColorStop(0.5, ['#5fae94', '#7a97c9', '#b98a6a'][b]);
      grd2.addColorStop(1, 'rgba(60,90,120,0)');
      g.fillStyle = grd2;
      g.beginPath();
      g.moveTo(0, H * 0.16 + b * 18);
      const n = makeNoise1D(seed + b * 7);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, H * 0.16 + b * 18 + fbm1(n, x / 220 + b, 3) * 40);
      for (let x = W; x >= 0; x -= 16) g.lineTo(x, H * 0.42 + b * 26 + fbm1(n, x / 190 + b * 3, 3) * 30);
      g.closePath(); g.fill();
    }
    g.restore();
  }
}

function paintRidge(g, W, H, scene, seed, depth) {
  const R = rng(seed + depth * 999);
  const n = makeNoise1D(seed + depth * 131);
  const base = scene.groundY || H * 0.78;
  const amp = depth < 0.3 ? 90 : 62;
  const top = base - (depth < 0.3 ? 150 : 70);
  const col = depth < 0.3 ? (scene.farColor || '#131f33') : (scene.midColor || '#0e1726');
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) {
    const t = x / W;
    const y = top + fbm1(n, t * 9 + depth * 40, 4) * amp + Math.sin(t * 6 + depth * 9) * 8;
    g.lineTo(x, Math.min(y, base - 6));
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  // brush stipple along the crest
  g.save();
  g.strokeStyle = depth < 0.3 ? 'rgba(140,170,210,0.10)' : 'rgba(120,150,190,0.08)';
  for (let i = 0; i < W / 26; i++) {
    const x = R() * W;
    const t = x / W;
    const y = top + fbm1(n, t * 9 + depth * 40, 4) * amp + Math.sin(t * 6 + depth * 9) * 8;
    g.beginPath();
    g.moveTo(x, y - 1);
    g.lineTo(x + 5 + R() * 12, y + 2 + R() * 3);
    g.stroke();
  }
  g.restore();
  // ruined towers poking up, far layer only
  if (depth > 0.35 && scene.ruins !== false) {
    g.save();
    g.fillStyle = col;
    for (let i = 0; i < W / 320; i++) {
      const x = 60 + R() * (W - 120);
      const t = x / W;
      const y = top + fbm1(n, t * 9 + depth * 40, 4) * amp + Math.sin(t * 6 + depth * 9) * 8;
      const h = 26 + R() * 70, w = 8 + R() * 10;
      g.fillRect(x, y - h, w, h);
      g.fillRect(x - 3, y - h, w + 6, 4);
      if (R() > 0.5) { // leaning mast
        g.beginPath();
        g.moveTo(x + w, y - h);
        g.lineTo(x + w + 14 + R() * 16, y - h - 16);
        g.lineTo(x + w + 12, y - h + 3);
        g.closePath(); g.fill();
      }
    }
    g.restore();
  }
}

function paintNearTrees(g, W, H, scene, seed) {
  if (scene.trees === false) return;
  const n = makeNoise1D(seed + 51);
  const base = scene.groundY || H * 0.78;
  const R = rng(seed + 7);
  g.save();
  g.strokeStyle = scene.treeColor || '#080d16';
  for (let i = 0; i < W / 46; i++) {
    const x = R() * W;
    const h = 40 + R() * 90;
    const y = base - 8 - R() * 10;
    const lean = fbm1(n, x / 90, 3) * 10;
    g.lineWidth = 2 + R() * 3;
    g.beginPath();
    g.moveTo(x, y);
    roughLine(g, x, y, x + lean, y - h, 1.6, seed + i);
    g.stroke();
    // dead branches
    g.lineWidth = 1 + R();
    const br = 2 + (R() * 3 | 0);
    for (let b = 0; b < br; b++) {
      const t = 0.35 + (b / br) * 0.6;
      const bx = x + lean * t, by = y - h * t;
      const sgn = b % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(bx + sgn * (7 + R() * 12), by - 6 - R() * 10);
      g.stroke();
    }
  }
  g.restore();
}

function paintGround(g, W, H, scene, seed) {
  const base = scene.groundY || H * 0.78;
  const n = makeNoise1D(seed + 3);
  // snow/dirt bed with an uneven top edge
  g.fillStyle = scene.groundColor || '#131c2a';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 14) g.lineTo(x, base + fbm1(n, x / 130, 3) * 5);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  // cold top-light along the surface line
  g.strokeStyle = 'rgba(150,180,215,0.14)';
  g.lineWidth = 1.4;
  g.beginPath();
  for (let x = 0; x <= W; x += 14) {
    const y = base + fbm1(n, x / 130, 3) * 5;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  // scattered rubble brush dabs
  const R = rng(seed + 91);
  for (let i = 0; i < W / 9; i++) {
    const x = R() * W;
    const y = base + 6 + R() * (H - base - 6);
    g.fillStyle = `rgba(${18 + R() * 30 | 0},${28 + R() * 34 | 0},${44 + R() * 40 | 0},0.5)`;
    g.fillRect(x, y, 2 + R() * 6, 1 + R() * 2.5);
  }
  // drifts
  g.fillStyle = 'rgba(120,150,190,0.05)';
  for (let i = 0; i < W / 220; i++) {
    const x = R() * W;
    g.beginPath();
    g.ellipse(x, base + 16 + R() * 24, 60 + R() * 90, 7 + R() * 8, 0, 0, TAU);
    g.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Compositing helpers used per-frame                                   */
/* ------------------------------------------------------------------ */

export function drawBackdrop(g, bd, camX, t, W, H) {
  for (const L of bd.layers) {
    const span = Math.max(1, L.w - W);
    const off = -camX * L.parallax;
    const ox = clamp(off, -span, 0);
    g.drawImage(L.canvas, ox, 0, L.w, H, 0, 0, L.w, H);
    if (ox + L.w < W) g.drawImage(L.canvas, ox + L.w, 0, W - (ox + L.w), H, ox + L.w, 0, W - (ox + L.w), H);
  }
}

/* Wind streaks over everything (drawn with alpha; strong during gusts) */
export function drawWind(g, W, H, t, strength) {
  if (strength <= 0.01) return;
  g.save();
  g.globalAlpha = 0.12 * strength;
  g.strokeStyle = '#cfe0ff';
  const n = makeNoise1D(4);
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * H + fbm1(n, t * 0.4 + i, 2) * 30;
    const x = ((t * (140 + i * 18) + i * 300) % (W + 340)) - 170;
    const len = 60 + (i % 5) * 40;
    g.lineWidth = 1 + (i % 3) * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.4, y - 4, x + len * 0.7, y + 3, x + len, y - 2);
    g.stroke();
  }
  g.restore();
}

/* Ashfall / snow particles. Persistent pool. */
export function makeFlakes(W, H, n = 110) {
  const R = rng(1234);
  const a = [];
  for (let i = 0; i < n; i++) a.push({ x: R() * W, y: R() * H, s: 0.5 + R() * 1.6, v: 12 + R() * 30, d: R() * TAU, w: R() });
  return { list: a, W, H };
}
export function stepFlakes(fl, dt, t, wind = 0) {
  for (const f of fl.list) {
    f.y += f.v * dt * (0.6 + f.s * 0.4);
    f.x += (10 + f.s * 14) * dt + wind * (60 + f.s * 90) * dt + Math.sin(t * 0.8 + f.d) * 8 * dt;
    if (f.y > fl.H + 4) { f.y = -4; f.x = Math.random() * fl.W; }
    if (f.x > fl.W + 4) f.x = -4; else if (f.x < -4) f.x = fl.W + 4;
  }
}
export function drawFlakes(g, fl, camX = 0) {
  g.save();
  for (const f of fl.list) {
    g.globalAlpha = 0.14 + f.s * 0.12;
    g.fillStyle = f.s > 1.5 ? '#dfe9f7' : '#93a7c2';
    g.beginPath();
    g.arc(f.x, f.y, f.s * 0.9, 0, TAU);
    g.fill();
  }
  g.restore();
}

/* Lighting: darkness with carved holes. `lights`: [{x,y,r,warm,inten,flick}] */
export function makeLightCanvas(W, H, doc) {
  const c = doc(W, H);
  return { canvas: c, ctx: c.getContext('2d'), W, H };
}
export function renderLighting(L, lights, dark, tint) {
  const g = L.ctx;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, L.W, L.H);
  g.fillStyle = tint || '#04060d';
  g.globalAlpha = clamp(dark, 0, 1);
  g.fillRect(0, 0, L.W, L.H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  for (const li of lights) {
    const flick = li.flick == null ? 1 : 0.92 + flickSeed(li) * 0.12;
    const r = li.r * flick;
    const rg = g.createRadialGradient(li.x, li.y, r * 0.08, li.x, li.y, r);
    rg.addColorStop(0, `rgba(0,0,0,${clamp(0.95 * (li.inten ?? 1), 0, 1)})`);
    rg.addColorStop(0.55, `rgba(0,0,0,${clamp(0.42 * (li.inten ?? 1), 0, 1)})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(li.x, li.y, r, 0, TAU); g.fill();
  }
}
let _fT = 0;
function flickSeed(li) {
  // cheap shared flicker
  return Math.sin(_fT * 11 + li.x * 0.03 + li.y * 0.05) * 0.6 + Math.sin(_fT * 23 + li.x * 0.11) * 0.4;
}
export function advanceFlicker(dt) { _fT += dt; }

export function applyWarmGlow(g, lights, amount = 1) {
  g.save();
  g.globalCompositeOperation = 'screen';
  for (const li of lights) {
    if (li.warm === 0) continue;
    const r = li.r * 0.92;
    const rg = g.createRadialGradient(li.x, li.y, 2, li.x, li.y, r);
    const w = li.warm ?? '255,178,96';
    rg.addColorStop(0, `rgba(${w},${0.20 * amount * (li.inten ?? 1)})`);
    rg.addColorStop(0.5, `rgba(${w},${0.07 * amount * (li.inten ?? 1)})`);
    rg.addColorStop(1, `rgba(${w},0)`);
    g.fillStyle = rg;
    g.fillRect(li.x - r, li.y - r, r * 2, r * 2);
  }
  g.restore();
}

/* Vignette + grain, drawn last. */
export function makeGrainTile(doc, size = 180, seed = 7) {
  const c = doc(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const R = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (R() * 2 - 1) * 46;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function drawGrade(g, W, H, grain, t, reducedMotion, strength = 1) {
  const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(2,3,8,${0.55 * strength})`);
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  if (grain) {
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.06 * strength;
    const ox = reducedMotion ? 0 : (Math.floor(t * 14) * 53) % 181;
    const oy = reducedMotion ? 0 : (Math.floor(t * 14) * 97) % 181;
    for (let y = -oy; y < H; y += 180) for (let x = -ox; x < W; x += 180) g.drawImage(grain, x, y);
    g.restore();
  }
}

/* Embers rising from a flame — used by every fire in the game. */
export function makeEmbers() { return []; }
export function spawnEmber(list, x, y, hue) {
  if (list.length > 160) return;
  list.push({ x, y, vx: (Math.random() - 0.5) * 26, vy: -30 - Math.random() * 55, life: 0.7 + Math.random() * 1.1, t: 0, hue: hue || 32 });
}
export function stepEmbers(list, dt, t) {
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    e.t += dt;
    e.x += (e.vx + Math.sin(t * 3 + e.y * 0.05) * 18) * dt;
    e.y += e.vy * dt;
    e.vy += 18 * dt;
    if (e.t > e.life) list.splice(i, 1);
  }
}
export function drawEmbers(g, list, camX = 0) {
  g.save();
  g.globalCompositeOperation = 'screen';
  for (const e of list) {
    const k = 1 - e.t / e.life;
    g.globalAlpha = k * 0.85;
    g.fillStyle = `hsl(${e.hue}, 95%, ${45 + k * 25}%)`;
    g.beginPath(); g.arc(e.x - camX, e.y, 0.8 + k * 1.7, 0, TAU); g.fill();
  }
  g.restore();
}

/* A brush-drawn flame: wobbling teardrop layers. */
export function drawFlame(g, x, y, s, t, seedN = 0, lit = 1) {
  if (lit <= 0.02) return;
  const n = Math.sin(t * 11 + seedN) * 0.5 + Math.sin(t * 23 + seedN * 3) * 0.25;
  const n2 = Math.sin(t * 7.3 + seedN * 5);
  s *= lit;
  g.save();
  g.translate(x, y);
  g.globalCompositeOperation = 'screen';
  for (const [col, k, wob] of [
    ['rgba(255,110,30,0.55)', 1.7, 0.22],
    ['rgba(255,170,60,0.75)', 1.15, 0.16],
    ['rgba(255,232,170,0.95)', 0.66, 0.1],
  ]) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, -s * 2.6 * k * (1 + n * wob));
    g.bezierCurveTo(s * 0.9 * k, -s * 1.2 * k, s * 0.62 * k, 0, 0, s * 0.28 * k);
    g.bezierCurveTo(-s * 0.62 * k, 0, -s * 0.9 * k, -s * 1.2 * k, 0, -s * 2.6 * k * (1 + n * wob));
    g.fill();
  }
  // lean with wind
  g.rotate(n2 * 0.06);
  g.restore();
}
