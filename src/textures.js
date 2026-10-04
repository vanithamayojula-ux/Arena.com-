// Every surface in Vaelune is painted here, procedurally, at load time.
import * as THREE from 'three';
import { makeFbm, makeRNG, hex2rgb, mix } from './rng.js';

const cache = new Map();

function cv(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function tex(canvas, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Normal map derived from a height buffer (Float32Array size²) — tiles. */
function normalFromHeight(height, size, strength = 2.2) {
  const out = new Uint8Array(size * size * 4);
  const at = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      out[i] = (nx * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * 0.5 + 0.5) * 255;
      out[i + 2] = (nz * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(out, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/* ───────────────────────── masonry / paint / wood ───────────────────────── */

function surfaceMaps(seed, {
  size = 256, base = '#6d7268', dark = 0.55, grain = 26, stains = 14,
  cracks = 0, courses = 0, planks = 0, wetBottom = true, wet = 0.16,
} = {}) {
  const key = JSON.stringify(['surf', seed, size, base, dark, grain, stains, cracks, courses, planks, wetBottom, wet]);
  if (cache.has(key)) return cache.get(key);

  const [br, bg, bb] = hex2rgb(base);
  const n1 = makeFbm(seed, 4, 5);
  const n2 = makeFbm(seed + 91, 8, 4);
  const height = new Float32Array(size * size);
  const c = cv(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rng = makeRNG(seed + 7);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      let shade = mix(0.5, 1.5, n1(u, v)) * mix(0.7, 1.3, n2(u * 2, v * 2));
      // horizontal courses (stone blocks / brick)
      let courseShade = 0;
      if (courses > 0) {
        const row = Math.floor(v * courses);
        const off = (row % 2) * 0.5;
        const col = (u * courses * 1.6 + off) % 1;
        const edgeV = Math.abs(((v * courses) % 1) - 0.5);
        const edgeU = Math.abs(col - 0.5);
        courseShade = (edgeV > 0.46 || edgeU > 0.47) ? -0.45 : 0;
        courseShade += (rng.f() * 0 - 0) + (n2(u * 3, v * 3) - 0.5) * 0.12;
      }
      if (planks > 0) {
        const pi = Math.floor(u * planks);
        const within = (u * planks) % 1;
        const gap = within < 0.02 || within > 0.98 ? -0.5 : 0;
        courseShade = gap + (n2(pi * 0.37 + u * 6, v * 1.2) - 0.5) * 0.22;
      }
      shade += courseShade;
      // damp rising from the bottom of the wall
      if (wetBottom) {
        const w = Math.max(0, 1 - v / (wet * 4)) * 0.55 + mix(0, 1, Math.pow(Math.max(0, 1 - v * 1.6), 3)) * 0.3;
        shade -= w;
      }
      // algae bloom in the noise
      const algae = Math.pow(Math.max(0, n2(u * 1.5 + 0.3, v * 1.5) - 0.55), 1.5) * 2.2;
      const l = Math.max(0.06, shade);
      let r = br * l, g = bg * l, b = bb * l;
      g += algae * 26; r -= algae * 14; b += algae * 6;
      const gr = (n2(u * 11, v * 11) - 0.5) * grain;
      r += gr; g += gr; b += gr;
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, Math.max(0, r));
      img.data[i + 1] = Math.min(255, Math.max(0, g));
      img.data[i + 2] = Math.min(255, Math.max(0, b));
      img.data[i + 3] = 255;
      height[y * size + x] = shade * 0.5 + n2(u * 24, v * 24) * 0.5;
    }
  }
  ctx.putImageData(img, 0, 0);

  // vertical water stains / drips
  ctx.globalCompositeOperation = 'multiply';
  for (let s = 0; s < stains; s++) {
    const x = rng.f() * size, w = rng.range(2, 16);
    const g = ctx.createLinearGradient(0, 0, 0, size * rng.range(0.4, 1));
    g.addColorStop(0, 'rgba(30,34,30,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.globalAlpha = rng.range(0.12, 0.4);
    ctx.fillRect(x, 0, w, size * rng.range(0.5, 1));
  }
  ctx.globalAlpha = 1;

  // cracks
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(12,14,14,0.55)';
  for (let k = 0; k < cracks; k++) {
    let x = rng.f() * size, y = rng.f() * size, a = rng.f() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = rng.int(4, 12);
    for (let i = 0; i < steps; i++) {
      a += rng.range(-0.7, 0.7);
      x += Math.cos(a) * rng.range(4, 18); y += Math.sin(a) * rng.range(4, 18);
      ctx.lineTo(x, y);
      height[(((y | 0) % size) + size) % size * size + (((x | 0) % size) + size) % size] -= 0.35;
    }
    ctx.lineWidth = rng.range(0.6, 1.8);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  const set = {
    map: tex(c, { repeat: 1 }),
    normalMap: normalFromHeight(height, size, 2.6),
    roughnessMap: (() => {
      const rc = cv(size), rx = rc.getContext('2d');
      rx.drawImage(c, 0, 0);
      rx.globalCompositeOperation = 'saturation';
      rx.fillStyle = '#808080'; rx.fillRect(0, 0, size, size);
      rx.globalCompositeOperation = 'source-over';
      rx.fillStyle = `rgba(255,255,255,${0.3})`; rx.fillRect(0, 0, size, size);
      return tex(rc, { srgb: false });
    })(),
  };
  set.map.repeat.set(1, 1); set.normalMap.repeat.set(1, 1); set.roughnessMap.repeat.set(1, 1);
  cache.set(key, set);
  return set;
}

export const plasterMaps = (seed, opts) => surfaceMaps(seed, { base: '#7d7a6c', stains: 16, cracks: 3, wet: 0.2, ...opts });
export const stoneMaps = (seed, opts) => surfaceMaps(seed, { base: '#4e5450', courses: 9, stains: 10, cracks: 4, wet: 0.24, ...opts });
export const darkStoneMaps = (seed, opts) => surfaceMaps(seed, { base: '#333a3c', courses: 7, stains: 8, cracks: 6, wet: 0.3, ...opts });
export const woodMaps = (seed, opts) => surfaceMaps(seed, { base: '#5a4632', planks: 7, stains: 6, cracks: 0, wet: 0.35, ...opts });
export const sandMaps = (seed, opts) => surfaceMaps(seed, { base: '#8a8574', stains: 4, cracks: 0, wet: 0.5, ...opts });

/* ───────────────────────── emissive: windows, veins, runes ───────────────────────── */

/** Lit-window emissive map. Returns a canvas so it can be re-randomised per building. */
export function windowEmissive(seed, { cols = 4, rows = 4, warmth = 0.35, size = 256, tile = 0.25 } = {}) {
  const key = JSON.stringify(['win', seed, cols, rows, warmth, size]);
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const rng = makeRNG(seed);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  const cw = size / cols, ch = size / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const r = rng.f();
      if (r > 0.52) continue; // dark / shuttered
      const lit = 0.35 + Math.pow(rng.f(), 1.6) * 0.95;
      const warm = rng.f() < warmth;
      const col = warm
        ? `rgba(255,${180 + rng.f() * 50 | 0},${110 + rng.f() * 60 | 0},${lit})`
        : `rgba(${120 + rng.f() * 60 | 0},${230 + rng.f() * 25 | 0},${200 + rng.f() * 40 | 0},${lit})`;
      const x = i * cw + cw * 0.22, y = j * ch + ch * 0.22;
      const w = cw * 0.56, h = ch * (rng.chance(0.15) ? 0.3 : 0.5);
      ctx.shadowColor = col; ctx.shadowBlur = cw * 0.5;
      ctx.fillStyle = col;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.16);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      ctx.shadowBlur = 0;
      if (rng.chance(0.22)) { // a broken pane: dark slash
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.6, y); ctx.lineTo(x + w * 0.75, y); ctx.lineTo(x + w * 0.18, y + h);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  const t = tex(c, { repeat: 1 });
  t.repeat.set(tile, tile);      // one window grid per ~13.6 m of wall
  cache.set(key, t);
  return t;
}

/** Branching bioluminescent veins that creep up walls and out of the water. */
export function veinEmissive(seed, { size = 512, hue = 168, sat = 88, light = 62, dens = 16, thickness = 2.4 } = {}) {
  const key = JSON.stringify(['vein', seed, hue, sat, light, dens, thickness, size]);
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const rng = makeRNG(seed);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const col = (a) => `hsla(${hue + rng.range(-14, 14)},${sat}%,${light}%,${a})`;

  const grow = (x, y, ang, len, w, depth) => {
    if (depth > 7 || w < 0.35 || len < 3) return;
    const steps = Math.max(2, Math.round(len / 9));
    let px = x, py = y, a = ang;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let i = 0; i < steps; i++) {
      a += rng.range(-0.42, 0.42);
      px += Math.cos(a) * len / steps;
      py += Math.sin(a) * len / steps;
      ctx.lineTo(px, py);
      if (rng.chance(0.22)) {
        grow(px, py, a + rng.sign() * rng.range(0.6, 1.4), len * rng.range(0.35, 0.6), w * 0.6, depth + 1);
      }
    }
    ctx.shadowColor = col(1); ctx.shadowBlur = 14 + w * 3;
    ctx.strokeStyle = col(0.85); ctx.lineWidth = Math.max(0.4, w);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  for (let i = 0; i < dens; i++) {
    const x = rng.f() * size;
    const y = rng.chance(0.72) ? size + 4 : rng.range(0.3, 1) * size; // mostly rooted at the bottom
    grow(x, y, -Math.PI / 2 + rng.range(-0.5, 0.5), size * rng.range(0.35, 0.8), rng.range(1.4, thickness * 1.8), 0);
  }
  const t = tex(c, { repeat: 1 });
  t.repeat.set(0.2, 0.2);        // a vein tile spans ~17 m of stone
  cache.set(key, t);
  return t;
}

/** Glowing market sigils painted on stone. */
export function runeEmissive(seed, { size = 512, hue = 40, count = 90 } = {}) {
  const key = JSON.stringify(['rune', seed, hue, count, size]);
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const rng = makeRNG(seed);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  for (let i = 0; i < count; i++) {
    const ang = rng.f() * Math.PI * 2;
    const rad = Math.pow(rng.f(), 0.6) * size * 0.44;
    const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rng.f() * Math.PI * 2);
    const s = rng.range(6, 20);
    const col = `hsla(${hue + rng.range(-16, 24)},${90}%,${62 + rng.f() * 12}%,${rng.range(0.35, 1)})`;
    ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.strokeStyle = col; ctx.lineWidth = rng.range(1.2, 2.8);
    ctx.beginPath();
    const segs = rng.int(2, 5);
    for (let s2 = 0; s2 < segs; s2++) {
      ctx.moveTo(rng.range(-s, s) * 0.5, rng.range(-s, s) * 0.5);
      ctx.lineTo(rng.range(-s, s) * 0.5, rng.range(-s, s) * 0.5);
    }
    ctx.stroke();
    if (rng.chance(0.3)) { ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  const t = tex(c, { repeat: 1 });
  t.repeat.set(0.35, 0.35);      // rune-work covers ~10 m of stone
  cache.set(key, t);
  return t;
}

/* ───────────────────────── fabric (awnings, banners, sails) ───────────────────────── */

export function fabricMap(seed, colA = '#a8443c', colB = '#e8d9b8', { size = 256, stripes = 7 } = {}) {
  const key = JSON.stringify(['fab', seed, colA, colB, stripes, size]);
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const rng = makeRNG(seed);
  ctx.fillStyle = colB; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size; i++) {
    const t = i / size;
    const band = Math.sin(t * Math.PI * 2 * stripes);
    if (band > 0) {
      ctx.fillStyle = colA;
      ctx.globalAlpha = 0.55 + 0.45 * Math.abs(band);
      ctx.fillRect(i, 0, 1, size);
    }
  }
  ctx.globalAlpha = 1;
  // weave + fading
  const img = ctx.getImageData(0, 0, size, size);
  const n = makeFbm(seed + 3, 8, 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const k = 0.72 + n(x / size, y / size) * 0.55 + (Math.sin(y * 1.7) * 0.03);
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
  for (let s = 0; s < 10; s++) {
    ctx.fillStyle = `rgba(30,26,22,${rng.range(0.05, 0.22)})`;
    ctx.beginPath();
    ctx.ellipse(rng.f() * size, rng.f() * size, rng.range(8, 40), rng.range(6, 30), rng.f() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

/* ───────────────────────── water & post-processing helpers ───────────────────────── */

/** Screen-space paper grain for the watercolour pass (linear filtering, no srgb). */
export function paperTexture(seed = 11, size = 512) {
  const key = 'paper' + seed + size;
  if (cache.has(key)) return cache.get(key);
  const data = new Uint8Array(size * size * 4);
  const n1 = makeFbm(seed, 4, 5);
  const n2 = makeFbm(seed + 17, 32, 3);
  const rng = makeRNG(seed + 5);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const fiber = Math.sin(v * size * 0.9 + n1(u, v) * 6) * 0.02;
    let g = 0.72 + n1(u, v) * 0.34 + n2(u, v) * 0.16 + fiber;
    g += (rng.f() - 0.5) * 0.05;
    const i = (y * size + x) * 4;
    const b = Math.max(0, Math.min(255, g * 255));
    data[i] = data[i + 1] = data[i + 2] = b; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Radial ripple alpha for footsteps in water. */
export function rippleTexture(seed = 3, size = 128) {
  const key = 'ripple' + seed + size;
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * (0.2 + i * 0.13), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190,255,240,${0.5 - i * 0.13})`;
    ctx.lineWidth = 2.5 - i * 0.5;
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(190,255,240,0.18)');
  g.addColorStop(1, 'rgba(190,255,240,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

/** Soft round sprite used for motes, sparks, ghost crowds. */
export function glowSprite(seed = 1, size = 128, hue = 165, soft = 1) {
  const key = `glow${seed}${size}${hue}${soft}`;
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `hsla(${hue},100%,86%,1)`);
  g.addColorStop(0.22, `hsla(${hue},96%,72%,${0.55 * soft})`);
  g.addColorStop(0.55, `hsla(${hue},92%,58%,${0.14 * soft})`);
  g.addColorStop(1, `hsla(${hue},90%,50%,0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

/** Fuzzy humanoid silhouette used for the crowds that come back with a memory. */
export function crowdSprite(seed = 9, size = 128, hue = 34) {
  const key = 'crowd' + seed + size + hue;
  if (cache.has(key)) return cache.get(key);
  const c = cv(size), ctx = c.getContext('2d');
  const rng = makeRNG(seed);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  void rng;
  const body = ctx.createLinearGradient(0, size * 0.15, 0, size);
  body.addColorStop(0, `hsla(${hue},70%,72%,0.0)`);
  body.addColorStop(0.35, `hsla(${hue},72%,66%,0.55)`);
  body.addColorStop(1, `hsla(${hue},70%,52%,0.0)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx, size * 0.12);
  ctx.quadraticCurveTo(cx + size * 0.26, size * 0.4, cx + size * 0.2, size * 0.98);
  ctx.lineTo(cx - size * 0.2, size * 0.98);
  ctx.quadraticCurveTo(cx - size * 0.26, size * 0.4, cx, size * 0.12);
  ctx.fill();
  ctx.fillStyle = `hsla(${hue},80%,80%,0.7)`;
  ctx.beginPath(); ctx.arc(cx, size * 0.14, size * 0.075, 0, Math.PI * 2); ctx.fill();
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] > 0) img.data[i + 3] *= 0.55 + rng.f() * 0.6;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c, { repeat: 1 });
  cache.set(key, t);
  return t;
}

export function clearTextureCache() { cache.clear(); }
