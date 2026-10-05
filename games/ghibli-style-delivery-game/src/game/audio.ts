type SfxName =
  | "acorn"
  | "deliver"
  | "heart"
  | "polite"
  | "awkward"
  | "pickup"
  | "talk"
  | "select"
  | "tick"
  | "start"
  | "over"
  | "step"
  | "express";

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  muted = false;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem("lotw-muted") === "1";
    } catch {
      /* ignore */
    }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem("lotw-muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.2, dest?: AudioNode, slide = 0) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case "acorn":
        this.tone(1046, t, 0.09, "triangle", 0.18);
        this.tone(1568, t + 0.06, 0.14, "triangle", 0.16);
        break;
      case "deliver":
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.07, 0.25, "triangle", 0.2));
        break;
      case "express":
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, t + i * 0.05, 0.3, "square", 0.07));
        break;
      case "heart":
        [1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, t + i * 0.05, 0.4, "sine", 0.14));
        break;
      case "polite":
        this.tone(659, t, 0.15, "triangle", 0.16);
        this.tone(784, t + 0.08, 0.2, "triangle", 0.14);
        break;
      case "awkward":
        this.tone(220, t, 0.25, "sawtooth", 0.06, undefined, -80);
        this.tone(196, t + 0.12, 0.3, "sawtooth", 0.05, undefined, -60);
        break;
      case "pickup":
        [392, 523, 659].forEach((f, i) => this.tone(f, t + i * 0.06, 0.18, "triangle", 0.18));
        break;
      case "talk":
        this.tone(560 + Math.random() * 120, t, 0.05, "square", 0.03);
        break;
      case "select":
        this.tone(880, t, 0.06, "triangle", 0.12);
        break;
      case "tick":
        this.tone(1200, t, 0.04, "square", 0.04);
        break;
      case "start":
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.06, 0.3, "triangle", 0.16));
        break;
      case "over":
        [659, 523, 440, 349].forEach((f, i) => this.tone(f, t + i * 0.18, 0.5, "triangle", 0.15));
        break;
      case "step":
        this.tone(140 + Math.random() * 40, t, 0.04, "triangle", 0.035);
        break;
    }
  }

  // gentle pentatonic waltz
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    const melody = [
      76, 0, 79, 81, 0, 79, 76, 0, 74, 72, 0, 74,
      76, 0, 79, 84, 0, 81, 79, 0, 76, 74, 0, 0,
      72, 0, 74, 76, 0, 79, 81, 0, 79, 76, 0, 74,
      72, 0, 69, 72, 0, 74, 72, 0, 0, 0, 0, 0,
    ];
    const bass = [48, 55, 52, 45, 52, 48, 53, 48];
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const beat = 0.26;
    const sched = () => {
      if (!this.ctx || !this.musicGain) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.4) {
        const i = this.step % melody.length;
        const n = melody[i];
        if (n) this.tone(mtof(n), this.nextNoteTime, beat * 2.2, "triangle", 0.12, this.musicGain);
        if (i % 6 === 0) {
          const b = bass[Math.floor(i / 6) % bass.length];
          this.tone(mtof(b), this.nextNoteTime, beat * 5, "sine", 0.18, this.musicGain);
          this.tone(mtof(b + 7), this.nextNoteTime + beat * 2, beat * 2, "sine", 0.07, this.musicGain);
          this.tone(mtof(b + 12), this.nextNoteTime + beat * 4, beat * 2, "sine", 0.06, this.musicGain);
        }
        this.nextNoteTime += beat;
        this.step++;
      }
    };
    this.musicTimer = window.setInterval(sched, 100);
    sched();
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
