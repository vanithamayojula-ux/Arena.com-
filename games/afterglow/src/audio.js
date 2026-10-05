/* AFTERGLOW — procedural score & sound. A cold world needs a small ensemble:
   detuned strings, a mournful box-hurdy drone, bells for the resonance rings,
   wind that never stops. All synthesized; nothing loaded. */

import { rng } from './util.js';

const A4 = 440;
const semi = n => A4 * Math.pow(2, n / 12);
// Natural minor (Aeolian on A) degrees to semitone offsets
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const deg = (d, oct = 0) => semi(SCALE[((d % 7) + 7) % 7] + 12 * (oct + Math.floor(d / 7)) - 9); // A3 base

let ctx = null, master = null, musicBus = null, sfxBus = null, windGain = null, muted = false, ready = false;
let noiseBuf = null;
let timer = null;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = nb.getChannelData(0);
  const R = rng(4444);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = R() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  noiseBuf = nb;
  ready = true;
  startWind();
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export function isMuted() { return muted; }

function startWind() {
  if (!ready) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.7;
  windGain = ctx.createGain(); windGain.gain.value = 0.045;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.03;
  lfo.connect(lfoG); lfoG.connect(windGain.gain);
  const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.045;
  const lfo2G = ctx.createGain(); lfo2G.gain.value = 140;
  lfo2.connect(lfo2G); lfo2G.connect(bp.frequency);
  src.connect(bp); bp.connect(windGain); windGain.connect(master);
  src.start(); lfo.start(); lfo2.start();
}
export function windGust(amount = 0.2, dur = 1.4) {
  if (!ready || !windGain) return;
  const t = ctx.currentTime;
  windGain.gain.cancelScheduledValues(t);
  windGain.gain.setValueAtTime(windGain.gain.value, t);
  windGain.gain.linearRampToValueAtTime(0.045 + amount, t + dur * 0.3);
  windGain.gain.linearRampToValueAtTime(0.045, t + dur);
}

/* ---------- voices ---------- */
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, t, dur, type = 'triangle', peak = 0.2, dest = musicBus, glide = 0) {
  if (!ready || muted) return;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + dur);
  const g = ctx.createGain();
  env(g, t, Math.min(0.02, dur * 0.2), dur, peak);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
function strum(freq, t, dur, peak = 0.16) {
  // bowish: saw + lowpass + vibrato-ish detune
  if (!ready || muted) return;
  for (const [dt, det] of [[0, -4], [0.03, 4]]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = freq * Math.pow(2, det / 1200);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + freq;
    f.Q.value = 1;
    const g = ctx.createGain(); env(g, t + dt, Math.min(0.12, dur * 0.35), dur, peak * 0.7);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t + dt); o.stop(t + dur + 0.2);
  }
}
function bell(freq, t, peak = 0.22) {
  if (!ready || muted) return;
  for (const [m, p] of [[1, 1], [2.76, 0.35], [5.4, 0.12]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
    const g = ctx.createGain(); env(g, t, 0.004, p > 0.3 ? 0.5 : 1.4, peak * p);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + 1.7);
  }
}
function noiseBurst(t, dur, freq, q, peak, type = 'bandpass') {
  if (!ready || muted) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

/* ---------- sfx ---------- */
export const SFX = {
  ui() { if (ready) tone(1200, ctx.currentTime, 0.06, 'square', 0.025, sfxBus); },
  soft() { if (ready) tone(900, ctx.currentTime, 0.09, 'sine', 0.045, sfxBus); },
  page() { noiseBurst(ctx.currentTime, 0.12, 2600, 0.8, 0.05); },
  step() { noiseBurst(ctx.currentTime, 0.05, 380 + Math.random() * 160, 1.6, 0.035); },
  relight() { const t = ctx.currentTime; noiseBurst(t, 0.28, 620, 0.8, 0.12); tone(deg(4, -1), t + 0.02, 0.2, 'sine', 0.06, sfxBus); },
  hit() { bell(deg(0, 2), ctx.currentTime, 0.2); },
  perfect() { const t = ctx.currentTime; bell(deg(4, 2), t, 0.26); bell(deg(7, 2), t + 0.06, 0.22); },
  miss() { const t = ctx.currentTime; tone(deg(1, 0), t, 0.22, 'square', 0.05, sfxBus, -40); noiseBurst(t, 0.18, 240, 1, 0.05); },
  combo(n) { if (ready) bell(deg(Math.min(12, n), 2), ctx.currentTime, 0.14); },
  crowd(mood) { const t = ctx.currentTime; noiseBurst(t, 0.9, 700 + mood * 900, 0.5, 0.05 + mood * 0.09); noiseBurst(t + 0.1, 0.7, 2400, 1.2, 0.03 + mood * 0.04); },
  whoosh() { noiseBurst(ctx.currentTime, 0.34, 900, 0.7, 0.09); },
  thud() { const t = ctx.currentTime; tone(90, t, 0.16, 'sine', 0.3, sfxBus, -40); noiseBurst(t, 0.1, 300, 1.4, 0.12); },
  hurt() { const t = ctx.currentTime; tone(160, t, 0.3, 'sawtooth', 0.16, sfxBus, -80); noiseBurst(t, 0.22, 480, 0.9, 0.14); },
  shot() { const t = ctx.currentTime; noiseBurst(t, 0.5, 1300, 0.4, 0.55); tone(1900, t, 0.1, 'square', 0.12, sfxBus, -1700); },
  whistle() { const t = ctx.currentTime; tone(2200, t, 0.24, 'sine', 0.1, sfxBus, 900); tone(2200, t + 0.22, 0.3, 'sine', 0.08, sfxBus, -1100); },
  wisp() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tone(1400 + Math.random() * 900, t + i * 0.08, 0.3, 'sine', 0.05, sfxBus, -700); },
  banish() { const t = ctx.currentTime; tone(700, t, 0.5, 'sine', 0.08, sfxBus, -560); noiseBurst(t, 0.4, 1800, 0.6, 0.08); },
  coin() { const t = ctx.currentTime; tone(deg(7, 2), t, 0.12, 'triangle', 0.09, sfxBus); tone(deg(9, 2), t + 0.07, 0.18, 'triangle', 0.08, sfxBus); },
  bellTower(t0) { const t = (t0 || ctx.currentTime); bell(deg(0, 1), t, 0.3); bell(deg(4, 1), t + 0.4, 0.26); },
  trustUp() { const t = ctx.currentTime; tone(deg(0, 1), t, 0.14, 'sine', 0.07, sfxBus); tone(deg(2, 1), t + 0.1, 0.2, 'sine', 0.07, sfxBus); },
  trustDown() { const t = ctx.currentTime; tone(deg(1, 1), t, 0.2, 'sine', 0.06, sfxBus, -60); tone(deg(0, 0), t + 0.16, 0.3, 'sine', 0.05, sfxBus); },
};

/* Headless safety: if the audio context never initialized (stubbed env,
   autoplay blocked, ancient browser), every sfx becomes a no-op. */
for (const k of Object.keys(SFX)) {
  const f = SFX[k];
  SFX[k] = (...args) => { if (!ready) return; f(...args); };
}
const _sting = sting;
export function stingSafe(kind) { if (!ready) return; _sting(kind); }

/* ---------- music: theme scheduler ---------- */
const THEMES = {
  none: null,
  title: { bpm: 52, roots: [0, -2, 5, 3], lead: [[0, 0, 2], [2, 2, 1], [4, 3, 3], [3, 6, 2]], style: 'box' },
  camp: { bpm: 56, roots: [0, 3, -2, 5], lead: [[4, 1, 1], [2, 2, 2], [0, 4, 1], [2, 5, 2], [4, 7, 1]], style: 'warm' },
  road: { bpm: 60, roots: [0, -3, 2, 3], lead: [[0, 0, 2], [3, 2, 1], [2, 3, 2], [-1, 5, 1], [0, 6, 3]], style: 'cold' },
  town: { bpm: 66, roots: [0, 5, 3, -2], lead: [[2, 0, 1], [4, 1, 1], [0, 2, 2], [4, 4, 1], [5, 5, 1], [7, 6, 2]], style: 'warm' },
  tension: { bpm: 74, roots: [0, 0, -3, 1], lead: [[7, 0, 1], [6, 1, 1], [7, 2, 1], [4, 4, 2], [2, 6, 1]], style: 'pulse' },
  guard: { bpm: 84, roots: [0, -1, 0, 3], lead: [[7, 0, 1], [8, 1, 1], [7, 2, 1], [4, 3, 1], [3, 4, 2], [7, 6, 1]], style: 'pulse' },
  fight: { bpm: 100, roots: [0, 0, 5, 3], lead: [[10, 0, 1], [9, 1, 1], [7, 2, 1], [4, 3, 2], [7, 5, 1], [10, 6, 1]], style: 'drums' },
  waltz: { bpm: 104, roots: [0, 3, -2, 5, 0, 3, 7, 5], lead: [[0, 0, 1], [2, 1, 1], [4, 2, 1], [7, 3, 1], [5, 4, 1], [3, 5, 1], [4, 6, 1], [0, 7, 1]], style: 'waltz' },
  dawn: { bpm: 64, roots: [0, 5, 7, 3], lead: [[7, 0, 2], [9, 2, 1], [11, 3, 2], [7, 5, 1], [9, 6, 3]], style: 'hope' },
  sad: { bpm: 46, roots: [0, -3, -4, -2], lead: [[3, 0, 3], [2, 3, 2], [0, 5, 4], [-2, 9, 3]], style: 'cold' },
};
let theme = null, step = 0, nextAt = 0;

export function setTheme(name) {
  if (name === theme) return;
  theme = THEMES[name] ? name : null;
  step = 0;
  nextAt = ready ? ctx.currentTime + 0.08 : 0;
  if (timer) { clearInterval(timer); timer = null; }
  if (theme) timer = setInterval(sched, 90);
}
export function getTheme() { return theme; }

function sched() {
  if (!ready || muted || !theme) return;
  const T = THEMES[theme];
  const beat = 60 / T.bpm;
  const lookahead = ctx.currentTime + 0.4;
  while (nextAt < lookahead) {
    const bar = Math.floor(step / 8), s = step % 8;
    const root = T.roots[bar % T.roots.length];
    if (s === 0) strum(deg(root, -1), nextAt, beat * 6, 0.1); // cello pulse
    if (T.style === 'drums') {
      if (s % 4 === 0) tone(60, nextAt, 0.12, 'sine', 0.28, musicBus, -30);
      if (s % 2 === 1) noiseBurst(nextAt, 0.06, 420, 2, 0.1);
    }
    if (T.style === 'waltz' && s === 0) tone(deg(root, 0), nextAt, beat * 0.8, 'triangle', 0.08, musicBus);
    for (const [d, off, dur] of T.lead) {
      if (Math.floor(step) % 8 === (off % 8) && (step % 8 === off % 8)) {
        const f = deg(d + root, d >= 5 ? 1 : 2);
        if (T.style === 'box') tone(f, nextAt, beat * dur * 1.4, 'triangle', 0.11, musicBus);
        else if (T.style === 'hope') strum(f, nextAt, beat * dur * 1.2, 0.07);
        else tone(f, nextAt, beat * dur * 1.1, 'sine', 0.09, musicBus);
      }
    }
    // sparse chord color
    if (s === 4 && (T.style === 'warm' || T.style === 'hope')) {
      strum(deg(root + 4, 0), nextAt, beat * 3, 0.05);
      strum(deg(root + 7, 0), nextAt + 0.05, beat * 3, 0.05);
    }
    if (s === 6 && T.style === 'pulse') noiseBurst(nextAt, 0.05, 5200, 3, 0.02);
    nextAt += beat;
    step++;
  }
}

export function sting(kind) {
  if (!ready || muted) return;
  const t = ctx.currentTime;
  if (kind === 'triumph') { [0, 2, 4, 7].forEach((d, i) => strum(deg(d, i === 3 ? 1 : 0), t + i * 0.09, 1.6, 0.1)); }
  if (kind === 'sad') { strum(deg(0, 0), t, 2.2, 0.09); strum(deg(-2, -1), t + 0.2, 2.4, 0.07); }
  if (kind === 'reveal') { [7, 11, 14].forEach((d, i) => tone(deg(d, 1), t + i * 0.14, 0.9, 'sine', 0.07, musicBus)); }
  if (kind === 'bad') { tone(deg(-3, -1), t, 0.9, 'sawtooth', 0.12, musicBus, -60); }
}
