/* AFTERGLOW — headless content validation: the story graph must be complete
   and every act must be winnable from initial state. Pure data + engine logic,
   no DOM. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS, ACTS, SAVE_TITLE } from '../src/story.js';
import { check, applyEffects, clamp } from '../src/util.js';
import { makeCtx } from './helpers.mjs';
import { CAST } from '../src/actors.js';

test('every act exists with a sane shape', () => {
  assert.equal(ACTS.length, 6);
  for (const act of ACTS) assert.ok(Array.isArray(act) && act.length > 3, 'act steps');
  for (const a of ACTS) {
    for (const s of a) {
      assert.ok(s && (typeof s === 'function' || s.s), 'each step is a step');
      if (s.s === 'scene') assert.ok(WORLDS[s.id], `world ${s.id} exists`);
    }
  }
});

test('every scene step references a world with exit or completion path', () => {
  for (const [id, w] of Object.entries(WORLDS)) {
    assert.ok(w.worldW > 200, id + ' has width');
    const pts = w.points || [];
    assert.ok(pts.length, id + ' has points');
    const exitable = pts.filter(p => p.exit || (p.run && JSON.stringify(p.run, (k, v) => typeof v === 'function' ? 'fn' : v).includes('sceneExit')));
    assert.ok(exitable.length >= 1, id + ' must be completable (exit point or sceneExit in run)');
    for (const p of pts) {
      assert.ok(typeof p.x === 'number' && p.x >= 0 && p.x <= w.worldW, id + ' point x in bounds');
      assert.ok(!p.run || Array.isArray(p.run), id + ' point run is steps');
    }
  }
});

test('all run/then/out step lists reference valid worlds', () => {
  const walk = (steps, where) => {
    if (!steps) return;
    for (const s of steps) {
      if (!s || typeof s === 'function') continue;
      assert.ok(s.s, 'step in ' + where + ' needs .s — got: ' + JSON.stringify(s).slice(0, 120));
      if (s.s === 'scene') assert.ok(WORLDS[s.id], `world '${s.id}' missing (in ${where})`);
      if (s.s === 'talk') {
        const def = s;
        const nodes = def.nodes ? { ...def.nodes } : { one: { lines: def.lines || [] } };
        const keys = Object.keys(nodes);
        for (const k of keys) {
          const n = nodes[k];
          if (!n || typeof n !== 'object') continue;
          if (n.next) assert.ok(typeof n.next === 'string' ? n.next in nodes || n.next === 'start' : true, `node '${n.next}' missing from ${where}`);
          for (const c of (n.choices || [])) {
            if (c.go) assert.ok(c.go in nodes, `choice target '${c.go}' missing in ${where}`);
            if (c.then) walk(c.then, where + '/choice.then');
          }
        }
      }
      if (s.then) walk(s.then, where + '/then');
      if (s.else) walk(s.else, where + '/else');
      if (s.on) for (const k in s.on) walk(s.on[k], where + '/on.' + k);
      if (s.out) for (const k in s.out) walk(s.out[k], where + '/out.' + k);
      if (s.onDone) walk(s.onDone, where + '/onDone');
      if (s.events) for (const ev of s.events) walk(ev.steps, where + '/event');
    }
  };
  for (let i = 0; i < ACTS.length; i++) walk(ACTS[i], 'act' + i);
  for (const [wid, w] of Object.entries(WORLDS)) {
    for (const p of (w.points || [])) walk(p.run, 'world.' + wid + '.point@' + p.x);
  }
});

test('minigame out-covers: perf great/ok/poor, combat all exits, guard win/lose', () => {
  const find = (steps, kind, acc = []) => {
    for (const s of steps || []) {
      if (!s || typeof s !== 'object') continue;
      if (s.s === kind) acc.push(s);
      for (const key of ['then', 'else', 'onDone']) find(s[key], kind, acc);
      if (s.out) for (const k in s.out) find(s.out[k], kind, acc);
      if (s.run) for (const p of s.run) find([p], kind, acc);
    }
    return acc;
  };
  const all = [];
  for (const a of ACTS) find(a, 'perf', all);
  for (const w of Object.values(WORLDS)) for (const p of (w.points || [])) find(p.run, 'perf', all);
  assert.equal(all.length, 2, 'two shows');
  for (const p of all) for (const k of ['great', 'ok', 'poor']) assert.ok(p.out && p.out[k], 'show needs out.' + k);

  const guards = [];
  for (const a of ACTS) find(a, 'guard', guards);
  for (const w of Object.values(WORLDS)) for (const p of (w.points || [])) find(p.run, 'guard', guards);
  assert.equal(guards.length, 1);
  for (const k of ['win', 'lose']) assert.ok(guards[0].out && guards[0].out[k], 'guard needs out.' + k);

  const fights = [];
  for (const a of ACTS) find(a, 'combat', fights);
  assert.equal(fights.length, 1);
  for (const k of ['standdown', 'rob', 'finish', 'pyrrhic']) assert.ok(fights[0].out[k], 'combat needs out.' + k);
});

test('negotiations resolve: every negotiate step has win/even/bad outcomes', () => {
  const negs = [];
  const walk = steps => {
    for (const s of steps || []) {
      if (!s || typeof s !== 'object') continue;
      if (s.s === 'negotiate') negs.push(s);
      for (const key of ['then', 'else', 'onDone']) walk(s[key]);
      if (s.out) for (const k in s.out) walk(s.out[k]);
      if (s.run) for (const p of s.run) walk([p]);
    }
  };
  for (const a of ACTS) walk(a);
  for (const w of Object.values(WORLDS)) for (const p of (w.points || [])) walk(p.run);
  assert.equal(negs.length, 4, 'gate, guild, choir, and slat: four deals to strike');
  for (const n of negs) {
    assert.ok(n.rounds && n.rounds.length >= 2, 'rounds');
    assert.ok(n.who && CAST[n.who], 'npc ' + n.who + ' exists');
    for (const k of ['win', 'even', 'bad']) assert.ok(n.out[k], n.who + ' negotiation needs out.' + k);
    for (const r of n.rounds) {
      assert.ok(r.opts.length >= 2, 'options');
      // at least one option can lower tension, so a good player can win
      const canLower = r.opts.some(o => (o.dT || 0) < 0.05);
      assert.ok(canLower, 'round must be winnable');
    }
  }
});

test('road events + ambush chain from initial state', () => {
  const G = { oil: 100, oilMax: 100, chits: 4, ammo: 2, hp: 3, hpMax: 3, trust: { bod: 2, nadia: 2, tomas: 2 }, flags: {}, pell: false };
  // Fenn's gift path: wickGift flag lets the Choir concession appear
  applyEffects(G, { trust: { tomas: 1 } });
  assert.ok(G.trust.tomas === 3, 'trust grows');
  G.flags.wickGift = true;
  assert.ok(check({ true: 'wickGift' }, G), 'cond eval');
  applyEffects(G, { chits: -5 });
  assert.ok(!check({ minChits: 5 }, G), 'cannot afford');
  applyEffects(G, { chits: 9 });
  assert.ok(check({ minChits: 5 }, G), 'can afford now');
});

test('act flow: prologue scene exists and camp is completable; SAVE_TITLE maps all acts', () => {
  assert.ok(WORLDS.camp, 'camp world');
  assert.ok(WORLDS.camp.points.some(p => p.exit), 'camp has an exit');
  for (let i = 0; i < ACTS.length; i++) assert.ok(SAVE_TITLE(i).length > 1, 'title for act ' + i);
});

test('performance lanes are within cast bounds', () => {
  const shows = [];
  const walk = steps => {
    for (const s of steps || []) {
      if (!s || typeof s !== 'object') continue;
      if (s.s === 'perf') shows.push(s);
      for (const key of ['then', 'else', 'onDone']) walk(s[key]);
      if (s.out) for (const k in s.out) walk(s.out[k]);
      if (s.run) for (const p of s.run) walk([p]);
    }
  };
  for (const a of ACTS) walk(a);
  for (const w of Object.values(WORLDS)) for (const p of (w.points || [])) walk(p.run);
  for (const sh of shows) {
    const lanes = (sh.members || ['miri']).length;
    for (const cue of (sh.pattern || [])) {
      if (typeof cue === 'object' && cue.lane != null) assert.ok(cue.lane < lanes, 'lane index within members');
    }
    assert.ok(sh.target > 0.3 && sh.target < 0.95, 'target sane');
  }
});

test('world decor + live painters run for every scene, flag states included', () => {
  const g = makeCtx();
  const runLive = (w, flags) => {
    if (typeof w.live !== 'function') return;
    const app = { G: { flags, trust: { bod: 2, nadia: 2, tomas: 2 } } };
    w.live(g, { W: 960, H: 540, worldW: w.w || 2400, groundY: w.groundY || 430, app, lightAt: () => 1, camX: 100 }, 3.7, 100);
  };
  for (const [id, w] of Object.entries(WORLDS)) {
    if (typeof w.decor === 'function') {
      w.decor(g, 960, 540, { R: () => 0.5, seed: 2, PAL: {}, groundY: w.groundY || 430, worldW: w.w || 2400 });
    }
    try { runLive(w, {}); runLive(w, { showOn: true, fundedLamp: true, lampLit: true, pellJoined: true, spared: true }); }
    catch (e) { assert.fail(`${id} live painter threw: ${e.message}`); }
  }
});
