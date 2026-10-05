/* AFTERGLOW — boots the real entry point (the same src/main.js index.html loads)
   against a minimal DOM stub, then pumps frames and simulates play. Catches
   wiring errors that data tests cannot see. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers.mjs';

const dom = installDom();

function key(code, type = 'keydown') {
  const evs = dom.listeners[type] || [];
  for (const fn of evs) fn({ code, preventDefault() { } });
}
const tap = code => { key(code, 'keydown'); key(code, 'keyup'); };
const release = (...codes) => { for (const c of codes) key(c, 'keyup'); };
const hold = (code, frames, dom) => { for (let i = 0; i < frames; i++) { key(code, 'keydown'); dom.pump(1); } release(code); };

const app = await (async () => {
  const { boot } = await import('../src/main.js');
  return boot();
})();

test('boots into the title screen without throwing', () => {
  assert.ok(app, 'app boots');
  assert.equal(app.inMenu, true, 'title menu');
  dom.pump(12);
  assert.ok(!app.__errored, 'frame error: ' + (app.__errored && app.__errored.stack));
});

test('menu → prologue card → camp scene runs through frames', () => {
  // start the tour
  app.title.ci = 0;
  app.title.activate();
  assert.equal(app.inMenu, false);
  for (let i = 0; i < 40 && !(app.overlay && app.overlay.kind === 'card'); i++) dom.pump(1);
  assert.ok(app.overlay && app.overlay.kind === 'card', 'chapter card shows');
  // push through the card and the narrator intro
  for (let i = 0; i < 400; i++) { tap('Space'); dom.pump(2); if (app.scene) break; }
  dom.pump(5);
  assert.ok(app.scene, 'reached the camp scene');
  assert.ok(!app.__errored, 'frame error: ' + (app.__errored && app.__errored.stack));
});

test('walking + talking in the camp scene mutates state correctly', () => {
  const appG = app.G;
  assert.equal(appG.oil, 100, 'full oil at tour start');
  // walk right toward the troupe's embers and speak
  hold('KeyD', 220, dom);
  tap('KeyE');
  dom.pump(1);
  assert.ok(app.overlay && app.overlay.kind === 'talk', 'a conversation opens');
  // mash through the dialogue
  for (let i = 0; i < 160 && app.overlay; i++) { tap('Space'); dom.pump(1); }
  assert.ok(!app.overlay, 'dialogue closes');
  dom.pump(3);
  assert.ok(!app.__errored, 'frame error: ' + (app.__errored && app.__errored.stack));
});

test('leaving camp ends act 0 and saves a continue point', () => {
  // march to the exit marker
  hold('KeyD', 220, dom);
  tap('KeyE');
  for (let i = 0; i < 300 && app.G.act === 0; i++) { tap('Space'); dom.pump(1); }
  assert.ok(app.G.act >= 1 || !app.inMenu === false, 'act advanced');
  assert.equal(app.G.act, 1, 'next act is queued in save');
  const raw = JSON.parse(localStorage.getItem('afterglow-save-v1'));
  assert.equal(raw.act, 1, 'save pointer');
});

test('act 1 gate: negotiation mode can open and cycle', () => {
  // we are at the top of act 1 (title menu); launch via app API to keep the test focused
  app.playAct(1, false);
  for (let i = 0; i < 200 && !app.scene; i++) { tap('Space'); dom.pump(1); }
  dom.pump(3);
  assert.ok(app.scene, 'gate scene loaded');
  hold('KeyD', 260, dom);
  tap('KeyE');
  for (let i = 0; i < 600 && !(app.mini); i++) { tap('Space'); dom.pump(1); }
  assert.ok(app.mini && app.mini.constructor.name === 'NegotiateGame', 'Hask negotiation begins');
  // cycle the negotiation a bit; stop as soon as the stage tears down (it may resolve fully)
  for (let i = 0; i < 160 && (app.mini || app.scene || app.overlay); i++) { tap('Space'); tap('ArrowDown'); dom.pump(1); }
  app.toTitle();
  dom.pump(40);
  assert.ok(!app.__errored, 'frame error: ' + (app.__errored && app.__errored.stack));
});

test('a full perf beat can run headlessly', async () => {
  const { PerfGame } = await import('../src/minigames.js');
  const perf = new PerfGame(app, { members: ['miri'], bars: 4, every: 2, target: 0.55, pattern: ['ball', 'fire'] });
  app.overlay = null;
  app._flowDone = null;
  for (let i = 0; i < 900 && !perf.over; i++) {
    perf.update(1 / 60, { consume: k => (k === 'action' ? i % 14 === 0 : false), down: () => false });
  }
  assert.ok(perf.over, 'performance ends on schedule');
  assert.ok(['great', 'ok', 'poor'].includes(perf.resultKey), 'a result is reached');
});

test('pause menu opens and closes', () => {
  app.toTitle();
  dom.pump(40); // burn the menu grace
  app.playAct(0, true);
  for (let i = 0; i < 300 && !app.scene; i++) { tap('Space'); dom.pump(1); }
  tap('Escape');
  dom.pump(1);
  assert.equal(app.paused, true, 'paused');
  tap('Escape');
  dom.pump(1);
  assert.equal(app.paused, false, 'resumed');
});
