// Track builder: turns a compact "turtle" description (straights, turns, climbs,
// loops, corkscrew rolls, pads) into a closed, arc-length-sampled ribbon with a
// full orientation frame (tangent / up / right) at every sample.
//
// Everything here is pure maths so the simulation, the renderer and the node
// tests all share the exact same track.

import { add, sub, mul, dot, cross, len, norm, clamp, smooth, rotate, rng } from './vec.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const SAMPLE_SPACING = 4;

// ---------------------------------------------------------------------------
// Turtle
// ---------------------------------------------------------------------------
class Turtle {
  constructor() {
    this.p = [0, 0, 0];
    this.f = [0, 0, -1];
    this.u = [0, 1, 0];
    this.pts = [[0, 0, 0]];
    this.cum = [0]; // path length at each point
    this.len = 0;
    this.marks = []; // pads / items / hazards, positioned by path length
    this.rolls = [];
    this.widths = [{ at: 0, w: 60 }];
    this.glue = [];
    this.tags = [];
  }
  advance(d) {
    this.p = add(this.p, mul(this.f, d));
    this.len += d;
    this.pts.push(this.p.slice());
    this.cum.push(this.len);
  }
  yaw(a) {
    // positive = turn right
    this.f = norm(rotate(this.f, this.u, -a));
  }
  pitch(a) {
    const r = cross(this.f, this.u);
    this.f = norm(rotate(this.f, r, a));
    this.u = norm(rotate(this.u, r, a));
  }
  straight(L) {
    const n = Math.max(1, Math.ceil(L / 90));
    for (let i = 0; i < n; i++) this.advance(L / n);
  }
  turn(deg, radius) {
    const a = Math.abs(deg) * DEG;
    const arc = a * radius;
    const n = Math.max(3, Math.ceil(arc / 55));
    const da = (Math.sign(deg) * a) / n;
    for (let i = 0; i < n; i++) {
      this.yaw(da / 2);
      this.advance(arc / n);
      this.yaw(da / 2);
    }
  }
  climb(deg, radius) {
    const a = Math.abs(deg) * DEG;
    const arc = a * radius;
    const n = Math.max(3, Math.ceil(arc / 55));
    const da = (Math.sign(deg) * a) / n;
    for (let i = 0; i < n; i++) {
      this.pitch(da / 2);
      this.advance(arc / n);
      this.pitch(da / 2);
    }
  }
  loop(radius, lateral = 130) {
    // Vertical circle that drifts sideways by `lateral` units over the turn
    // (a helix), so the exit lane clears the entry lane instead of crossing it.
    const arc = TAU * radius;
    const n = Math.ceil(arc / 40);
    const da = TAU / n;
    const r0 = cross(this.f, this.u);
    for (let i = 0; i < n; i++) {
      this.pitch(da / 2);
      this.advance(arc / n);
      this.p = add(this.p, mul(r0, lateral / n));
      this.pts[this.pts.length - 1] = this.p.slice();
      this.pitch(da / 2);
    }
  }
}

/**
 * Ops (all angles in degrees, positive yaw = right, positive climb = nose up):
 *  ['S', len]            straight
 *  ['T', deg, radius]    horizontal turn
 *  ['C', deg, radius]    climb / dive arc
 *  ['L', radius, side]   vertical loop (helical, drifts sideways by `side` units)
 *  ['R', turns, len]     corkscrew roll across a straight of `len`
 *  ['W', width]          set track width (blended smoothly)
 *  ['B', x]              boost pad (x in -1..1 across the track)
 *  ['J', x]              jump pad
 *  ['I', n]              item-pad row of n pads
 *  ['M', x]              mine
 *  ['G', 1|0]            start / stop "glue" (magnetic) section for loops
 */
export function runOps(ops) {
  const t = new Turtle();
  for (const op of ops) {
    const [k, a, b] = op;
    switch (k) {
      case 'S': t.straight(a); break; // optional 3rd element 'f' marks it solver-adjustable
      case 'T': t.turn(a, b); break;
      case 'C': t.climb(a, b); break;
      case 'L': t.loop(a, b ?? 130); break;
      case 'R': {
        const start = t.len;
        t.straight(b);
        t.rolls.push({ a: start, b: t.len, turns: a });
        break;
      }
      case 'W': t.widths.push({ at: t.len, w: a }); break;
      case 'B': t.marks.push({ type: 'boost', at: t.len, x: a ?? 0 }); break;
      case 'J': t.marks.push({ type: 'jump', at: t.len, x: a ?? 0 }); break;
      case 'I': t.marks.push({ type: 'item', at: t.len, n: a ?? 3 }); break;
      case 'M': t.marks.push({ type: 'mine', at: t.len, x: a ?? 0 }); break;
      case 'G':
        if (a) t.glue.push({ a: t.len, b: Infinity });
        else if (t.glue.length) t.glue[t.glue.length - 1].b = t.len;
        break;
      default: throw new Error('Unknown track op ' + k);
    }
  }
  return t;
}

// ---------------------------------------------------------------------------
// Closed centripetal Catmull-Rom, densely sampled
// ---------------------------------------------------------------------------
function crPoint(p0, p1, p2, p3, t) {
  const d = (a, b) => Math.max(Math.pow(len(sub(a, b)), 0.5), 1e-4);
  const t0 = 0;
  const t1 = t0 + d(p0, p1);
  const t2 = t1 + d(p1, p2);
  const t3 = t2 + d(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => add(mul(a, (tb - tt) / (tb - ta)), mul(b, (tt - ta) / (tb - ta)));
  const A1 = L(p0, p1, t0, t1);
  const A2 = L(p1, p2, t1, t2);
  const A3 = L(p2, p3, t2, t3);
  const B1 = L(A1, A2, t0, t2);
  const B2 = L(A2, A3, t1, t3);
  return L(B1, B2, t1, t2);
}

function densify(ctrl) {
  const n = ctrl.length;
  const out = [];
  const owner = []; // control-segment index per dense point
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    const segLen = len(sub(p2, p1));
    const m = Math.max(4, Math.ceil(segLen / 1.2));
    for (let j = 0; j < m; j++) {
      out.push(crPoint(p0, p1, p2, p3, j / m));
      owner.push(i);
    }
  }
  return { out, owner };
}

function boxBlur(arr, radius, wrap = true) {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += arr[wrap ? (i + k + n * 4) % n : clamp(i + k, 0, n - 1)];
    out[i] = s / (radius * 2 + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
export function buildTrack(def) {
  const turtle = runOps(def.ops);
  const total = turtle.len;

  // Close the circuit: spread the end gap evenly along the path (a tiny shear).
  const end = turtle.pts[turtle.pts.length - 1];
  const gap = sub(end, turtle.pts[0]);
  const closureGap = len(gap);
  const ctrl = [];
  for (let i = 0; i < turtle.pts.length - 1; i++) {
    ctrl.push(mul(sub(turtle.pts[i], mul(gap, turtle.cum[i] / total)), def.scale ?? 1));
  }

  // Dense spline -> uniform arc-length samples
  const { out: dense } = densify(ctrl);
  const dn = dense.length;
  const cumLen = new Float64Array(dn + 1);
  for (let i = 0; i < dn; i++) cumLen[i + 1] = cumLen[i] + len(sub(dense[(i + 1) % dn], dense[i]));
  const L0 = cumLen[dn];
  const N = Math.round(L0 / SAMPLE_SPACING);
  const ds = L0 / N;
  const P = new Float32Array(N * 3);
  {
    let j = 0;
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      while (cumLen[j + 1] < s) j++;
      const f = (s - cumLen[j]) / Math.max(cumLen[j + 1] - cumLen[j], 1e-9);
      const a = dense[j];
      const b = dense[(j + 1) % dn];
      P[i * 3] = a[0] + (b[0] - a[0]) * f;
      P[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
      P[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
    }
  }
  const pAt = (i) => {
    const k = ((i % N) + N) % N;
    return [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]];
  };

  // Tangents
  const T = new Float32Array(N * 3);
  const tAt = (i) => {
    const k = ((i % N) + N) % N;
    return [T[k * 3], T[k * 3 + 1], T[k * 3 + 2]];
  };
  for (let i = 0; i < N; i++) {
    const t = norm(sub(pAt(i + 1), pAt(i - 1)));
    T.set(t, i * 3);
  }

  // Parallel-transport the up vector around the loop (so loops/corkscrews
  // never flip), then remove the accumulated closure twist.
  const U = new Float32Array(N * 3);
  const up0 = Math.abs(tAt(0)[1]) > 0.98 ? [0, 0, -1] : [0, 1, 0];
  let u = norm(sub(up0, mul(tAt(0), dot(up0, tAt(0)))));
  U.set(u, 0);
  const transport = (uPrev, tPrev, tNext) => {
    const ax = cross(tPrev, tNext);
    const s = len(ax);
    let r = uPrev;
    if (s > 1e-9) r = rotate(uPrev, mul(ax, 1 / s), Math.atan2(s, dot(tPrev, tNext)));
    return norm(sub(r, mul(tNext, dot(r, tNext))));
  };
  for (let i = 1; i < N; i++) {
    u = transport(u, tAt(i - 1), tAt(i));
    U.set(u, i * 3);
  }
  const uEnd = transport(u, tAt(N - 1), tAt(0));
  const u0 = [U[0], U[1], U[2]];
  const twist = Math.atan2(dot(cross(uEnd, u0), tAt(0)), dot(uEnd, u0));

  // Per-sample bank angle: auto-bank into corners + authored corkscrew rolls.
  const frac = (at) => at / total;
  const bankRaw = new Float32Array(N);
  const kRaw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dT = mul(sub(tAt(i + 1), tAt(i - 1)), 1 / (2 * ds));
    const Ui = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]];
    const Ri = cross(tAt(i), Ui);
    kRaw[i] = dot(dT, Ri);
  }
  const kSm = boxBlur(kRaw, 10);
  const gain = (def.bank ?? 140) * (def.scale ?? 1);
  for (let i = 0; i < N; i++) bankRaw[i] = clamp(kSm[i] * gain, -0.75, 0.75);
  const bank = boxBlur(bankRaw, 12);
  for (let i = 0; i < N; i++) {
    const f = i / N;
    let roll = 0;
    for (const r of turtle.rolls) {
      const a = frac(r.a);
      const b = frac(r.b);
      if (f >= b) roll += r.turns * TAU;
      else if (f > a) roll += r.turns * TAU * smooth((f - a) / (b - a));
    }
    // closure twist correction spreads linearly over the lap
    const tw = (-twist * i) / N;
    bank[i] += roll + tw;
  }

  // Apply bank, build final frames + curvature
  const R = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const Ti = tAt(i);
    const Ub = [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]];
    const Rb = cross(Ti, Ub);
    const c = Math.cos(bank[i]);
    const s = Math.sin(bank[i]);
    const Un = norm([Ub[0] * c + Rb[0] * s, Ub[1] * c + Rb[1] * s, Ub[2] * c + Rb[2] * s]);
    U.set(Un, i * 3);
    R.set(cross(Ti, Un), i * 3);
  }
  const kR = new Float32Array(N);
  const kU = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dT = mul(sub(tAt(i + 1), tAt(i - 1)), 1 / (2 * ds));
    kR[i] = dot(dT, [R[i * 3], R[i * 3 + 1], R[i * 3 + 2]]);
    kU[i] = dot(dT, [U[i * 3], U[i * 3 + 1], U[i * 3 + 2]]);
  }
  const kRs = boxBlur(kR, 3);
  const kUs = boxBlur(kU, 3);

  // Width profile
  const W = new Float32Array(N);
  const wk = turtle.widths.map((w) => ({ f: frac(w.at), w: w.w }));
  const baseW = wk[0].w;
  for (let i = 0; i < N; i++) {
    const f = i / N;
    let w = baseW;
    for (let k = 0; k < wk.length; k++) {
      const cur = wk[k];
      const nxt = wk[k + 1];
      if (f >= cur.f) {
        w = cur.w;
        if (nxt && f < nxt.f) {
          const blend = clamp((f - cur.f) / 0.012, 0, 1); // ease into each new width
          const prev = k > 0 ? wk[k - 1].w : wk[wk.length - 1].w;
          w = prev + (cur.w - prev) * smooth(blend);
        } else if (!nxt) {
          const blend = clamp((f - cur.f) / 0.012, 0, 1);
          const prev = k > 0 ? wk[k - 1].w : baseW;
          w = prev + (cur.w - prev) * smooth(blend);
        }
      }
    }
    W[i] = w;
  }

  const glue = new Uint8Array(N);
  for (const g of turtle.glue) {
    const a = Math.floor(frac(g.a) * N);
    const b = Math.min(N, Math.ceil(frac(Math.min(g.b, total)) * N));
    for (let i = a; i < b; i++) glue[i] = 1;
  }

  const length = N * ds;
  const toS = (at) => ((at / total) * length + length) % length;

  // Pads & hazards
  const pads = [];
  const mines = [];
  for (const m of turtle.marks) {
    const s = toS(m.at);
    if (m.type === 'boost') pads.push({ type: 'boost', s, x: m.x, len: 26 });
    else if (m.type === 'jump') pads.push({ type: 'jump', s, x: m.x, len: 14 });
    else if (m.type === 'item') {
      const n = m.n;
      for (let k = 0; k < n; k++) pads.push({ type: 'item', s, x: n === 1 ? 0 : -0.6 + (1.2 * k) / (n - 1), len: 6 });
    } else if (m.type === 'mine') mines.push({ s, x: m.x });
  }

  const track = {
    def,
    id: def.id,
    name: def.name,
    N,
    ds,
    length,
    P,
    T,
    U,
    R,
    W,
    kR: kRs,
    kU: kUs,
    glue,
    pads,
    mines,
    closureGap,
    turtleLength: total,
    rolls: turtle.rolls.map((r) => ({ a: toS(r.a), b: toS(r.b), turns: r.turns })),
  };
  track.sample = makeSampler(track);
  return track;
}

/** Fast frame sampler. Returns a reused object (do not hold on to it). */
function makeSampler(tr) {
  const { N, ds, P, T, U, R, W, kR, kU, glue, length } = tr;
  const out = {
    s: 0,
    P: [0, 0, 0], T: [0, 0, 1], U: [0, 1, 0], R: [1, 0, 0],
    w: 60, kR: 0, kU: 0, glue: 0,
  };
  return function sample(dist, o = out) {
    let s = dist % length;
    if (s < 0) s += length;
    const f = s / ds;
    const i0 = Math.floor(f) % N;
    const i1 = (i0 + 1) % N;
    const t = f - Math.floor(f);
    const mix = (A, i, j, dst) => {
      dst[0] = A[i * 3] + (A[j * 3] - A[i * 3]) * t;
      dst[1] = A[i * 3 + 1] + (A[j * 3 + 1] - A[i * 3 + 1]) * t;
      dst[2] = A[i * 3 + 2] + (A[j * 3 + 2] - A[i * 3 + 2]) * t;
    };
    const norm3 = (v) => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      v[0] /= l; v[1] /= l; v[2] /= l;
    };
    mix(P, i0, i1, o.P);
    mix(T, i0, i1, o.T); norm3(o.T);
    mix(U, i0, i1, o.U); norm3(o.U);
    // right = T x U
    o.R[0] = o.T[1] * o.U[2] - o.T[2] * o.U[1];
    o.R[1] = o.T[2] * o.U[0] - o.T[0] * o.U[2];
    o.R[2] = o.T[0] * o.U[1] - o.T[1] * o.U[0];
    o.w = W[i0] + (W[i1] - W[i0]) * t;
    o.kR = kR[i0] + (kR[i1] - kR[i0]) * t;
    o.kU = kU[i0] + (kU[i1] - kU[i0]) * t;
    o.glue = glue[i0];
    o.s = s;
    return o;
  };
}

/** World-space position of a track-space coordinate. */
export function worldPos(track, dist, x, h, out = [0, 0, 0]) {
  const f = track.sample(dist);
  out[0] = f.P[0] + f.R[0] * x + f.U[0] * h;
  out[1] = f.P[1] + f.R[1] * x + f.U[1] * h;
  out[2] = f.P[2] + f.R[2] * x + f.U[2] * h;
  return out;
}

/**
 * Smallest world distance between two parts of the track that are far apart
 * along the lap. Used by tests to make sure loops and crossings clear each other.
 */
export function minClearance(track, minArc = 260) {
  const { N, ds, P } = track;
  const stride = 2;
  let best = Infinity;
  let where = [0, 0];
  const skip = Math.ceil(minArc / ds);
  for (let i = 0; i < N; i += stride) {
    for (let j = i + skip; j < N; j += stride) {
      const arc = Math.min(j - i, N - (j - i));
      if (arc < skip) continue;
      const d = Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]);
      if (d < best) {
        best = d;
        where = [i * ds, j * ds];
      }
    }
  }
  return { distance: best, at: where };
}

export { rng };
