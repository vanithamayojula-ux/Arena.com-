/* LUMEN PROTOCOL — engine mechanics: gates, permanent effects, saves. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, can, apply, personaOf, carrying, whispersFor, saveGame, loadGame, clearSave, enterScene, choiceAt, visibleState, advance, SAVE_KEY, SKILLS } from '../src/game.js';
import { SCENES, CHAPTERS } from '../src/story.js';

const S = { SCENES, CHAPTERS };

test('trait gates open the moment the trait exists', () => {
  const g = createGame('analyst');
  assert.equal(can(g, { trait: { lucidity: 2 } }), true);
  assert.equal(can(g, { trait: { empathy: 2 } }), false);
  apply(g, { trait: { empathy: 2 } });
  assert.equal(can(g, { trait: { empathy: 2 } }), true);
});

test('effects are permanent and bounded', () => {
  const g = createGame('saint'); // empathy 2
  for (let i = 0; i < 10; i++) apply(g, { trait: { empathy: 1 } });
  assert.equal(g.traits.empathy, 6, 'capped at 6');
  apply(g, { trait: { empathy: -3 } });
  assert.equal(g.traits.empathy, 3);
  apply(g, { trait: { empathy: -10 } });
  assert.equal(g.traits.empathy, 0, 'floored at 0');
});

test('skills add, remove, and gate', () => {
  const g = createGame('saint');
  assert.ok(g.skills.includes('saint_freq'), 'calibration skill present');
  apply(g, { skill: 'echo_sight' });
  assert.equal(can(g, { skill: 'echo_sight' }), true);
  apply(g, { skill: 'echo_sight' }); // dup-safe
  assert.equal(g.skills.filter(s => s === 'echo_sight').length, 1);
  apply(g, { skillRemove: 'saint_freq' });
  assert.equal(can(g, { skill: 'saint_freq' }), false);
});

test('cargo: gain, carry, deliver original vs copy', () => {
  const g = createGame('analyst');
  apply(g, { gain: 'widows_morning' });
  assert.deepEqual(carrying(g), ['widows_morning']);
  // a copy keeps it riding; original delivery ends the carry
  apply(g, { deliver: { pack: 'widows_morning', mode: 'copy', to: 'sera' } });
  assert.equal(g.packs.widows_morning.delivered, 'copy');
  assert.deepEqual(carrying(g), [], 'delivered = not carried');
  const h = createGame('analyst');
  apply(h, { gain: 'widows_morning' });
  apply(h, { deliver: { pack: 'widows_morning', mode: 'original', to: 'sera' } });
  assert.deepEqual(carrying(h), []);
});

test('whispers only come from carried cargo', () => {
  const g = createGame('feral');
  assert.deepEqual(whispersFor(g, 'lift'), []);
  apply(g, { gain: 'elevator_grief' });
  const w = whispersFor(g, 'market');
  assert.equal(w.length, 1);
  assert.match(w[0].text, /sink/i);
});

test('persona follows the ledger', () => {
  const g = createGame('saint');
  assert.equal(personaOf(g).id, 'courier');
  apply(g, { trait: { relic: 6 } });
  assert.equal(personaOf(g).id, 'choir');
  const h = createGame('saint'); apply(h, { trait: { empathy: 6 } });
  assert.equal(personaOf(h).id, 'saint');
  const k = createGame('saint'); apply(k, { trait: { defiance: 6 } });
  assert.equal(personaOf(k).id, 'glitch');
});

test('scene fx apply exactly once per scene', () => {
  const g = createGame('saint');
  enterScene(g, S, 'recon'); // recon has scene fx relic+1
  assert.equal(g.traits.relic, 1);
  enterScene(g, S, 'recon');
  assert.equal(g.traits.relic, 1, 'no double-tick');
  assert.ok(g.flags.fx_recon);
});

test('locked choices refuse; legal choices move state and flow', () => {
  const g = createGame('saint');
  enterScene(g, S, 'bar'); // b1 has a defiance-2 choice
  const r = choiceAt(g, S, 2);
  assert.equal(r.ok, false, 'locked refused');
  const r0 = choiceAt(g, S, 0);
  assert.equal(r0.ok, true);
  assert.equal(g.node, 'b2', 'flow moved');
  assert.equal(g.line, 0, 'node reset to first line');
});

test('save round-trips a mid-run state, then clears', () => {
  const store = new Map();
  const storage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const g = createGame('analyst');
  enterScene(g, S, 'lift');
  choiceAt(g, S, 0);            // talk to the stowaway
  advance(g, S); advance(g, S); // …walk her lines
  apply(g, { gain: 'lantern_fire', trait: { relic: 1 }, skill: 'echo_sight' });
  saveGame(g, storage);
  const back = loadGame(storage);
  assert.deepEqual(back.traits, g.traits);
  assert.deepEqual(back.skills, g.skills);
  assert.equal(back.packs.lantern_fire !== undefined, true);
  assert.equal(back.scene, g.scene);
  clearSave(storage);
  assert.equal(loadGame(storage), null);
});

test('delivering the widow’s morning ORIGINAL removes the pack; COPY logs the seam flag', () => {
  const g = createGame('analyst'); // starts with frost_read
  apply(g, { gain: 'widows_morning', trait: { lucidity: 2 } });
  enterScene(g, S, 'bar');
  // walk b1 → b3
  choiceAt(g, S, 1); // lucidity choice → b2c
  for (let i = 0; i < 12 && g.node !== 'b3'; i++) { if (visibleState(g, S).mode === 'choices') break; advance(g, S); }
  assert.equal(g.node, 'b3');
  const out = choiceAt(g, S, 1); // COPY branch
  assert.ok(out.ok, 'analyst can copy');
  assert.equal(g.flags.sera_seam, true);
  assert.ok(g.skills.includes('frost_read'));
  assert.ok(g.scars.length >= 1, 'a scar was logged');
});
