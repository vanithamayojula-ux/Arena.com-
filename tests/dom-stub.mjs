// Minimal DOM / canvas / WebAudio stubs so the game's procedural world can be built
// and simulated in Node — no browser, no GL. Imported for its side effects.
// Headless smoke test for Umbral Tide.
// Stubs just enough DOM to let every procedural module actually run, then
// builds the city and ticks the world for a simulated minute.

/* ── fake 2D canvas ── */
function makeCtx(canvas) {
  const grad = () => ({ addColorStop() {} });
  const ctx = {
    canvas,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', shadowColor: '#000', shadowBlur: 0,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif', textAlign: 'left',
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, drawImage() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    bezierCurveTo() {}, arc() {}, arcTo() {}, ellipse() {}, rect() {}, roundRect() {},
    fill() {}, stroke() {}, clip() {}, save() {}, restore() {}, translate() {},
    rotate() {}, scale() {}, setTransform() {}, transform() {},
    createLinearGradient: grad, createRadialGradient: grad, createPattern: () => null,
    fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
  };
  return ctx;
}

class FakeCanvas {
  constructor() { this.width = 300; this.height = 150; this.style = {}; this._ctx = null; }
  getContext(kind) {
    if (kind === '2d') { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; }
    return null;
  }
  addEventListener() {} removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  toDataURL() { return 'data:,'; }
}

const elements = new Map();
function makeEl(tag = 'div') {
  if (tag === 'canvas') return new FakeCanvas();
  const el = {
    tagName: tag.toUpperCase(), style: {}, dataset: {}, children: [],
    classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); return on; }, contains(c) { return this._s.has(c); } },
    textContent: '', innerHTML: '', value: '',
    addEventListener() {}, removeEventListener() {}, appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl('div'); }, querySelectorAll() { return []; },
    setAttribute() {}, getAttribute() { return null; }, focus() {}, blur() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20 }; },
  };
  return el;
}

globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? new FakeCanvas() : makeEl(tag)),
  getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeEl('div')); return elements.get(id); },
  querySelector: () => makeEl('div'),
  addEventListener() {}, removeEventListener() {},
  exitPointerLock() {}, pointerLockElement: null,
  body: makeEl('body'),
};
globalThis.__handlers = {};
globalThis.__fire = (type, ev) => { (globalThis.__handlers[type] || []).forEach((fn) => fn(ev)); };
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener(type, fn) { (globalThis.__handlers[type] = globalThis.__handlers[type] || []).push(fn); },
  removeEventListener() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  AudioContext: undefined, webkitAudioContext: undefined,
  performance: { now: () => Date.now() },
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => Date.now() };
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch (e) {}
globalThis.self = globalThis;

const fails = [];
const ok = (label) => console.log(`  ok  ${label}`);
function check(label, fn) {
  try { const v = fn(); ok(label + (v !== undefined ? ` → ${v}` : '')); return v; }
  catch (e) { fails.push([label, e]); console.log(`  FAIL ${label}: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e}`); return null; }
}

