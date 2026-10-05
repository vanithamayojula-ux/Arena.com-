/* AFTERGLOW — a tour for the dimmed sun. App shell: state, save, modes, menus. */

import { clamp, lerp, TAU } from './util.js';
import { PAL, makeBackdrop, drawBackdrop, makeFlakes, stepFlakes, drawFlakes, renderLighting, applyWarmGlow, drawGrade, makeGrainTile, drawFlame } from './paint.js';
import { CAST, drawActor, drawPortrait, drawLantern } from './actors.js';
import { makeInput } from './input.js';
import { initAudio, resumeAudio, setMuted as audioSetMuted, setTheme, SFX, sting } from './audio.js';
import { Flow, Dialogue } from './flow.js';
import { Stage } from './world.js';
import { PerfGame, NegotiateGame, RoadGame, GuardGame, CombatGame } from './minigames.js';
import { drawHUD, drawDialogue as uiDrawDialogue, drawChoices as uiDrawChoices, drawCard as uiDrawCard, drawToasts, roundPanel, roundRect } from './ui.js';
import { applyEffects as utilApply } from './util.js';
import { WORLDS, ACTS, SAVE_TITLE } from './story.js';

const SAVE_KEY = 'afterglow-save-v1';
const SET_KEY = 'afterglow-settings-v1';

export function defaultG() {
  return {
    act: 0, chits: 3, oil: 100, oilMax: 100,
    hp: 3, hpMax: 3, ammo: 2,
    trust: { bod: 2, nadia: 2, tomas: 2 },
    flags: {}, pell: false,
    textSpeed: 90, reducedMotion: false, muted: false,
    showMembers: true, playerChar: 'miri',
  };
}

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.W = 960; this.H = 540;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.g = canvas.getContext('2d');
    this.mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
    this.light = this.mkCanvas(this.W, this.H);
    this.lightCtx = this.light.getContext('2d');
    this.light = { canvas: this.light, ctx: this.lightCtx, W: this.W, H: this.H };
    this.grain = makeGrainTile(this.mkCanvas, 180, 7);
    this.G = defaultG();
    this.G.emitTrustFX = (log) => this.emitTrustFX(log);
    this.G.applyFX = (fx) => this.applyFX(fx);
    this.flow = new Flow(this);
    this.scene = null;
    this.mini = null;
    this.overlay = null;
    this.paused = false;
    this.toastsQ = [];
    this.fade = { a: 1, dir: -1, speed: 1.6, cb: null };
    this.time = 0; this.dt = 0.016;
    this.title = this.buildTitleMode();
    this.inMenu = true;
    this.loadSettings();
    this.inp = makeInput(canvas);
    canvas.addEventListener('pointerdown', e => this.onClick(e));
    this.inp.onTap((k, on) => { if (!on) return; });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.actStart = 0;
    this.lastMode = null;
  }

  /* ---------- shell plumbing ---------- */
  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / this.W, vh / this.H);
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = Math.round(this.W * scale) + 'px';
    this.canvas.style.height = Math.round(this.H * scale) + 'px';
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  applyFX(fx) {
    return utilApply(this.G, fx);
  }
  emitTrustFX(log) {
    if (!log || !log.length) return;
    for (const e of log) {
      if (e.kind === 'trust') {
        const who = CAST[e.k] ? CAST[e.k].name : e.k;
        if (e.d > 0) { this.toast(who + ' trusts you a little more', '#a8e0c5'); SFX.trustUp(); }
        else { this.toast(who + ' is drifting', '#e29a8f'); SFX.trustDown(); }
      }
    }
  }
  toast(text, color) { this.toastsQ.push({ text, color, t: 0, life: 3 }); if (this.toastsQ.length > 3) this.toastsQ.shift(); }

  /* ---------- persistence ---------- */
  save() {
    try {
      const s = { act: this.G.act, data: serialize(this.G) };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      this.toast('saved', 'rgba(200,215,235,0.8)');
    } catch (e) { /* private mode — play on */ }
  }
  static hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      Object.assign(this.G, defaultG(), s.data, {});
      this.G.act = s.act || 0;
      this.G.textSpeed = this.G.textSpeed || 90;
      return true;
    } catch (e) { return false; }
  }
  loadSettings() {
    try {
      const raw = localStorage.getItem(SET_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        this.G.textSpeed = s.textSpeed ?? 90;
        this.G.reducedMotion = !!s.reducedMotion;
        this.G.muted = !!s.muted;
        audioSetMuted(this.G.muted);
      }
    } catch (e) { }
  }
  saveSettings() {
    try {
      localStorage.setItem(SET_KEY, JSON.stringify({ textSpeed: this.G.textSpeed, reducedMotion: this.G.reducedMotion, muted: this.G.muted }));
    } catch (e) { }
  }

  /* ---------- modes ---------- */
  toTitle() {
    this.inMenu = true;
    this.scene = null; this.mini = null; this.overlay = null;
    this.paused = false;
    this.showSettingsInPause = false;
    this.menuGrace = 0.45; // stray SPACE from a just-closed card must not start a new tour
    setTheme(null);
    this.title.ci = 0;
    this.fadeTo(0);
  }
  playAct(n, fresh) {
    this.inMenu = false;
    this.flow = new Flow(this); // drop any pending programs from a previous act
    this._flowDone = null;
    if (fresh) { this.G = defaultG(); this.G.emitTrustFX = l => this.emitTrustFX(l); this.G.applyFX = fx => this.applyFX(fx); }
    this.G.act = n;
    this.actStart = n;
    this.scene = null; this.mini = null; this.overlay = null;
    this.save();
    setTheme('camp');
    this.flow.play(ACTS[n], () => this.endAct(n + 1));
  }
  endAct(n) {
    if (n >= ACTS.length) {
      this.G.flags.completed = true;
      this.save();
      this.toTitle();
      return;
    }
    this.G.act = n;
    this.save();
    // small intermission — return to title with continue pointing at next act
    this.toTitle();
  }

  openCard(s, done) {
    this.overlay = { kind: 'card', card: s, t: 0, dur: s.dur || 2.6, done };
    if (s.music) setTheme(s.music);
  }
  openTalk(s, done) {
    const dlg = new Dialogue(this.G, s, () => { });
    dlg.start();
    this.overlay = { kind: 'talk', dlg, done };
  }
  openScene(id, step, done) {
    const def = WORLDS[id];
    if (!def) { console.warn('[afterglow] missing world', id); done(); return; }
    this.scene = new Stage(this, { ...def, ...(step.opts || {}) });
    this.sceneClose = done;
    if (step.music) setTheme(step.music);
    if (step.lines) {
      this.openTalk({ lines: step.lines }, () => { });
    }
  }
  closeScene() {
    this.scene = null;
    const cb = this.sceneClose;
    this.sceneClose = null;
    cb && cb();
  }
  openPerf(s, done) { this._flowDone = done; this.mini = new PerfGame(this, s); if (s.music !== false) setTheme('waltz'); }
  openNegotiate(s, done) { this._flowDone = done; this.mini = new NegotiateGame(this, s); }
  openRoad(s, done) { this._flowDone = done; this.mini = new RoadGame(this, s); if (s.music) setTheme(s.music); }
  openGuard(s, done) { this._flowDone = done; this.mini = new GuardGame(this, s); if (s.music) setTheme(s.music); }
  openCombat(s, done) { this._flowDone = done; this.mini = new CombatGame(this, s); setTheme('fight'); }
  _minigameEnd() {
    this.mini = null;
    const cb = this._flowDone; this._flowDone = null;
    cb && cb();
  }
  openCredits(done) { this.overlay = { kind: 'credits', t: 0, done }; }

  onClick(e) {
    initAudio(); resumeAudio();
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * this.W;
    const y = (e.clientY - rect.top) / rect.height * this.H;
    if (this.inMenu) { this.title.click(x, y); return; }
    if (this.overlay) {
      if (this.overlay.kind === 'card') this.overlay.t = this.overlay.dur;
      else if (this.overlay.kind === 'talk' && this.overlay.dlg.finished === false) {
        const d = this.overlay.dlg;
        if (!d.done) { d.shown = d.full; d.done = true; }
        else if (!d.choices) d.nextLine();
      }
      return;
    }
    if (this.mini && this.mini.onClick) this.mini.onClick(x, y);
  }

  /* ---------- title mode ---------- */
  buildTitleMode() {
    const app = this;
    const bd = () => this._titleBd || (this._titleBd = makeBackdrop(this.mkCanvas, TITLE_WORLD, 1400, this.W, this.H));
    const menu = {
      ci: 0,
      get grace() { return app.menuGrace || 0; },
      set grace(v) { app.menuGrace = v; },
      items: () => [
        { t: 'Begin the tour', act: 0 },
        ...(App.hasSave() ? [{ t: `Continue — ${SAVE_TITLE(Math.max(0, this.savedAct()))}`, act: this.savedAct() }] : []),
        { t: 'Settings', settings: true },
        { t: 'Credits', credits: true },
      ],
      click: (x, y) => {
        const it = menu.rects && menu.rects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
        if (it) { menu.ci = it.i; menu.activate(); }
      },
      activate: () => {
        const it = menu.items()[menu.ci];
        if (!it) return;
        if (it.settings) { menu.settings = !menu.settings; SFX.ui(); return; }
        if (it.credits) { app.openCredits(); SFX.ui(); return; }
        if (it.act === 0) { initAudio(); resumeAudio(); app.playAct(0, true); }
        else { initAudio(); resumeAudio(); if (app.loadSave()) app.playAct(it.act, false); else app.playAct(0, true); }
        SFX.coin();
      },
    };
    return menu;
  }
  savedAct() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s ? Math.min(ACTS.length - 1, s.act || 0) : 0; } catch (e) { return 0; }
  }

  /* ---------- main loop ---------- */
  update(dt) {
    this.time += dt;
    this.flow.update(dt);
    for (const n of this.toastsQ) n.t += dt;
    this.toastsQ = this.toastsQ.filter(n => n.t < n.life);

    // fade system
    if (this.fade.dir) {
      this.fade.a = clamp(this.fade.a + this.fade.dir * dt * this.fade.speed, 0, 1);
      if (this.fade.a <= 0) { this.fade.dir = 0; }
    }
    if (this.paused) {
      if (this.inp.consume('menu')) { this.paused = false; this.showSettingsInPause = false; return; }
      if (this.showSettingsInPause) {
        if (this.inp.consume('down')) { this.title.setI = ((this.title.setI || 0) + 1) % 3; SFX.ui(); return; }
        if (this.inp.consume('up')) { this.title.setI = ((this.title.setI || 0) + 2) % 3; SFX.ui(); return; }
        if (this.inp.consume('left')) { this.cycleSetting(-1); return; }
        if (this.inp.consume('right') || this.inp.consume('action')) { this.cycleSetting(1); return; }
        return;
      }
      if (this.inp.consume('down')) { this.pauseCi = ((this.pauseCi || 0) + 1) % 4; SFX.ui(); }
      if (this.inp.consume('up')) { this.pauseCi = ((this.pauseCi || 0) + 3) % 4; SFX.ui(); }
      if (this.inp.consume('action')) {
        const opts = ['Resume', 'Save', 'Settings', 'Quit to title'];
        const k = opts[this.pauseCi || 0];
        if (k === 'Resume') this.paused = false;
        if (k === 'Save') { this.save(); this.paused = false; }
        if (k === 'Settings') { this.showSettingsInPause = !this.showSettingsInPause; }
        if (k === 'Quit to title') { this.toTitle(); }
      }
      return;
    }
    if (this.overlay && this.overlay.kind === 'credits') {
      this.overlay.t += dt;
      if (this.inp.consume('action')) { const d = this.overlay.done; this.overlay = null; d && d(); this.toTitle(); }
      return;
    }
    if (this.inMenu) { this.updateTitle(dt); return; }
    if (this.overlay && this.overlay.kind === 'card') {
      const ov = this.overlay;
      ov.t += dt;
      if (this.inp.consume('action')) ov.t = ov.dur;
      if (ov.t >= ov.dur) {
        this.overlay = null;
        ov.done && ov.done();
      }
      return;
    }
    if (this.overlay && this.overlay.kind === 'talk') {
      const d = this.overlay.dlg;
      d.update(dt, this.inp);
      if (d.finished) {
        const follow = d.follow;
        const done = this.overlay.done;
        this.overlay = null;
        if (follow && follow.length) this.flow.play(follow, () => done && done());
        else done && done();
      }
      return;
    }
    if (this.inp.consume('menu')) { this.paused = true; this.pauseCi = 0; return; }
    if (this.scene) this.scene.update(dt, this.inp);
    if (this.mini) this.mini.update(dt, this.inp);
  }
  updateTitle(dt) {
    const m = this.title;
    if (m.settings) {
      if (this.inp.consume('menu')) m.settings = false;
      if (this.inp.consume('left') || this.inp.consume('right')) {
        const dir = this.inp.down('left') ? -1 : 1;
        if (this.inp.consume('left')) this.cycleSetting(-1);
        if (this.inp.consume('right')) this.cycleSetting(1);
      }
      if (this.inp.consume('down')) { m.setI = ((m.setI || 0) + 1) % 3; SFX.ui(); }
      if (this.inp.consume('up')) { m.setI = ((m.setI || 0) + 2) % 3; SFX.ui(); }
      if (this.inp.consume('action')) this.cycleSetting(1);
      return;
    }
    const n = m.items().length;
    if (this.inp.consume('down')) { m.ci = (m.ci + 1) % n; SFX.ui(); }
    if (this.inp.consume('up')) { m.ci = (m.ci + n - 1) % n; SFX.ui(); }
    if (m.grace > 0) { m.grace -= dt; this.inp.consume('action'); return; }
    if (this.inp.consume('action')) m.activate();
  }
  cycleSetting(d) {
    const m = this.title;
    const i = m.setI || 0;
    if (i === 0) {
      const opts = [40, 90, 220, 1e9];
      const k = opts.indexOf(this.G.textSpeed);
      this.G.textSpeed = opts[clamp((k < 0 ? 1 : k) + d, 0, opts.length - 1)];
    } else if (i === 1) this.G.reducedMotion = !this.G.reducedMotion;
    else if (i === 2) { this.G.muted = !this.G.muted; audioSetMuted(this.G.muted); }
    SFX.ui();
    this.saveSettings();
  }

  render() {
    const g = this.g;
    const t = this.time;
    g.clearRect(0, 0, this.W, this.H);
    if (this.overlay && this.overlay.kind === 'credits') {
      drawCredits(g, this.W, this.H, this.overlay.t);
      this.post(g, t);
      return;
    }
    if (this.inMenu) { this.drawTitle(g, t); this.post(g, t); return; }
    if (this.mini) {
      this.mini.draw(g, t);
      this.mini.drawUI(g, t);
    } else if (this.scene) {
      this.scene.draw(g, t);
    }
    const showHud = !this.overlay || this.overlay.kind === 'talk';
    if (showHud) drawHUD(g, this.W, this.H, this.G, t, { objective: this.currentObjective() });
    if (this.overlay && this.overlay.kind === 'talk') uiDrawDialogue(g, this.W, this.H, this.overlay.dlg, t);
    if (this.overlay && this.overlay.kind === 'talk' && this.overlay.dlg.choices) {
      uiDrawChoices(g, this.W, this.H, this.overlay.dlg.choices, this.overlay.dlg.ci, t);
    }
    if (this.overlay && this.overlay.kind === 'card') uiDrawCard(g, this.W, this.H, { ...this.overlay.card, p: cardP(this.overlay) }, t);
    drawToasts(g, this.W, this.H, this.toastsQ, t);
    if (this.paused) this.drawPause(g, t);
    this.post(g, t);
  }
  currentObjective() {
    if (this.mini) return null;
    if (this.overlay && this.overlay.kind === 'talk') return null;
    return this.scene && this.scene.def.objective ? this.scene.def.objective : null;
  }
  post(g, t) {
    drawGrade(g, this.W, this.H, this.grain, t, this.G.reducedMotion, 1);
    if (this.fade.a > 0) { g.fillStyle = `rgba(2,3,8,${this.fade.a})`; g.fillRect(0, 0, this.W, this.H); }
  }
  fadeTo(a) { this.fade.a = 1 - a > 0.5 ? 1 : this.fade.a; this.fade.dir = -1; this.fade.a = 1; }
  blackIn() { this.fade.a = 1; this.fade.dir = -1; }

  drawTitle(g, t) {
    const bd = this._titleBd || (this._titleBd = makeBackdrop(this.mkCanvas, TITLE_WORLD, 1400, this.W, this.H));
    const cam = 240 + Math.sin(t * 0.05) * 160;
    drawBackdrop(g, bd, cam, t, this.W, this.H);
    // the troupe around the fire, small and warm
    const fx = this.W * 0.5, fy = Math.round(this.H * 0.8);
    const fireL = [{ x: fx, y: fy - 10, r: 240, inten: 1, flick: 1 }];
    drawFlame(g, fx, fy - 8, 5.4, t, 3);
    let i = 0;
    for (const k of ['miri', 'bod', 'nadia', 'tomas', 'pell']) {
      const a = -2.1 + i * 1.05;
      const x = fx + Math.cos(a) * 96, y = fy + Math.sin(a) * 20 + 8;
      drawActor(g, CAST[k], x, y, t + i * 2, { dir: Math.cos(a) > 0 ? -1 : 1, state: 'idle', litAmount: 1 });
      i++;
    }
    const fl = this._titleFlakes || (this._titleFlakes = makeFlakes(this.W, this.H, 100));
    if (!this.G.reducedMotion) stepFlakes(fl, this.dt, t, 0.1);
    drawFlakes(g, fl, 0);
    renderLighting(this.light, fireL, 0.62, '#03040a');
    g.drawImage(this.light.canvas, 0, 0);
    applyWarmGlow(g, fireL, 1);
    // title type
    g.save();
    g.textAlign = 'center';
    g.fillStyle = 'rgba(3,5,12,0.25)';
    g.fillRect(0, 0, this.W, this.H);
    g.font = `600 64px "Cormorant Garamond", Georgia, serif`;
    g.fillStyle = '#efe6d4';
    g.fillText('AFTERGLOW', this.W / 2, 150);
    g.strokeStyle = 'rgba(232,182,76,0.6)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(this.W / 2 - 150, 164); g.lineTo(this.W / 2 + 150, 164); g.stroke();
    g.font = `italic 16px "Spectral", Georgia, serif`;
    g.fillStyle = 'rgba(196,206,224,0.9)';
    g.fillText('a tour with the Ashfall Players', this.W / 2, 188);
    g.font = `12px "Spectral", Georgia, serif`;
    g.fillStyle = 'rgba(150,163,184,0.8)';
    g.fillText('twelve years since the sun became a coal', this.W / 2, 208);
    g.restore();
    // menu
    const m = this.title;
    m.rects = [];
    if (m.settings) { this.drawSettings(g, t, true); return; }
    const items = m.items();
    let y = this.H - 178;
    for (let i = 0; i < items.length; i++) {
      const on = i === m.ci;
      const w = 300, x = (this.W - w) / 2;
      g.save();
      g.fillStyle = on ? 'rgba(28,20,10,0.92)' : 'rgba(8,11,18,0.8)';
      g.strokeStyle = on ? 'rgba(232,182,76,0.9)' : 'rgba(130,150,180,0.3)';
      roundRect(g, x, y, w, 34, 6); g.fill(); g.stroke();
      g.textAlign = 'center';
      g.font = `${on ? '600 ' : ''}15px "Spectral", Georgia, serif`;
      g.fillStyle = on ? '#f2e4c4' : '#9fadc4';
      g.fillText(items[i].t, this.W / 2, y + 22);
      g.restore();
      m.rects.push({ x, y, w, h: 34, i });
      y += 42;
    }
    if (items[m.ci] && items[m.ci].act === 0 && App.hasSave()) {
      g.save();
      g.textAlign = 'center';
      g.font = `italic 12px "Spectral", Georgia, serif`;
      g.fillStyle = 'rgba(226,154,143,0.9)';
      g.fillText('begins again from the top; a saved tour waits below', this.W / 2, y + 8);
      g.restore();
    }
  }
  drawSettings(g, t, inTitle) {
    const m = this.title;
    const rows = [
      { k: 'Text', v: this.G.textSpeed >= 1e9 ? 'instant' : this.G.textSpeed === 220 ? 'fast' : this.G.textSpeed === 90 ? 'measured' : 'slow' },
      { k: 'Reduced motion', v: this.G.reducedMotion ? 'gentle' : 'default' },
      { k: 'Sound', v: this.G.muted ? 'silence' : 'the whole score' },
    ];
    const w = 420, x = (this.W - w) / 2, y0 = this.H / 2 - 80;
    roundPanel(g, x, y0 - 34, w, rows.length * 40 + 56, 10);
    g.save();
    g.textAlign = 'left';
    g.font = `600 16px "Cormorant Garamond", Georgia, serif`;
    g.fillStyle = '#e6dcc6';
    g.fillText('SETTINGS', x + 22, y0 - 10);
    rows.forEach((r, i) => {
      const on = (m.setI || 0) === i;
      g.font = `14px "Spectral", Georgia, serif`;
      g.fillStyle = on ? '#f2e4c4' : '#9fadc4';
      g.fillText(r.k, x + 24, y0 + 22 + i * 40);
      g.textAlign = 'right';
      g.fillStyle = on ? '#ffd98c' : '#c4ccda';
      g.fillText(on ? '◀  ' + r.v + '  ▶' : r.v, x + w - 24, y0 + 22 + i * 40);
      g.textAlign = 'left';
    });
    g.font = `italic 12px "Spectral", Georgia, serif`;
    g.fillStyle = 'rgba(150,163,184,0.8)';
    g.fillText('↑↓ rows · ←→ or ENTER change · ESC close', x + 24, y0 + rows.length * 40 + 12);
    g.restore();
  }
  drawPause(g, t) {
    const w = 360, x = (this.W - w) / 2, y = this.H / 2 - 96;
    roundPanel(g, x, y, w, 192, 10);
    g.save();
    g.textAlign = 'center';
    g.font = `600 22px "Cormorant Garamond", Georgia, serif`;
    g.fillStyle = '#e9dfc8';
    g.fillText('— intermission —', this.W / 2, y + 38);
    const opts = ['Resume', 'Save', 'Settings', 'Quit to title'];
    opts.forEach((o, i) => {
      const on = (this.pauseCi || 0) === i;
      g.font = `${on ? '600 ' : ''}15px "Spectral", Georgia, serif`;
      g.fillStyle = on ? '#ffd98c' : '#9fadc4';
      g.fillText((on ? '❖ ' : '') + o + (on ? ' ❖' : ''), this.W / 2, y + 76 + i * 30);
    });
    g.font = `italic 12px "Spectral", Georgia, serif`;
    g.fillStyle = 'rgba(150,163,184,0.8)';
    g.fillText('ESC resumes', this.W / 2, y + 176);
    g.restore();
    if (this.showSettingsInPause) this.drawSettings(g, t, false);
  }
}

function cardP(ov) { return clamp(ov.t / (ov.dur + 0.6), 0, 1); }

function serialize(G) {
  return {
    act: G.act, chits: G.chits, oil: G.oil, oilMax: G.oilMax,
    hp: G.hp, hpMax: G.hpMax, ammo: G.ammo, trust: { ...G.trust },
    flags: { ...G.flags }, pell: G.pell, textSpeed: G.textSpeed,
    reducedMotion: G.reducedMotion, muted: G.muted, showMembers: true, playerChar: 'miri',
  };
}

function drawCredits(g, W, H, t) {
  g.save();
  g.fillStyle = 'rgba(3,4,9,0.93)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  const lines = [
    ['AFTERGLOW', 34, true],
    ['a tour in five acts for a dimmed sun', 15, false],
    ['', 10, false],
    ['booked by', 13, false],
    ['Arena Agent', 20, true],
    ['', 10, false],
    ['the Ashfall Players', 13, false],
    ['Miri Voss · Bodfrie Kell · Nadia Quill · Tomas Reeve', 14, false],
    ['with Pell, who counts the dark', 12, false],
    ['', 10, false],
    ['painted, scored and rigged procedurally in canvas 2d + webaudio', 12, false],
    ['no light sources were harmed; several were saved', 12, false],
    ['', 10, false],
    ['press ENTER', 13, false],
  ];
  let y = H - (t * 26) % (H + 400) - 40;
  for (const [ln, size, big] of lines) {
    g.font = `${big ? '600 ' : ''}${size}px ${big ? '"Cormorant Garamond", Georgia' : '"Spectral", Georgia'}, serif`;
    g.fillStyle = big ? '#e9dfc8' : 'rgba(180,192,212,0.85)';
    g.fillText(ln, W / 2, y);
    y += size + 12;
  }
  g.restore();
}

const TITLE_WORLD = {
  id: 'title-camp', skyTop: '#05070f', skyMid: '#0b1424', skyBot: '#15253c', stars: true, aurora: true, clouds: 6,
  farColor: '#101c30', midColor: '#0b1626', treeColor: '#060b13', groundColor: '#111b2a',
  groundY: Math.round(540 * 0.8),
  decor: (g, W, H, c) => {
    // wagon + cart silhouettes
    g.fillStyle = '#0a1220';
    g.beginPath();
    g.moveTo(W * 0.7, c.groundY); g.lineTo(W * 0.7 + 26, c.groundY - 52); g.lineTo(W * 0.7 + 96, c.groundY - 52); g.lineTo(W * 0.7 + 112, c.groundY);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(W * 0.7 + 40, c.groundY - 4, 10, 0, TAU); g.arc(W * 0.7 + 84, c.groundY - 4, 10, 0, TAU); g.fill();
    g.strokeStyle = '#121b2b'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(W * 0.2, c.groundY - 2); g.lineTo(W * 0.2 + 6, c.groundY - 74); g.stroke();
    g.beginPath(); g.moveTo(W * 0.2 + 6, c.groundY - 74); g.lineTo(W * 0.2 + 54, c.groundY - 62); g.lineTo(W * 0.2 + 6, c.groundY - 52); g.closePath();
    g.fillStyle = '#16223a'; g.fill();
  },
};

/* boot */
export function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) { console.warn('no canvas'); return null; }
  const app = new App(canvas);
  window.__afterglow = app;
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    app.dt = dt;
    try { app.update(dt); app.render(); }
    catch (e) { if (!app.__errored) { console.error('[afterglow] frame error', e); app.__errored = e; } }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('pointerdown', () => { initAudio(); resumeAudio(); }, { once: true });
  return app;
}
