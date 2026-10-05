// Small math / noise helpers shared across Emberfall. No DOM dependencies, so the
// same modules run headless under the screenshot rasteriser in tools/.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Deterministic PRNG (mulberry32) so scenes and the rasteriser agree on every prop.
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth pseudo-noise from a seed: cheap, deterministic, good enough for ridgelines.
export function noise1(seed, x) {
  const xi = Math.floor(x);
  const f = x - xi;
  const h = (n) => {
    let t = (n * 374761393 + seed * 668265263) | 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177) | 0;
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const a = h(xi);
  const b = h(xi + 1);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

// fbm-ish layered noise, returns [0,1]
export function fbm(seed, x, oct = 3, lac = 2.1, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise1(seed + i * 977, x * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

export const fmt = (n) => (Math.round(n * 10) / 10).toString();

// Parse "r,g,b" arrays or hex "#rgb"/"#rrggbb" to [r,g,b,a255] — used by the shot raster.
export function rgba(c, a) {
  if (Array.isArray(c)) return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a === undefined ? (c.length > 3 ? c[3] : 1) : a})`;
  return c;
}

export function hexToRgb(h) {
  let s = h.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
