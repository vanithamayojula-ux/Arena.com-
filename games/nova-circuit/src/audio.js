// Fully procedural audio: engine, weapons, UI and a driving synth soundtrack.
// Nothing is loaded from disk; everything is built from oscillators and noise.

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  harm: [0, 2, 3, 5, 7, 8, 11],
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.muted = false;
    this.music = null;
    this.engine = null;
    this.lastLock = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.55; this.musicBus.connect(this.master);
    // shared noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // simple feedback delay for the lead
    this.delay = ctx.createDelay(1.0); this.delay.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay);
    const dg = ctx.createGain(); dg.gain.value = 0.5; dl.connect(dg); dg.connect(this.musicBus);
    this.leadBus = ctx.createGain(); this.leadBus.gain.value = 1; this.leadBus.connect(this.musicBus); this.leadBus.connect(this.delay);
    this.buildEngine();
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.value = music * 0.55;
    this.sfxBus.gain.value = sfx;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 1; }

  // ----- primitives -------------------------------------------------------
  tone(type, f0, f1, dur, vol, when = 0, dest = this.sfxBus, attack = 0.004) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  noise(dur, vol, f0, f1, type = 'bandpass', when = 0, q = 1, dest = this.sfxBus) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ----- continuous engine --------------------------------------------------
  buildEngine() {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.sfxBus);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3; lp.connect(out);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 30.5;
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 120;
    const g1 = ctx.createGain(); g1.gain.value = 0.35; const g2 = ctx.createGain(); g2.gain.value = 0.25; const g3 = ctx.createGain(); g3.gain.value = 0.2;
    o1.connect(g1); o2.connect(g2); o3.connect(g3); g1.connect(lp); g2.connect(lp); g3.connect(lp);
    const wind = ctx.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 800; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0;
    wind.connect(wf); wf.connect(wg); wg.connect(this.sfxBus);
    o1.start(); o2.start(); o3.start(); wind.start();
    this.engine = { out, lp, o1, o2, o3, wf, wg };
  }
  setEngine(on, speedFrac, boost) {
    if (!this.engine) return;
    const e = this.engine, t = this.ctx.currentTime;
    const sf = Math.min(1.6, Math.max(0, speedFrac));
    const f = 48 + sf * 70 + (boost ? 38 : 0);
    e.o1.frequency.setTargetAtTime(f, t, 0.06);
    e.o2.frequency.setTargetAtTime(f * 0.5 + 0.4, t, 0.06);
    e.o3.frequency.setTargetAtTime(f * 2.01, t, 0.06);
    e.lp.frequency.setTargetAtTime(380 + sf * 900 + (boost ? 1400 : 0), t, 0.08);
    e.out.gain.setTargetAtTime(on ? 0.16 + sf * 0.06 + (boost ? 0.07 : 0) : 0, t, 0.1);
    e.wg.gain.setTargetAtTime(on ? Math.min(0.5, 0.05 + sf * 0.2 + (boost ? 0.22 : 0)) : 0, t, 0.1);
    e.wf.frequency.setTargetAtTime(500 + sf * 1800 + (boost ? 1500 : 0), t, 0.1);
  }

  // ----- one-shots ---------------------------------------------------------
  ui(kind = 'click') {
    if (!this.ctx) return;
    if (kind === 'click') this.tone('square', 900, 1400, 0.06, 0.08);
    else if (kind === 'back') this.tone('square', 700, 380, 0.08, 0.08);
    else if (kind === 'go') { this.tone('sawtooth', 220, 880, 0.35, 0.12); this.tone('square', 440, 1760, 0.3, 0.06, 0.05); }
    else if (kind === 'move') this.tone('triangle', 1200, 1200, 0.03, 0.05);
  }
  laser(own = true, pan = 0) { if (!this.ctx) return; const v = own ? 0.11 : 0.04; this.tone('sawtooth', 1500, 280, 0.12, v); this.tone('square', 2200, 600, 0.05, v * 0.4); }
  missile(own = true) { if (!this.ctx) return; const v = own ? 0.25 : 0.1; this.noise(0.7, v, 600, 3000, 'bandpass', 0, 1.2); this.tone('sawtooth', 120, 600, 0.5, v * 0.6); }
  explosion(big = true, vol = 1) {
    if (!this.ctx) return;
    this.noise(big ? 1.1 : 0.55, 0.55 * vol, big ? 1800 : 2500, 60, 'lowpass', 0, 0.8);
    this.tone('sine', big ? 110 : 160, 28, big ? 0.9 : 0.4, 0.55 * vol);
    if (big) this.noise(0.25, 0.3 * vol, 6000, 800, 'highpass');
  }
  hit() { if (!this.ctx) return; this.noise(0.1, 0.22, 3500, 900, 'bandpass'); this.tone('square', 260, 90, 0.12, 0.14); }
  spark() { if (!this.ctx) return; this.noise(0.05, 0.06, 5000, 2500, 'highpass'); }
  wall() { if (!this.ctx) return; this.noise(0.35, 0.3, 4000, 500, 'bandpass', 0, 2); this.tone('sawtooth', 160, 60, 0.2, 0.12); }
  bump() { if (!this.ctx) return; this.noise(0.15, 0.25, 900, 200, 'lowpass'); this.tone('square', 130, 60, 0.12, 0.15); }
  land(imp = 60) { if (!this.ctx) return; this.noise(0.2, Math.min(0.4, imp / 200), 600, 120, 'lowpass'); }
  pickup(kind) {
    if (!this.ctx) return;
    const base = kind === 'repair' ? 523 : kind === 'ammo' ? 440 : kind === 'shield' ? 587 : 660;
    [1, 1.25, 1.5, 2].forEach((m, i) => this.tone('triangle', base * m, base * m, 0.18, 0.13, i * 0.055));
  }
  boostPad() { if (!this.ctx) return; this.noise(0.6, 0.22, 400, 5000, 'bandpass', 0, 0.9); this.tone('sawtooth', 160, 700, 0.5, 0.1); }
  jumpPad() { if (!this.ctx) return; this.tone('sine', 200, 1200, 0.4, 0.2); this.noise(0.3, 0.12, 1000, 4000, 'bandpass'); }
  boostStart() { if (!this.ctx) return; this.noise(0.5, 0.2, 300, 3500, 'bandpass', 0, 0.8); this.tone('sawtooth', 100, 380, 0.4, 0.08); }
  emp() { if (!this.ctx) return; this.tone('sine', 900, 50, 0.9, 0.35); this.noise(0.7, 0.3, 4000, 200, 'bandpass'); }
  overdrive() { if (!this.ctx) return; [0, 4, 7, 12].forEach((s, i) => this.tone('sawtooth', 220 * Math.pow(2, s / 12), 220 * Math.pow(2, s / 12) * 1.01, 0.3, 0.1, i * 0.05)); }
  mineDrop() { if (!this.ctx) return; this.tone('triangle', 500, 200, 0.12, 0.12); }
  dodge() { if (!this.ctx) return; this.noise(0.3, 0.18, 800, 4000, 'bandpass', 0, 1.5); }
  evade() { if (!this.ctx) return; this.tone('triangle', 1600, 2400, 0.12, 0.1); }
  lap(best) { if (!this.ctx) return; [0, 7, 12].forEach((s, i) => this.tone('square', 440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), 0.14, 0.09, i * 0.08)); }
  finish(good = true) { if (!this.ctx) return; const n = good ? [0, 4, 7, 12, 16, 19] : [0, 3, 7, 10]; n.forEach((s, i) => this.tone('sawtooth', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 0.5, 0.09, i * 0.09)); }
  countdown(n) { if (!this.ctx) return; if (n > 0) this.tone('square', 520, 520, 0.18, 0.14); else { this.tone('square', 1040, 1040, 0.5, 0.16); this.tone('sawtooth', 520, 1040, 0.5, 0.08); } }
  lockTone(state) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (state === 'locking') { if (now - this.lastLock > 0.16) { this.lastLock = now; this.tone('square', 1500, 1500, 0.04, 0.06); } }
    else if (state === 'locked') { if (now - this.lastLock > 0.09) { this.lastLock = now; this.tone('square', 2400, 2400, 0.05, 0.07); } }
  }
  warning() { if (!this.ctx) return; const now = this.ctx.currentTime; if (now - (this.lastWarn || 0) > 0.28) { this.lastWarn = now; this.tone('sawtooth', 880, 880, 0.12, 0.1); this.tone('sawtooth', 660, 660, 0.12, 0.1, 0.13); } }
  overheat() { if (!this.ctx) return; this.tone('sawtooth', 300, 120, 0.3, 0.1); }
  respawn() { if (!this.ctx) return; this.tone('sine', 200, 900, 0.5, 0.14); }

  // ----- music --------------------------------------------------------------
  startMusic(style = {}) {
    if (!this.ctx) return;
    this.stopMusic();
    const st = { bpm: 132, root: 45, scale: 'minor', seed: 1, intensity: 0.5, menu: false, ...style };
    const ctx = this.ctx;
    const m = { st, step: 0, next: ctx.currentTime + 0.1, timer: null, intensity: st.intensity, target: st.intensity };
    let seed = st.seed * 9973 + 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const sc = SCALES[st.scale];
    // 16-step bass pattern + 32-step lead pattern, chord progression over 4 bars
    m.bass = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 0 : rnd() < 0.55 ? [0, 0, 7, 12, 3][Math.floor(rnd() * 5)] : null));
    m.lead = Array.from({ length: 32 }, (_, i) => (rnd() < 0.5 ? sc[Math.floor(rnd() * sc.length)] + (rnd() < 0.4 ? 12 : 24) : null));
    m.prog = [0, 0, st.scale === 'phrygian' ? 1 : 5, st.scale === 'minor' ? 7 : 3].map((d) => d);
    m.timer = setInterval(() => this.schedule(m), 25);
    this.music = m;
  }
  stopMusic() { if (this.music) { clearInterval(this.music.timer); this.music = null; } }
  setMusicIntensity(v) { if (this.music) this.music.target = v; }
  schedule(m) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') { m.next = ctx.currentTime + 0.1; return; }
    const spb = 60 / m.st.bpm / 4;
    while (m.next < ctx.currentTime + 0.15) {
      this.playStep(m, m.step, m.next - ctx.currentTime, spb);
      m.step++;
      m.next += spb;
    }
    m.intensity += (m.target - m.intensity) * 0.02;
  }
  playStep(m, step, when, spb) {
    const st = m.st;
    const i16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const I = m.intensity;
    const root = st.root + m.prog[bar];
    const f = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const dest = this.musicBus;
    if (st.menu) {
      if (i16 % 4 === 0) this.tone('sine', f(root - 12), f(root - 12), spb * 6, 0.22, when, dest, 0.02);
      if (i16 % 2 === 0) { const sc = SCALES[st.scale]; const n = root + 12 + sc[(step * 3 + bar) % sc.length]; this.tone('triangle', f(n), f(n), spb * 3, 0.1, when, this.leadBus, 0.01); }
      if (i16 === 0) { for (const iv of [0, 7, 12, 15]) this.tone('sawtooth', f(root + iv) * 0.5, f(root + iv) * 0.5, spb * 15, 0.03, when, dest, 0.4); }
      return;
    }
    // drums
    if (i16 % 4 === 0) { this.tone('sine', 150, 42, 0.18, 0.55 * (0.6 + I * 0.4), when, dest, 0.002); }
    if (i16 % 8 === 4) { this.noise(0.14, 0.2 * (0.5 + I * 0.5), 2600, 1800, 'bandpass', when, 0.8, dest); this.tone('triangle', 240, 140, 0.1, 0.1, when, dest); }
    if (i16 % 4 === 2) this.noise(0.04, 0.1 * (0.4 + I), 9000, 7000, 'highpass', when, 1, dest);
    if (I > 0.6 && i16 % 2 === 1) this.noise(0.025, 0.05, 9000, 8000, 'highpass', when, 1, dest);
    // bass
    const b = m.bass[i16];
    if (b !== null && b !== undefined) {
      const n = root - 12 + b;
      this.tone('sawtooth', f(n), f(n), spb * 0.9, 0.2, when, dest, 0.003);
    }
    // pad on bar start
    if (i16 === 0) for (const iv of [0, 3, 7, 10]) this.tone('sawtooth', f(root + iv), f(root + iv) * 1.003, spb * 16, 0.028 * (0.5 + I), when, dest, 0.5);
    // lead
    if (I > 0.45) {
      const l = m.lead[step % 32];
      if (l !== null && l !== undefined) {
        const n = root + 12 + l;
        this.tone('square', f(n), f(n), spb * 1.8, 0.05 * I, when, this.leadBus, 0.003);
      }
    }
  }
}
