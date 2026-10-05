import { pickWord, TIER_SHORT } from "./words";
import { sfx } from "./audio";

export type Difficulty = "chill" | "standard" | "blitz";

export interface HudState {
  score: number;
  combo: number;
  mult: number;
  hp: number;
  maxHp: number;
  level: number;
  words: number;
  wpm: number;
  acc: number;
  time: number;
  danger: number;
  overdrive: boolean;
  target: string;
  targetTyped: number;
  banner: { id: number; text: string; sub: string; tone: "good" | "bad" | "level" } | null;
}

export interface Result {
  score: number;
  words: number;
  level: number;
  wpm: number;
  acc: number;
  bestCombo: number;
  time: number;
  difficulty: Difficulty;
}

type WordKind = "normal" | "gold" | "heal";

interface Word {
  id: number;
  text: string;
  typed: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  phase: number;
  kind: WordKind;
  w: number;
  err: number;
  born: number;
  dead: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  g: number;
  drag: number;
  char?: string;
  ring?: boolean;
  rot?: number;
  vr?: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
}

const DIFF: Record<Difficulty, { fall: number; spawn: number; hp: number; mul: number; max: number }> = {
  chill: { fall: 19, spawn: 1650, hp: 6, mul: 0.8, max: 6 },
  standard: { fall: 15, spawn: 1300, hp: 5, mul: 1, max: 8 },
  blitz: { fall: 11.5, spawn: 950, hp: 4, mul: 1.6, max: 10 },
};

const PALETTE: Record<WordKind, { base: string; done: string; glow: string }> = {
  normal: { base: "#c9d8f0", done: "#22d3ee", glow: "rgba(34,211,238," },
  gold: { base: "#fde9a8", done: "#fbbf24", glow: "rgba(251,191,36," },
  heal: { base: "#bbf7d0", done: "#34d399", glow: "rgba(52,211,153," },
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class TypingGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: HudState) => void;
  private onOver: (r: Result) => void;

  W = 0;
  H = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;
  private t = 0;
  private hudT = -1;
  private fontSize = 20;
  private charW = 12;

  mode: "ambient" | "playing" | "paused" | "over" = "ambient";
  difficulty: Difficulty = "standard";

  private words: Word[] = [];
  private parts: Particle[] = [];
  private floats: FloatText[] = [];
  private stars: Star[] = [];
  private target: Word | null = null;
  private used = new Set<string>();
  private nextId = 1;

  private score = 0;
  private combo = 0;
  private bestCombo = 0;
  private hp = 5;
  private maxHp = 5;
  private level = 1;
  private wordsDone = 0;
  private correct = 0;
  private wrong = 0;
  private elapsed = 0;

  private spawnT = 0;
  private spawnEvery = 1.3;
  private shake = 0;
  private shakeX = 0;
  private shakeY = 0;
  private shakeR = 0;
  private hitStop = 0;
  private flash = 0;
  private flashColor = "255,60,80";
  private gridScroll = 0;
  private bannerId = 0;
  private banner: HudState["banner"] = null;
  private linePulse = 0;
  private overdrive = 0;

  constructor(
    canvas: HTMLCanvasElement,
    cb: { onHud: (h: HudState) => void; onOver: (r: Result) => void },
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.onHud = cb.onHud;
    this.onOver = cb.onOver;
    this.resize();
    this.seedStars();
    this.mode = "ambient";
    this.spawnEvery = 1.1;
    this.spawnT = 0.4;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
    // re-measure once the webfont arrives so letter spacing is pixel-perfect
    document.fonts?.ready?.then(() => this.resize()).catch(() => {});
  }

  /* ------------------------------------------------------------------ setup */

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(320, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const oldH = this.H;
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.fontSize = Math.round(clamp(w * 0.036, 18, 36));
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.font = `700 ${this.fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    this.charW = ctx.measureText("M").width || this.fontSize * 0.6;
    for (const wd of this.words) {
      wd.w = wd.text.length * this.charW;
      wd.x = clamp(wd.x, wd.w / 2 + 8, w - wd.w / 2 - 8);
      // keep relative progress when the playfield height changes (e.g. the
      // on-screen keyboard appearing on mobile) so nothing instantly dies
      if (oldH > 0 && oldH !== h) {
        wd.y = clamp((wd.y / oldH) * h, -20, h - 40);
        wd.vy *= h / oldH; // preserve the crossing time in seconds
      }
    }
    if (!this.stars.length) this.seedStars();
  }

  private seedStars() {
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: rnd(0.25, 1),
    }));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  /* ------------------------------------------------------------ lifecycle */

  startGame(diff: Difficulty) {
    this.difficulty = diff;
    const cfg = DIFF[diff];
    this.mode = "playing";
    this.words = [];
    this.parts = [];
    this.floats = [];
    this.target = null;
    this.used.clear();
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.level = 1;
    this.wordsDone = 0;
    this.correct = 0;
    this.wrong = 0;
    this.elapsed = 0;
    this.shake = 10;
    this.flash = 0;
    this.overdrive = 0;
    this.spawnEvery = cfg.spawn / 1000;
    this.spawnT = 0.6;
    // a staggered wave of words so the screen is alive instantly
    const o = this.H * 0.2;
    this.spawn(-o * 1.05);
    this.spawn(-o * 0.55);
    this.spawn(-o * 0.05);
    this.banner = { id: ++this.bannerId, text: "GO!", sub: "type fast", tone: "good" };
    sfx.start();
    this.pushHud(true);
  }

  goAmbient() {
    this.mode = "ambient";
    this.words = [];
    this.parts = [];
    this.floats = [];
    this.target = null;
    this.spawnEvery = 1.2;
    this.spawnT = 0.3;
  }

  pause() {
    if (this.mode !== "playing") return;
    this.mode = "paused";
    sfx.ui();
    this.pushHud(true);
  }

  resume() {
    if (this.mode !== "paused") return;
    this.mode = "playing";
    this.last = performance.now();
    sfx.ui();
    this.pushHud(true);
  }

  /* ---------------------------------------------------------------- input */

  key(raw: string) {
    const ch = raw.toLowerCase();
    if (this.mode !== "playing" || ch.length !== 1) return;
    if (!/[a-z0-9]/.test(ch)) return;

    const cur = this.target && !this.target.dead ? this.target : null;
    let hitWord: Word | null = null;
    let ok = false;

    if (cur && cur.text[cur.typed] === ch) {
      hitWord = cur;
      ok = true;
    } else if (!cur) {
      let best: Word | null = null;
      for (const w of this.words) {
        if (w.dead || w.typed !== 0 || w.text[0] !== ch) continue;
        if (!best || w.y > best.y) best = w;
      }
      if (best) {
        this.target = best;
        hitWord = best;
        ok = true;
      }
    }

    if (ok && hitWord) {
      hitWord.typed++;
      this.correct++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      sfx.key(this.combo * 0.7);
      this.sparkAt(hitWord);
      if (hitWord.typed >= hitWord.text.length) this.complete(hitWord);
      else if (this.combo > 0 && this.combo % 12 === 0) {
        this.setBanner(`${this.combo} CHAIN`, "keep it rolling", "good");
      }
    } else {
      this.wrong++;
      this.combo = 0;
      sfx.error();
      this.shake = Math.max(this.shake, 5);
      if (cur) cur.err = 0.28;
      this.float(cur ? cur.x : this.W / 2, cur ? cur.y - 20 : this.H * 0.55, "MISS", "#fb7185", 16);
    }
    this.pushHud();
  }

  backspace() {
    if (this.mode !== "playing") return;
    const cur = this.target;
    if (!cur) return;
    if (cur.typed > 0) {
      cur.typed--;
      this.correct = Math.max(0, this.correct - 1);
      sfx.ui();
    } else {
      this.target = null;
    }
    this.pushHud(true);
  }

  /* --------------------------------------------------------------- helpers */

  private setBanner(text: string, sub: string, tone: "good" | "bad" | "level") {
    this.banner = { id: ++this.bannerId, text, sub, tone };
    this.pushHud(true);
  }

  private float(x: number, y: number, text: string, color: string, size = 18) {
    this.floats.push({ x, y, vy: -46, life: 0.85, max: 0.85, text, color, size });
    if (this.floats.length > 26) this.floats.shift();
  }

  private sparkAt(w: Word) {
    const pal = PALETTE[w.kind];
    const i = w.typed - 1;
    const x = w.x - w.w / 2 + (i + 0.5) * this.charW;
    const y = w.y;
    for (let n = 0; n < 5; n++) {
      this.parts.push({
        x,
        y,
        vx: rnd(-70, 70),
        vy: rnd(-110, -20),
        life: rnd(0.2, 0.4),
        max: 0.4,
        size: rnd(1.4, 2.8),
        color: pal.done,
        g: 340,
        drag: 2,
      });
    }
  }

  private explodeWord(w: Word) {
    const pal = PALETTE[w.kind];
    const n = Math.min(46, 12 + w.text.length * 3);
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, Math.PI * 2);
      const sp = rnd(70, 340);
      this.parts.push({
        x: w.x + rnd(-w.w / 2, w.w / 2),
        y: w.y + rnd(-8, 8),
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 60,
        life: rnd(0.35, 0.85),
        max: 0.85,
        size: rnd(1.6, 4.2),
        color: i % 3 === 0 ? pal.done : pal.base,
        g: 420,
        drag: 1.4,
      });
    }
    // flying characters
    for (let i = 0; i < w.text.length; i++) {
      const ang = rnd(-Math.PI * 0.9, -Math.PI * 0.1);
      const sp = rnd(130, 300);
      this.parts.push({
        x: w.x - w.w / 2 + (i + 0.5) * this.charW,
        y: w.y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rnd(0.5, 0.9),
        max: 0.9,
        size: this.fontSize * rnd(0.5, 0.8),
        color: pal.done,
        g: 900,
        drag: 0.6,
        char: w.text[i],
        rot: rnd(-0.6, 0.6),
        vr: rnd(-7, 7),
      });
    }
    this.parts.push({
      x: w.x,
      y: w.y,
      vx: 0,
      vy: 0,
      life: 0.45,
      max: 0.45,
      size: 8,
      color: pal.done,
      g: 0,
      drag: 0,
      ring: true,
      vr: 520,
    });
    if (this.parts.length > 620) this.parts.splice(0, this.parts.length - 620);
  }

  private complete(w: Word) {
    const cfg = DIFF[this.difficulty];
    this.wordsDone++;
    const mult = this.mult();
    let base = 10 + w.text.length * 7;
    if (w.kind === "gold") {
      base *= 3;
      sfx.bonus();
      this.setBanner("GOLD x3", "bonus payload", "good");
      this.shake = Math.max(this.shake, 12);
      this.flash = Math.max(this.flash, 0.5);
      this.flashColor = "251,191,36";
    } else {
      sfx.explode(clamp(w.text.length / 10, 0, 1));
      this.shake = Math.max(this.shake, 6 + w.text.length * 0.5);
    }
    if (w.kind === "heal") {
      if (this.hp < this.maxHp) {
        this.hp++;
        sfx.heal();
        this.float(w.x, w.y - 30, "+1 SHIELD", "#34d399", 20);
        this.setBanner("SHIELD RESTORED", "+1 integrity", "good");
      } else {
        base *= 2;
        this.float(w.x, w.y - 30, "+FULL", "#34d399", 18);
      }
    }
    const gain = Math.round(base * mult * cfg.mul);
    this.score += gain;
    this.hitStop = 0.055;
    this.explodeWord(w);
    this.float(w.x, w.y - 16, `+${gain}`, mult > 1 ? "#fbbf24" : "#67e8f9", mult > 1 ? 22 : 18);
    if (mult > 1) this.float(w.x, w.y + 14, `x${mult}`, "#f0f", 16);

    if (this.combo > 0 && this.combo % 4 === 0) {
      this.parts.push({
        x: w.x,
        y: w.y,
        vx: 0,
        vy: 0,
        life: 0.6,
        max: 0.6,
        size: 10,
        color: "#f0f",
        g: 0,
        drag: 0,
        ring: true,
        vr: 900,
      });
      this.flash = Math.max(this.flash, 0.3);
      this.flashColor = "240,0,255";
    }

    this.used.delete(w.text);
    w.dead = true;
    if (this.target === w) this.target = null;

    const lvl = 1 + Math.floor(this.wordsDone / 10);
    if (lvl > this.level) {
      this.level = lvl;
      sfx.levelUp();
      this.setBanner(`LEVEL ${lvl}`, "speed up!", "level");
      this.shake = Math.max(this.shake, 14);
      this.overdrive = 1.6;
      this.flash = Math.max(this.flash, 0.45);
      this.flashColor = "240,0,255";
    }
    this.pushHud(true);
  }

  private mult() {
    return Math.min(10, 1 + Math.floor(this.combo / 4));
  }

  private damage(w: Word) {
    if (this.mode !== "playing") return;
    this.hp--;
    this.combo = 0;
    this.flash = 1;
    this.flashColor = "255,60,80";
    this.shake = Math.max(this.shake, 20);
    this.hitStop = 0.1;
    this.linePulse = 1;
    sfx.damage();
    const n = 34;
    for (let i = 0; i < n; i++) {
      const ang = rnd(-Math.PI, 0);
      const sp = rnd(90, 380);
      this.parts.push({
        x: w.x + rnd(-w.w / 2, w.w / 2),
        y: this.H - 12,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rnd(0.4, 0.9),
        max: 0.9,
        size: rnd(2, 5),
        color: i % 2 ? "#fb7185" : "#f43f5e",
        g: 620,
        drag: 1.1,
      });
    }
    this.float(w.x, this.H - 70, "-1 SHIELD", "#fb7185", 20);
    this.used.delete(w.text);
    w.dead = true;
    if (this.target === w) this.target = null;
    if (this.hp <= 0) this.gameOver();
    else this.setBanner("BREACH", "word escaped", "bad");
    this.pushHud(true);
  }

  private gameOver() {
    if (this.mode === "over") return;
    this.mode = "over";
    this.shake = 34;
    this.flash = 1.2;
    sfx.gameOver();
    for (let i = 0; i < 90; i++) {
      const ang = rnd(0, Math.PI * 2);
      const sp = rnd(80, 520);
      this.parts.push({
        x: this.W / 2,
        y: this.H * 0.62,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rnd(0.6, 1.5),
        max: 1.5,
        size: rnd(2, 6),
        color: i % 3 === 0 ? "#f0f" : i % 3 === 1 ? "#22d3ee" : "#fb7185",
        g: 260,
        drag: 0.9,
      });
    }
    this.onOver(this.result());
  }

  result(): Result {
    const mins = Math.max(this.elapsed, 1) / 60;
    return {
      score: this.score,
      words: this.wordsDone,
      level: this.level,
      wpm: Math.round(this.correct / 5 / mins),
      acc: this.correct + this.wrong === 0 ? 100 : Math.round((this.correct / (this.correct + this.wrong)) * 100),
      bestCombo: this.bestCombo,
      time: this.elapsed,
      difficulty: this.difficulty,
    };
  }

  private pushHud(force = false) {
    if (!force && this.t - this.hudT < 0.09) return;
    this.hudT = this.t;
    let danger = 0;
    for (const w of this.words) {
      if (w.dead) continue;
      danger = Math.max(danger, clamp((w.y - 30) / (this.H - 90), 0, 1));
    }
    const mins = Math.max(this.elapsed, 1) / 60;
    this.onHud({
      score: this.score,
      combo: this.combo,
      mult: this.mult(),
      hp: Math.max(0, this.hp),
      maxHp: this.maxHp,
      level: this.level,
      words: this.wordsDone,
      wpm: Math.round(this.correct / 5 / mins),
      acc: this.correct + this.wrong === 0 ? 100 : Math.round((this.correct / (this.correct + this.wrong)) * 100),
      time: this.elapsed,
      danger,
      overdrive: this.mult() >= 4,
      target: this.target && !this.target.dead ? this.target.text : "",
      targetTyped: this.target ? this.target.typed : 0,
      banner: this.banner,
    });
  }

  /* ----------------------------------------------------------------- spawn */

  private spawn(yOff = 0) {
    const playing = this.mode === "playing";
    const cfg = DIFF[this.difficulty];
    const maxWords = playing ? Math.min(cfg.max, 3 + Math.floor(this.level * 0.7)) : 5;
    const alive = this.words.filter((w) => !w.dead).length;
    if (alive >= maxWords) return;

    for (let attempt = 0; attempt < 14; attempt++) {
      const text = playing ? pickWord(this.level, this.used) : TIER_SHORT[(Math.random() * TIER_SHORT.length) | 0];
      const w = text.length * this.charW;
      if (w > this.W - 30) continue;
      let kind: WordKind = "normal";
      if (playing) {
        const r = Math.random();
        if (this.level >= 2 && r < 0.07) kind = "gold";
        else if (this.level >= 3 && r < 0.13 && this.hp < this.maxHp) kind = "heal";
      }
      const margin = w / 2 + 12;
      const x = rnd(margin, this.W - margin);
      let clash = false;
      for (const o of this.words) {
        if (o.dead) continue;
        if (Math.abs(o.y - (-14 + yOff)) > 70) continue;
        if (Math.abs(o.x - x) < (o.w + w) / 2 + 18) clash = true;
      }
      if (clash) continue;

      const fall = playing
        ? clamp(cfg.fall - (this.level - 1) * 0.85, 3.4, 40) * (1 + text.length * 0.014)
        : 26;
      this.used.add(text);
      this.words.push({
        id: this.nextId++,
        text,
        typed: 0,
        x,
        y: -14 + yOff,
        vy: this.H / fall,
        vx: rnd(-6, 6),
        phase: rnd(0, 6.28),
        kind,
        w,
        err: 0,
        born: this.t,
        dead: false,
      });
      return;
    }
  }

  /* ------------------------------------------------------------------ loop */

  private loop(ts: number) {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.05) dt = 0.05;
    this.t += dt;
    this.update(dt);
    this.draw();
  }

  private update(dt: number) {
    const playing = this.mode === "playing";
    if (this.mode === "paused") return;

    // world time (hit-stop slows falling for juicy impact)
    const wdt = this.hitStop > 0 ? dt * 0.22 : dt;
    this.hitStop = Math.max(0, this.hitStop - dt);

    if (playing) {
      this.elapsed += dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawn();
        this.spawnT = this.spawnEvery * Math.pow(0.93, this.level - 1) * rnd(0.72, 1.3);
      }
    } else if (this.mode === "ambient" || this.mode === "over") {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.mode === "ambient") {
        this.spawn();
        this.spawnT = this.spawnEvery * rnd(0.7, 1.5);
      }
    }

    const scrollSpeed = (this.mode === "playing" ? 26 + this.level * 3.5 : 16) * (this.overdrive > 0 ? 1.6 : 1);
    this.gridScroll = (this.gridScroll + scrollSpeed * dt) % 64;
    this.overdrive = Math.max(0, this.overdrive - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.linePulse = Math.max(0, this.linePulse - dt * 1.6);
    this.shake *= Math.pow(0.0025, dt);
    if (this.shake < 0.05) this.shake = 0;
    this.shakeX = rnd(-1, 1) * this.shake;
    this.shakeY = rnd(-1, 1) * this.shake;
    this.shakeR = rnd(-1, 1) * this.shake * 0.0012;

    for (const s of this.stars) {
      s.y += (0.045 + s.z * 0.12) * dt * (playing ? 1.5 : 0.8);
      if (s.y > 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }

    // words
    const floor = this.H - 16;
    for (const w of this.words) {
      if (w.dead) continue;
      w.y += w.vy * wdt;
      w.x += w.vx * wdt;
      if (w.x < w.w / 2 + 8 || w.x > this.W - w.w / 2 - 8) w.vx *= -1;
      w.err = Math.max(0, w.err - dt * 2.6);
      if (playing && w.y >= floor) this.damage(w);
      else if (!playing && w.y >= floor + 30) {
        w.dead = true;
        this.used.delete(w.text);
      }
    }
    if (this.words.length > 40 || this.words.some((w) => w.dead)) {
      this.words = this.words.filter((w) => !w.dead);
    }
    if (this.target && this.target.dead) this.target = null;

    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      if (p.ring) {
        p.size += (p.vr ?? 400) * dt;
        continue;
      }
      p.vy += p.g * dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * 0.25 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr ?? 3) * dt;
    }

    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 40 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }

    if (playing) this.pushHud();
  }

  /* ------------------------------------------------------------------ draw */

  private draw() {
    const ctx = this.ctx;
    const { W, H } = this;
    const od = this.overdrive > 0;

    // backdrop
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, od ? "#150a20" : "#070a18");
    g.addColorStop(0.55, "#05060f");
    g.addColorStop(1, od ? "#1a0a18" : "#0a0714");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of this.stars) {
      const a = 0.12 + s.z * 0.4;
      ctx.fillStyle = `rgba(160,220,255,${a})`;
      const sz = s.z * 2.1;
      ctx.fillRect(s.x * W, s.y * H, sz, sz);
    }

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    if (this.shakeR) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(this.shakeR);
      ctx.translate(-W / 2, -H / 2);
    }

    this.drawGrid(od);
    this.drawFloor();
    for (const w of this.words) if (!w.dead && w !== this.target) this.drawWord(w);
    if (this.target && !this.target.dead) this.drawWord(this.target, true);
    this.drawParts();
    this.drawFloats();

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${clamp(this.flash * 0.42, 0, 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // danger vignette — driven by how close words are to the shield line
    const danger =
      this.mode === "playing" ? clamp(this.dangerLevel() * 0.55 + (this.hp <= 2 ? 0.3 : 0), 0, 0.8) : 0;
    if (danger > 0) {
      const rg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.7);
      rg.addColorStop(0, "rgba(255,0,60,0)");
      rg.addColorStop(1, `rgba(255,20,60,${danger * (0.55 + 0.25 * Math.sin(this.t * 6))})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawGrid(od: boolean) {
    const ctx = this.ctx;
    const { W, H } = this;
    const col = od ? "255,60,220" : "34,211,238";
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${col},0.10)`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 64) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    ctx.stroke();

    ctx.strokeStyle = `rgba(${col},0.16)`;
    ctx.beginPath();
    for (let y = this.gridScroll - 64; y <= H; y += 64) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

    // horizon glow
    const hg = ctx.createLinearGradient(0, 0, 0, 120);
    hg.addColorStop(0, `rgba(${col},0.14)`);
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, 120);
  }

  private drawFloor() {
    const ctx = this.ctx;
    const { W, H } = this;
    const y = H - 16;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 3.2);
    const hot = Math.max(this.linePulse, this.mode === "playing" ? clamp(this.dangerLevel(), 0, 1) * 0.7 : 0);

    const lg = ctx.createLinearGradient(0, y - 34, 0, y + 8);
    lg.addColorStop(0, "rgba(255,0,90,0)");
    lg.addColorStop(1, `rgba(255,40,110,${0.16 + hot * 0.4})`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, y - 34, W, 42);

    ctx.fillStyle = `rgba(255,${90 + 60 * pulse},170,${0.55 + hot * 0.45})`;
    ctx.fillRect(0, y, W, 2);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + hot * 0.5})`;
    ctx.fillRect(0, y - 1, W, 1);
  }

  private dangerLevel() {
    let d = 0;
    for (const w of this.words) {
      if (w.dead) continue;
      d = Math.max(d, clamp((w.y - 30) / (this.H - 90), 0, 1));
    }
    return d;
  }

  private drawWord(w: Word, locked = false) {
    const ctx = this.ctx;
    const pal = PALETTE[w.kind];
    const bob = Math.sin(this.t * 2 + w.phase) * 2.4;
    const x0 = w.x - w.w / 2;
    const y = w.y + bob;
    const age = clamp((this.t - w.born) / 0.22, 0, 1);
    const scale = 0.82 + 0.18 * age + (locked ? 0.06 : 0);
    const dim = this.mode === "ambient" ? 0.3 : 1;
    const err = w.err > 0;

    ctx.save();
    ctx.globalAlpha = dim * (err ? 1 : 0.94);
    ctx.translate(w.x, y);
    ctx.scale(scale, scale);
    ctx.translate(-w.x, -y);
    ctx.font = `700 ${this.fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // soft glow halo for the typed portion (capped so long words stay cheap)
    if (w.typed > 0 && !err && w.typed <= 10) {
      ctx.shadowColor = pal.glow + "0.9)";
      ctx.shadowBlur = 16;
    }

    for (let i = 0; i < w.text.length; i++) {
      const done = i < w.typed;
      ctx.fillStyle = err ? "#fb7185" : done ? pal.done : pal.base;
      if (done) ctx.globalAlpha = dim * (0.75 + 0.25 * Math.sin(this.t * 9 - i));
      ctx.fillText(w.text[i], x0 + i * this.charW, y);
      ctx.globalAlpha = dim * (err ? 1 : 0.94);
    }
    ctx.shadowBlur = 0;

    // progress underline
    if (w.typed > 0 && this.mode === "playing") {
      const p = w.typed / w.text.length;
      ctx.fillStyle = err ? "rgba(251,113,133,0.5)" : pal.glow + "0.85)";
      ctx.fillRect(x0, y + this.fontSize * 0.72, w.w * p, 3);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x0, y + this.fontSize * 0.72, w.w, 3);
    }

    // target reticle
    if (locked && this.mode === "playing") {
      const pad = 9 + Math.sin(this.t * 8) * 1.6;
      const l = 10;
      const left = x0 - pad;
      const right = x0 + w.w + pad;
      const top = y - this.fontSize * 0.86;
      const bot = y + this.fontSize * 0.98;
      ctx.strokeStyle = err ? "rgba(251,113,133,0.9)" : pal.glow + "0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, top + l);
      ctx.lineTo(left, top);
      ctx.lineTo(left + l, top);
      ctx.moveTo(right - l, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, top + l);
      ctx.moveTo(left, bot - l);
      ctx.lineTo(left, bot);
      ctx.lineTo(left + l, bot);
      ctx.moveTo(right - l, bot);
      ctx.lineTo(right, bot);
      ctx.lineTo(right, bot - l);
      ctx.stroke();
    }

    // kind badges
    if (w.kind === "gold" && this.mode === "playing") {
      ctx.fillStyle = "#fbbf24";
      ctx.font = `700 ${Math.round(this.fontSize * 0.5)}px "Orbitron", monospace`;
      ctx.fillText("★", x0 - 18, y);
    } else if (w.kind === "heal" && this.mode === "playing") {
      ctx.fillStyle = "#34d399";
      ctx.font = `700 ${Math.round(this.fontSize * 0.55)}px "Orbitron", monospace`;
      ctx.fillText("+", x0 - 16, y);
    }
    ctx.restore();
  }

  private drawParts() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * 0.6;
        ctx.lineWidth = 2 + a * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.char !== undefined) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.font = `800 ${p.size}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.char, 0, 0);
        ctx.restore();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.restore();
  }

  private drawFloats() {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floats) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `800 ${f.size}px "Orbitron", monospace`;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText(f.text, f.x + 2, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
