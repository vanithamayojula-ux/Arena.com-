/* LUMEN PROTOCOL test helpers — canvas stub, micro-DOM, fake rAF clock. */

export function makeCtx() {
  const noop = () => {};
  const grad = { addColorStop: noop };
  const ctx = {
    canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop, strokeText: noop,
    translate: noop, rotate: noop, scale: noop, transform: noop, setTransform: noop, clip: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    measureText: () => ({ width: 10 }),
  };
  for (const k of ['fillStyle','strokeStyle','lineWidth','font','textAlign','textBaseline','globalAlpha','lineCap','lineJoin','shadowBlur','shadowColor']) ctx[k] = null;
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
    tag, children: [], _listeners: {}, style: {}, dataset: {}, className: '',
    classList: classList(),
    _text: '', _innerHTML: '',
    width: 960, height: 540, clientWidth: 960, clientHeight: 540,
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; if (v === '') this.children = []; },
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    prepend(c) { this.children.unshift(c); c.parent = this; return c; },
    get lastChild() { return this.children[this.children.length - 1] || null; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); },
    addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    closest: () => null,
    dispatch(type, ev) { (this._listeners[type] || []).forEach(f => f(ev)); },
    click() { if (typeof this.onclick === 'function') this.onclick({ preventDefault() {}, stopPropagation() {} }); this.dispatch('click', { target: this, preventDefault() {} }); },
    focus() {}, disabled: false,
  };
  if (tag === 'canvas') el.getContext = () => { const c = makeCtx(); c.canvas = el; return c; };
  return el;
}
export function installDom() {
  const els = new Map();
  const winL = {};
  const timeouts = [];
  let clock = 1000;
  const rafQ = [];
  global.document = {
    body: makeEl('body'),
    getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id === 'city' ? 'canvas' : 'div')); return els.get(id); },
    createElement: (t) => makeEl(t),
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  global.window = {
    addEventListener: (t, f) => { (winL[t] = winL[t] || []).push(f); },
    removeEventListener: () => {},
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 760,
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
  if (typeof global.navigator === 'undefined') global.navigator = {};
  const key = (code, opts = {}) => (winL.keydown || []).forEach(f => f(Object.assign({ code, key: code.replace('Key','').replace('Digit',''), repeat: false, preventDefault() {}, stopPropagation() {} }, opts)));
  const pump = (frames = 1) => {
    for (let i = 0; i < frames; i++) {
      clock += 16;
      for (const f of rafQ.splice(0, rafQ.length)) f(clock);
      for (const to of timeouts.splice(0, timeouts.length)) if (to.at <= clock) to.f();
    }
  };
  return { key, pump, els };
}
