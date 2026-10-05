/**
 * Tiny procedural sound engine — every sound is synthesized at runtime with
 * WebAudio, so there are zero assets to download and no latency.
 */

type ToneOpts = {
  freq: number;
  to?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
  attack?: number;
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    type Ctor = typeof AudioContext;
    const W = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    const Ctor = W.AudioContext || W.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // one shared noise buffer for explosions / impacts
      const len = Math.floor(this.ctx.sampleRate * 0.7);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch {
      this.ctx = null;
    }
  }

  private tone(o: ToneOpts) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "square";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.dur ?? 0.12));
    const dur = o.dur ?? 0.12;
    const peak = o.gain ?? 0.18;
    const atk = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private burst(dur: number, gain: number, from: number, to: number, delay = 0, q = 1) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Typing blip — pitch climbs with the combo for a satisfying ladder. */
  key(step: number) {
    const base = 440 * Math.pow(2, Math.min(step, 14) / 12);
    this.tone({ freq: base, to: base * 1.02, type: "square", dur: 0.055, gain: 0.075 });
    this.tone({ freq: base * 2, type: "triangle", dur: 0.035, gain: 0.03 });
  }

  error() {
    this.tone({ freq: 150, to: 70, type: "sawtooth", dur: 0.16, gain: 0.1 });
    this.burst(0.1, 0.05, 900, 200);
  }

  explode(power = 1) {
    this.burst(0.28 + power * 0.08, 0.24, 2600, 180, 0, 4);
    this.tone({ freq: 320 * (1 + power * 0.1), to: 60, type: "sawtooth", dur: 0.22, gain: 0.12 });
    this.tone({ freq: 880, to: 180, type: "triangle", dur: 0.16, gain: 0.06, delay: 0.01 });
  }

  bonus() {
    [0, 4, 7, 12].forEach((s, i) =>
      this.tone({ freq: 523 * Math.pow(2, s / 12), type: "triangle", dur: 0.14, gain: 0.1, delay: i * 0.055 }),
    );
  }

  heal() {
    this.tone({ freq: 520, to: 1040, type: "sine", dur: 0.28, gain: 0.13 });
    this.tone({ freq: 780, to: 1560, type: "sine", dur: 0.24, gain: 0.07, delay: 0.06 });
  }

  damage() {
    this.burst(0.5, 0.3, 700, 60, 0, 2);
    this.tone({ freq: 190, to: 45, type: "sawtooth", dur: 0.45, gain: 0.16 });
  }

  levelUp() {
    [0, 5, 9, 12, 17].forEach((s, i) =>
      this.tone({ freq: 392 * Math.pow(2, s / 12), type: "square", dur: 0.16, gain: 0.085, delay: i * 0.06 }),
    );
  }

  start() {
    [0, 7, 12].forEach((s, i) =>
      this.tone({ freq: 330 * Math.pow(2, s / 12), type: "square", dur: 0.15, gain: 0.1, delay: i * 0.07 }),
    );
  }

  gameOver() {
    [12, 8, 5, 0, -5].forEach((s, i) =>
      this.tone({ freq: 392 * Math.pow(2, s / 12), type: "sawtooth", dur: 0.34, gain: 0.1, delay: i * 0.13 }),
    );
    this.burst(1.1, 0.2, 1400, 60, 0.1, 2);
  }

  ui() {
    this.tone({ freq: 660, type: "square", dur: 0.05, gain: 0.06 });
  }
}

export const sfx = new Sfx();
