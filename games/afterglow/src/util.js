/* AFTERGLOW — small math / randomness / text helpers. No dependencies. */

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeIn = t => t * t * t;
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const approach = (v, target, delta) =>
  v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);

/* Deterministic RNG (mulberry32) so painted backdrops are stable per-seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashStr = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* Cheap value-noise for brushy silhouettes and wind fields. */
export function makeNoise1D(seed) {
  const r = rng(seed);
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i++) table[i] = r() * 2 - 1;
  return function noise(x) {
    const xi = Math.floor(x), t = x - xi;
    const a = table[xi & 255], b = table[(xi + 1) & 255];
    const s = t * t * (3 - 2 * t);
    return lerp(a, b, s);
  };
}
export function fbm1(noise, x, oct = 4, lac = 2, gain = 0.5) {
  let f = 1, amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += noise(x * f) * amp; norm += amp; f *= lac; amp *= gain; }
  return sum / norm;
}

export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const sign = Math.sign;

/* Text layout for the canvas dialogue boxes. */
export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const raw of String(text).split('\n')) {
    if (!raw) { out.push(''); continue; }
    const words = raw.split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; }
      else line = test;
    }
    out.push(line);
  }
  return out;
}

/* Wobbly hand-drawn line: segments offset by noise so strokes read as brushwork. */
export function roughLine(ctx, x1, y1, x2, y2, wobble = 1.4, seed = 1) {
  const n = makeNoise1D(seed);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.min(24, Math.round(len / 14)));
  const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
  ctx.moveTo(x1 + n(0) * wobble * nx, y1 + n(0) * wobble * ny);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const o = i === steps ? 0 : n(t * 7 + seed) * wobble;
    ctx.lineTo(lerp(x1, x2, t) + nx * o, lerp(y1, y2, t) + ny * o);
  }
}

export function roughEllipse(ctx, cx, cy, rx, ry, wobble = 1.2, seed = 3) {
  const n = makeNoise1D(seed);
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const w = 1 + n(i * 1.7 + seed) * (wobble / Math.max(rx, ry));
    const x = cx + Math.cos(a) * rx * w, y = cy + Math.sin(a) * ry * w;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

export const fmtPct = v => Math.round(v * 100) + '%';
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length) % arr.length];

/* Tiny predicate evaluator used by story `if:` guards. */
export function check(cond, G) {
  if (!cond) return true;
  if (cond.true) return !!G.flags[cond.true];
  if (cond.false) return !G.flags[cond.false];
  if (cond.minOil != null) return G.oil >= cond.minOil;
  if (cond.minChits != null) return G.chits >= cond.minChits;
  if (cond.trustAtLeast) {
    for (const k in cond.trustAtLeast) if ((G.trust[k] ?? 0) < cond.trustAtLeast[k]) return false;
    return true;
  }
  if (cond.trustAtMost) {
    for (const k in cond.trustAtMost) if ((G.trust[k] ?? 0) > cond.trustAtMost[k]) return false;
    return true;
  }
  if (cond.hasFlag) for (const f of cond.hasFlag) if (!G.flags[f]) return false;
  if (cond.noFlag) for (const f of cond.noFlag) if (G.flags[f]) return false;
  if (cond.ammo != null) return G.ammo >= cond.ammo;
  return true;
}

export function applyEffects(G, fx) {
  if (!fx) return [];
  const log = [];
  if (fx.set) for (const k in fx.set) { G.flags[k] = fx.set[k]; if (fx.set[k]) log.push({ kind: 'flag', k }); }
  if (fx.unset) for (const k of fx.unset) G.flags[k] = false;
  if (fx.oil) G.oil = clamp(G.oil + fx.oil, 0, G.oilMax);
  if (fx.chits) G.chits = Math.max(0, G.chits + fx.chits);
  if (fx.trust) for (const k in fx.trust) {
    G.trust[k] = clamp((G.trust[k] ?? 1) + fx.trust[k], 0, 4);
    log.push({ kind: 'trust', k, d: fx.trust[k] });
  }
  if (fx.ammo != null) G.ammo = Math.max(0, G.ammo + fx.ammo);
  if (fx.hp) G.hp = clamp(G.hp + fx.hp, 0, G.hpMax);
  if (fx.pell) G.pell = true;
  return log;
}
