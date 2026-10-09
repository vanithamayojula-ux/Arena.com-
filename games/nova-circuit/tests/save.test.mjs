import test from 'node:test';
import assert from 'node:assert/strict';
import { load, save, recordResult, DEFAULTS } from '../src/save.js';

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

test('defaults when storage is empty or corrupt', () => {
  assert.deepEqual(load(mem()), DEFAULTS());
  const s = mem(); s.setItem('nova-circuit.v1', '{nope');
  assert.deepEqual(load(s), DEFAULTS());
});

test('round-trips and merges partial saves with defaults', () => {
  const s = mem();
  const d = DEFAULTS(); d.name = 'ACE'; d.settings.music = 0.1;
  save(d, s);
  const back = load(s);
  assert.equal(back.name, 'ACE');
  assert.equal(back.settings.music, 0.1);
  assert.equal(back.settings.sfx, DEFAULTS().settings.sfx);
  s.setItem('nova-circuit.v1', JSON.stringify({ name: 'X' }));
  assert.equal(load(s).setup.laps, 3);
});

test('records keep personal bests only', () => {
  const d = DEFAULTS();
  assert.deepEqual(recordResult(d, 'frostline', 3, 30, 100), { lap: true, race: true });
  assert.deepEqual(recordResult(d, 'frostline', 3, 31, 101), { lap: false, race: false });
  assert.deepEqual(recordResult(d, 'frostline', 3, 29, 105), { lap: true, race: false });
  assert.deepEqual(recordResult(d, 'frostline', 5, Infinity, Infinity), { lap: false, race: false });
  assert.equal(d.records.frostline.lap, 29);
  assert.equal(d.records.frostline.race[3], 100);
});
