// Vaelune's score and its voices are synthesised at runtime — no audio files.
// Sea bed, wind, a slow minor pad, bells, whispers, and the low hum the tide makes.
export class Soundscape {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.totality = 0.35;
    this.danger = 0;
    this.tide = 0;
    this._whisperT = 3;
    this._heartT = 0;
    this.drones = [];
    this._melT = 4;
    this.chordIndex = 0;
    this.brightness = 0.0;
  }

  /* ─────────────────────────── graph construction ─────────────────────────── */

  async start() {
    if (this.ready) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: 'playback' });
    this.ctx = ctx;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (_e) { /* ignore */ } }

    const master = ctx.createGain();
    master.gain.value = 0.0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3.2;
    comp.attack.value = 0.02; comp.release.value = 0.4;
    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 20000;
    master.connect(comp); comp.connect(this.masterFilter); this.masterFilter.connect(ctx.destination);
    this.master = master;

    // ── reverb: a long, wet stone room under a metre of water
    const conv = ctx.createConvolver();
    conv.buffer = this._impulse(4.2, 2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.5;
    this.dry = ctx.createGain(); this.dry.gain.value = 0.85;
    conv.connect(this.wet); this.wet.connect(master);
    this.dry.connect(master);
    this.reverb = conv;
    this.reverbIn = ctx.createGain();
    this.reverbIn.connect(conv);

    this.noiseBuf = this._noise(6.0);

    this._beds();
    this._music();

    // duck music under dialogue
    this.duckGain = master;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 1.0;
    this.bedsGain = ctx.createGain(); this.bedsGain.gain.value = 1.0;

    master.gain.setTargetAtTime(0.85, ctx.currentTime, 2.5);
    this.ready = true;
  }

  _noise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;     // brown-ish
      d[i] = (w * 0.35 + last * 3.2) * 0.6;
    }
    // fade the loop point
    for (let i = 0; i < 2000; i++) {
      const k = i / 2000;
      d[i] *= k; d[len - 1 - i] *= k;
    }
    return buf;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - t * 0.2);
      }
    }
    return buf;
  }

  _lfo(rate, depth, target) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.frequency.value = rate;
    const g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(target); o.start();
    return o;
  }

  _beds() {
    const ctx = this.ctx;
    const noiseLoop = (filterType, freq, q, gain, seconds = 6) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g);
      g.connect(this.dry); g.connect(this.reverbIn);
      src.start(0, Math.random() * 4);
      return { g, f, src };
    };

    // the sea: everything is happening under a metre of water
    this.sea = noiseLoop('lowpass', 320, 0.7, 0.22);
    this._lfo(0.055, 90, this.sea.f.frequency);
    this._lfo(0.031, 0.05, this.sea.g.gain);

    // wind through the empty galleries
    this.wind = noiseLoop('bandpass', 620, 0.9, 0.035);
    this._lfo(0.043, 260, this.wind.f.frequency);
    this._lfo(0.017, 0.022, this.wind.g.gain);

    // the hum under the city — two detuned voices a fifth apart
    const humGain = ctx.createGain(); humGain.gain.value = 0.0;
    const humFilt = ctx.createBiquadFilter(); humFilt.type = 'lowpass'; humFilt.frequency.value = 260;
    const mk = (f, type, g) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(humFilt); o.start();
      this._lfo(0.07 + Math.random() * 0.05, f * 0.004, o.frequency);
      return o;
    };
    mk(41.2, 'sine', 0.5); mk(61.7, 'triangle', 0.16); mk(82.4, 'sine', 0.09);
    humFilt.connect(humGain);
    humGain.connect(this.dry); humGain.connect(this.reverbIn);
    humGain.gain.setTargetAtTime(0.30, ctx.currentTime, 6);
    this.hum = humGain;
  }

  /* ─────────────────────────── music ─────────────────────────── */
  // Am7 – Fmaj7 – Cmaj7 – G6, sixteen seconds each, played by a slow pad.
  static CHORDS = [
    [55.0, 82.41, 110.0, 164.81, 220.0],  // A  C  E  G
    [43.65, 87.31, 130.81, 174.61, 261.63], // F  A  C  E
    [65.41, 98.0, 130.81, 196.0, 246.94],   // C  G  C  G  B
    [49.0, 73.42, 98.0, 146.83, 196.0],     // G  D  G  D  G
  ];
  static PENTA = [55.0, 65.41, 73.42, 82.41, 98.0, 110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 329.63];

  _music() {
    const ctx = this.ctx;
    this.padBus = ctx.createGain(); this.padBus.gain.value = 0.5;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 700; this.padFilter.Q.value = 0.6;
    this.padBus.connect(this.padFilter);
    this.padFilter.connect(this.dry); this.padFilter.connect(this.reverbIn);
    this._lfo(0.035, 260, this.padFilter.frequency);

    this.voices = [];
    for (let i = 0; i < 5; i++) {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = 110;
      o.detune.value = (i - 2) * 5;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.padBus); o.start();
      this.voices.push({ o, g });
    }
    this._chordStart = this.ctx.currentTime;
    this.chordIndex = 0;
    this._retune(0.1);
  }

  _retune(time = 3.5) {
    const chord = Soundscape.CHORDS[this.chordIndex % Soundscape.CHORDS.length];
    const now = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      const f = chord[i % chord.length] * (i === 4 ? 2 : 1);
      v.o.frequency.setTargetAtTime(f, now, time);
      const bright = 0.055 + this.brightness * 0.05 + (i === 4 ? 0.012 : 0);
      v.g.gain.setTargetAtTime(bright, now, time);
    });
    this.padFilter.frequency.setTargetAtTime(520 + this.brightness * 900, now, time);
  }

  _bell(freq, when = 0, gain = 0.16, dur = 5) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.76;
    const g = ctx.createGain(); const g2 = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g2.gain.setValueAtTime(0, t);
    g2.gain.linearRampToValueAtTime(gain * 0.3, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35);
    o.connect(g); o2.connect(g2);
    g.connect(this.dry); g.connect(this.reverbIn);
    g2.connect(this.reverbIn);
    o.start(t); o.stop(t + dur + 0.1);
    o2.start(t); o2.stop(t + dur + 0.1);
  }

  _note(freq, when = 0, gain = 0.09, dur = 4) {
    const ctx = this.ctx, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g);
    g.connect(this.dry); g.connect(this.reverbIn);
    o.start(t); o.stop(t + dur + 0.1);
  }

  /* ─────────────────────────── one-shots ─────────────────────────── */

  footstep(inWater = true, strength = 0.5) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = inWater ? 0.8 + Math.random() * 0.3 : 1.4;
    const f = ctx.createBiquadFilter();
    f.type = inWater ? 'bandpass' : 'lowpass';
    f.frequency.setValueAtTime(inWater ? 900 + Math.random() * 500 : 2200, t);
    f.frequency.exponentialRampToValueAtTime(inWater ? 260 : 700, t + (inWater ? 0.34 : 0.09));
    f.Q.value = inWater ? 0.9 : 0.6;
    const g = ctx.createGain();
    const peak = (inWater ? 0.14 : 0.07) * (0.5 + strength);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (inWater ? 0.5 : 0.14));
    src.connect(f); f.connect(g);
    g.connect(this.dry); g.connect(this.reverbIn);
    src.start(t); src.stop(t + 0.6);
    if (inWater && strength > 0.6 && Math.random() < 0.25) this.splash(strength * 0.4);
  }

  splash(strength = 0.5) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.1;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2 * strength, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.reverbIn);
    src.start(t); src.stop(t + 1.0);
  }

  memorySting(kind = 'still') {
    if (!this.ready) return;
    if (kind === 'dark') {
      this._bell(110.0, 0, 0.20, 7);
      this._bell(116.5, 0.06, 0.14, 7);   // a semitone of friction
      this.droneSwell(0.8);
    } else if (kind === 'warm') {
      this._bell(329.63, 0, 0.16, 6);
      this._bell(440.0, 0.28, 0.12, 6);
    } else {
      this._bell(220.0, 0, 0.15, 6.5);
      this._bell(329.63, 0.34, 0.10, 6.5);
    }
    this.brightness = Math.min(1, this.brightness + 0.18);
    this._retune(4);
  }

  droneSwell(amount = 0.5) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(38, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 6);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14 * amount, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 8);
    o.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.reverbIn);
    o.start(t); o.stop(t + 8.2);
  }

  whisper(text = '') {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const syllables = Math.max(2, Math.min(7, Math.round((text.length || 40) / 16)));
    for (let i = 0; i < syllables; i++) {
      const at = t + i * (0.14 + Math.random() * 0.1);
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      src.playbackRate.value = 1.6 + Math.random() * 0.6;
      src.loop = true;
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
      f1.frequency.value = 480 + Math.random() * 700;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
      f2.frequency.value = 1400 + Math.random() * 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, at + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      f1.frequency.linearRampToValueAtTime(f1.frequency.value * 0.6, at + 0.16);
      src.connect(f1); f1.connect(f2); f2.connect(g);
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() * 2 - 1) * 0.85;
      g.connect(pan); pan.connect(this.dry); pan.connect(this.reverbIn);
      src.start(at); src.stop(at + 0.25);
    }
  }

  gateGroan() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f0, f1, g0, dur] of [[46, 28, 0.13, 7], [69, 41, 0.07, 7], [23, 15, 0.1, 8]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220 + Math.random() * 120;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(g0, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.reverbIn);
      o.start(t); o.stop(t + dur + 0.2);
    }
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 9);
    src.connect(f); f.connect(g); g.connect(this.dry); g.connect(this.reverbIn);
    src.start(t); src.stop(t + 9.2);
  }

  lantern(on) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (on) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 660;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(this.dry); g.connect(this.reverbIn);
      o.start(t); o.stop(t + 1);
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
      const g2 = ctx.createGain(); g2.gain.value = 0.03;
      src.connect(f); f.connect(g2); this.lanternCrackle = g2;
      g2.connect(this.dry);
      src.start(t);
      this.lanternSrc = src;
      setTimeout(() => { try { this.lanternSrc.stop(); } catch (_e) {} this.lanternSrc = null; this.lanternCrackle = null; }, 9000);
    } else if (this.lanternSrc) {
      try { this.lanternSrc.stop(); } catch (_e) {}
      this.lanternSrc = null; this.lanternCrackle = null;
    }
  }

  heartbeat(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const thump = (at, g0) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(62, at);
      o.frequency.exponentialRampToValueAtTime(34, at + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(g0, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
      o.connect(g); g.connect(this.dry);
      o.start(at); o.stop(at + 0.3);
    };
    thump(t, 0.14 * intensity);
    thump(t + 0.19, 0.09 * intensity);
  }

  chime(freq = 880, gain = 0.1) { this._bell(freq, 0, gain, 4); }

  /** Shard voice: a small spatial drone that answers when you get close. */
  attachDrone(position, accent = 165) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 4; panner.maxDistance = 90; panner.rolloffFactor = 1.4;
    if (panner.positionX) { panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z; }
    else panner.setPosition(position.x, position.y, position.z);

    const g = ctx.createGain(); g.gain.value = 0.0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = accent;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = accent * 1.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(f); f.connect(panner);
    panner.connect(this.dry); panner.connect(this.reverbIn);
    this._lfo(0.11 + Math.random() * 0.1, accent * 0.008, o1.frequency);
    this._lfo(0.07 + Math.random() * 0.08, 0.12, g.gain);
    o1.start(); o2.start();
    const drone = { panner, gain: g, setActive(v) { g.gain.setTargetAtTime(0.10 * v, ctx.currentTime, 1.5); } };
    this.drones.push(drone);
    return drone;
  }

  /* ─────────────────────────── state ─────────────────────────── */

  setListener(pos, forward, up) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    const set = (a, b, c, name) => {
      if (a) { a.setTargetAtTime(b, t, 0.08); return true; }
      return false;
    };
    if (!set(l.positionX, pos.x, 'x')) { if (l.setPosition) l.setPosition(pos.x, pos.y, pos.z); }
    else {
      l.positionX.setTargetAtTime(pos.x, t, 0.08);
      l.positionY.setTargetAtTime(pos.y, t, 0.08);
      l.positionZ.setTargetAtTime(pos.z, t, 0.08);
      l.forwardX.setTargetAtTime(forward.x, t, 0.08);
      l.forwardY.setTargetAtTime(forward.y, t, 0.08);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.08);
      l.upX.setTargetAtTime(up.x, t, 0.08);
      l.upY.setTargetAtTime(up.y, t, 0.08);
      l.upZ.setTargetAtTime(up.z, t, 0.08);
    }
  }

  setTotality(t) {
    this.totality = t;
    if (!this.ready) return;
    this.sea.g.gain.setTargetAtTime(0.20 + t * 0.12, this.ctx.currentTime, 2);
    this.wind.g.gain.setTargetAtTime(0.03 + t * 0.05, this.ctx.currentTime, 2);
  }

  setTide(level) {
    this.tide = level;
    if (!this.ready) return;
    if (this.hum) this.hum.gain.setTargetAtTime(0.26 + level * 0.07, this.ctx.currentTime, 3);
  }

  setUnderwater(on) {
    if (!this.ready) return;
    this.masterFilter.frequency.setTargetAtTime(on ? 420 : 20000, this.ctx.currentTime, 0.25);
  }

  setDanger(d) {
    this.danger = d;
    if (!this.ready) return;
    this.padFilter.Q.setTargetAtTime(0.6 + d * 2.4, this.ctx.currentTime, 1.5);
    if (this.sea) this.sea.f.frequency.setTargetAtTime(320 - d * 160, this.ctx.currentTime, 2);
  }

  /** Update musical time: chord changes, sparse melody, whispers, heartbeats. */
  update(dt, opts = {}) {
    if (!this.ready) return;
    const { danger = 0, sanity = 1, paused = false } = opts;
    if (paused) return;
    this._chordT = (this._chordT || 0) + dt;
    if (this._chordT > 18) { this._chordT = 0; this.chordIndex++; this._retune(5); }

    this._melT -= dt;
    if (this._melT <= 0) {
      this._melT = 6 + Math.random() * 9;
      const p = Soundscape.PENTA;
      const f = p[Math.floor(Math.random() * p.length)] * (Math.random() < 0.3 ? 2 : 1);
      this._note(f, 0, 0.05 + this.brightness * 0.03, 3.5 + Math.random() * 3);
      if (Math.random() < 0.4) this._note(f * (Math.random() < 0.5 ? 1.5 : 1.2), 0.7 + Math.random(), 0.035, 3.5);
    }

    this._whisperT -= dt;
    if (this._whisperT <= 0) {
      this._whisperT = 5 + Math.random() * 12 - danger * 3;
      this.whisper('');
    }
    this._heartT -= dt;
    if (danger > 0.25 && this._heartT <= 0) {
      this._heartT = Math.max(0.62, 1.25 - danger * 0.55);
      this.heartbeat(Math.min(1, danger));
    }
    if (sanity < 0.5 && Math.random() < dt * 0.35) {
      this.whisper('stay');
    }
  }
}
