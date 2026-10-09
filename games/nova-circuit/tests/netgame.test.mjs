import test from 'node:test';
import assert from 'node:assert/strict';
import { tracks } from './helpers.mjs';
import { Race } from '../src/sim.js';
import { NetSession } from '../src/netgame.js';

// Two simulated clients wired together through an in-memory "relay".
function duel() {
  const specs = (me) => [
    { id: 'A', owner: 'A', name: 'ALPHA', ship: 'viper', livery: 0, human: true, remote: me !== 'A', slot: me === 'A' ? 0 : -1, grid: 0 },
    { id: 'B', owner: 'B', name: 'BRAVO', ship: 'razor', livery: 1, human: true, remote: me !== 'B', slot: me === 'B' ? 0 : -1, grid: 1 },
  ];
  const mk = (me) => new Race({ track: tracks[0], racers: specs(me), laps: 1, seed: 9, instantStart: true });
  const pipe = { queue: [] };
  const mkNet = (me) => ({ pid: me, send: (msg, to) => pipe.queue.push({ from: me, to, msg }), flush() {} });
  const ra = mk('A'), rb = mk('B');
  const na = new NetSession(ra, mkNet('A'), 'A'), nb = new NetSession(rb, mkNet('B'), 'B');
  const sess = { A: na, B: nb };
  const deliver = () => {
    const q = pipe.queue; pipe.queue = [];
    for (const { from, to, msg } of q) for (const id of ['A', 'B']) if (id !== from && (!to || to === id || (to === 'host' && id === 'A'))) sess[id].onMsg(from, msg);
  };
  const step = (n = 1) => { for (let i = 0; i < n; i++) { for (const [r, s] of [[ra, na], [rb, nb]]) { r.step(1 / 60); const ev = r.drain(); s.outgoing(ev); s.tick(1 / 60); r._ev = (r._ev || []).concat(ev); } deliver(); } };
  return { ra, rb, na, nb, step };
}

test('state packets keep ghosts in sync', () => {
  const { ra, rb, step } = duel();
  ra.ships[0].input.boost = true; rb.ships[1].input.boost = true;
  step(240);
  const ghostB = ra.ships[1], realB = rb.ships[1];
  assert.ok(Math.abs(ghostB.dist - realB.dist) < 25, `ghost lag ${ghostB.dist} vs ${realB.dist}`);
  assert.ok(realB.dist > 100);
});

test('lasers fired by one client damage the other (hit routed to the owner)', () => {
  const { ra, rb, step } = duel();
  step(5);
  const [a] = ra.ships; const real = rb.ships[1];
  const hp0 = real.hp;
  for (let i = 0; i < 180; i++) {
    // keep both ships side by side, A behind B so A's cannon aims at B
    for (const r of [ra, rb]) { const [x, y] = r.ships; x.vs = 100; y.vs = 100; x.dist = 100 + i; y.dist = 160 + i; x.x = y.x = 0; }
    a.input.fire = true;
    step(1);
  }
  assert.ok(real.hp < hp0, `B's own sim should have been damaged (${real.hp} < ${hp0})`);
  const remoteBullets = rb.bullets.length + (rb._ev || []).filter((e) => e.type === 'laser' && e.remote).length;
  assert.ok(remoteBullets > 0, 'B sees A\'s lasers');
});

test('kills are credited to the shooter and announced on both sides', () => {
  const { ra, rb, step } = duel();
  step(5);
  const real = rb.ships[1];
  real.hp = 5; real.invuln = 0;
  ra.applyHit; // (no-op reference)
  rb.applyRemoteHit('B', { dmg: 50, by: 'A', kind: 'missile', stun: 0, slow: 1 });
  step(5);
  assert.ok(!real.alive);
  assert.ok((ra._ev || []).some((e) => e.type === 'kill' && e.victim.id === 'B' && e.killer && e.killer.id === 'A'), 'A learns it scored a kill');
  assert.equal(ra.ships[0].kills, 1);
});

test('mines are replicated and removal is propagated', () => {
  const { ra, rb, step } = duel();
  step(5);
  const a = ra.ships[0];
  a.item = 'mines'; a.itemUses = 3; a.input.item = true;
  step(3);
  assert.ok(ra.mines.some((m) => m.rid), 'owner has an identified mine');
  assert.ok(rb.mines.some((m) => m.rid && m.owner === 'A'), 'other client got the mine');
  const m = ra.mines.find((q) => q.rid);
  const idx = ra.mines.indexOf(m);
  ra.explodeMine(m, idx, a); // e.g. shot down
  step(3);
  assert.ok(!rb.mines.some((q) => q.rid === m.rid), 'mine removed remotely');
});

test('a pilot leaving mid-race is dropped from the human list', () => {
  const { ra, na } = duel();
  na.playerLeft('B');
  assert.ok(ra.ships[1].left && !ra.ships[1].alive);
  assert.equal(ra.humans.length, 1);
});

test('race is force-ended 45s after the first pilot finishes', () => {
  const { ra, na } = duel();
  ra.step(1 / 60);
  assert.equal(ra.state, 'racing');
  ra.ships[1].finished = true; ra.ships[1].finishTime = 30;
  ra.ships[1].net = null;
  ra.time = 31;
  na.tick(0.01); // records first finish
  ra.time = 77;
  na.tick(0.01);
  assert.equal(ra.state, 'finished');
});
