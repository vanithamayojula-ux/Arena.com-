import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRace, run, aiRacers, tracks } from './helpers.mjs';
import { C, Race } from '../src/sim.js';

const human = (extra = {}) => ({ name: 'YOU', ship: 'viper', livery: 0, human: true, slot: 0, ...extra });

test('countdown holds ships on the grid, then GO', () => {
  const r = makeRace(0, { racers: [human(), ...aiRacers(3)] });
  run(r, C.COUNTDOWN - 0.3);
  assert.equal(r.state, 'countdown');
  assert.ok(r.ships.every((s) => s.vs === 0 && s.dist < 0));
  run(r, 0.5);
  assert.equal(r.state, 'racing');
  assert.ok(r.drain().some((e) => e.type === 'go'));
});

test('a perfect launch (boost held through the countdown) gives a head start', () => {
  const mk = (hold) => {
    const r = makeRace(0, { racers: [human()], mode: 'trial' });
    const s = r.ships[0];
    for (let i = 0; i < 60 * 3.02; i++) { s.input.boost = hold && i > 60 * 2.4; r.step(1 / 60); }
    run(r, 0.6, 1 / 60, () => { s.input.boost = false; });
    return s.dist;
  };
  assert.ok(mk(true) > mk(false) + 20);
});

test('flooding the engine (boost held far too early) stalls the launch', () => {
  const r = makeRace(0, { racers: [human()], mode: 'trial' });
  const s = r.ships[0];
  for (let i = 0; i < 60 * 3.1; i++) { s.input.boost = true; r.step(1 / 60); }
  assert.ok(s.stall > 0 || s.vs < 100);
});

for (let ti = 0; ti < tracks.length; ti++) {
  test(`all-AI race completes on ${tracks[ti].id}`, () => {
    const r = makeRace(ti, { laps: 2 });
    run(r, 200, 1 / 30, () => {});
    assert.ok(r.ships.filter((s) => s.finished).length >= 4, 'most AI should finish within 200s');
    assert.ok(r.order[0].finished);
    const evs = r.drain();
    assert.ok(evs.some((e) => e.type === 'lap'));
  });
}

test('race results are produced once all humans finish', () => {
  const r = makeRace(0, { laps: 1, racers: [human({ skill: 0.9 }), ...aiRacers(3)] });
  const h = r.ships[0];
  h.ai = true; h.human = true; // let the autopilot drive our "human" for the test
  run(r, 160, 1 / 30);
  assert.equal(r.state, 'finished');
  assert.ok(r.results.length === 4);
  assert.deepEqual(r.results.map((x) => x.place), [1, 2, 3, 4]);
});

test('sim is deterministic for a given seed', () => {
  const snap = (seed) => {
    const r = makeRace(1, { seed, laps: 1 });
    run(r, 40, 1 / 60);
    return r.ships.map((s) => [s.dist.toFixed(3), s.x.toFixed(3), s.hp, s.ammo, s.kills].join(',')).join('|');
  };
  assert.equal(snap(5), snap(5));
  assert.notEqual(snap(5), snap(6));
});

test('lasers heat up, overheat, and cool down', () => {
  const r = makeRace(0, { racers: [human()], instantStart: true });
  const s = r.ships[0];
  run(r, 0.1);
  s.input.fire = true;
  let over = false;
  run(r, 9, 1 / 60, () => { s.input.fire = true; if (s.overheated) over = true; });
  assert.ok(over, 'cannon should overheat when held down');
  s.input.fire = false;
  run(r, 6, 1 / 60, () => { s.input.fire = false; });
  assert.ok(!s.overheated && s.heat < 30);
});

test('lasers damage a ship in front', () => {
  const r = makeRace(0, { racers: [human(), { name: 'DUMMY', ship: 'viper', livery: 2, skill: 0.1 }], instantStart: true });
  const [a, b] = r.ships;
  run(r, 0.1);
  b.ai = false; b.autopilot = false; // sitting duck
  a.dist = 100; b.dist = 160; a.x = b.x = 0; a.vs = b.vs = 0;
  const hp0 = b.hp;
  for (let i = 0; i < 90; i++) { a.input.fire = true; a.dist = 100; b.dist = 160; a.vs = 100; b.vs = 100; b.x = 0; a.x = 0; r.step(1 / 60); }
  assert.ok(b.hp < hp0, `target hp ${b.hp} should drop from ${hp0}`);
});

test('missiles lock on and kill; kills respawn the victim and credit the killer', () => {
  const r = makeRace(0, { racers: [human({ ship: 'razor' }), { name: 'DUMMY', ship: 'razor', livery: 2, skill: 0.1 }], instantStart: true });
  const [a, b] = r.ships;
  run(r, 0.1);
  b.ai = false; b.hp = 30; a.ammo = 5;
  const kills = [];
  let fired = false;
  for (let i = 0; i < 60 * 8; i++) {
    a.dist = 100; b.dist = 200; a.x = b.x = 0; a.vs = b.vs = 80;
    if (a.locked && !fired) { a.input.missile = true; fired = true; }
    r.step(1 / 60);
    for (const e of r.drain()) if (e.type === 'kill') kills.push(e);
    if (kills.length) break;
  }
  assert.ok(fired, 'lock-on should be achieved');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].killer, a);
  assert.equal(a.kills, 1);
  assert.ok(!b.alive);
  run(r, C.RESPAWN + 0.5);
  assert.ok(b.alive, 'victim respawns');
});

test('dodging makes a ship evade missiles', () => {
  const r = makeRace(0, { racers: [human(), { name: 'DUMMY', ship: 'viper', livery: 2 }], instantStart: true });
  const [a, b] = r.ships;
  run(r, 0.1);
  b.ai = false;
  const ev = [];
  b.dodgeT = 0.3;
  r.applyHit(b, { dmg: 40, kind: 'missile', by: a });
  assert.equal(b.hp, b.hpMax);
  for (const e of r.drain()) ev.push(e.type);
  assert.ok(ev.includes('evade'));
});

test('shield absorbs most damage', () => {
  const r = makeRace(0, { racers: [human()], instantStart: true });
  const s = r.ships[0];
  run(r, 0.1);
  s.invuln = 0; s.shield = 5;
  r.applyHit(s, { dmg: 40, kind: 'missile' });
  assert.ok(s.hpMax - s.hp <= 9);
});

test('item pads grant pickups', () => {
  const r = makeRace(0, { racers: [human()], instantStart: true });
  const s = r.ships[0];
  const pad = r.pads.find((p) => p.type === 'item');
  s.dist = pad.s - 30; s.vs = 150; s.x = pad.x * (r.track.sample(pad.s).w / 2 - 6);
  const got = [];
  for (let i = 0; i < 120; i++) { s.x = pad.x * (r.track.sample(pad.s).w / 2 - 6); r.step(1 / 60); for (const e of r.drain()) if (e.type === 'pickup') got.push(e); }
  assert.ok(got.length >= 1);
});

test('boost pad accelerates beyond boost speed; boost drains energy', () => {
  const r = makeRace(0, { racers: [human()], mode: 'trial', instantStart: true });
  const s = r.ships[0];
  run(r, 4, 1 / 60, () => { s.input.boost = false; });
  const cruise = s.vs;
  s.energy = 100;
  run(r, 2, 1 / 60, () => { s.input.boost = true; });
  assert.ok(s.vs > cruise + 40, `boost speed ${s.vs} vs ${cruise}`);
  assert.ok(s.energy < 100);
});

test('walls hurt only mildly and ships stay on the track surface', () => {
  const r = makeRace(0, { racers: [human()], mode: 'trial', instantStart: true });
  const s = r.ships[0];
  run(r, 20, 1 / 60, () => { s.input.steer = 1; s.input.boost = false; });
  const hw = r.track.sample(s.dist).w / 2;
  assert.ok(Math.abs(s.x) <= hw + 0.5, 'ship contained by rails');
  assert.ok(s.alive);
});

test('ghost ships follow network state', () => {
  const r = new Race({ track: tracks[0], racers: [human({ id: 'me' }), { name: 'REMOTE', ship: 'viper', livery: 3, human: true, remote: true, id: 'them', owner: 'them' }], laps: 2, seed: 1, instantStart: true });
  run(r, 0.1);
  const g = r.ships[1];
  g.net = { dist: 400, x: 10, h: 2.4, vs: 250, vx: 0, vh: 0, boost: 0, shield: 0, invuln: 0, dodge: 0, hp: 80, hpMax: 100, alive: true, finished: false, finishTime: Infinity, lap: 1, kills: 2, stun: 0, at: r.clock };
  run(r, 1);
  assert.ok(g.dist > 380 && g.dist < 700);
  assert.equal(g.hp, 80);
  assert.equal(g.kills, 2);
});

test('hits on remote ships are emitted for the owner instead of applied', () => {
  const r = new Race({ track: tracks[0], racers: [human({ id: 'me' }), { name: 'REMOTE', ship: 'viper', livery: 3, human: true, remote: true, id: 'them' }], laps: 2, seed: 1, instantStart: true });
  run(r, 0.1); r.drain();
  const g = r.ships[1];
  r.hit(g, { dmg: 10, by: r.ships[0], kind: 'laser' });
  const ev = r.drain();
  assert.ok(ev.some((e) => e.type === 'netHit' && e.target === g));
  const hp = r.ships[0].hp;
  r.applyRemoteHit('me', { dmg: 12, by: 'them', kind: 'laser', stun: 0, slow: 1 });
  assert.equal(r.ships[0].hp, hp - 12);
});
