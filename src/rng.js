// Seeded randomness + tileable value noise. Every run of Vaelune is the same city.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRNG(seed) {
  const r = mulberry32(seed);
  return {
    f: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length) % arr.length],
    chance: (p) => r() < p,
    sign: () => (r() < 0.5 ? -1 : 1),
    gauss: () => (r() + r() + r() + r() - 2) / 2,
  };
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Value noise that tiles when sampled with an integer period `mask+1`. */
export function tilingNoise(seed) {
  const rng = makeRNG(seed);
  const arr = new Float32Array(256 * 256);
  for (let i = 0; i < arr.length; i++) arr[i] = rng.f();
  const H = (x, y, mask) => arr[(((y & mask) << 8) | (x & mask))];
  return function (x, y, mask) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smooth(x - xi), v = smooth(y - yi);
    const a = H(xi, yi, mask), b = H(xi + 1, yi, mask);
    const c = H(xi, yi + 1, mask), d = H(xi + 1, yi + 1, mask);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}

/** Tileable fbm over uv in [0,1]; base period in cells (power of two). */
export function makeFbm(seed, basePeriod = 4, octaves = 5) {
  const n = tilingNoise(seed);
  return function (u, v) {
    let amp = 1, sum = 0, tot = 0, freq = basePeriod;
    for (let i = 0; i < octaves; i++) {
      sum += amp * n(u * freq, v * freq, freq - 1);
      tot += amp; amp *= 0.5; freq *= 2;
    }
    return sum / tot;
  };
}

export function hex2rgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
