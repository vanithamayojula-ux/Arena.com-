// EMBERFALL — full-tour director soak. Where story.test.mjs drives each scene in
// isolation, this boots the REAL main.js director (title card → chapter one →
// ending card) inside a stubbed DOM, with the scene loop running on a hand-cranked
// requestAnimationFrame and setTimeout flushed per frame. Draw calls go to an
// absorbing null-context: the point is the plumbing — step routing, condition
// skips, saves, prompt wiring, ending maths — not pixels (painter covers those).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ------------------------------------------------------------------ the world we stub
const GRAD = { addColorStop() {} };
class AbsorbCtx {
  constructor() {
    this.canvas = { width: 1280, height: 720 };
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1;
    this.lineCap = 'butt'; this.lineJoin = 'miter'; this.font = '10px x';
    this.textAlign = 'left'; this.textBaseline = 'alphabetic';
  }
  save() {} restore() {} beginPath() {} closePath() {} moveTo() {} lineTo() {}
  quadraticCurveTo() {} bezierCurveTo() {} arc() {} arcTo() {} ellipse() {}
  rect() {} roundRect() {} fill() {} stroke() {} clip() {} fillRect() {}
  strokeRect() {} clearRect() {} translate() {} rotate() {} scale() {}
  setTransform() {} transform() {} resetTransform() {} drawImage() {}
  setLineDash() {} getLineDash() { return []; } fillText() {} strokeText() {}
  measureText() { return { width: 8 }; }
  createLinearGradient() { return GRAD; } createRadialGradient() { return GRAD; }
  createPattern() { return null; }
  getImageData() { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; }
  putImageData() {} createImageData(w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; }
  isPointInPath() { return false; }
}

const CLICKED = []; // elements handed to callers of querySelector, so we can pull trigger-handles
function makeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), children: [], _html: '', style: {}, dataset: {},
    _handlers: Object.create(null), textContent: '', width: 1280, height: 720,
    clientWidth: 1280, clientHeight: 720, scrollTop: 0, scrollHeight: 0,
    _qkids: Object.create(null),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(t, cb) { (el._handlers[t] ||= []).push(cb); },
    removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild(c) { el.children.push(c); return c; },
    insertBefore(c) { el.children.push(c); return c; },
    removeChild(c) { return c; }, remove() {}, focus() {}, blur() {}, scrollIntoView() {},
    click() { (el._handlers.click || []).forEach((f) => f({ preventDefault() {} })); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    querySelector(sel) { return (el._qkids[sel] ||= mkChild(sel)); },
    querySelectorAll() { return []; }, closest: () => el,
    getContext: () => (el.__ctx ||= new AbsorbCtx()),
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = String(v); el.children.length = 0; },
    get firstElementChild() { return (el._qkids['#first'] ||= mkChild('#first')); },
    get lastElementChild() { return (el._qkids['#last'] ||= mkChild('#last')); },
  };
  function mkChild(sel) {
    const c = makeEl('button');
    c._sel = sel;
    CLICKED.push(c);
    return c;
  }
  return el;
}

const BYID = Object.create(null);
globalThis.document = {
  readyState: 'complete',
  hidden: false, visibilityState: 'visible',
  createElement: (tag) => makeEl(tag),
  getElementById: (id) => (BYID[id] ||= makeEl(id === 'stage' ? 'canvas' : 'div')),
  querySelector: (sel) => globalThis.document.getElementById(sel.replace('#', '')),
  querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  body: makeEl('body'), documentElement: makeEl('html'),
  fonts: { ready: Promise.resolve() },
};

const WINH = Object.create(null);
const LS = new Map();
globalThis.localStorage = {
  getItem: (k) => (LS.has(k) ? LS.get(k) : null),
  setItem: (k, v) => { LS.set(k, String(v)); },
  removeItem: (k) => { LS.delete(k); },
};
globalThis.window = {
  addEventListener(t, cb) { (WINH[t] ||= []).push(cb); },
  removeEventListener() {},
  devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};

// hand-cranked clocks: rAF frames we pump ourselves; every timer flushes per frame
const RAFQ = [];
const TIMERS = [];
globalThis.requestAnimationFrame = (cb) => { RAFQ.push(cb); return RAFQ.length; };
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = (fn, ms) => { TIMERS.push(fn); return TIMERS.length; };
globalThis.clearTimeout = () => {};
const flushTimers = () => { let n = 0; while (TIMERS.length && n++ < 400) { const f = TIMERS.shift(); try { f(); } catch (e) { ERRORS.push(e); } } };

const ERRORS = [];
const WARNS = [];
const realErr = console.error; const realWarn = console.warn;
console.error = (...a) => { ERRORS.push(a.map(String).join(' ')); };
console.warn = (...a) => { WARNS.push(a.map(String).join(' ')); };

// ------------------------------------------------------------------ ui, stubbed like the scene tests
import { ui } from '../src/ui.js';
import { CHAPTERS, ENDINGS } from '../src/story.js';

let lastPrompt = null;
let choicePicks = 0;
const CARDS = [];
function stubUi() {
  ui.fast = true;
  ui.dlg = { tx: { setAttribute() {}, textContent: '' }, hint: { style: {} }, ch: { children: [] } };
  ui.say = () => { ui.typing = false; };
  ui.skipTyping = () => { ui.typing = false; };
  ui.hideDialogue = () => {}; ui.showInDialogue = () => {};
  ui.toast = () => {}; ui.setChapter = () => {}; ui.judgment = () => {}; ui.syncHud = () => {};
  ui.bumpBond = () => {}; ui.showLanes = () => {}; ui.laneHit = () => {};
  ui.hasPromptOpen = () => false; ui.pickPrompt = () => {}; ui.closePrompt = () => {};
  ui.hasChoiceOpen = () => false; ui.pickChoice = () => {};
  ui.promptCard = (cfg) => { lastPrompt = cfg; };
  ui.setPromptDefault = (f) => { if (lastPrompt) lastPrompt.defaultFn = f; };
  ui.offerChoices = (opts, cb) => { choicePicks++; cb(0); };
  ui.play = () => {}; ui.fadeOut = () => {};
  ui.cardIsOpen = () => false; ui.hideCard = () => {};
  ui.showCard = (html, o = {}) => {
    const fr = makeEl('div');
    fr.innerHTML = typeof html === 'string' ? html : '';
    CARDS.push({ fr, opts: o, html: fr._html });
    return fr;
  };
  // init against the stub DOM is harmless and keeps the shape real
  try { ui.init(); } catch { /* stage lookups are all stubbed anyway */ }
}

// ------------------------------------------------------------------ the soak
test('the whole tour plays itself, start to finish, on the real director', async () => {
  stubUi();
  const main = await import('../src/main.js');
  const E = globalThis.window.__emberfall;
  assert.ok(E && E.G, 'main.js did not publish the tooling hook');

  // press BEGIN (mFresh if a save existed; it doesn't)
  const begin = CLICKED.find((c) => c._sel === '#mBegin');
  assert.ok(begin && begin._handlers.click?.length, 'title card never wired BEGIN');
  begin._handlers.click[0]();
  flushTimers();
  assert.ok(E.running, 'the tour did not start');

  let ts = 0;
  const st0 = E.G.st;
  let swept = CLICKED.length;
  const clickSweep = () => { // press chapter-card buttons ("TAKE THE ROAD →") as they appear
    while (swept < CLICKED.length) {
      const el = CLICKED[swept++];
      if ((el._sel === '#tGo' || el._sel === '#mResume') && el._handlers.click?.length) {
        el._handlers.click[0]();
        flushTimers();
      }
    }
  };
  const seen = new Set();
  const MAX = 250000;
  let frames = 0;
  const pick = { roadOilWarn: false };
  while (frames < MAX) {
    // one frame: run every queued rAF callback with a fat dt (scene pacing is dt-based)
    const q = RAFQ.splice(0);
    ts += 50;
    for (const cb of q) cb(ts);
    flushTimers();

    const sc = E.scene;
    if (sc) {
      seen.add(`${sc.kind || sc.constructor?.name || 'scene'}#${st0.chapter}:${st0.step}`);
      if (lastPrompt) { const p = lastPrompt; lastPrompt = null; try { p.onPick?.(0); } catch (e) { ERRORS.push(e); } }
      try {
        if (sc.kind === 'performance' || sc.act !== undefined) {
          if (sc.paused && !lastPrompt) sc.paused = false;
          if (sc.state === 'play') {
            if (sc.act?.kind === 'pattern') {
              const call = sc.pattern?.calls.find((c) => c.phase === 'input');
              if (call) sc.press(call.seq[call.inputIdx]);
              else if (!sc.pattern?.calls.find((c) => c.phase !== 'done')) sc.actT += 0.2;
              else sc.actT += 0.05;
            } else if (sc.notes) {
              const n = sc.notes.find((x) => !x.hit && !x.missed);
              if (!n) { if (sc.act) sc.actT = Math.max(sc.actT, sc.act.total * sc.act.beat + 3); }
              else { sc.actT = n.t - 0.02; sc.press(n.lane); if (n.hold) sc.actT = n.t + n.hold + 0.35; sc.actT = Math.max(sc.actT, 0); }
            }
          }
        }
        if (sc.kind === 'watch' || sc.lamps) {
          if (sc.running && !sc.over) {
            sc.mouse && (sc.mouse.x = 640, sc.mouse.y = 300);
            for (const L of sc.lamps || []) if (L.extinguished) sc.relight(L);
            if (sc.glow !== undefined && sc.glow < 60) sc.shove();
          }
        }
        if (sc.kind === 'fight' || sc.state === 'window') { if (sc.state === 'window') sc.input?.(); }
        // the road may warn about a hustle; keep walking
        if (sc.kind === 'road' && sc.keys) { sc.keys.d = true; }
      } catch (e) { ERRORS.push(e); break; }
    }
    if (lastPrompt) { const p = lastPrompt; lastPrompt = null; try { p.onPick?.(0); } catch (e) { ERRORS.push(e); } }

    clickSweep();
    if (!E.running) break; // the ending card drops the curtain on the loop
    frames++;
    if (frames % 2000 === 0) await new Promise((r) => setImmediate(r)); // breathe, don't starve the runner
  }

  console.error = realErr; console.warn = realWarn;

  assert.ok(!E.running || st0.chapter >= CHAPTERS.length, `tour stalled at chapter ${st0.chapter + 1} step ${st0.step} after ${frames} frames`);
  const NOISE = /Reparsing as ES module|module syntax was detected|trace-warnings/;
  const hard = ERRORS.filter((e) => e && !NOISE.test(String(e)));
  assert.deepEqual(hard.map(String).slice(0, 4), [], `errors during soak:\n${hard.map((e) => String(e.stack || e)).slice(0, 4).join('\n')}`);
  assert.ok(!WARNS.some((w) => /unknown step type/.test(w)), `director saw unknown steps: ${WARNS.join(' | ')}`);
  assert.ok(seen.size >= CHAPTERS.reduce((n, c) => n + Math.min(6, c.steps.length), 0), `only visited ${seen.size} distinct steps — the graph is bigger than that`);

  // the ledger stayed a ledger: every number finite, in range, sane
  for (const k of ['oil', 'silver', 'morale', 'rep', 'relit', 'trust', 'shows']) {
    assert.ok(Number.isFinite(st0[k]), `${k} went non-finite: ${st0[k]}`);
  }
  assert.ok(st0.oil >= 0 && st0.oil <= 100, `oil escaped the lantern: ${st0.oil}`);
  assert.ok(st0.morale >= 0 && st0.morale <= 100, 'morale out of range');
  for (const who of Object.keys(st0.bonds)) assert.ok(st0.bonds[who] >= 0 && st0.bonds[who] <= 100, `bond ${who} out of range`);

  // an ending card actually went up, and it names one of the three endings
  const endCard = CARDS[CARDS.length - 1];
  assert.ok(endCard && /CURTAIN/.test(endCard.html), `no ending card rendered (last card: ${String(endCard?.html).slice(0, 80)})`);
  assert.ok(Object.keys(ENDINGS).length === 3, 'ending table drifted');

  // and the save that the epilogue wrote parses back into the same shape
  const raw = LS.get('emberfall.save.v1');
  assert.ok(raw, 'no save was written at the end of the tour');
  const back = JSON.parse(raw);
  assert.ok(back.chapter >= 1, 'the save forgot where the tour ended');
});
