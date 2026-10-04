// Headless harness: a canvas 2D stub that records nothing but accepts every
// call the renderer makes, so the real simulation code can run under Node.

export function makeCtx(canvas) {
  const gradient = { addColorStop() {} };
  const noop = () => {};
  return {
    canvas,
    // state
    save: noop,
    restore: noop,
    setTransform: noop,
    transform: noop,
    resetTransform: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    // paths
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    // painting
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createPattern: () => null,
    setLineDash: noop,
    getLineDash: () => [],
    // settable props
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowBlur: 0,
    shadowColor: 'transparent',
    imageSmoothingEnabled: true,
  };
}

export function makeCanvas(w = 300, h = 150) {
  const canvas = { width: w, height: h };
  const ctx = makeCtx(canvas);
  canvas.getContext = () => ctx;
  return canvas;
}

/** HUD spy that records every call so tests can assert on game feedback. */
export function makeHud() {
  const calls = { toasts: [], scores: [], quotas: [], waves: [], bars: 0, over: null };
  return {
    calls,
    show() {},
    score(v) {
      calls.scores.push(v);
    },
    combo() {},
    wave(v) {
      calls.waves.push(v);
    },
    quota(done, total) {
      calls.quotas.push([done, total]);
    },
    timer() {},
    bars() {
      calls.bars++;
    },
    toast(text, color) {
      calls.toasts.push({ text, color });
    },
    gameOver(info) {
      calls.over = info;
    },
  };
}

export function makeSfx() {
  const played = [];
  const rec = (name) => () => played.push(name);
  return {
    played,
    start: rec('start'),
    roar: rec('roar'),
    chomp: rec('chomp'),
    biteAir: rec('biteAir'),
    kill: (p) => played.push(`kill:${p}`),
    screech: rec('screech'),
    hurt: rec('hurt'),
    step: rec('step'),
    combo: (l) => played.push(`combo:${l}`),
    waveClear: rec('waveClear'),
    gameOver: rec('gameOver'),
    ambience: rec('ambience'),
    stopAmbience: rec('stopAmbience'),
  };
}

export function idleInput(overrides = {}) {
  return {
    x: 0,
    y: 0,
    sprint: false,
    bite: false,
    biteQueued: false,
    aim: 0,
    aimActive: false,
    touch: false,
    ...overrides,
  };
}
