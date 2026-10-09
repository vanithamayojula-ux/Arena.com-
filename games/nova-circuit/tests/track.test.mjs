import test from 'node:test';
import assert from 'node:assert/strict';
import { tracks } from './helpers.mjs';
import { minClearance, worldPos } from '../src/track.js';

for (const t of tracks) {
  test(`${t.id}: lap length is race-sized`, () => {
    assert.ok(t.length > 8000 && t.length < 13000, `length ${t.length}`);
  });

  test(`${t.id}: circuit closes seamlessly`, () => {
    const a = t.sample(0), b = t.sample(t.length - 0.01);
    const d = Math.hypot(a.P[0] - b.P[0], a.P[1] - b.P[1], a.P[2] - b.P[2]);
    assert.ok(d < 0.5, `seam gap ${d}`);
    const dot = a.T[0] * b.T[0] + a.T[1] * b.T[1] + a.T[2] * b.T[2];
    assert.ok(dot > 0.99, `tangent mismatch ${dot}`);
    const du = a.U[0] * b.U[0] + a.U[1] * b.U[1] + a.U[2] * b.U[2];
    assert.ok(du > 0.97, `up mismatch ${du}`);
  });

  test(`${t.id}: frames are orthonormal and finite`, () => {
    for (let d = 0; d < t.length; d += 37) {
      const f = t.sample(d);
      const len = (v) => Math.hypot(v[0], v[1], v[2]);
      const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
      assert.ok(Math.abs(len(f.T) - 1) < 0.02 && Math.abs(len(f.U) - 1) < 0.02 && Math.abs(len(f.R) - 1) < 0.02, `non-unit frame at ${d}`);
      assert.ok(Math.abs(dot(f.T, f.U)) < 0.05 && Math.abs(dot(f.T, f.R)) < 0.05 && Math.abs(dot(f.U, f.R)) < 0.05, `skewed frame at ${d}`);
      assert.ok(Number.isFinite(f.P[0] + f.P[1] + f.P[2]) && f.w > 20, `bad sample at ${d}`);
    }
  });

  test(`${t.id}: track never passes through itself`, () => {
    const c = minClearance(t);
    assert.ok(c.distance > 100, `self-clearance ${c.distance}`);
  });

  test(`${t.id}: has pads and wrap-around sampling works`, () => {
    assert.ok(t.pads.some((p) => p.type === 'boost') && t.pads.some((p) => p.type === 'item'));
    const a = t.sample(123.4), b = t.sample(123.4 + t.length * 3);
    assert.ok(Math.abs(a.P[0] - b.P[0]) < 1e-3);
    const w = worldPos(t, 500, 10, 3);
    assert.equal(w.length, 3);
  });
}
