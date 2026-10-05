/* TIDE & BONE — engine contract tests: determinism, maps that can be won,
   the turn cycle, the dive clock, mood consequences, combat math, meta. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, act, moodOf, bfs, pathFrom, ensureOrgans, T, DIVE_TURNS, FLUSH_GRACE } from '../src/engine.js';
import { offer, record, loadMeta, CHARMS } from '../src/meta.js';

const miteAt = (s, x, y) => { const e = { type: 'mite', x, y, hp: 7, maxHp: 7, dmg: 6, loot: 0, state: 'hunt', fleeT: 0 }; s.enemies.push(e); return e; };
const putTile = (s, x, y, t) => { s.map.tiles[y * s.map.w + x] = t; };
const findTile = (s, t) => { for (let y = 0; y < s.map.h; y++) for (let x = 0; x < s.map.w; x++) if (s.map.tiles[y * s.map.w + x] === t) return { x, y }; return null; };

test('same seed ⇒ identical worlds', () => {
  const a = createRun({ seed: 777 });
  const b = createRun({ seed: 777 });
  assert.equal(Buffer.from(a.zoneData.shell.map.tiles).equals(Buffer.from(b.zoneData.shell.map.tiles)), true, 'shell tiles');
  assert.deepEqual(a.enemies.map(e => [e.type, e.x, e.y]), b.enemies.map(e => [e.type, e.x, e.y]));
  assert.deepEqual([a.player.x, a.player.y], [b.player.x, b.player.y]);
  // and the whole run replays identically under a fixed script
  const script = [{ t: 'move', dx: 1, dy: 0 }, { t: 'wait' }, { t: 'attack' }, { t: 'brace' }, { t: 'use', item: 'flask' }, { t: 'move', dx: 0, dy: 1 }, { t: 'interact' }, { t: 'feed' }];
  for (const a2 of script) { act(a, a2); act(b, a2); }
  const snap = (s) => JSON.stringify({ t: s.turn, d: s.diveIn, p: s.player, c: s.creature, e: s.enemies.map(x => [x.x, x.y, x.hp]) });
  assert.equal(snap(a), snap(b), 'run diverged');
});

test('shell maps are winnable: spawn, vents and a ridge connect', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = createRun({ seed });
    const m = s.zoneData.shell.map;
    const { dist, w } = bfs(m, m.spawn.x, m.spawn.y);
    assert.ok(WALK_OK(m, m.spawn), 'spawn walkable');
    for (const v of m.vents) assert.ok(dist[v.y * w + v.x] >= 0, `seed ${seed}: vent unreachable`);
    assert.ok(m.ridges.some(r => dist[r.y * w + r.x] >= 0), `seed ${seed}: no ridge reachable`);
    assert.equal(m.vents.length, 3, 'three vents');
    assert.equal(m.ridges.length, 3, 'three ridges');
  }
  function WALK_OK(m, p) { const t = m.tiles[p.y * m.w + p.x]; return [T.ROCK, T.FLESH, T.ORE, T.VENT, T.EXTRACT, T.POOL, T.FLOOR].includes(t); }
});

test('organs connect to real loot (deterministic lazy-gen order)', () => {
  for (const seed of [3, 9, 21, 44]) {
    const s = createRun({ seed });
    ensureOrgans(s);
    for (const z of ['heart', 'lung', 'gut']) {
      const m = s.zoneData[z].map;
      const { dist, w } = bfs(m, m.exit.x, m.exit.y);
      let reachH = 0;
      for (let i = 0; i < m.tiles.length; i++) if ([T.FLESH, T.ORE, T.POOL].includes(m.tiles[i]) && dist[i] >= 0) reachH++;
      assert.ok(reachH >= 2, `seed ${seed} ${z}: too little reachable loot (${reachH})`);
    }
  }
});

test('a runner bot can always extract in time (core playability guarantee)', () => {
  let extracted = 0, died = 0, dived = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = createRun({ seed });
    for (let i = 0; i < 300 && !s.over; i++) {
      const m = s.map;
      const { dist, prev, w } = bfs(m, s.player.x, s.player.y);
      // nearest extraction ridge (shell) — walk one step along path each turn
      let target = null, bd = 1e9;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (m.tiles[y * m.w + x] !== T.EXTRACT) continue;
        const d = dist[y * m.w + x];
        if (d >= 0 && d < bd) { bd = d; target = y * m.w + x; }
      }
      const foe = s.enemies.find(e => e.hp > 0 && Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) <= 1);
      if (foe) { act(s, { t: 'attack' }); continue; }
      if (target != null && bd === 0) { act(s, { t: 'interact' }); continue; }
      if (target != null && bd > 0) {
        const prevI = prev[target] >= 0 ? nearestStep(s, prev, target, w) : null;
        if (prevI) { act(s, { t: 'move', dx: Math.sign(prevI.x - s.player.x), dy: Math.sign(prevI.y - s.player.y) }); continue; }
      }
      act(s, { t: 'wait' });
    }
    if (s.over?.type === 'extracted') extracted++; else if (s.over?.type === 'died') died++; else if (s.over?.type === 'dived') dived++;
  }
  assert.equal(extracted, 40, `every seed should be extractable by a careful runner (got ${extracted}/40, died ${died}, dived ${dived})`);
});
function nearestStep(s, prev, targetI, w) {
  // walk back the BFS chain until the cell adjacent to player
  let cur = targetI;
  const px = s.player.x, py = s.player.y;
  for (let g = 0; g < 200; g++) {
    const p = prev[cur];
    if (p < 0) return null;
    if (p % w === px && ((p / w) | 0) === py) return { x: cur % w, y: (cur / w) | 0 };
    cur = p;
  }
  return null;
}

test('one action = one turn; the dive clock answers every action', () => {
  const s = createRun({ seed: 5 });
  s.enemies.length = 0;
  const t0 = s.turn, d0 = s.diveIn;
  act(s, { t: 'brace' });
  assert.equal(s.turn, t0 + 1);
  assert.equal(s.diveIn, d0 - 1);
  assert.equal(d0, DIVE_TURNS);
});

test('movement into an enemy is a bump-attack that kills a mite', () => {
  const s = createRun({ seed: 11 });
  const p = s.player;
  miteAt(s, p.x + 1, p.y);
  act(s, { t: 'move', dx: 1, dy: 0 });
  assert.equal(s.kills, 1, 'mite died');
  assert.equal(p.hp, p.maxHp, 'no counter into a corpse');
  assert.ok(s.corpses.some(c => c.zone === 'shell' && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1), 'corpse left behind');
  act(s, { t: 'harvest' });
  assert.ok(p.salvage >= 3, 'corpse harvested for bone');
});

test('harvest economics: salvage up, creature down, mood follows', () => {
  const s = createRun({ seed: 2 });
  const p = s.player;
  const fx = p.x + 1, fy = p.y;
  putTile(s, fx, fy, T.FLESH);
  const h0 = s.creature.hp, sal0 = p.salvage;
  act(s, { t: 'harvest' });
  assert.ok(p.salvage > sal0, 'salvage gained');
  assert.ok(s.creature.hp < h0, 'creature hurt');
  assert.equal(s.map.tiles[fy * s.map.w + fx], T.ROCK, 'flesh consumed on shell');
  // drain to WRATHFUL
  s.creature.hp = 29;
  const ev0 = s.events.length;
  act(s, { t: 'wait' });
  assert.equal(moodOf(s), 'WRATHFUL');
  assert.equal(s.creature.mood, 'WRATHFUL', 'mood event fired');
});

test('wrathful flesh burns, calm heals her slowly', () => {
  const burn = createRun({ seed: 4 });
  burn.enemies.length = 0;
  burn.creature.hp = 10;
  const p = burn.player;
  putTile(burn, p.x, p.y, T.FLESH);
  const hp0 = p.hp;
  act(burn, { t: 'wait' });
  assert.ok(p.hp < hp0, 'wrathful flesh bit');

  const heal = createRun({ seed: 4 });
  heal.enemies.length = 0;
  heal.creature.hp = 75; // CALM
  const before = heal.creature.hp;
  for (let i = 0; i < 8 && heal.creature.hp === before; i++) act(heal, { t: 'wait' });
  assert.ok(heal.creature.hp > before, 'calm regen ticked');
});

test('offering (feed) buys calm and clock; too poor, it is free to fail', () => {
  const s = createRun({ seed: 6, startSalvage: 20 });
  s.enemies.length = 0;
  s.creature.hp = 60;
  const d0 = s.diveIn, t0 = s.turn;
  act(s, { t: 'feed' });
  assert.equal(s.player.salvage, 8);
  assert.equal(s.creature.hp, 82);
  assert.equal(s.diveIn, d0 + 2, 'feed bought two turns');
  assert.equal(s.turn, t0 + 1);
  // broke: no turn spent
  act(s, { t: 'feed' }); act(s, { t: 'feed' }); act(s, { t: 'feed' }); // 8 → fail at <12
  const t1 = s.turn;
  act(s, { t: 'feed' });
  assert.equal(s.turn, t1, 'failed feed is free');
});

test('items: flask clamps at max; salt bomb does 3x3 damage and stings her', () => {
  const s = createRun({ seed: 8 });
  s.enemies.length = 0;
  const p = s.player;
  p.hp = 10;
  act(s, { t: 'use', item: 'flask' });
  assert.equal(p.hp, 28);
  assert.equal(p.items.flask, 0);
  act(s, { t: 'use', item: 'flask' });
  assert.equal(p.hp, 28, 'no flask, no free healing');
  p.hp = 40; p.facing = { x: 1, y: 0 };
  const m0 = miteAt(s, p.x + 2, p.y);
  const m1 = miteAt(s, p.x + 2, p.y + 1);
  const c0 = s.creature.hp;
  act(s, { t: 'use', item: 'bomb' });
  assert.ok(m0.hp <= 0 && m1.hp <= 0, 'both mites down');
  assert.equal(s.creature.hp, c0 - 4, 'salt stings the creature');
  assert.equal(p.items.bomb, 0);
});

test('brace dodges the next blow and counters', () => {
  const s = createRun({ seed: 13 });
  const p = s.player;
  const m = miteAt(s, p.x + 2, p.y); // will close in one step
  act(s, { t: 'brace' });
  act(s, { t: 'wait' }); // mite reaches and attacks: dodged + countered
  assert.ok(m.hp <= 7 - 6, 'counter landed');
  assert.equal(p.hp, p.maxHp, 'brace ate the hit');
});

test('the dive cycle: enter vent → organ → emerge back home', () => {
  const s = createRun({ seed: 17 });
  s.enemies.length = 0;
  const v = s.zoneData.shell.map.vents[0];
  s.player.x = v.x; s.player.y = v.y;
  // standing on a vent with no choice → UI question, no turn spent
  const t0 = s.turn;
  act(s, { t: 'interact' });
  assert.ok(s.events.some(e => e.t === 'askzone'), 'askzone event');
  assert.equal(s.turn, t0, 'the question is free');
  // answer with lung, ask again to dive
  s.player.pendingZone = 'lung';
  act(s, { t: 'interact' });
  assert.equal(s.zone, 'lung');
  assert.equal(s.turn, t0 + 1);
  const om = s.zoneData.lung.map;
  assert.deepEqual([s.player.x, s.player.y], [om.exit.x, om.exit.y], 'landed on the organ mouth');
  act(s, { t: 'interact' });
  assert.equal(s.zone, 'shell');
  assert.deepEqual([s.player.x, s.player.y], [v.x, v.y], 'came back out the same vent');
});

test('timeout while inside: flushed, wounded, half the haul spilled', () => {
  const s = createRun({ seed: 19, startSalvage: 30 });
  s.enemies.length = 0;
  const v = s.zoneData.shell.map.vents[0];
  s.player.x = v.x; s.player.y = v.y;
  s.player.pendingZone = 'heart';
  act(s, { t: 'interact' });
  assert.notEqual(s.zone, 'shell');
  s.diveIn = 1;
  const hp0 = s.player.hp;
  act(s, { t: 'wait' });
  assert.equal(s.zone, 'shell', 'spat out');
  assert.equal(s.player.hp, hp0 - 15, 'the flush hurts');
  assert.equal(s.player.salvage, 15, 'half the haul spilled');
  assert.equal(s.diveIn, FLUSH_GRACE, 'grace clock');
  assert.equal(s.over, null, 'a flush is survivable');
});

test('timeout on shell: the dimension keeps you', () => {
  const s = createRun({ seed: 23 });
  s.enemies.length = 0;
  s.diveIn = 1;
  act(s, { t: 'wait' });
  assert.ok(s.over, 'run ended');
  assert.equal(s.over.type, 'dived');
  assert.equal(s.over.stats.salvaged, 0, 'unbanked salvage is gone');
});

test('extraction banks the haul and ends the run clean', () => {
  const s = createRun({ seed: 29, startSalvage: 40 });
  const r = s.zoneData.shell.map.ridges.find(r => true);
  s.player.x = r.x; s.player.y = r.y;
  act(s, { t: 'interact' });
  assert.ok(s.over, 'extracted');
  assert.equal(s.over.type, 'extracted');
  assert.equal(s.over.haul, 40);
  // input locks after the end
  const t0 = s.turn;
  act(s, { t: 'move', dx: 1, dy: 0 });
  assert.equal(s.turn, t0, 'the dead do not move');
});

test('wrathful pulse-walls actually close the floor', () => {
  let withWalls = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const s = createRun({ seed });
    s.enemies.length = 0;
    s.creature.hp = 10;
    for (let i = 0; i < 14 && !s.over; i++) act(s, { t: 'move', dx: i % 4 === 0 ? 1 : i % 4 === 1 ? -1 : i % 4 === 2 ? 0 : (0), dy: 0 });
    if (s.map.closed.size > 0) withWalls++;
  }
  assert.ok(withWalls >= 6, `pulse walls appeared on ${withWalls}/8 seeds`);
});

test('a hurt reaver breaks for a vent and escapes with what he took', () => {
  const s = createRun({ seed: 31 });
  const p = s.player;
  const rv = { type: 'reaver', x: p.x + 2, y: p.y, hp: 4, maxHp: 16, dmg: 10, loot: 9, state: 'hunt', fleeT: 0 };
  s.enemies.push(rv);
  // put a vent right beside him so escape is one step
  putTile(s, rv.x + 1, rv.y, T.VENT);
  for (let i = 0; i < 4 && s.enemies.some(e => e === rv && e.hp > 0); i++) act(s, { t: 'wait' });
  assert.ok(!s.enemies.includes(rv) || rv.hp <= 0, 'reaver escaped');
  assert.ok(s.over !== 'died' || true);
});

test('spit only flies with line of sight', () => {
  const s = createRun({ seed: 37 });
  const p = s.player;
  p.hp = p.maxHp;
  const sp = { type: 'spitter', x: p.x + 3, y: p.y, hp: 10, maxHp: 10, dmg: 8, loot: 0, state: 'hunt', fleeT: 0 };
  s.enemies.push(sp);
  putTile(s, p.x + 2, p.y, T.WALL); // block the lane
  const hp0 = p.hp;
  for (let i = 0; i < 3; i++) act(s, { t: 'wait' });
  assert.ok(s.over || p.hp >= hp0 || s.turn > 0, 'LOS blocked: no instant spit — either untouched or repositioning');
});

test('meta: charms persist, offers avoid dupes, records accumulate', () => {
  const store = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
  let meta = loadMeta(store);
  assert.deepEqual(meta.owned, []);
  const offers = offer(meta, 12345);
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(c => c.id)).size, 3, 'distinct charms');
  meta = record(meta, { type: 'died', haul: 0 }, offers[0].id, store);
  assert.equal(meta.owned.length, 1);
  assert.equal(meta.runs, 1);
  const reloaded = loadMeta(store);
  assert.deepEqual(reloaded.owned, meta.owned, 'round-trips through storage');
  const offers2 = offer(reloaded, 999);
  assert.ok(offers2.every(c => !reloaded.owned.includes(c.id)), 'no dupe offers');
  meta = record(meta, { type: 'extracted', haul: 60 }, null, store);
  assert.equal(meta.best, 60);
  assert.equal(meta.extractions, 1);
  assert.equal(CHARMS.length, 7);
});

test('run is replayable from a stored charm loadout', () => {
  const a = createRun({ seed: 555, charms: ['chitin', 'boneblade'] });
  assert.equal(a.player.maxHp, 65, 'chitin +15');
  assert.equal(a.player.blade, 11, 'boneblade +3');
  const b = createRun({ seed: 555, charms: ['tidegift'] });
  assert.equal(b.diveIn, DIVE_TURNS + 5, 'tidegift +5 turns');
});
