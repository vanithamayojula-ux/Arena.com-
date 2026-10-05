/* Minimal DOM/canvas/window stubs so AFTERGLOW can boot headlessly in node. */

export function makeCtx(canvas) {
  const gradient = () => ({ addColorStop() { } });
  const noop = () => { };
  const ctx = {
    canvas,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
    font: '10px serif', textBaseline: 'alphabetic', textAlign: 'left',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, arcTo: noop,
    ellipse: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, drawImage: noop, putImageData: noop,
    setLineDash: noop, setTransform: noop, transform: noop,
    createLinearGradient: gradient, createRadialGradient: gradient, createPattern: () => null,
    measureText: (s) => ({ width: String(s).length * 7 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
  };
  return ctx;
}

export function makeCanvasEl(id = 'c') {
  const el = {
    id, width: 300, height: 150,
    style: {},
    classList: { add() { }, remove() { }, toggle() { }, contains: () => false },
    children: [],
    appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
    remove() { },
    addEventListener() { }, removeEventListener() { },
    setPointerCapture() { }, releasePointerCapture() { },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540, right: 960, bottom: 540 }),
    focus() { },
    querySelectorAll: () => [],
    innerHTML: '',
    dataset: {},
  };
  el.getContext = () => (el.__ctx || (el.__ctx = makeCtx(el)));
  return el;
}

export function installDom() {
  const _setInterval = setInterval.bind(globalThis);
  const _clearInterval = clearInterval.bind(globalThis);
  const elements = new Map();
  const listeners = {};
  const rafQueue = [];
  const game = makeCanvasEl('game');
  game.parentElement = makeCanvasEl('frame');
  elements.set('game', game);

  global.window = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
    removeEventListener() { },
    matchMedia: () => ({ matches: false, addEventListener() { } }),
    AudioContext: undefined, webkitAudioContext: undefined,
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    setInterval: (fn, ms) => { const h = _setInterval(fn, ms); h.unref && h.unref(); return h; },
    clearInterval: (h) => _clearInterval(h),
    __listeners: listeners,
  };
  global.requestAnimationFrame = global.window.requestAnimationFrame;
  global.setInterval = global.window.setInterval;
  global.clearInterval = global.window.clearInterval;
  global.setTimeout = ((f) => { const h = _setInterval(() => { _clearInterval(h); f(); }, 1000); h.unref && h.unref(); return h; });
  if (!global.performance) { global.performance = { now: () => 1000 }; }
  global.document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: () => makeCanvasEl(),
    body: makeCanvasEl('body'),
  };
  const store = {};
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  if (!global.window.performance) global.window.performance = global.performance;

  let clock = 1000;
  global.performance = { now: () => clock };
  global.window.performance = global.performance;
  return { game, listeners, rafQueue,
    advance(ms = 16) { clock += ms; },
    pump(n = 1, step = 16) {
      for (let i = 0; i < n; i++) {
        const fn = rafQueue.shift();
        if (!fn) return i;
        clock += step;
        fn(clock);
      }
      return n;
    } };
}
