/* TIDE & BONE test helpers — a canvas-2d stub, a micro-DOM sufficient for
   main.js, and a deterministic frame pump on a fake clock. Node only. */

export function makeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = {
    canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    translate: noop, rotate: noop, scale: noop, transform: noop, setTransform: noop, clip: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop, putImageData: noop,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
  };
  for (const k of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'font', 'textAlign', 'textBaseline', 'globalAlpha', 'globalCompositeOperation', 'shadowBlur', 'shadowColor', 'imageSmoothingEnabled']) ctx[k] = null;
  return ctx;
}

function classList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    toggle: (c, f) => { (f === undefined ? !s.has(c) : f) ? s.add(c) : s.delete(c); },
    contains: c => s.has(c),
  };
}
export function makeEl(tag = 'div') {
  const el = {
    tag, children: [], _listeners: {}, style: {}, dataset: {}, className: "",
    classList: classList(),
    _text: '', _innerHTML: '',
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    width: 560, height: 560,
    clientWidth: 560, clientHeight: 560,
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; this.children = []; },
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    prepend(c) { this.children.unshift(c); c.parent = this; return c; },
    get lastChild() { return this.children[this.children.length - 1] || null; },
    get childElementCount() { return this.children.length; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    removeEventListener() {},
    setAttribute() {}, getAttribute() { return null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 560, height: 560 }),
    dispatch(type, ev) { (this._listeners[type] || []).forEach(f => f(ev)); },
    click() { if (typeof this.onclick === 'function') this.onclick({ preventDefault() {}, stopPropagation() {} }); },
    focus() {}, disabled: false,
  };
  if (tag === 'canvas') {
    el.getContext = () => { const c = makeCtx(); c.canvas = el; return c; };
  }
  return el;
}

export function installDom() {
  const els = new Map();
  const winListeners = {};
  const timeouts = [];
  let clock = 1000;
  const rafQ = [];
  const _setInterval = global.setInterval, _clearInterval = global.clearInterval;

  global.document = {
    body: makeEl('body'),
    getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id === 'game' ? 'canvas' : 'div')); return els.get(id); },
    createElement: (t) => makeEl(t),
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  global.window = {
    addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
    removeEventListener: () => {},
    devicePixelRatio: 1,
    innerWidth: 800, innerHeight: 700,
  };
  global.localStorage = {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); },
  };
  global.requestAnimationFrame = (f) => { rafQ.push(f); return rafQ.length; };
  global.cancelAnimationFrame = () => {};
  global.setTimeout = (f, ms) => { timeouts.push({ f, at: clock + (ms || 0) }); return timeouts.length; };
  global.clearTimeout = () => {};
  global.performance = { now: () => clock };
  global.setInterval = (f, ms) => _setInterval(f, Math.max(50, ms)); // keep natives for anything internal
  global.clearInterval = _clearInterval;
  if (typeof global.navigator === 'undefined') global.navigator = {};

  const key = (code) => { (winListeners.keydown || []).forEach(f => f({ code, repeat: false, preventDefault() {}, stopPropagation() {} })); };
  const pump = (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      clock += 16;
      const q = rafQ.splice(0, rafQ.length);
      for (const f of q) f(clock);
      for (const to of timeouts.splice(0, timeouts.length)) if (to.at <= clock) to.f();
    }
  };
  return { key, pump, els, timeouts, clock: () => clock, keydowns: winListeners };
}
