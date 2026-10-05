/* TIDE & BONE — boot test: the actual entry point (main.js) on a stubbed DOM.
   Title → run → keys move → vent picker → pause → death → charm pick →
   restart. Render pipeline runs every frame; a crash anywhere lands in the
   open (boot() re-throws through the frame pump). */

import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, makeCtx } from './helpers.mjs';

const dom = installDom();
const { boot } = await import('../src/main.js');
const R = await import('../src/render.js');
const E = await import('../src/engine.js');

const app = boot();
assert.equal(app.mode, 'title', 'boots to the title screen');

test('render smoke: draw every zone + fx without a hiccup', () => {
  const canvas = dom.els.get('game') || document.getElementById('game');
  const st = E.createRun({ seed: 3 });
  const rend = R.makeRenderer(canvas, st);
  rend.consumeEvents([{ t: 'shake', mag: 4 }, { t: 'float', x: 2, y: 2, text: '+5' }, { t: 'blast', x: 3, y: 3 }, { t: 'tracer', x0: 1, y0: 1, x1: 3, y1: 3 }, { t: 'hurt', n: 5 }, { t: 'heal', n: 3 }, { t: 'slide', kind: 'dive' }]);
  for (const z of ['shell', 'heart', 'lung', 'gut']) {
    if (z !== 'shell') { E.ensureOrgans(st); st.zone = z; st.map = st.zoneData[z].map; st.enemies = st.zoneData[z].enemies; }
    for (let i = 0; i < 3; i++) rend.draw(st, 0.05);
  }
});

test('begin button starts a live run with HUD synced', () => {
  document.getElementById('btnBegin').click();
  assert.equal(app.mode, 'play');
  assert.ok(app.state, 'state live');
  assert.equal(app.state.turn, 0);
  dom.pump(3);
  assert.equal(document.getElementById('diveCount').textContent, String(Math.max(0, app.state.diveIn)));
});

test('keys spend turns and the dive clock ticks', () => {
  const s = app.state;
  s.enemies.length = 0; // deterministic: march in peace
  const t0 = s.turn;
  for (const k of ['KeyD', 'KeyD', 'KeyS', 'KeyA', 'KeyW']) dom.key(k);
  assert.equal(s.turn, t0 + 5, 'five moves, five turns');
});

test('standing on a vent asks for a zone; picking one descends', () => {
  const s = app.state;
  const v = s.zoneData.shell.map.vents[0];
  s.player.x = v.x; s.player.y = v.y;
  dom.key('KeyE');
  assert.ok(document.getElementById('zonePicker').classList.contains('on'), 'picker shown');
  const btn = document.getElementById('zonePicker').children.find(c => c.className === 'zp-btn zp-gut');
  assert.ok(btn, 'gut button rendered');
  btn.click();
  assert.notEqual(s.zone, 'shell', 'descended');
  dom.pump(2);
  // climb back out
  dom.key('KeyE');
  assert.equal(s.zone, 'shell', 'emerged');
});

test('pause freezes input, Escape unfreezes', () => {
  const t0 = app.state.turn;
  dom.key('Escape');
  assert.equal(app.paused, true);
  dom.key('KeyD');
  assert.equal(app.state.turn, t0, 'no turns while paused');
  dom.key('Escape');
  assert.equal(app.paused, false);
  dom.key('KeyD');
  assert.equal(app.state.turn, t0 + 1, 'turns again');
});

test('death flow: wound → game over screen → charm pick → restart', () => {
  const s = app.state;
  s.enemies.length = 0;
  s.player.hp = 1;
  const foe = { type: 'mite', x: s.player.x + 2, y: s.player.y, hp: 7, maxHp: 7, dmg: 6, loot: 0, state: 'hunt', fleeT: 0 };
  s.enemies.push(foe);
  for (let i = 0; i < 6 && !s.over; i++) dom.key('KeyG'); // wait into the mite
  assert.ok(s.over, 'the mite finished us');
  dom.pump(2);
  assert.equal(app.mode, 'over', 'over screen state');
  assert.ok(document.getElementById('overScreen').classList.contains('on'), 'over screen shown');
  const title = document.getElementById('overTitle').textContent;
  assert.match(title, /DIED|LOST TO THE DEEP|EXTRACTED/);
  const offerBtns = document.getElementById('charmOffer').children.filter(c => (c.className || '') === 'charm-btn');
  assert.equal(offerBtns.length, 3, 'three charm offers');
  offerBtns[0].click();
  assert.equal(document.getElementById('overGo').disabled, false, 'continue unlocked after picking');
  const stored = JSON.parse(localStorage.getItem('tidebone-meta-v1'));
  assert.equal(stored.owned.length, 1, 'charm persisted to storage');
  document.getElementById('overGo').click();
  assert.equal(app.mode, 'title', 'back to title');
  document.getElementById('btnBegin').click();
  assert.equal(app.mode, 'play', 'and a fresh run starts');
  assert.notEqual(app.state, s, 'new state object');
});

test('frames after restart still render (loop never wedged)', () => {
  dom.pump(10);
  assert.equal(app.mode, 'play');
});
