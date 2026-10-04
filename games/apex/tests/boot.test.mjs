// Boots the real entry point (the same src/main.js index.html loads) against a
// minimal DOM stub, then pumps animation frames through it. This catches wiring
// errors — missing element ids, wrong handler names, bad HUD calls — that the
// pure simulation tests cannot see.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx } from './helpers.mjs';

function makeElement(id) {
  const listeners = {};
  const styleStore = {};
  const el = {
    id,
    textContent: '',
    width: 300,
    height: 150,
    offsetWidth: 100,
    style: new Proxy(styleStore, {
      get: (t, k) => (k in t ? t[k] : ''),
      set: (t, k, v) => {
        t[k] = v;
        return true;
      },
    }),
    classList: {
      _set: new Set(),
      add(c) {
        this._set.add(c);
      },
      remove(c) {
        this._set.delete(c);
      },
      toggle(c, on) {
        if (on === undefined) on = !this._set.has(c);
        if (on) this._set.add(c);
        else this._set.delete(c);
      },
      contains(c) {
        return this._set.has(c);
      },
    },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    removeEventListener() {},
    dispatch(type, ev = {}) {
      for (const fn of listeners[type] || []) fn(ev);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600, right: 960, bottom: 600 }),
    getContext: () => makeCtx(el),
    setPointerCapture() {},
    releasePointerCapture() {},
  };
  return el;
}

const elements = new Map();
const IDS = [
  'game', 'minimap', 'menu', 'pause', 'gameover', 'hud', 'toast',
  'hud-score', 'hud-combo', 'hud-wave', 'hud-quota', 'hud-quota-fill', 'hud-timer',
  'hud-stamina', 'hud-health', 'hud-hunger', 'hud-hint',
  'go-title', 'go-reason', 'go-score', 'go-combo', 'go-caught', 'go-wave',
  'btn-start', 'btn-again', 'btn-resume', 'btn-quit',
  'stick', 'stick-knob', 'btn-bite', 'btn-sprint',
];

let rafQueue = [];

globalThis.document = {
  hidden: false,
  activeElement: null,
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  },
  createElement: (tag) => (tag === 'canvas' ? makeElement('created') : makeElement(tag)),
  addEventListener() {},
  removeEventListener() {},
};

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 2,
  AudioContext: undefined, // audio stays silent in the harness
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
};
Object.defineProperty(globalThis, 'navigator', {
  value: { maxTouchPoints: 0 },
  configurable: true,
  writable: true,
});
globalThis.requestAnimationFrame = (fn) => {
  rafQueue.push(fn);
  return rafQueue.length;
};
globalThis.OffscreenCanvas = class {
  constructor(w, h) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return makeCtx(this);
  }
};

// Confirm every id the entry point asks for is declared in index.html.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('index.html declares every element id the entry point uses', async () => {
  const html = await readFile(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const missing = IDS.filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `index.html is missing ids: ${missing.join(', ')}`);
});

test('main.js boots, starts a run on the start button, and renders frames', async () => {
  const before = IDS.map((id) => globalThis.document.getElementById(id));
  assert.ok(before.every(Boolean));

  await import('../src/main.js');

  // the frame loop registered itself
  assert.ok(rafQueue.length > 0, 'main.js should schedule a frame');

  // click "Begin the hunt"
  globalThis.document.getElementById('btn-start').dispatch('click');

  const score = globalThis.document.getElementById('hud-score');
  const quota = globalThis.document.getElementById('hud-quota');

  // pump 240 frames (~4s at 60fps)
  let t = 0;
  for (let i = 0; i < 240; i++) {
    const q = rafQueue;
    rafQueue = [];
    t += 16.7;
    for (const fn of q) fn(t);
  }

  assert.ok(rafQueue.length > 0, 'the loop should keep re-scheduling frames');
  assert.equal(quota.textContent, `0 / 5`, `HUD should show wave 1 quota, got "${quota.textContent}"`);
  assert.equal(globalThis.document.getElementById('hud-wave').textContent, '1');
  assert.match(score.textContent, /^0$/, 'score starts at zero');

  // meters were written as percentages
  const stamina = globalThis.document.getElementById('hud-stamina');
  assert.match(String(stamina.style.width ?? '100%'), /%$/, 'stamina bar should be set');
});

test('pause and quit controls respond', async () => {
  const pauseBtn = globalThis.document.getElementById('btn-resume');
  const quitBtn = globalThis.document.getElementById('btn-quit');
  // should not throw, whatever the current state
  pauseBtn.dispatch('click');
  quitBtn.dispatch('click');

  const menu = globalThis.document.getElementById('menu');
  assert.ok(menu.classList.contains('hidden') === false, 'quitting returns to the menu');
});
