// Procedural sound effects — everything is synthesised, so there are no
// audio assets to ship. Created lazily on the first user gesture.

class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
    this.lastStep = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // shared white-noise source
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() {
    return this.ctx && !this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  _noise(dur, { filter = 900, type = 'lowpass', gain = 0.3, sweepTo = null, q = 1 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = filter;
    bp.Q.value = q;
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _tone(freq, dur, { type = 'sine', gain = 0.2, to = null, delay = 0, attack = 0.01 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  chomp() {
    this._noise(0.18, { filter: 1600, sweepTo: 300, gain: 0.35, type: 'lowpass' });
    this._tone(150, 0.22, { type: 'sawtooth', gain: 0.16, to: 48 });
  }

  biteAir() {
    this._noise(0.12, { filter: 2600, sweepTo: 900, gain: 0.13, type: 'bandpass', q: 1.4 });
  }

  kill(pitch = 1) {
    this._tone(220 * pitch, 0.5, { type: 'triangle', gain: 0.2, to: 90 * pitch });
    this._noise(0.32, { filter: 900, sweepTo: 180, gain: 0.2 });
  }

  roar() {
    this._tone(96, 0.95, { type: 'sawtooth', gain: 0.24, to: 46, attack: 0.06 });
    this._tone(146, 0.85, { type: 'square', gain: 0.08, to: 70, attack: 0.08 });
    this._noise(0.9, { filter: 700, sweepTo: 180, gain: 0.22, type: 'lowpass' });
  }

  screech() {
    this._tone(760, 0.3, { type: 'sawtooth', gain: 0.09, to: 1500 });
    this._noise(0.2, { filter: 3000, gain: 0.08, type: 'bandpass', q: 3 });
  }

  hurt() {
    this._tone(300, 0.28, { type: 'square', gain: 0.16, to: 90 });
    this._noise(0.16, { filter: 500, gain: 0.16 });
  }

  step(hard) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now - this.lastStep < 0.09) return;
    this.lastStep = now;
    this._noise(hard ? 0.1 : 0.06, { filter: hard ? 420 : 700, gain: hard ? 0.075 : 0.035 });
  }

  combo(level) {
    const base = 380 * Math.pow(1.09, Math.min(level, 8));
    this._tone(base, 0.14, { type: 'triangle', gain: 0.12 });
    this._tone(base * 1.5, 0.18, { type: 'triangle', gain: 0.08, delay: 0.05 });
  }

  waveClear() {
    [0, 0.11, 0.22, 0.36].forEach((d, i) => {
      this._tone([330, 415, 494, 660][i], 0.34, { type: 'triangle', gain: 0.14, delay: d });
    });
  }

  gameOver() {
    this._tone(150, 1.6, { type: 'sawtooth', gain: 0.18, to: 42, attack: 0.05 });
    this._tone(75, 1.9, { type: 'sine', gain: 0.16, to: 30, attack: 0.1 });
    this._noise(1.4, { filter: 400, sweepTo: 90, gain: 0.12 });
  }

  start() {
    this._tone(120, 0.7, { type: 'sawtooth', gain: 0.2, to: 55, attack: 0.05 });
    this._noise(0.6, { filter: 800, sweepTo: 200, gain: 0.14 });
  }

  /** Low wind/insect bed, started once per run. */
  startAmbience() {
    if (!this.ready || this.ambient) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 420;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.028;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.014;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.ambient = { src, g, lfo };
  }

  stopAmbience() {
    if (!this.ambient) return;
    try {
      this.ambient.src.stop();
      this.ambient.lfo.stop();
    } catch (_) {
      /* already stopped */
    }
    this.ambient = null;
  }
}

export const audio = new AudioKit();
