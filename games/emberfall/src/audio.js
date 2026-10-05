// One small synthesizer, no samples. Everything is lazy — created on the first user
// gesture (title click), and silent when muted. Headless tools never touch this.

let ctx = null, master = null, droneGain = null, droneNodes = null;
let ambientOn = false;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    return true;
  } catch (e) { return false; }
}

function ok() { return ctx && master; }

function env(node, t0, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

export function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, slideTo = 0) {
  if (!ok()) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  env(g, t0, 0.008, vol, dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function click() { tone(1400, 0.05, 'triangle', 0.06); }
export function choice() { tone(880, 0.09, 'triangle', 0.08, 1180); }
export function pageTurn() { tone(320, 0.1, 'sine', 0.05, 240); }

export function judgment(grade) {
  if (!ok()) return;
  if (grade === 'perfect') { tone(1320, 0.16, 'triangle', 0.12); tone(1980, 0.2, 'sine', 0.06); }
  else if (grade === 'great') { tone(990, 0.12, 'triangle', 0.1); }
  else if (grade === 'ok') { tone(660, 0.1, 'sine', 0.06); }
  else { tone(156, 0.22, 'sawtooth', 0.07, 98); }
}

export function flamethrow() { // relighting a lamp — breath then bloom
  if (!ok()) return;
  const t0 = ctx.currentTime;
  const len = 0.5, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const p = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 1.6) * (p < 0.15 ? p / 0.15 : 1);
  }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t0);
  f.frequency.exponentialRampToValueAtTime(180, t0 + len); f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = 0.24;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
  tone(520, 0.3, 'sine', 0.05, 880);
}

export function thud(v = 1) { tone(70, 0.16, 'sine', 0.16 * v, 40); }
export function worry() { tone(240, 0.3, 'sine', 0.05, 210); }
export function fanfare() {
  if (!ok()) return;
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.34, 'triangle', 0.1), i * 110));
}
export function doom() {
  if (!ok()) return;
  [220, 196, 147].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sawtooth', 0.05, f * 0.7), i * 160));
}

// low winter drone under the world. o.town=true adds a warm major third (safety).
export function ambience(on, o = {}) {
  ambientOn = on;
  if (!ctx) { if (on) return; }
  if (!ok()) return;
  if (on && !droneNodes) {
    droneGain = ctx.createGain(); droneGain.gain.value = 0;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 300;
    droneGain.connect(filt); filt.connect(master);
    const oscs = [];
    for (const [f, v] of [[55, 0.5], [55.4, 0.35], [82.4, o.warm ? 0.16 : 0.05], [110, 0.08]]) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = f; g.gain.value = v;
      osc.connect(g); g.connect(droneGain); osc.start();
      oscs.push(osc);
    }
    // wind: filtered noise loop
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    src.connect(nf); nf.connect(ng); ng.connect(droneGain); src.start();
    droneNodes = { oscs, src };
  }
  if (droneGain) {
    droneGain.gain.cancelScheduledValues(ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(on && !isMuted() ? (ambientOn ? 0.05 : 0) : 0, ctx.currentTime + 1.4);
  }
  if (droneNodes && !on) {
    // stop after fade handled by gain; keep oscillators alive but silent (cheap)
  }
}

let muted = false;
export function isMuted() { return muted || !ctx; }
export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.9;
}

// Metronome used by the performance scene; returns nothing, purely cosmetic ticks.
export function tick(strong) {
  if (!ok() || muted) return;
  tone(strong ? 1500 : 1100, 0.04, 'square', strong ? 0.045 : 0.028);
}
