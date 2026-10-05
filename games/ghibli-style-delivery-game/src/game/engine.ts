import { audio } from "./audio";
import { drawCharacter, PLAYER_LOOK, type Facing, type Look } from "./characters";
import { PROMPTS, QUALITY_LABEL, type Prompt, type Reply } from "./dialogue";
import { clamp, lerp, shuffle } from "./rng";
import { makeCloudShadow, makeGlow, rr } from "./sprites";
import { mulberry32 } from "./rng";
import { generateWorld, tileAt, T, WATER, WORLD_H, WORLD_W, COLS, type Client, type StaticObj, type World } from "./world";

export interface HudLetter {
  clientId: number;
  name: string;
  color: string;
  express: boolean;
  expressFrac: number;
}
export interface HudState {
  score: number;
  timeLeft: number;
  combo: number;
  letters: HudLetter[];
  deliveries: number;
  canInteract: boolean;
  prompt: string;
  stamina: number;
}
export interface DialogueState {
  clientId: number;
  name: string;
  look: Look;
  line: string;
  replies: string[];
  express: boolean;
  key: number;
}
export interface GameOverStats {
  score: number;
  deliveries: number;
  bestCombo: number;
  heartfelt: number;
  acorns: number;
}
export interface Callbacks {
  onHud: (h: HudState) => void;
  onDialogue: (d: DialogueState | null) => void;
  onGameOver: (s: GameOverStats) => void;
}

type Mode = "title" | "play" | "dialogue" | "paused" | "over";

interface Letter {
  clientId: number;
  express: boolean;
  deadline: number;
  total: number;
  born: number;
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
  type: number;
  rot: number;
  vr: number;
  g: number;
  drag: number;
}
interface FText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}
interface Acorn {
  x: number;
  y: number;
  phase: number;
  active: boolean;
  respawn: number;
}
interface Soot {
  x: number;
  y: number;
  hx: number;
  hy: number;
  tx: number;
  ty: number;
  t: number;
  scared: number;
}
interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  s: number;
}
interface Wind {
  x: number;
  y: number;
  len: number;
  life: number;
  max: number;
  amp: number;
}
interface DrawEntry {
  y: number;
  t: number; // 0 static,1 client,2 player,3 soot,4 acorn
  o: unknown;
}

let cachedWorld: World | null = null;
const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

const START_TIME = 75;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: Callbacks;
  world: World;
  dpr = 1;
  cssW = 1;
  cssH = 1;
  zoom = 1;
  mode: Mode = "title";
  prevMode: Mode = "play";

  player = { x: 0, y: 0, vx: 0, vy: 0, facing: "down" as Facing, walk: 0, moving: false, sq: 0, sqv: 0, stamina: 1, tired: false, hop: 0, stepAcc: 0, running: false };
  cam = { x: 0, y: 0 };
  shake = 0;
  shakeX = 0;
  shakeY = 0;
  time = 0;
  clock = START_TIME;
  score = 0;
  combo = 0;
  bestCombo = 0;
  deliveries = 0;
  heartfelt = 0;
  acornsCollected = 0;
  letters: Letter[] = [];
  particles: Particle[] = [];
  ftexts: FText[] = [];
  acorns: Acorn[] = [];
  soots: Soot[] = [];
  clouds: Cloud[] = [];
  seeds: Seed[] = [];
  winds: Wind[] = [];
  windTimer = 0;
  keys = new Set<string>();
  joy = { x: 0, y: 0 };
  target: Client | null = null;
  dialogue: { client: Client; prompt: Prompt; replies: Reply[]; start: number; letter: Letter } | null = null;
  dialogueKey = 0;
  hudTimer = 0;
  overT = 0;
  hitstop = 0;
  interactCd = 0;
  pickupCd = 0;
  lastTick = 99;
  dusk = 0;
  lastDelivered = -1;
  recentPrompts: number[] = [];

  glowWarm: HTMLCanvasElement;
  glowSoft: HTMLCanvasElement;
  cloudSprite: HTMLCanvasElement;
  raf = 0;
  last = 0;
  entries: DrawEntry[] = [];
  vignette: CanvasGradient | null = null;
  sunlight: CanvasGradient | null = null;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
    if (!cachedWorld) cachedWorld = generateWorld(isTouch ? 1 : 1.5);
    this.world = cachedWorld;
    const r = mulberry32(77);
    this.glowWarm = makeGlow("rgba(255,200,110,0.85)", 128);
    this.glowSoft = makeGlow("rgba(255,240,190,0.9)", 64);
    this.cloudSprite = makeCloudShadow(r);
    for (let i = 0; i < 6; i++) this.clouds.push({ x: r() * WORLD_W, y: r() * WORLD_H, s: 2 + r() * 1.5, v: 10 + r() * 8 });
    for (let i = 0; i < 22; i++) this.seeds.push({ x: Math.random(), y: Math.random(), vx: 0.02 + Math.random() * 0.03, vy: -0.004 - Math.random() * 0.01, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
    this.player.x = this.world.spawn.x;
    this.player.y = this.world.spawn.y;
    this.cam.x = this.world.fountain.x;
    this.cam.y = this.world.fountain.y;
    this.spawnSoots();
    this.spawnAcorns();
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  // ---------------- input ----------------
  onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (this.mode === "play" && !e.repeat && (k === "e" || k === " " || k === "enter")) this.interact();
  };
  onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  onBlur = () => this.keys.clear();
  setJoy(x: number, y: number) {
    this.joy.x = x;
    this.joy.y = y;
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width || window.innerWidth);
    this.cssH = Math.max(1, rect.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.zoom = clamp(Math.min(this.cssW / 480, this.cssH / 560), 0.65, 2.2);
    const ctx = this.ctx;
    const cx = this.cssW / 2,
      cy = this.cssH / 2;
    const v = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.55, cx, cy, Math.hypot(cx, cy) * 1.05);
    v.addColorStop(0, "rgba(40,30,60,0)");
    v.addColorStop(1, "rgba(40,30,60,0.38)");
    this.vignette = v;
    const s = ctx.createLinearGradient(0, 0, this.cssW * 0.8, this.cssH);
    s.addColorStop(0, "rgba(255,240,200,0.22)");
    s.addColorStop(0.5, "rgba(255,240,200,0.04)");
    s.addColorStop(1, "rgba(255,240,200,0)");
    this.sunlight = s;
  };

  // ---------------- state control ----------------
  startGame() {
    audio.unlock();
    audio.startMusic();
    audio.play("start");
    const p = this.player;
    p.x = this.world.spawn.x;
    p.y = this.world.spawn.y;
    p.vx = p.vy = 0;
    p.facing = "down";
    p.stamina = 1;
    p.tired = false;
    p.sq = 0.3;
    p.hop = 0;
    this.time = 0;
    this.clock = START_TIME;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.deliveries = 0;
    this.heartfelt = 0;
    this.acornsCollected = 0;
    this.letters = [];
    this.particles.length = 0;
    this.ftexts.length = 0;
    this.dialogue = null;
    this.target = null;
    this.overT = 0;
    this.lastTick = 99;
    this.lastDelivered = -1;
    this.interactCd = 0.3;
    this.pickupCd = 0;
    this.shake = 0;
    this.joy.x = this.joy.y = 0;
    this.keys.clear();
    for (const c of this.world.clients) {
      c.bubble = null;
      c.jump = 0;
      c.x = c.homeX;
      c.y = c.homeY;
    }
    this.spawnAcorns();
    this.refill(true);
    this.cam.x = p.x;
    this.cam.y = p.y;
    this.mode = "play";
    this.burst(p.x, p.y - 20, 16, 3, ["#fff3a8", "#ffffff", "#f7c6d6"], 160);
    this.text(p.x, p.y - 64, "Deliver the letters!", "#fff8ec", 18, 1.6);
    this.cb.onDialogue(null);
    this.emitHud();
  }

  pause() {
    if (this.mode === "play" || this.mode === "dialogue") {
      this.prevMode = this.mode;
      this.mode = "paused";
      this.keys.clear();
      this.joy.x = this.joy.y = 0;
    }
  }
  resume() {
    if (this.mode === "paused") {
      this.mode = this.prevMode;
      this.last = performance.now();
    }
  }
  toTitle() {
    this.mode = "title";
    this.dialogue = null;
    this.cb.onDialogue(null);
  }

  // ---------------- gameplay helpers ----------------
  spawnSoots() {
    this.soots = [];
    const r = mulberry32(99);
    let n = 0,
      tries = 0;
    while (n < 16 && tries < 500) {
      tries++;
      const st = this.world.statics[Math.floor(r() * this.world.statics.length)];
      if (st.kind !== "tree") continue;
      const x = st.x + (r() - 0.5) * 40,
        y = st.y + 14 + r() * 10;
      if (this.blocked(x, y)) continue;
      this.soots.push({ x, y, hx: x, hy: y, tx: x, ty: y, t: r() * 3, scared: 0 });
      n++;
    }
  }

  randomWalkable(): { x: number; y: number } {
    for (let i = 0; i < 200; i++) {
      const x = 80 + Math.random() * (WORLD_W - 160);
      const y = 80 + Math.random() * (WORLD_H - 160);
      if (!this.blocked(x, y) && !this.blocked(x + 10, y) && !this.blocked(x - 10, y)) return { x, y };
    }
    return { x: this.world.spawn.x, y: this.world.spawn.y };
  }

  spawnAcorns() {
    this.acorns = [];
    for (let i = 0; i < 20; i++) {
      const p = this.randomWalkable();
      this.acorns.push({ x: p.x, y: p.y, phase: Math.random() * 6, active: true, respawn: 0 });
    }
    // a few right by the start for instant fun
    const s = this.world.spawn;
    const near = [
      [-70, 40],
      [70, 40],
      [-130, 70],
      [130, 70],
    ];
    near.forEach(([dx, dy], i) => {
      if (!this.blocked(s.x + dx, s.y + dy)) {
        this.acorns[i].x = s.x + dx;
        this.acorns[i].y = s.y + dy;
      }
    });
  }

  refill(first = false) {
    const clients = this.world.clients;
    const p = this.player;
    const need = 3 - this.letters.length;
    if (need <= 0) return 0;
    const taken = new Set(this.letters.map((l) => l.clientId));
    const pool = clients.filter((c) => !taken.has(c.id) && c.id !== this.lastDelivered);
    const maxD = 650 + this.deliveries * 90;
    pool.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    let added = 0;
    for (let i = 0; i < need; i++) {
      let c: Client | undefined;
      if (first && i === 0) c = pool[Math.floor(Math.random() * Math.min(2, pool.length))];
      else {
        const within = pool.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < maxD);
        const src = within.length ? within : pool;
        c = src[Math.floor(Math.random() * src.length)];
      }
      if (!c) break;
      pool.splice(pool.indexOf(c), 1);
      const dist = Math.hypot(c.x - p.x, c.y - p.y);
      const express = !first && this.deliveries >= 2 && Math.random() < 0.3;
      const total = clamp(dist / 110 + 9, 12, 28);
      this.letters.push({ clientId: c.id, express, deadline: this.time + total, total, born: this.time });
      added++;
    }
    return added;
  }

  blocked(px: number, py: number) {
    const x0 = px - 7,
      y0 = py - 6,
      x1 = px + 7,
      y1 = py + 2;
    if (x0 < 6 || y0 < 6 || x1 > WORLD_W - 6 || y1 > WORLD_H - 6) return true;
    const w = this.world;
    if (tileAt(w, Math.floor(x0 / T), Math.floor(y0 / T)) === WATER) return true;
    if (tileAt(w, Math.floor(x1 / T), Math.floor(y0 / T)) === WATER) return true;
    if (tileAt(w, Math.floor(x0 / T), Math.floor(y1 / T)) === WATER) return true;
    if (tileAt(w, Math.floor(x1 / T), Math.floor(y1 / T)) === WATER) return true;
    const cs = w.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (x1 > c.x && x0 < c.x + c.w && y1 > c.y && y0 < c.y + c.h) return true;
    }
    return false;
  }

  interact() {
    if (this.mode !== "play" || this.interactCd > 0) return;
    const c = this.target;
    if (!c) return;
    const letter = this.letters.find((l) => l.clientId === c.id);
    if (letter) {
      this.openDialogue(c, letter);
    } else if (c.cooldown <= 0) {
      const line = c.def.idle[Math.floor(Math.random() * c.def.idle.length)];
      this.say(c, line);
      c.cooldown = 1.2;
      audio.play("talk");
      c.jump = 0.5;
    }
  }

  say(c: Client, text: string) {
    this.ctx.font = "700 12px 'Zen Maru Gothic', sans-serif";
    c.bubble = { text, t: 2.4, w: this.ctx.measureText(text).width };
  }

  openDialogue(c: Client, letter: Letter) {
    let idx = 0;
    for (let k = 0; k < 10; k++) {
      idx = Math.floor(Math.random() * PROMPTS.length);
      if (!this.recentPrompts.includes(idx)) break;
    }
    this.recentPrompts.push(idx);
    if (this.recentPrompts.length > 6) this.recentPrompts.shift();
    const prompt = PROMPTS[idx];
    const replies = shuffle(prompt.replies.slice());
    this.dialogue = { client: c, prompt, replies, start: this.time, letter };
    this.mode = "dialogue";
    this.joy.x = this.joy.y = 0;
    const p = this.player;
    const dx = c.x - p.x,
      dy = c.y - p.y;
    p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "left" : "right") : dy > 0 ? "up" : "down";
    c.bubble = null;
    c.jump = 0.5;
    audio.play("talk");
    this.burst(c.x, c.y - 40, 6, 3, ["#fff3a8", "#ffffff"], 80);
    this.dialogueKey++;
    this.cb.onDialogue({
      clientId: c.id,
      name: c.def.name,
      look: c.def.look,
      line: prompt.line,
      replies: replies.map((r) => r.text),
      express: letter.express,
      key: this.dialogueKey,
    });
  }

  chooseReply(i: number, readTime = 0) {
    const d = this.dialogue;
    if (!d || this.mode !== "dialogue") return;
    const reply = d.replies[i];
    if (!reply) return;
    const c = d.client;
    const q = reply.q;
    const letter = d.letter;
    this.letters = this.letters.filter((l) => l !== letter);
    const age = this.time - letter.born;
    const speedBonus = Math.round(Math.max(0, 100 - age * 3));
    let replyPts = 0;
    if (q === 2) {
      this.combo++;
      replyPts = 150;
      this.heartfelt++;
    } else if (q === 1) replyPts = 50;
    else this.combo = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const answerTime = this.time - d.start - readTime;
    const quick = q >= 1 && answerTime < 3;
    const express = letter.express;
    const mult = (1 + this.combo * 0.25) * (express ? 2 : 1);
    const total = Math.round(((100 + speedBonus + replyPts + (quick ? 50 : 0)) * mult) / 5) * 5;
    const tb = Math.round(Math.max(4, 9 - this.deliveries * 0.15) + (q === 2 ? 3 : q === 1 ? 1 : 0) + (express ? 4 : 0));
    this.score += total;
    this.clock += tb;
    this.deliveries++;
    this.lastDelivered = c.id;

    // juice
    const x = c.x,
      y = c.y - 30;
    this.paperBurst(x, y, express ? 26 : 16);
    if (q === 2) {
      for (let k = 0; k < 14; k++) this.addP(x + (Math.random() - 0.5) * 30, y, (Math.random() - 0.5) * 90, -60 - Math.random() * 90, 1.2 + Math.random() * 0.6, 7 + Math.random() * 4, Math.random() < 0.5 ? "#f26d8a" : "#ff9db2", 2, 0, 0, -30, 1.2);
      this.burst(x, y, 14, 3, ["#fff3a8", "#ffffff", "#ffd36b"], 220);
      audio.play("heart");
    } else if (q === 1) {
      this.burst(x, y, 10, 3, ["#fff3a8", "#ffffff"], 160);
      audio.play("polite");
    } else {
      for (let k = 0; k < 6; k++) this.addP(x + (Math.random() - 0.5) * 20, y - 10, (Math.random() - 0.5) * 80, -80 - Math.random() * 40, 0.8, 4, "#7fb8e6", 6, 0, 0, 380, 1);
      for (let k = 0; k < 8; k++) this.addP(x, y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.9, 10, "rgba(120,120,130,0.5)", 5, 0, 0, -20, 2);
      audio.play("awkward");
    }
    audio.play(express ? "express" : "deliver");
    this.shake = q === 0 ? 5 : express ? 12 : q === 2 ? 9 : 6;
    this.hitstop = 0.07;
    this.text(x, y - 34, `+${total}`, express ? "#ffcf4a" : "#fff8ec", express ? 30 : 26, 1.3);
    this.text(x, y - 8, QUALITY_LABEL[q] + (q === 2 && this.combo > 1 ? ` x${this.combo}` : ""), q === 2 ? "#ff9db2" : q === 1 ? "#cfe8ff" : "#b8b8c0", 16, 1.3);
    if (quick) this.text(x - 40, y + 14, "Quick wit!", "#a8f0c8", 14, 1.2);
    this.text(x + 46, y + 14, `+${tb}s`, "#9fe0ff", 15, 1.3);
    if (express) this.text(x, y - 62, "EXPRESS x2!", "#ff6b4a", 18, 1.3);
    c.jump = q === 0 ? 0.4 : 1;
    this.say(c, reply.react);
    this.player.hop = 1;
    this.player.sq = -0.2;

    this.dialogue = null;
    this.mode = "play";
    this.interactCd = 0.35;
    this.cb.onDialogue(null);
    if (this.letters.length === 0) {
      this.text(this.player.x, this.player.y - 70, "Bag empty! Back to the Post Office ✉", "#fff3a8", 14, 2);
    }
    this.emitHud();
  }

  // ---------------- particles ----------------
  addP(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, type: number, rot: number, vr: number, g: number, drag: number) {
    if (this.particles.length > 450) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, type, rot, vr, g, drag });
  }
  burst(x: number, y: number, n: number, type: number, colors: string[], speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.addP(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, 3 + Math.random() * 4, colors[i % colors.length], type, Math.random() * 6, (Math.random() - 0.5) * 8, 60, 3);
    }
  }
  paperBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const s = 160 + Math.random() * 200;
      this.addP(x, y, Math.cos(a) * s, Math.sin(a) * s, 1.1 + Math.random() * 0.6, 5, i % 3 === 0 ? "#f6e7c4" : "#fffaf0", 1, Math.random() * 6, (Math.random() - 0.5) * 14, 420, 1.6);
    }
  }
  text(x: number, y: number, text: string, color: string, size: number, life: number) {
    this.ftexts.push({ x, y, text, color, life, max: life, size });
  }

  // ---------------- loop ----------------
  frame = (ts: number) => {
    this.raf = requestAnimationFrame(this.frame);
    let dt = Math.min(0.05, (ts - this.last) / 1000);
    this.last = ts;
    if (dt <= 0) return;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      dt *= 0.15;
    }
    this.update(dt);
    this.render();
  };

  emitHud() {
    const clients = this.world.clients;
    const t = this.target;
    const tl = t ? this.letters.find((l) => l.clientId === t.id) : undefined;
    let prompt = "";
    if (this.mode === "play") {
      if (tl && t) prompt = `${isTouch ? "Tap ✉" : "Press E"} to talk to ${t.def.name}`;
      else if (this.letters.length === 0) prompt = "Bag empty — run back to the Post Office!";
      else if (this.time < 6) prompt = "Follow the arrows to your clients";
    }
    this.cb.onHud({
      score: this.score,
      timeLeft: Math.max(0, this.clock),
      combo: this.combo,
      letters: this.letters.map((l) => {
        const c = clients[l.clientId];
        return { clientId: l.clientId, name: c.def.name, color: c.def.look.shirt, express: l.express, expressFrac: l.express ? clamp((l.deadline - this.time) / l.total, 0, 1) : 0 };
      }),
      deliveries: this.deliveries,
      canInteract: !!tl,
      prompt,
      stamina: this.player.stamina,
    });
  }

  update(dt: number) {
    const m = this.mode;
    if (m === "paused") return;
    this.time += dt;
    const p = this.player;
    const w = this.world;

    if (m === "play") this.updatePlayer(dt);
    else {
      p.vx *= 0.8;
      p.vy *= 0.8;
      p.moving = false;
    }

    // squash spring
    p.sqv += (-p.sq * 220 - p.sqv * 16) * dt;
    p.sq += p.sqv * dt;
    if (p.hop > 0) p.hop = Math.max(0, p.hop - dt * 2.6);

    if (m === "play" || m === "dialogue") {
      this.clock -= dt * (m === "dialogue" ? 0.5 : 1);
      if (this.interactCd > 0) this.interactCd -= dt;
      if (this.pickupCd > 0) this.pickupCd -= dt;
      // express timers
      for (const l of this.letters) {
        if (l.express && this.time > l.deadline) {
          l.express = false;
          this.text(p.x, p.y - 60, "Express missed...", "#c8c8d0", 13, 1.4);
          audio.play("awkward");
        }
      }
      if (this.clock < 10 && this.clock > 0) {
        const s = Math.ceil(this.clock);
        if (s !== this.lastTick) {
          this.lastTick = s;
          audio.play("tick");
        }
      }
      if (this.clock <= 0 && m === "play") this.gameOver();
      else if (this.clock <= 0) this.clock = 0.001;
    }

    if (m === "play") {
      // post office
      const pm = w.postMat;
      if (this.letters.length < 3 && this.pickupCd <= 0 && Math.hypot(p.x - pm.x, p.y - pm.y) < 38) {
        const n = this.refill();
        if (n > 0) {
          this.pickupCd = 1;
          audio.play("pickup");
          this.paperBurst(pm.x, pm.y - 20, 10);
          this.burst(pm.x, pm.y - 10, 12, 3, ["#fff3a8", "#ffd36b"], 180);
          this.text(p.x, p.y - 60, `+${n} letter${n > 1 ? "s" : ""}!`, "#fff3a8", 18, 1.2);
          this.shake = 4;
          p.sq = 0.25;
        }
      }
      // acorns
      for (const a of this.acorns) {
        if (!a.active) continue;
        if (Math.abs(a.x - p.x) < 22 && Math.abs(a.y - p.y) < 22) {
          a.active = false;
          a.respawn = 6;
          this.score += 25;
          this.clock += 1;
          this.acornsCollected++;
          audio.play("acorn");
          this.burst(a.x, a.y - 6, 10, 3, ["#ffe27a", "#ffffff", "#ffd36b"], 150);
          this.text(a.x, a.y - 24, "+25 · +1s", "#ffe9a0", 14, 0.9);
          this.shake = Math.max(this.shake, 2);
        }
      }
    }
    for (const a of this.acorns) {
      if (!a.active) {
        a.respawn -= dt;
        if (a.respawn <= 0) {
          const q = this.randomWalkable();
          a.x = q.x;
          a.y = q.y;
          a.active = true;
        }
      }
    }

    // target detection
    this.target = null;
    if (m === "play") {
      let best = 62 * 62;
      for (const c of w.clients) {
        const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
        const has = this.letters.some((l) => l.clientId === c.id);
        const dd = has ? d * 0.6 : d;
        if (dd < best) {
          best = dd;
          this.target = c;
        }
      }
    }

    // clients
    for (const c of w.clients) {
      c.phase += dt;
      if (c.jump > 0) c.jump = Math.max(0, c.jump - dt * 1.4);
      if (c.cooldown > 0) c.cooldown -= dt;
      if (c.bubble) {
        c.bubble.t -= dt;
        if (c.bubble.t <= 0) c.bubble = null;
      }
      if (m !== "dialogue" || this.dialogue?.client !== c) {
        const dx = p.x - c.x,
          dy = p.y - c.y;
        if (dx * dx + dy * dy < 130 * 130 && m !== "title") c.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        else c.facing = "down";
      }
    }

    // soots
    for (const s of this.soots) {
      s.t -= dt;
      const dx = s.x - p.x,
        dy = s.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 70 && m !== "title") {
        if (s.scared <= 0) {
          for (let k = 0; k < 3; k++) this.addP(s.x, s.y - 6, (Math.random() - 0.5) * 60, -30 - Math.random() * 40, 0.6, 2.5, "#2a2630", 0, 0, 0, 80, 1);
        }
        s.scared = 1.2;
        s.tx = s.x + (dx / (d || 1)) * 80;
        s.ty = s.y + (dy / (d || 1)) * 80;
      } else if (s.t <= 0) {
        s.t = 1 + Math.random() * 2.5;
        s.tx = s.hx + (Math.random() - 0.5) * 60;
        s.ty = s.hy + (Math.random() - 0.5) * 40;
      }
      if (s.scared > 0) s.scared -= dt;
      const sp = s.scared > 0 ? 7 : 2;
      s.x += (s.tx - s.x) * Math.min(1, dt * sp);
      s.y += (s.ty - s.y) * Math.min(1, dt * sp);
    }

    // particles
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      q.vy += q.g * dt;
      const dr = Math.exp(-q.drag * dt);
      q.vx *= dr;
      q.vy *= dr;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
    const fs = this.ftexts;
    for (let i = fs.length - 1; i >= 0; i--) {
      fs[i].life -= dt;
      fs[i].y -= dt * 34;
      if (fs[i].life <= 0) fs.splice(i, 1);
    }

    // clouds / seeds / wind
    for (const c of this.clouds) {
      c.x += c.v * dt;
      c.y += c.v * 0.35 * dt;
      if (c.x > WORLD_W + 400) c.x = -800;
      if (c.y > WORLD_H + 300) c.y = -600;
    }
    for (const s of this.seeds) {
      s.ph += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt + Math.sin(s.ph * 1.3) * 0.0006;
      if (s.x > 1.05) s.x = -0.05;
      if (s.y < -0.05) s.y = 1.05;
    }
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = 0.9 + Math.random() * 1.4;
      const vw = this.cssW / this.zoom,
        vh = this.cssH / this.zoom;
      this.winds.push({ x: this.cam.x - vw / 2 - 40 + Math.random() * vw * 0.6, y: this.cam.y - vh / 2 + Math.random() * vh, len: 80 + Math.random() * 120, life: 1.6, max: 1.6, amp: 6 + Math.random() * 10 });
      if (Math.random() < 0.5) this.addP(this.cam.x - vw / 2, this.cam.y + (Math.random() - 0.5) * vh, 120 + Math.random() * 60, -10 + Math.random() * 20, 4, 4, Math.random() < 0.5 ? "#f5bfd0" : "#9acd6f", 4, Math.random() * 6, 3, 0, 0);
    }
    for (let i = this.winds.length - 1; i >= 0; i--) {
      const wd = this.winds[i];
      wd.life -= dt;
      wd.x += 90 * dt;
      if (wd.life <= 0) this.winds.splice(i, 1);
    }

    // camera
    const vw = this.cssW / this.zoom,
      vh = this.cssH / this.zoom;
    let tx: number, ty: number;
    if (m === "title") {
      tx = w.fountain.x + Math.cos(this.time * 0.07) * 520;
      ty = w.fountain.y + Math.sin(this.time * 0.09) * 320;
      this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 0.8);
      this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 0.8);
    } else {
      tx = p.x + p.vx * 0.22;
      ty = p.y - 10 + p.vy * 0.22;
      if (m === "dialogue" && this.dialogue) {
        tx = (p.x + this.dialogue.client.x) / 2;
        ty = (p.y + this.dialogue.client.y) / 2 + vh * 0.12;
      }
      const k = Math.min(1, dt * 6);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }
    this.cam.x = vw >= WORLD_W ? WORLD_W / 2 : clamp(this.cam.x, vw / 2, WORLD_W - vw / 2);
    this.cam.y = vh >= WORLD_H ? WORLD_H / 2 : clamp(this.cam.y, vh / 2, WORLD_H - vh / 2);
    this.shake *= Math.exp(-dt * 9);
    if (this.shake < 0.1) this.shake = 0;
    this.shakeX = (Math.random() - 0.5) * 2 * this.shake;
    this.shakeY = (Math.random() - 0.5) * 2 * this.shake;

    // dusk
    let duskT = 0.18;
    if (m === "play" || m === "dialogue") duskT = clamp(1 - this.clock / 45, 0, 0.92);
    if (m === "over") {
      this.overT += dt;
      duskT = 1;
      if (this.overT > 1.3 && this.overT - dt <= 1.3) this.cb.onGameOver({ score: this.score, deliveries: this.deliveries, bestCombo: this.bestCombo, heartfelt: this.heartfelt, acorns: this.acornsCollected });
    }
    this.dusk += (duskT - this.dusk) * Math.min(1, dt * (m === "over" ? 1.5 : 3));

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && m !== "title") {
      this.hudTimer = 0.05;
      this.emitHud();
    }
  }

  gameOver() {
    this.mode = "over";
    this.overT = 0;
    this.clock = 0;
    this.shake = 8;
    audio.play("over");
    this.text(this.player.x, this.player.y - 70, "The sun has set...", "#ffe0b0", 20, 2.5);
    this.emitHud();
  }

  updatePlayer(dt: number) {
    const p = this.player;
    const k = this.keys;
    let ix = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
    let iy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
    ix += this.joy.x;
    iy += this.joy.y;
    let mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
      mag = 1;
    }
    const wantRun = k.has("shift") || Math.hypot(this.joy.x, this.joy.y) > 0.9;
    if (p.stamina <= 0.02) p.tired = true;
    if (p.tired && p.stamina > 0.35) p.tired = false;
    const running = wantRun && mag > 0.1 && !p.tired;
    p.running = running;
    p.stamina = clamp(p.stamina + (running ? -0.38 : 0.28) * dt, 0, 1);
    const speed = running ? 250 : 160;
    const tvx = ix * speed,
      tvy = iy * speed;
    const acc = Math.min(1, dt * (mag > 0.1 ? 16 : 20));
    p.vx += (tvx - p.vx) * acc;
    p.vy += (tvy - p.vy) * acc;
    const wasMoving = p.moving;
    p.moving = mag > 0.15;
    if (p.moving && !wasMoving) p.sq = -0.12;
    if (!p.moving && wasMoving) p.sq = 0.12;
    if (p.moving) {
      if (Math.abs(ix) > Math.abs(iy) * 1.05) p.facing = ix > 0 ? "right" : "left";
      else p.facing = iy > 0 ? "down" : "up";
    }

    // movement with sliding
    const dx = p.vx * dt,
      dy = p.vy * dt;
    if (dx !== 0) {
      if (!this.blocked(p.x + dx, p.y)) p.x += dx;
      else if (Math.abs(iy) < 0.3) {
        for (const n of [4, -4, 8, -8]) {
          if (!this.blocked(p.x + dx, p.y + n)) {
            p.y += Math.sign(n) * Math.min(Math.abs(n), 120 * dt);
            break;
          }
        }
        p.vx *= 0.5;
      } else p.vx *= 0.5;
    }
    if (dy !== 0) {
      if (!this.blocked(p.x, p.y + dy)) p.y += dy;
      else if (Math.abs(ix) < 0.3) {
        for (const n of [4, -4, 8, -8]) {
          if (!this.blocked(p.x + n, p.y + dy)) {
            p.x += Math.sign(n) * Math.min(Math.abs(n), 120 * dt);
            break;
          }
        }
        p.vy *= 0.5;
      } else p.vy *= 0.5;
    }
    const sp = Math.hypot(p.vx, p.vy);
    p.walk += dt * sp * 0.075;
    if (p.moving) {
      p.stepAcc += dt * sp * 0.075;
      if (p.stepAcc > Math.PI) {
        p.stepAcc -= Math.PI;
        if (running) {
          audio.play("step");
          this.addP(p.x - p.vx * 0.03, p.y, -p.vx * 0.1 + (Math.random() - 0.5) * 20, -10 - Math.random() * 10, 0.45, 5, "rgba(220,205,170,0.7)", 5, 0, 0, 0, 2);
        }
      }
    }
  }

  // ---------------- render ----------------
  render() {
    const ctx = this.ctx;
    const w = this.world;
    const z = this.zoom;
    const vw = this.cssW / z,
      vh = this.cssH / z;
    const left = this.cam.x - vw / 2 + this.shakeX;
    const top = this.cam.y - vh / 2 + this.shakeY;
    const k = this.dpr * z;
    const time = this.time;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#7fae5e";
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    const ox = Math.round(-left * k),
      oy = Math.round(-top * k);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.imageSmoothingEnabled = true;

    // ground
    const gs = w.groundScale;
    const sx = clamp(left, 0, WORLD_W),
      sy = clamp(top, 0, WORLD_H);
    const sw = Math.min(vw + 2, WORLD_W - sx),
      sh = Math.min(vh + 2, WORLD_H - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(w.ground, sx * gs, sy * gs, sw * gs, sh * gs, sx, sy, sw, sh);

    // water shimmer
    const tx0 = Math.max(0, Math.floor(left / T)),
      tx1 = Math.min(COLS - 1, Math.floor((left + vw) / T));
    const ty0 = Math.max(0, Math.floor(top / T)),
      ty1 = Math.floor((top + vh) / T);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tileAt(w, tx, ty) !== WATER) continue;
        const h = (tx * 73856093) ^ (ty * 19349663);
        const ph = (h & 255) / 40;
        const a = Math.sin(time * 1.8 + ph);
        if (a < 0.2) continue;
        ctx.globalAlpha = (a - 0.2) * 0.7;
        const lx = tx * T + 8 + ((h >> 8) & 15) + Math.sin(time + ph) * 3;
        const ly = ty * T + 10 + ((h >> 12) & 15);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 9, ly);
        ctx.moveTo(lx + 6, ly + 7);
        ctx.lineTo(lx + 12, ly + 7);
        ctx.stroke();
      }
    ctx.globalAlpha = 1;

    const inGame = this.mode !== "title";

    // post mat glow
    const pm = w.postMat;
    if (inGame && this.letters.length < 3) {
      const pulse = 0.5 + Math.sin(time * 5) * 0.5;
      ctx.fillStyle = this.letters.length === 0 ? `rgba(255,220,110,${0.35 + pulse * 0.35})` : `rgba(255,240,190,${0.2 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.ellipse(pm.x, pm.y, 30 + pulse * 6, 12 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // target rings
    if (inGame) {
      for (const l of this.letters) {
        const c = w.clients[l.clientId];
        const pulse = (time * 1.4) % 1;
        ctx.strokeStyle = l.express ? `rgba(255,90,70,${1 - pulse})` : `rgba(255,248,220,${1 - pulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 14 + pulse * 18, 6 + pulse * 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = l.express ? "rgba(255,90,70,0.25)" : "rgba(255,240,180,0.3)";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // gather drawables
    const E = this.entries;
    let n = 0;
    const push = (y: number, t: number, o: unknown) => {
      let e = E[n];
      if (!e) {
        e = { y, t, o };
        E[n] = e;
      } else {
        e.y = y;
        e.t = t;
        e.o = o;
      }
      n++;
    };
    const r = left + vw,
      b = top + vh;
    for (const s of w.statics) {
      if (s.bx > r || s.bx + s.bw < left || s.by > b || s.by + s.bh < top) continue;
      push(s.sortY, 0, s);
    }
    for (const c of w.clients) if (c.x > left - 40 && c.x < r + 40 && c.y > top - 10 && c.y < b + 70) push(c.y, 1, c);
    push(this.player.y, 2, this.player);
    for (const s of this.soots) if (s.x > left - 20 && s.x < r + 20 && s.y > top && s.y < b + 20) push(s.y, 3, s);
    for (const a of this.acorns) if (a.active && a.x > left - 20 && a.x < r + 20 && a.y > top && a.y < b + 20) push(a.y, 4, a);
    const list = E.slice(0, n).sort((a, b2) => a.y - b2.y);

    for (const e of list) {
      switch (e.t) {
        case 0:
          this.drawStatic(e.o as StaticObj);
          break;
        case 1: {
          const c = e.o as Client;
          const jy = c.jump > 0 ? -Math.abs(Math.sin(c.jump * Math.PI * 2)) * 12 : 0;
          if (jy < 0) {
            ctx.fillStyle = "rgba(40,55,35,0.2)";
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 9, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          drawCharacter(ctx, c.x, c.y + jy, c.def.look, c.facing, 0, false, 1, 1, time + c.phase, 0, jy === 0);
          break;
        }
        case 2: {
          const p = this.player;
          const hy = p.hop > 0 ? -Math.sin(p.hop * Math.PI) * 14 : 0;
          const sq = p.sq;
          if (hy < 0) {
            ctx.fillStyle = "rgba(40,55,35,0.25)";
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          drawCharacter(ctx, p.x, p.y + hy, PLAYER_LOOK, p.facing, p.walk, p.moving, 1 + sq, 1 - sq, time, this.letters.length, hy === 0);
          break;
        }
        case 3:
          this.drawSoot(e.o as Soot);
          break;
        case 4:
          this.drawAcorn(e.o as Acorn);
          break;
      }
    }

    // particles
    this.drawParticles();

    // wind
    ctx.lineCap = "round";
    for (const wd of this.winds) {
      const f = wd.life / wd.max;
      const a = Math.sin(f * Math.PI) * 0.55;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const prog = 1 - f;
      const x0 = wd.x,
        x1 = wd.x + wd.len * Math.min(1, prog * 2.2);
      ctx.moveTo(x0 + wd.len * Math.max(0, prog * 2 - 1), wd.y);
      ctx.bezierCurveTo((x0 + x1) / 2, wd.y - wd.amp, (x0 + x1) / 2, wd.y + wd.amp, x1, wd.y - wd.amp * 0.3);
      ctx.stroke();
    }

    // cloud shadows
    ctx.globalAlpha = 0.16;
    for (const c of this.clouds) {
      const cw = 420 * c.s,
        ch = 260 * c.s;
      if (c.x > r || c.x + cw < left || c.y > b || c.y + ch < top) continue;
      ctx.drawImage(this.cloudSprite, c.x, c.y, cw, ch);
    }
    ctx.globalAlpha = 1;

    // tint
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const d = this.dusk;
    if (this.sunlight && d < 0.6) {
      ctx.globalAlpha = 1 - d / 0.6;
      ctx.fillStyle = this.sunlight;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalAlpha = 1;
    }
    if (d > 0.02) {
      let cr: number, cg: number, cb: number;
      if (d < 0.5) {
        const t = d / 0.5;
        cr = 255;
        cg = lerp(252, 200, t);
        cb = lerp(245, 150, t);
      } else {
        const t = (d - 0.5) / 0.5;
        cr = lerp(255, 105, t);
        cg = lerp(200, 100, t);
        cb = lerp(150, 175, t);
      }
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalCompositeOperation = "source-over";
    }
    // lights
    const la = clamp((d - 0.45) / 0.4, 0, 1);
    if (la > 0) {
      ctx.setTransform(k, 0, 0, k, ox, oy);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = la * 0.75;
      for (const l of w.lamps) {
        if (l.x < left - 90 || l.x > r + 90 || l.y < top - 90 || l.y > b + 90) continue;
        ctx.drawImage(this.glowWarm, l.x - 80, l.y - 70, 160, 160);
      }
      ctx.globalAlpha = la * 0.8;
      ctx.fillStyle = "#ffbf5a";
      for (const bd of w.buildings) {
        if (bd.x > r || bd.x + bd.w < left || bd.y - 60 > b || bd.y + bd.h < top) continue;
        for (const wr of bd.windows) ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
      }
      ctx.globalAlpha = la * 0.4;
      for (const bd of w.buildings) {
        if (bd.x > r || bd.x + bd.w < left || bd.y - 60 > b || bd.y + bd.h < top) continue;
        for (const wr of bd.windows) ctx.drawImage(this.glowSoft, wr.x + wr.w / 2 - 24, wr.y + wr.h / 2 - 24, 48, 48);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // world UI layer
    ctx.setTransform(k, 0, 0, k, ox, oy);
    if (inGame) this.drawWorldUI(left, top, vw, vh);
    this.drawFTexts();

    // screen space
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (inGame && this.mode !== "over") this.drawArrows(left, top);
    // seeds
    ctx.fillStyle = "rgba(255,255,250,0.85)";
    for (const s of this.seeds) {
      const x = s.x * this.cssW,
        y = s.y * this.cssH;
      ctx.globalAlpha = 0.5 + Math.sin(s.ph * 2) * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 * s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
    if (inGame && this.clock < 10 && this.mode === "play") {
      const a = (Math.sin(time * 8) * 0.5 + 0.5) * 0.18 * (1 - this.clock / 10);
      ctx.fillStyle = `rgba(200,60,40,${a})`;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
    }
  }

  drawStatic(s: StaticObj) {
    const ctx = this.ctx;
    const time = this.time;
    switch (s.kind) {
      case "building": {
        const sp = s.sprite!;
        ctx.drawImage(sp.canvas, s.bx, s.by, sp.w, sp.h);
        const bd = s.building!;
        if (bd.kind === "tower") {
          const cx = bd.x + bd.w / 2,
            cy = bd.y + bd.h - 150 + 34;
          const hours = 8 + this.dusk * 11;
          const ha = (hours / 12) * Math.PI * 2 - Math.PI / 2;
          const ma = (hours % 1) * Math.PI * 2 - Math.PI / 2 + time * 0.5;
          ctx.strokeStyle = "#3a2a1e";
          ctx.lineCap = "round";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ha) * 9, cy + Math.sin(ha) * 9);
          ctx.stroke();
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ma) * 14, cy + Math.sin(ma) * 14);
          ctx.stroke();
        }
        break;
      }
      case "tree": {
        const sp = s.sprite!;
        const sway = Math.sin(time * 1.3 + s.phase) * (s.big ? 0.012 : 0.03);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.transform(1, 0, sway, 1, 0, 0);
        ctx.drawImage(sp.canvas, -sp.ox, -sp.oy, sp.w, sp.h);
        ctx.restore();
        break;
      }
      case "lamp": {
        const x = s.x,
          y = s.y;
        ctx.fillStyle = "rgba(40,55,35,0.25)";
        ctx.beginPath();
        ctx.ellipse(x + 3, y, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2f4a44";
        ctx.fillRect(x - 1.8, y - 46, 3.6, 46);
        rr(ctx, x - 4.5, y - 5, 9, 6, 2);
        ctx.fill();
        const lit = clamp((this.dusk - 0.4) / 0.3, 0, 1);
        ctx.fillStyle = lit > 0 ? `rgb(255,${200 + lit * 30},${120 + lit * 40})` : "#f6ecd0";
        rr(ctx, x - 5.5, y - 57, 11, 11, 2);
        ctx.fill();
        ctx.fillStyle = "#2f4a44";
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 56);
        ctx.lineTo(x, y - 63);
        ctx.lineTo(x + 8, y - 56);
        ctx.fill();
        ctx.fillRect(x - 6, y - 47, 12, 2);
        break;
      }
      case "bench": {
        const x = s.x,
          y = s.y;
        ctx.fillStyle = "rgba(40,55,35,0.22)";
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 1, 24, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5a3a26";
        ctx.fillRect(x - 18, y - 8, 3, 9);
        ctx.fillRect(x + 15, y - 8, 3, 9);
        ctx.fillStyle = "#a8743f";
        rr(ctx, x - 22, y - 12, 44, 6, 2);
        ctx.fill();
        ctx.fillStyle = "#94623a";
        rr(ctx, x - 22, y - 22, 44, 5, 2);
        ctx.fill();
        rr(ctx, x - 22, y - 16, 44, 3, 1);
        ctx.fill();
        break;
      }
      case "mailbox": {
        const x = s.x,
          y = s.y;
        ctx.fillStyle = "rgba(40,55,35,0.25)";
        ctx.beginPath();
        ctx.ellipse(x + 2, y, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a3a2a";
        ctx.fillRect(x - 1.5, y - 14, 3, 14);
        ctx.fillStyle = "#d2493a";
        rr(ctx, x - 8, y - 34, 16, 22, 6);
        ctx.fill();
        ctx.fillStyle = "#a8352a";
        ctx.fillRect(x - 5, y - 27, 10, 2.5);
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.arc(x, y - 18, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "fountain": {
        const cx = this.world.fountain.x,
          cy = this.world.fountain.y;
        ctx.fillStyle = "rgba(40,55,35,0.2)";
        ctx.beginPath();
        ctx.ellipse(cx + 5, cy + 8, 60, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#b8ab90";
        ctx.beginPath();
        ctx.ellipse(cx, cy + 6, 56, 33, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9cdb2";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 56, 32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#74bdd2";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 47, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        // ripples
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) {
          const f = (time * 0.6 + i * 0.5) % 1;
          ctx.globalAlpha = 1 - f;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 10 + f * 34, 5 + f * 17, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#d9cdb2";
        rr(ctx, cx - 6, cy - 34, 12, 34, 4);
        ctx.fill();
        ctx.fillStyle = "#c8bba0";
        ctx.beginPath();
        ctx.ellipse(cx, cy - 34, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#86cbe0";
        ctx.beginPath();
        ctx.ellipse(cx, cy - 35, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // spray
        ctx.fillStyle = "rgba(235,250,255,0.95)";
        for (let i = 0; i < 16; i++) {
          const f = (time * 0.9 + i / 16) % 1;
          const a = (i / 16) * Math.PI * 2;
          const dx = Math.cos(a) * f * 34;
          const dy = Math.sin(a) * f * 16 - Math.sin(f * Math.PI) * 26 + f * 30;
          ctx.beginPath();
          ctx.arc(cx + dx, cy - 40 + dy, 1.8 * (1 - f * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "windmill": {
        const x = s.x,
          y = s.y;
        ctx.fillStyle = "rgba(40,55,35,0.25)";
        ctx.beginPath();
        ctx.ellipse(x + 14, y, 46, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#efe2c6";
        ctx.beginPath();
        ctx.moveTo(x - 30, y);
        ctx.lineTo(x + 30, y);
        ctx.lineTo(x + 19, y - 110);
        ctx.lineTo(x - 19, y - 110);
        ctx.fill();
        ctx.fillStyle = "#d8c8a6";
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + 30, y);
        ctx.lineTo(x + 19, y - 110);
        ctx.lineTo(x + 8, y - 110);
        ctx.fill();
        ctx.fillStyle = "#5a3a26";
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x - 8, y - 16);
        ctx.arc(x, y - 16, 8, Math.PI, 0);
        ctx.lineTo(x + 8, y);
        ctx.fill();
        ctx.fillStyle = "#6f9fb8";
        ctx.beginPath();
        ctx.arc(x, y - 62, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c8553d";
        ctx.beginPath();
        ctx.moveTo(x - 26, y - 106);
        ctx.quadraticCurveTo(x, y - 150, x + 26, y - 106);
        ctx.fill();
        const hx = x,
          hy = y - 116;
        const rot = time * 0.9;
        for (let i = 0; i < 4; i++) {
          const a = rot + (i * Math.PI) / 2;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.rotate(a);
          ctx.fillStyle = "#6a4a32";
          ctx.fillRect(0, -1.5, 82, 3);
          ctx.fillStyle = "rgba(250,244,228,0.95)";
          ctx.fillRect(14, 2, 66, 13);
          ctx.strokeStyle = "#8a6a4a";
          ctx.lineWidth = 1;
          ctx.strokeRect(14, 2, 66, 13);
          ctx.beginPath();
          for (let j = 25; j < 80; j += 11) {
            ctx.moveTo(j, 2);
            ctx.lineTo(j, 15);
          }
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = "#4a3a2a";
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  drawSoot(s: Soot) {
    const ctx = this.ctx;
    const moving = Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > 2;
    const hop = moving ? Math.abs(Math.sin(this.time * 14 + s.hx)) * 4 : Math.abs(Math.sin(this.time * 3 + s.hx)) * 1;
    const x = s.x,
      y = s.y - 6 - hop;
    ctx.fillStyle = "rgba(40,55,35,0.25)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d1b1f";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + this.time * 0.5;
      ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    }
    ctx.stroke();
    ctx.fillStyle = "#1d1b1f";
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 2.3, y - 1, 2, 0, Math.PI * 2);
    ctx.arc(x + 2.3, y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    const lx = clamp((this.player.x - s.x) * 0.02, -0.8, 0.8);
    ctx.beginPath();
    ctx.arc(x - 2.3 + lx, y - 1, 0.9, 0, Math.PI * 2);
    ctx.arc(x + 2.3 + lx, y - 1, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAcorn(a: Acorn) {
    const ctx = this.ctx;
    const bob = Math.sin(this.time * 3 + a.phase) * 2.5;
    const x = a.x,
      y = a.y - 10 + bob;
    ctx.fillStyle = "rgba(40,55,35,0.22)";
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + Math.sin(this.time * 4 + a.phase) * 0.15;
    ctx.drawImage(this.glowSoft, x - 14, y - 14, 28, 28);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#b8702e";
    ctx.beginPath();
    ctx.ellipse(x, y + 1.5, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e09a52";
    ctx.beginPath();
    ctx.ellipse(x - 1.4, y + 1, 1.4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6e4527";
    ctx.beginPath();
    ctx.ellipse(x, y - 2.5, 5.2, 3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 5.2, y - 2.8, 10.4, 1.6);
    ctx.fillRect(x - 0.6, y - 7.5, 1.4, 3);
    const tw = (this.time * 1.5 + a.phase) % 3;
    if (tw < 0.4) {
      const s = Math.sin((tw / 0.4) * Math.PI) * 4;
      this.star(x + 4, y - 4, s, "#fffbe0");
    }
  }

  star(x: number, y: number, s: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const q of this.particles) {
      const f = q.life / q.max;
      ctx.globalAlpha = Math.min(1, f * 2);
      ctx.fillStyle = q.color;
      switch (q.type) {
        case 0:
        case 6:
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * (q.type === 6 ? 0.8 : f), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 1: {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot);
          ctx.scale(Math.cos(q.rot * 1.7), 1);
          ctx.fillRect(-5, -3.5, 10, 7);
          ctx.strokeStyle = "rgba(160,120,80,0.6)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-5, -3.5);
          ctx.lineTo(0, 0.5);
          ctx.lineTo(5, -3.5);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 2: {
          const s = q.size * (0.6 + 0.4 * Math.min(1, (1 - f) * 5));
          const x = q.x + Math.sin(q.life * 6) * 4,
            y = q.y;
          ctx.beginPath();
          ctx.moveTo(x, y + s * 0.35);
          ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.5, y - s, x, y - s * 0.45);
          ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
          ctx.fill();
          break;
        }
        case 3:
          this.star(q.x, q.y, q.size * f * 1.3, q.color);
          break;
        case 4:
          ctx.beginPath();
          ctx.ellipse(q.x + Math.sin(q.life * 3) * 10, q.y + Math.cos(q.life * 2) * 6, q.size, q.size * 0.45, q.rot, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 5:
          ctx.globalAlpha = f * 0.8;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * (1.6 - f), 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  drawWorldUI(left: number, top: number, vw: number, vh: number) {
    const ctx = this.ctx;
    const w = this.world;
    const time = this.time;
    // envelope markers
    for (const l of this.letters) {
      const c = w.clients[l.clientId];
      if (c.x < left - 30 || c.x > left + vw + 30 || c.y < top - 20 || c.y > top + vh + 80) continue;
      const x = c.x,
        y = c.y - 62 + Math.sin(time * 4 + c.id) * 3;
      this.envelope(x, y, l.express, l.express ? clamp((l.deadline - this.time) / l.total, 0, 1) : -1);
    }
    // interaction prompt
    const t = this.target;
    if (t && this.mode === "play") {
      const has = this.letters.some((l) => l.clientId === t.id);
      const x = t.x,
        y = t.y - (has ? 90 : 62) + Math.sin(time * 6) * 1.5;
      ctx.fillStyle = has ? "#c94f35" : "rgba(255,250,236,0.95)";
      rr(ctx, x - 13, y - 11, 26, 20, 7);
      ctx.fill();
      ctx.fillStyle = has ? "#fff8ec" : "#5a4a36";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isTouch ? "✉" : has ? "E" : "…", x, y - 0.5);
    }
    // bubbles
    ctx.font = "700 12px 'Zen Maru Gothic', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of w.clients) {
      if (!c.bubble) continue;
      const bw = c.bubble.w + 18;
      const a = Math.min(1, c.bubble.t * 3);
      const pop = c.bubble.t > 2.2 ? 0.8 + (2.4 - c.bubble.t) : 1;
      const x = c.x,
        y = c.y - 66;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.fillStyle = "rgba(60,50,40,0.18)";
      rr(ctx, -bw / 2 + 2, -12, bw, 24, 10);
      ctx.fill();
      ctx.fillStyle = "#fffaf0";
      rr(ctx, -bw / 2, -14, bw, 24, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-5, 9);
      ctx.lineTo(0, 16);
      ctx.lineTo(5, 9);
      ctx.fill();
      ctx.fillStyle = "#4a3e32";
      ctx.fillText(c.bubble.text, 0, -2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // stamina arc
    const p = this.player;
    if (p.stamina < 0.99) {
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x + 16, p.y - 40, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = p.tired ? "#e46a4c" : "#a8f0c8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x + 16, p.y - 40, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.stamina);
      ctx.stroke();
    }
  }

  envelope(x: number, y: number, express: boolean, frac: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(40,40,30,0.25)";
    rr(ctx, x - 11, y - 6, 22, 15, 3);
    ctx.fill();
    ctx.fillStyle = express ? "#fff0e0" : "#fffaf0";
    rr(ctx, x - 11, y - 8, 22, 15, 3);
    ctx.fill();
    ctx.strokeStyle = "#c9a878";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 7);
    ctx.lineTo(x, y + 1);
    ctx.lineTo(x + 10, y - 7);
    ctx.stroke();
    ctx.fillStyle = express ? "#e0402f" : "#c94f35";
    ctx.beginPath();
    ctx.arc(x, y + 0.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
    if (frac >= 0) {
      ctx.strokeStyle = "#ff5a3c";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }
  }

  drawFTexts() {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const f of this.ftexts) {
      const age = f.max - f.life;
      const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.8 : age < 0.22 ? 1.2 - ((age - 0.12) / 0.1) * 0.2 : 1;
      ctx.globalAlpha = Math.min(1, f.life * 2.5);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(pop, pop);
      ctx.font = `900 ${f.size}px 'Zen Maru Gothic', sans-serif`;
      ctx.strokeStyle = "rgba(50,35,30,0.85)";
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawArrows(left: number, top: number) {
    const ctx = this.ctx;
    const z = this.zoom;
    const W = this.cssW,
      H = this.cssH;
    const cx = W / 2,
      cy = H / 2;
    const mT = isTouch ? 96 : 110,
      mB = isTouch ? 150 : 70,
      mX = 34;
    const targets: { x: number; y: number; color: string; express: boolean; post: boolean }[] = [];
    for (const l of this.letters) {
      const c = this.world.clients[l.clientId];
      targets.push({ x: c.x, y: c.y - 30, color: c.def.look.shirt, express: l.express, post: false });
    }
    if (this.letters.length === 0) targets.push({ x: this.world.postMat.x, y: this.world.postMat.y - 20, color: "#f2c94c", express: false, post: true });
    for (const t of targets) {
      const sx = (t.x - left) * z,
        sy = (t.y - top) * z;
      if (sx > mX && sx < W - mX && sy > mT && sy < H - mB) continue;
      const dx = sx - cx,
        dy = sy - cy;
      const hw = cx - mX,
        hh = dy < 0 ? cy - mT : H - mB - cy;
      const s = Math.min(Math.abs(dx) > 0 ? hw / Math.abs(dx) : 1e9, Math.abs(dy) > 0 ? hh / Math.abs(dy) : 1e9);
      const ax = cx + dx * s,
        ay = cy + dy * s;
      const ang = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(this.time * 6) * 0.08;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(pulse, pulse);
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = t.express ? "#e0402f" : t.post ? "#e0a92f" : "#fffaf0";
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(13, -9);
      ctx.lineTo(13, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(40,30,20,0.25)";
      ctx.beginPath();
      ctx.arc(1.5, 2.5, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.express ? "#e0402f" : t.post ? "#e0a92f" : "#fffaf0";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.post ? "#fff8ec" : t.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8ec";
      ctx.font = "900 12px 'Zen Maru Gothic', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = t.post ? "#c94f35" : "#fff8ec";
      ctx.fillText("✉", 0, 0.5);
      ctx.restore();
    }
  }
}
