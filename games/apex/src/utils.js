// Small math / random helpers shared across the game.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Framerate-independent exponential smoothing factor. */
export function smooth(t, dt) {
  return 1 - Math.pow(1 - t, dt * 60);
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed difference from a -> b, wrapped to [-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `current` toward `target` by at most `maxStep` radians. */
export function approachAngle(current, target, maxStep) {
  const d = angleDiff(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Deterministic PRNG (mulberry32) so a seed reproduces the same valley. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random helpers bound to a seedable generator. */
export function makeRandom(seed = 12345) {
  const rng = makeRng(seed);
  return {
    rng,
    range(lo, hi) {
      return lo + rng() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(lo + rng() * (hi - lo + 1));
    },
    pick(arr) {
      return arr[Math.floor(rng() * arr.length) % arr.length];
    },
    chance(p) {
      return rng() < p;
    },
    sign() {
      return rng() < 0.5 ? -1 : 1;
    },
  };
}

/** Cheap 2D value noise with smooth interpolation — used for terrain blotches. */
export function makeNoise(seed = 7) {
  const rand = makeRandom(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand.rng();

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const at = (gx, gy) => {
      const ix = ((gx % size) + size) % size;
      const iy = ((gy % size) + size) % size;
      return grid[iy * size + ix];
    };

    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}
