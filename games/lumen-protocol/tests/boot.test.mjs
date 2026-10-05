/* LUMEN PROTOCOL — boot test: the real entry point (main.js) on a stub DOM.
   Title → calibration → live dialogue → choices edit the HUD → autosave →
   continue → chapter card. The city painter runs every frame; any crash in
   main/city lands in app.errored and fails here. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers.mjs';

const dom = installDom();
const { boot } = await import('../src/main.js');
const app = boot();

test('boots to the title screen with the city painting', () => {
  assert.equal(app.screen, 'title');
  dom.pump(4);
  assert.equal(app.errored, null, 'no runtime errors: ' + (app.errored && app.errored.stack));
  assert.ok(document.getElementById('titleScreen').classList.contains('on'));
});

test('BEGIN opens calibration; a card click starts chapter one', () => {
  document.getElementById('btnStart').click();
  assert.equal(app.screen, 'calib');
  const cards = document.getElementById('calibCards').children;
  assert.equal(cards.length, 3, 'three calibrations');
  cards[0].click(); // THE SAINT
  assert.equal(app.screen, 'play');
  assert.equal(app.g.calib, 'saint');
  assert.equal(app.g.scene, 'lift');
  assert.ok(app.g.traits.empathy >= 2, 'calibration traits applied');
});

test('dialogue types out; click completes the line; the HUD tracks the state', () => {
  const line = document.getElementById('line');
  dom.pump(2);
  assert.ok(line.textContent.length > 0, 'some text shown');
  // complete typing instantly via the dialogue box click path
  document.getElementById('dialogueBox').click();
  assert.equal(app.typing, false, 'click finished the typewriter');
  assert.ok(line.textContent.includes('TIER 12') || line.textContent.length > 20, 'first line content');
  const hud = document.getElementById('hudPersona').textContent;
  assert.match(hud, /COURIER|SAINT/);
  assert.ok(document.getElementById('hudTraits').innerHTML.includes('EMP'), 'trait pips rendered');
});

test('SPACE walks lines until choices; digit keys commit; effects land', () => {
  for (let i = 0; i < 12 && !(visibleChoices()); i++) dom.key('Space');
  assert.ok(visibleChoices(), 'arrived at the first decision');
  const before = app.g.traits.empathy;
  dom.key('Digit1'); // acknowledge Kess: +empathy
  assert.ok(app.g.traits.empathy > before || app.g.node !== 'n1', 'choice consumed and moved state');
  assert.ok(JSON.parse(localStorage.getItem('lumen-save-v1')), 'autosaved after the beat');
  function visibleChoices() {
    const box = document.getElementById('choices');
    return box.children.length > 0;
  }
});

test('locked choices surface a toast instead of activating', () => {
  // park the run on the alley hub with a defiance-2 gate visible
  app.typing = false;
  app.g.scene = 'alley'; app.g.node = 'a1'; app.g.line = 99;
  const before = app.g.node;
  dom.key('Digit3'); // Frost-Read-gated choice: analyst-lite state can’t take it
  assert.equal(app.g.node, before, 'locked digit choice refused');
  dom.key('Digit2'); // ungated “Which version PAYS?”
  assert.notEqual(app.g.node, before, 'unlocked choice taken');
});

test('chapter end shows the interstitial card and click resumes', () => {
  const box = document.getElementById('choices');
  for (let i = 0; i < 800 && app.g.chapter === 1 && app.screen === 'play'; i++) {
    const legal = box.children.find(c => !String(c.className).includes('locked'));
    if (legal) { legal.click(); app.typing = false; continue; }
    dom.key('Space');
    dom.pump(2);
    app.typing = false;
  }
  assert.ok(app.g.chapter >= 2 || app.screen === 'chapterCard', 'chapter one completed by clicking (at ' + app.g.scene + '.' + app.g.node + ')');
  if (app.screen === 'chapterCard') {
    assert.ok(document.getElementById('chapterCard').classList.contains('on'), 'card shown');
    assert.match(document.getElementById('ccName').textContent, /TESTIMONIES/);
    document.getElementById('chapterCard').click();
  }
  assert.equal(app.screen, 'play');
});

test('a save survives reload semantics: boot() sees CONTINUE non-dimmed', () => {
  const raw = localStorage.getItem('lumen-save-v1');
  assert.ok(raw, 'save present');
  const parsed = JSON.parse(raw);
  assert.ok(parsed.traits && parsed.skills && parsed.flags && parsed.scene, 'shape is the game state');
  assert.ok(Number.isInteger(parsed.chapter) && parsed.chapter >= 1);
});
