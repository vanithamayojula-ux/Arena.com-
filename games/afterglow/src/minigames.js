/* AFTERGLOW — set-pieces. The troupe's real weapons: timing, nerve, lantern oil.
   Perf (resonance rings), Negotiate (tension read), Road (keep the flames alive),
   Guard (shepherd the dark away from the light), Combat (last resort, it costs). */

import { clamp, lerp, damp, sign, TAU, rng, dist, check } from './util.js';
import { PAL, makeBackdrop, drawBackdrop, makeFlakes, stepFlakes, drawFlakes, drawWind, renderLighting, applyWarmGlow, drawFlame, spawnEmber, stepEmbers, drawEmbers, makeEmbers } from './paint.js';
import { CAST, drawActor, drawCrowd, makeCrowd, drawPortrait, drawProp } from './actors.js';
import { SFX, sting, setTheme, windGust } from './audio.js';
import { drawMeter, roundRect, roundPanel, drawDialogue } from './ui.js';

const SERIF = '"Spectral", Georgia, serif';
const DISP = '"Cormorant Garamond", Georgia, serif';

class Minigame {
  constructor(app, cfg) {
    this.app = app; this.cfg = cfg; this.t = 0; this.over = false; this.resultKey = null;
    this.W = app.W; this.H = app.H;
    this.groundY = Math.round(app.H * 0.8);
    this.dark = cfg.dark ?? 0.55;
    this.camX = 0; this.worldW = cfg.worldW || app.W;
    this.player = { x: cfg.spawnX ?? app.W / 2, dir: 1, vx: 0, phase: 0, hurt: 0, roll: 0, swing: 0 };
    this.embers = makeEmbers();
    this.msgs = [];
  }
  toast(text) { this.msgs.push({ text, t: 0 }); if (this.msgs.length > 3) this.msgs.shift(); }
  lights() { return []; }
  finish(key, fx) {
    if (this.over) return;
    this.over = true; this.resultKey = key;
    this.app.G.flags['res_' + (this.cfg.save || 'last')] = key;
    if (fx) this.app.G.emitTrustFX(this.app.G.applyFX(fx));
    const out = (this.cfg.out || {})[key];
    if (out && out.length) this.app.flow.play(out, () => this.app._minigameEnd());
    else this.app._minigameEnd();
  }
  update(dt, inp) { }
  draw(g, t) { }
  drawUI(g, t) { }
  drawMsgs(g, y0) {
    let y = y0;
    for (const m of this.msgs) {
      g.save();
      g.globalAlpha = clamp(1 - (m.t - 2) / 1.4, 0, 1);
      g.textAlign = 'center';
      g.font = `italic 15px ${SERIF}`;
      g.fillStyle = '#e8d5a8';
      g.fillText(m.text, this.W / 2, y);
      g.restore();
      y += 22;
    }
  }
  tickMsgs(dt) { for (let i = this.msgs.length - 1; i >= 0; i--) { this.msgs[i].t += dt; if (this.msgs[i].t > 3.6) this.msgs.splice(i, 1); } }
}

/* ================= PERFORMANCE — resonance rings ================= */
export class PerfGame extends Minigame {
  constructor(app, cfg) {
    super(app, cfg);
    this.bd = makeBackdrop(app.mkCanvas, cfg.backdrop || PERF_BACKDROP(app), app.W, app.W, app.H);
    this.crowd = makeCrowd(cfg.crowd ?? 46, app.W, app.H, cfg.seed ?? 7);
    this.fl = makeFlakes(app.W, app.H, 70);
    this.bpm = cfg.bpm || 104;
    this.beat = 60 / this.bpm;
    this.bars = cfg.bars || 12;
    this.total = this.bars * 4 * this.beat;
    this.mood = 0.45; this.target = cfg.target ?? 0.8;
    this.combo = 0; this.best = 0;
    this.lanes = cfg.members || ['miri'];
    this.spot = (this.lanes.length - 1) >> 1;
    this.cues = [];
    this.spawnPlan = (cfg.pattern && cfg.pattern.length ? cfg.pattern : ['ball']).slice();
    this.fx = [];
    this.msg = null; this.msgT = 0;
    this.crowdRoar = 0;
    this.perfectStreak = 0;
    this.lanePos = this.lanes.map((_, i) => app.W * (0.5 + (i - (this.lanes.length - 1) / 2) * 0.24));
    this.poses = this.lanes.map(() => ({ k: 0, type: null }));
    this.hitLines = cfg.hitLines || [];
    this.milestones = [];
    this.startMile = Math.floor(this.mood * 20);
    this.leadBase = cfg.lead ?? 1.7;
    // pre-schedule every cue on the beat grid; the ring flies in `lead` before its hit time
    for (let b = (cfg.upbeat ?? 2), i = 0; b * this.beat < this.total - this.beat * 2; b += (cfg.every || 2), i++) {
      const p = this.spawnPlan[i % this.spawnPlan.length];
      const q = typeof p === 'string' ? { type: p } : p;
      const lane = q.lane != null ? q.lane % this.lanes.length : (this.lanes.length > 1 && q.rand ? (Math.random() * this.lanes.length) | 0 : 0);
      this.cues.push({ lane, tHit: (b + (q.off || 0)) * this.beat, type: q.type || 'ball', judged: false, r: 2.5 });
    }
  }
  leadFor(c) { return this.leadBase * (1 - 0.28 * clamp(c.tHit / this.total, 0, 1)); }
  update(dt, inp) {
    if (this.over) return;
    this.t += dt;
    if (this.app.overlay) return;
    if (inp.consume('left')) { this.spot = clamp(this.spot - 1, 0, this.lanes.length - 1); SFX.ui(); }
    if (inp.consume('right')) { this.spot = clamp(this.spot + 1, 0, this.lanes.length - 1); SFX.ui(); }
    for (const c of this.cues) {
      if (!c.judged) {
        c.r = clamp((c.tHit - this.t) / this.leadFor(c), 0, 2.4);
        if (this.t > c.tHit + 0.24) this.judge(c, 'miss');
      }
    }
    if (inp.consume('action')) {
      let best = null, bestD = 1e9;
      for (const c of this.cues) {
        if (c.judged || c.lane !== this.spot) continue;
        const d = Math.abs(c.tHit - this.t);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) {
        if (bestD < 0.15) this.judge(best, 'perfect');
        else if (bestD < 0.32) this.judge(best, 'good');
        else if (bestD < 0.68) this.judge(best, 'miss');
      }
    }
    this.cues = this.cues.filter(c => !(c.judged && this.t - (c.tHit || 0) > 0.6));
    this.mood = clamp(this.mood - dt * (this.cfg.decay ?? 0.048), 0, 1);
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.t > 0.9) this.fx.splice(i, 1); }
    this.crowdRoar = Math.max(0, this.crowdRoar - dt);
    this.msgT -= dt; if (this.msgT <= 0) this.msg = null;
    for (const p of this.poses) p.k = Math.max(0, p.k - dt * 2);
    stepFlakes(this.fl, dt, this.t, 0.1);
    stepEmbers(this.embers, dt, this.t);
    this.tickMsgs(dt);
    const mile = Math.floor(this.mood * 20);
    if (mile > this.startMile && this.hitLines.length) {
      const idx = this.milestones.length % this.hitLines.length;
      if (mile !== this._lastMile) { this._lastMile = mile; this.milestones.push(mile); this.msg = this.hitLines[idx]; this.msgT = 3; SFX.crowd(0.7); }
    }
    if (this.t >= this.total) {
      const res = this.mood >= this.target ? 'great' : this.mood >= this.target * 0.62 ? 'ok' : 'poor';
      sting(res === 'great' ? 'triumph' : res === 'ok' ? 'reveal' : 'bad');
      this.finish(res);
    }
  }
  judge(c, kind) {
    c.judged = true;
    const x = this.lanePos[c.lane];
    const y = this.laneY(c.lane);
    if (kind === 'miss') {
      this.mood = clamp(this.mood - 0.06, 0, 1);
      this.combo = 0; this.perfectStreak = 0;
      SFX.miss();
      this.fx.push({ x, y: y - 6, t: 0, txt: 'the audience winces', kind });
      return;
    }
    const solo = c.lane === this.spot;
    const bonus = solo ? 0.014 : -0.006;
    if (kind === 'perfect') {
      this.mood = clamp(this.mood + 0.08 + bonus, 0, 1);
      this.combo++; this.perfectStreak++;
      SFX.perfect();
      this.fx.push({ x, y: y - 14, t: 0, txt: '!', kind });
    } else {
      this.mood = clamp(this.mood + 0.045 + bonus, 0, 1);
      this.combo++; this.perfectStreak = 0;
      SFX.hit();
      this.fx.push({ x, y: y - 14, t: 0, txt: 'ok', kind });
    }
    this.best = Math.max(this.best, this.combo);
    this.poses[c.lane] = { k: 1, type: c.type };
    if (solo && kind === 'perfect') this.fx.push({ x, y: y - 36, t: 0, txt: 'SOLO', kind: 'solo' });
    if (this.combo > 0 && this.combo % 8 === 0) {
      SFX.combo(this.perfectStreak % 5);
      this.crowdRoar = 1.1;
      this.mood = clamp(this.mood + 0.03, 0, 1);
    }
    for (let i = 0; i < 3; i++) spawnEmber(this.embers, x + (Math.random() - 0.5) * 24, y + 44, 48);
  }
  laneY() { return this.groundY - 70; }
  draw(g, t) {
    drawBackdrop(g, this.bd, 0, t, this.W, this.H);
    this.lanes.forEach((k, i) => {
      const c = CAST[k];
      const p = this.poses[i];
      const x = this.lanePos[i], y = this.groundY;
      const bounce = p.k * Math.abs(Math.sin(p.k * 9)) * 8;
      drawActor(g, c, x, y - bounce, t + i, { dir: 1, state: p.k > 0.1 ? 'act' : 'idle', phase: t * 3, litAmount: i === this.spot ? 1.2 : 0.4 });
      if (p.k > 0.1) this.drawActProp(g, p.type, x, y - bounce - 30, t, p.k);
      if (k === 'bod' || k === 'nadia') drawProp(g, c, x + 24, y - 26, t, 1);
    });
    drawCrowd(g, this.crowd, t, clamp(this.mood * (1 + this.crowdRoar), 0, 1.4), this.W, this.H);
    const L = this.lights();
    renderLighting(this.app.light, L, this.dark, '#05070f');
    g.drawImage(this.app.light.canvas, 0, 0);
    applyWarmGlow(g, L, 1);
    drawFlakes(g, this.fl, 0);
    drawEmbers(g, this.embers, 0);
  }
  drawActProp(g, type, x, y, t, k) {
    g.save();
    if (type === 'ball') {
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * (TAU / 3);
        g.fillStyle = ['#c96a4a', '#d9b24c', '#7ba0c4'][i];
        g.beginPath(); g.arc(x + Math.cos(a) * 20, y - 28 - Math.abs(Math.sin(a)) * 16, 4.6, 0, TAU); g.fill();
      }
    } else if (type === 'fire') {
      drawFlame(g, x + 12, y - 26, 5, t, x, 1);
    } else if (type === 'note') {
      g.fillStyle = 'rgba(230,220,180,0.9)';
      g.font = '20px ' + SERIF;
      g.fillText('♪', x + 16, y - 34 - k * 6);
    } else if (type === 'puppet') {
      g.strokeStyle = 'rgba(220,230,255,0.5)';
      g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x + 10, y - 22); g.stroke();
      g.fillStyle = '#7a5468';
      g.beginPath(); g.ellipse(x + 12, y - 12, 5, 8, 0.3 * Math.sin(t * 8), 0, TAU); g.fill();
    } else if (type === 'rope') {
      g.strokeStyle = 'rgba(240,225,190,0.7)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x - 46, y - 30); g.quadraticCurveTo(x, y - 18 + k * 6, x + 46, y - 30); g.stroke();
    }
    g.restore();
  }
  lights() {
    const L = [];
    const base = this.groundY - 20;
    for (const fx of [this.W * 0.1, this.W * 0.9]) L.push({ x: fx, y: base, r: 230, inten: 0.75, flick: 1 });
    const x = this.lanePos[this.spot];
    L.push({ x, y: base - 80, r: 210, inten: 1, flick: 1, warm: '255,205,140' });
    return L;
  }
  drawUI(g, t) {
    this.lanes.forEach((k, i) => {
      const x = this.lanePos[i], y = this.laneY(i);
      g.save();
      g.strokeStyle = i === this.spot ? 'rgba(255,205,130,0.9)' : 'rgba(150,170,200,0.35)';
      g.lineWidth = i === this.spot ? 2 : 1.2;
      g.beginPath(); g.arc(x, y, 26, 0, TAU); g.stroke();
      if (i === this.spot) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fillStyle = 'rgba(255,205,130,0.8)'; g.fill(); }
      if (this.lanes.length > 1) {
        g.font = `11px ${SERIF}`;
        g.fillStyle = i === this.spot ? '#ffd98c' : 'rgba(150,170,200,0.6)';
        g.textAlign = 'center';
        g.fillText(CAST[k].name, x, y + 44);
      }
      g.restore();
    });
    for (const c of this.cues) {
      if (c.judged) continue;
      const x = this.lanePos[c.lane], y = this.laneY(c.lane);
      const rr = 26 * (1 + c.r * 1.5);
      g.save();
      const col = c.lane === this.spot ? '255,190,110' : '160,185,220';
      g.strokeStyle = `rgba(${col},${0.95 - c.r * 0.28})`;
      g.lineWidth = 2.6 - c.r * 0.5;
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
      if (c.r <= 1.05 && c.r >= 0.9) { g.fillStyle = `rgba(${col},0.2)`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); }
      g.restore();
    }
    for (const f of this.fx) {
      g.save();
      g.globalAlpha = 1 - f.t / 0.9;
      g.textAlign = 'center';
      g.font = (f.kind === 'perfect' || f.kind === 'solo') ? `600 15px ${SERIF}` : `italic 12.5px ${SERIF}`;
      g.fillStyle = f.kind === 'perfect' ? '#ffd98c' : f.kind === 'miss' ? '#c96a6a' : f.kind === 'solo' ? '#a8e0c5' : '#dfe6f0';
      g.fillText(f.txt, f.x, f.y - f.t * 26);
      g.restore();
    }
    drawMeter(g, this.W / 2 - 150, 26, 300, 'THE CROWD', this.mood, this.mood >= this.target ? '#e8b64c' : '#7fa3c9', { marker: this.target });
    const left = clamp(1 - this.t / this.total, 0, 1);
    drawMeter(g, this.W / 2 - 150, 48, 300, this.combo > 1 ? `combo ×${this.combo}` : 'the set', left, 'rgba(130,150,180,0.7)');
    if (this.msg) {
      g.save();
      g.globalAlpha = clamp(this.msgT, 0, 1);
      g.textAlign = 'center';
      g.font = `italic 16px ${SERIF}`;
      g.fillStyle = '#dfe8f5';
      g.fillText(this.msg, this.W / 2, 88);
      g.restore();
    }
    g.save();
    g.font = `12.5px ${SERIF}`;
    g.fillStyle = 'rgba(210,220,235,0.75)';
    g.textAlign = 'center';
    g.fillText(this.lanes.length > 1 ? '◀ ▶ move the light onto a performer   ·   SPACE when the rings meet' : 'SPACE when the ring meets the circle', this.W / 2, this.H - 14);
    g.restore();
  }
}
const PERF_BACKDROP = (app) => ({
  id: 'perf-stage', skyTop: '#060810', skyMid: '#0c1322', skyBot: '#101a2a',
  far: false, mid: false, trees: false, stars: true, clouds: 4, groundColor: '#10161f', groundY: Math.round(app.H * 0.8),
  decor: (g, W, H, c) => {
    g.fillStyle = '#18202c';
    g.fillRect(0, c.groundY + 4, W, H - c.groundY);
    g.fillStyle = '#0e1420';
    for (let x = 0; x < W; x += 46) g.fillRect(x, c.groundY + 6, 40, 4);
    g.strokeStyle = 'rgba(120,140,170,0.3)';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, H * 0.2); g.lineTo(W, H * 0.23); g.stroke();
    const R = rng(5);
    for (let x = 20; x < W; x += 52) {
      const h = 14 + R() * 16;
      g.globalAlpha = 0.5;
      g.fillStyle = ['#6b3d4a', '#4c5a3d', '#3d5a6b'][(x / 52 | 0) % 3];
      g.beginPath();
      const yy = H * 0.205 + (x / W) * H * 0.03;
      g.moveTo(x, yy); g.lineTo(x + 20, yy + 3); g.lineTo(x + 10, yy + h);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    g.fillStyle = '#0a101b';
    for (const [x, w, hh] of [[0.08, 120, 66], [0.3, 150, 88], [0.62, 110, 58], [0.86, 140, 80]]) {
      g.beginPath();
      g.moveTo(W * x - w / 2, H * 0.82);
      g.lineTo(W * x, H * 0.82 - hh);
      g.lineTo(W * x + w / 2, H * 0.82);
      g.closePath(); g.fill();
    }
  },
});

/* ================= NEGOTIATION — read the room ================= */
export class NegotiateGame extends Minigame {
  constructor(app, cfg) {
    super(app, cfg);
    this.npc = cfg.who;
    this.tension = clamp(cfg.tension ?? 0.55, 0, 1.2);
    this.roundI = 0;
    this.phase = 'choice';
    this.line = { who: this.npc, shown: '', full: '', done: false };
    this.ci = 0;
    this.rects = [];
    this.speed = app.G.textSpeed;
    this.hint = null;
    this.dark = 0.55;
    const opener = cfg.opener && cfg.opener.length;
    if (opener) {
      this.queue = cfg.opener.map(l => ({ who: l[0], full: String(l[1]), shown: '', done: false }));
      this.line = this.queue.shift();
      this.phase = 'opener';
    } else this.startRound();
  }
  startRound() {
    const r = (this.cfg.rounds || [])[this.roundI];
    if (!r) { this.resolve(); return; }
    this.phase = 'choice';
    this.opts = r.opts.filter(o => !o.if || check(o.if, this.app.G));
    const G = this.app.G;
    if (this.cfg.concessions) for (const c of this.cfg.concessions) {
      if (c.once && G.flags[c.once]) continue;
      if (c.cost != null && G.chits < c.cost) continue;
      this.opts.push({ ...c, isConcession: true });
    }
    this.say(String(r.line), r.hint || null);
  }
  say(full, hint) {
    this.line = { who: this.npc, full, shown: '', done: false };
    this.hint = hint;
  }
  update(dt, inp) {
    if (this.over) return;
    this.t += dt;
    if (this.app.overlay) return;
    if (!this.line.done) {
      const tail = this.line.shown.slice(-2);
      let sp = this.speed;
      if (/[,.…]$/.test(tail)) sp *= 0.42;
      this.line.shown = this.line.full.slice(0, Math.floor(this.line.shown.length + dt * sp + 1));
      if (this.line.shown.length >= this.line.full.length) this.line.done = true;
      if (inp.consume('action')) { this.line.shown = this.line.full; this.line.done = true; }
      return;
    }
    if (this.phase === 'opener') {
      if (inp.consume('action')) {
        if (this.queue.length) this.line = this.queue.shift();
        else this.startRound();
      }
      return;
    }
    if (this.phase === 'react') {
      if (inp.consume('action')) {
        this.reactI++;
        const rl = this.reactLines;
        if (this.reactI < rl.length) { const L = rl[this.reactI]; this.line = { who: L.who || this.npc, full: String(L.text), shown: '', done: false }; }
        else { this.roundI++; this.startRound(); }
      }
      return;
    }
    // choice phase
    if (inp.consume('down')) { this.ci = (this.ci + 1) % this.opts.length; SFX.ui(); }
    if (inp.consume('up')) { this.ci = (this.ci + this.opts.length - 1) % this.opts.length; SFX.ui(); }
    if (inp.consume('action')) this.choose(this.ci);
  }
  onClick(x, y) {
    if (this.over || this.phase !== 'choice' || !this.line.done) return;
    for (const r of this.rects) if (r && r.i >= 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return this.choose(r.i);
  }
  choose(i) {
    const o = this.opts[i];
    if (!o) return;
    SFX.page();
    const G = this.app.G;
    if (o.cost != null) { G.chits = Math.max(0, G.chits - o.cost); SFX.coin(); }
    if (o.onceFlag) G.flags[o.onceFlag] = true;
    let dT = o.dT || 0;
    const like = o.likeFor || this.cfg.likes, hate = o.hateFor || this.cfg.hates;
    let tag = null;
    if (o.kind && like && o.kind === like) { dT -= 0.17; tag = 'the room tilts your way'; }
    if (o.kind && hate && o.kind === hate) { dT += 0.15; tag = 'wrong note, badly played'; }
    const was = this.tension;
    this.tension = clamp(this.tension + dT, 0, 1.2);
    if (this.tension < was) SFX.soft(); else if (this.tension > was + 0.01) SFX.miss();
    if (o.effect) G.emitTrustFX(G.applyFX(o.effect));
    this.reactLines = o.react || [{ who: this.npc, text: dT - (o.dT || 0) < 0 ? 'Something in the posture across the table lets go, an inch.' : 'That did not help.' }];
    if (tag) this.reactLines = [{ who: 'narrator', text: tag }, ...this.reactLines];
    this.reactI = 0;
    this.phase = 'react';
    const L = this.reactLines[0];
    this.line = { who: L.who || this.npc, full: String(L.text), shown: '', done: false };
  }
  resolve() {
    sting(this.tension >= 1 ? 'bad' : this.tension <= 0.28 ? 'triumph' : 'reveal');
    if (this.tension >= 1) this.finish('bad');
    else if (this.tension <= 0.28) this.finish('win');
    else this.finish('even');
  }
  draw(g, t) {
    const grd = g.createLinearGradient(0, 0, 0, this.H);
    grd.addColorStop(0, '#0a0f19'); grd.addColorStop(1, '#131b28');
    g.fillStyle = grd; g.fillRect(0, 0, this.W, this.H);
    g.fillStyle = 'rgba(8,12,19,0.9)';
    for (let i = 0; i < 5; i++) g.fillRect(40 + i * this.W * 0.21, this.groundY - 215, 26, 210);
    g.fillStyle = '#1b2432';
    g.fillRect(this.W * 0.26, this.groundY - 46, this.W * 0.48, 12);
    g.fillStyle = '#101823';
    g.fillRect(this.W * 0.28, this.groundY - 34, this.W * 0.44, 26);
    drawActor(g, CAST[this.npc] || CAST.crowd, this.W * 0.36, this.groundY - 30, t, { dir: 1, state: 'idle', litAmount: 1.15 });
    drawActor(g, CAST.miri, this.W * 0.64, this.groundY - 30, t + 1, { dir: -1, state: 'idle', litAmount: 1 });
    drawActor(g, CAST.bod, this.W * 0.74, this.groundY - 26, t + 2, { dir: -1, litAmount: 0.4 });
    const L = [{ x: this.W * 0.5, y: this.groundY - 58, r: 160, inten: 1, flick: 1 }];
    renderLighting(this.app.light, L, 0.52, '#04060d');
    g.drawImage(this.app.light.canvas, 0, 0);
    applyWarmGlow(g, L, 1);
    drawFlame(g, this.W * 0.5, this.groundY - 54, 4, t, 1);
  }
  drawUI(g, t) {
    const W = this.W, H = this.H;
    const mood = this.tension > 0.75 ? 2 : this.tension > 0.55 ? 4 : this.tension < 0.3 ? 1 : 0;
    g.save();
    drawPortrait(g, 58, 76, 40, this.npc, mood, t);
    g.restore();
    drawMeter(g, 118, 54, 240, (CAST[this.npc] ? CAST[this.npc].name : 'Their') + ' TEMPER', clamp(1 - this.tension / 1.1, 0, 1), mood === 2 ? '#c9564a' : mood === 1 ? '#8fbf7a' : '#c9a24a');
    g.save();
    g.font = `12px ${SERIF}`;
    g.fillStyle = 'rgba(190,200,215,0.75)';
    g.fillText(this.cfg.stakes || '', 118, 80);
    g.restore();
    if (this.hint && this.phase === 'choice' && this.line.done) {
      g.save();
      g.font = `italic 13px ${SERIF}`;
      g.fillStyle = 'rgba(214,196,150,0.95)';
      g.fillText('✎ ' + this.hint, 118, 100);
      g.restore();
    }
    // choices above the plate
    if (this.phase === 'choice') {
      const opts = this.opts.map(o => ({ t: o.t + (o.cost != null ? `  (−${o.cost}⌾)` : ''), note: o.note }));
      const n = opts.length;
      const boxH = 120;
      let cy = H - boxH - 26 - 12 - n * 24;
      cy = Math.max(96, cy);
      this.rects = [{ i: -1 }];
      const cw = Math.min(W - 140, 560), cx = (W - cw) / 2;
      g.font = `14.5px ${SERIF}`;
      for (let i = 0; i < n; i++) {
        const c = opts[i];
        const h = 30;
        this.rects.push({ x: cx, y: cy, w: cw, h, i });
        const on = i === this.ci;
        g.save();
        g.fillStyle = on ? 'rgba(28,20,10,0.96)' : 'rgba(10,13,20,0.9)';
        g.strokeStyle = on ? 'rgba(232,182,76,0.85)' : 'rgba(120,140,170,0.28)';
        g.lineWidth = on ? 1.5 : 1;
        roundRect(g, cx, cy, cw, h, 7); g.fill(); g.stroke();
        g.fillStyle = on ? '#f4e8d0' : '#b9c2d2';
        g.font = `14.5px ${SERIF}`;
        g.fillText(c.t.length > 64 ? c.t.slice(0, 62) + '…' : c.t, cx + 16, cy + 19);
        if (c.note) {
          g.font = `italic 11.5px ${SERIF}`;
          g.fillStyle = on ? 'rgba(232,182,76,0.9)' : 'rgba(160,170,190,0.5)';
          g.fillText(c.note, cx + cw - 12 - g.measureText(c.note).width, cy + 19);
        }
        g.restore();
        cy += h + 6;
      }
    }
    drawDialogue(g, W, H, this.line, t, { boxH: 120, awaitHint: this.phase !== 'choice' ? '▼ SPACE' : '' });
    this.drawMsgs(g, 130);
  }
}

/* ================= ROAD — cold-crossing survival ================= */
export class RoadGame extends Minigame {
  constructor(app, cfg) {
    super(app, cfg);
    this.worldW = cfg.len;
    this.bd = makeBackdrop(app.mkCanvas, cfg.backdrop || ROAD_BACKDROP(app), cfg.len, app.W, app.H);
    this.fl = makeFlakes(app.W, app.H, 140);
    this.torches = (cfg.torches || []).map(x => ({ x, lit: true }));
    this.cartX = cfg.cartX ?? cfg.len * 0.45;
    this.cartLit = true;
    this.gustT = (cfg.gustEvery ?? 9) * 0.6;
    this.gustState = 'calm'; this.gustClock = 0;
    this.startedEvents = new Set();
    this.windStr = 0;
    this.note = null; this.noteT = 0;
    this.doneX = cfg.len - 70;
    this.cartHud = 0;
  }
  showNote(txt, dur = 2.4) { this.note = txt; this.noteT = dur; }
  update(dt, inp) {
    if (this.over) return;
    const G = this.app.G;
    this.t += dt;
    stepFlakes(this.fl, dt, this.t, this.windStr);
    stepEmbers(this.embers, dt, this.t);
    this.tickMsgs(dt);
    if (this.noteT > 0) this.noteT -= dt;
    if (this.app.overlay) return;
    // wind schedule
    this.gustT -= dt;
    if (this.gustT <= 0 && this.gustState === 'calm') { this.gustState = 'warn'; this.gustClock = 1.15; windGust(0.08, 1.2); }
    if (this.gustState === 'warn') {
      this.gustClock -= dt;
      this.windStr = damp(this.windStr, 0.5, 6, dt);
      if (this.gustClock <= 0) { this.gustState = 'gust'; this.gustClock = 1.1 + Math.random() * 0.6; windGust(0.3, 1.4); SFX.whoosh(); this._gustRolled = false; }
    } else if (this.gustState === 'gust') {
      this.windStr = damp(this.windStr, 1, 5, dt);
      this.gustClock -= dt;
      if (this.gustClock <= 0) { this.gustState = 'calm'; this.gustT = (this.cfg.gustEvery ?? 9) + Math.random() * 4; }
    } else this.windStr = damp(this.windStr, 0.12, 3, dt);

    const shield = (x) => Math.abs(x - this.player.x) < (this.cfg.shieldR || 70) || (this.cfg.shieldCart && this._huddle && Math.abs(x - this.cartX) < 90);
    if (this.gustState === 'gust' && !this._gustRolled) {
      this._gustRolled = true;
      for (const tr of this.torches) {
        if (tr.lit && !shield(tr.x) && Math.random() < (this.cfg.douseChance ?? 0.55)) { tr.lit = false; SFX.whoosh(); }
      }
      if (this.cartLit && !shield(this.cartX) && Math.random() < 0.5) { this.cartLit = false; SFX.whoosh(); this.onCartOut(); }
    }

    const left = inp.down('left'), right = inp.down('right');
    const sp = this.cfg.speed || 120;
    const v = (right ? 1 : 0) - (left ? 1 : 0);
    this.player.vx = lerp(this.player.vx, v * sp * (this.gustState === 'gust' ? 0.72 : 1), 1 - Math.exp(-10 * dt));
    this.player.x = clamp(this.player.x + this.player.vx * dt, 16, this.worldW - 16);
    if (v) { this.player.dir = v; this.player.state = 'walk'; this.player.phase += dt * Math.abs(this.player.vx) * 0.075; if (Math.random() < dt * 6) SFX.step(); }
    else this.player.state = 'idle';

    const drain = (this.cfg.drain ?? 0.5) + (this.gustState === 'gust' ? 0.65 : 0);
    G.oil = clamp(G.oil - drain * dt, 0, G.oilMax);
    if (G.oil <= 0 && !this._blanked) {
      this._blanked = true;
      this.showNote('The lantern gutters out. You walk blind; someone coughs behind you.', 3.2);
      G.emitTrustFX(G.applyFX({ trust: { tomas: -1 } }));
    }
    if (G.oil > 8) this._blanked = false;

    // interactions
    let near = null;
    for (const tr of this.torches) if (!tr.lit && Math.abs(tr.x - this.player.x) < 40) { near = tr; break; }
    this.nearTorch = near;
    const byCart = Math.abs(this.cartX - this.player.x) < 76;
    this._huddle = byCart && inp.down('use');
    if (inp.consume('use')) {
      if (near) {
        if (G.oil >= 6) { near.lit = true; G.oil -= 6; SFX.relight(); this.showNote('Relit. Oil is memory now.', 1.2); }
        else { SFX.miss(); this.showNote('Not a drop to spare. Leave it dark.', 1.6); }
      } else if (byCart && !this.cartLit) {
        if (G.oil >= 10) { this.cartLit = true; G.oil -= 10; SFX.relight(); }
        else this.showNote('Bod hugs the embers with his coat. It is not enough.', 1.6);
      }
    }
    this.cartHud = damp(this.cartHud, this._huddle ? 1 : 0, 7, dt);

    for (const ev of (this.cfg.events || [])) {
      if (!this.startedEvents.has(ev.at) && this.player.x >= ev.at) {
        this.startedEvents.add(ev.at);
        this.locked = true;
        this.app.flow.play(ev.steps, () => { this.locked = false; });
        return;
      }
    }
    if (this.player.x >= this.doneX && !this._ending) {
      this._ending = true;
      if (this.cfg.onDone) this.app.flow.play(this.cfg.onDone, () => this.finish('done'));
      else this.finish('done');
    }
  }
  onCartOut() {
    if (!this._cartEvent) {
      this._cartEvent = true;
      const G = this.app.G;
      G.chits = Math.max(0, G.chits - (this.cfg.cartChits || 2));
      G.emitTrustFX(G.applyFX({ trust: { bod: -1 } }));
      this.showNote('The cart brazier winks out. Bod says nothing, which is how you know.', 3.4);
    }
  }
  lights() {
    const L = [];
    const px = this.player.x - this.camX;
    const oilF = 0.35 + 0.65 * clamp(this.app.G.oil / 100, 0, 1);
    if (this.app.G.oil > 0) L.push({ x: px, y: this.groundY - 30, r: 200 * oilF, inten: oilF, flick: 1 });
    for (const tr of this.torches) {
      if (!tr.lit) continue;
      const x = tr.x - this.camX;
      if (x < -220 || x > this.W + 220) continue;
      L.push({ x, y: this.groundY - 64, r: 105, inten: 1, flick: 1 });
    }
    const cx = this.cartX - this.camX;
    if (cx > -300 && cx < this.W + 300) L.push({ x: cx, y: this.groundY - 36, r: this.cartLit ? 150 : 40, inten: this.cartLit ? 1 : 0.3, flick: 1 });
    return L;
  }
  draw(g, t) {
    const targetCam = clamp(this.player.x - this.W / 2, 0, Math.max(0, this.worldW - this.W));
    this.camX = damp(this.camX, targetCam, 6, this.app.dt || 0.016);
    drawBackdrop(g, this.bd, this.camX, t, this.W, this.H);
    for (const tr of this.torches) {
      const x = tr.x - this.camX;
      if (x < -60 || x > this.W + 60) continue;
      g.strokeStyle = '#20180f'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, this.groundY); g.lineTo(x, this.groundY - 56); g.stroke();
      g.fillStyle = '#2c2418';
      g.beginPath(); g.arc(x, this.groundY - 58, 6, 0, TAU); g.fill();
      if (tr.lit) drawFlame(g, x, this.groundY - 60, 4.4, t, tr.x);
      if (!tr.lit && Math.abs(tr.x - this.player.x) < 40) {
        g.save(); g.textAlign = 'center'; g.font = '12px ' + SERIF; g.fillStyle = '#e8d5a8';
        g.fillText('[E] relight · 6 oil', x, this.groundY - 88); g.restore();
      }
    }
    drawCart(g, this.cartX - this.camX, this.groundY, this.cartLit, this.cartHud, t);
    const names = ['bod', 'nadia', 'tomas'];
    names.forEach((k, i) => {
      const x = this.player.x - 44 - i * 46 - (this.gustState === 'gust' ? 14 : 0);
      drawActor(g, CAST[k], x - this.camX, this.groundY, t + i, { dir: this.player.dir, state: this.player.state, phase: this.player.phase - i * 1.2, litAmount: 0.45 });
    });
    if (this.app.G.pell) drawActor(g, CAST.pell, this.player.x + 36 - this.camX, this.groundY, t + 3, { dir: this.player.dir, state: this.player.state, phase: this.player.phase + 2, litAmount: 0.7 });
    drawActor(g, CAST.miri, this.player.x - this.camX, this.groundY, t, { dir: this.player.dir, state: this.player.state, phase: this.player.phase, hold: 'lantern', litAmount: 1 });
    for (const tr of this.torches) if (tr.lit && Math.abs(tr.x - this.player.x) < 700 && Math.random() < dt01(this) * 6) spawnEmber(this.embers, tr.x, this.groundY - 64);
    drawFlakes(g, this.fl, 0);
    const L = this.lights();
    renderLighting(this.app.light, L, this.dark + (this.gustState === 'warn' ? 0.05 : 0), '#03050c');
    g.drawImage(this.app.light.canvas, 0, 0);
    applyWarmGlow(g, L, 1);
    drawEmbers(g, this.embers, this.camX);
    drawWind(g, this.W, this.H, t, this.windStr);
  }
  drawUI(g, t) {
    if (this.gustState === 'warn') {
      g.save();
      g.globalAlpha = 0.55 + Math.sin(t * 14) * 0.45;
      g.fillStyle = '#bcd4ff';
      g.font = `600 15px ${SERIF}`;
      g.textAlign = 'center';
      g.fillText('⚞ the wind is thinking about something — stand by a flame', this.W / 2, 68);
      g.restore();
    }
    if (this.note && this.noteT > 0) {
      g.save();
      g.globalAlpha = clamp(this.noteT, 0, 1);
      g.textAlign = 'center';
      g.font = `italic 15.5px ${SERIF}`;
      g.fillStyle = '#d8e2f2';
      g.fillText(this.note, this.W / 2, 98);
      g.restore();
    }
    drawMeter(g, this.W - 226, 26, 196, 'ROAD', clamp(this.player.x / this.doneX, 0, 1), '#7fa3c9');
    if (this._huddle) {
      g.save();
      g.textAlign = 'center';
      g.font = `italic 13.5px ${SERIF}`;
      g.fillStyle = 'rgba(255,214,160,0.9)';
      g.fillText('the coat over the flame — hold', this.cartX - this.camX, this.groundY - 96);
      g.restore();
    }
    this.drawMsgs(g, 124);
  }
}
function dt01() { return 0.016; }
function drawCart(g, x, y, lit, huddle, t) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#151c27';
  roundRect(g, -46, -44, 92, 30, 6); g.fill();
  g.strokeStyle = '#0c1119'; g.lineWidth = 3;
  for (const wx of [-28, 26]) { g.beginPath(); g.arc(wx, -10, 11, 0, TAU); g.stroke(); }
  g.fillStyle = '#1b2430';
  g.beginPath(); g.moveTo(-44, -44); g.quadraticCurveTo(0, -78, 44, -44); g.closePath(); g.fill();
  g.fillStyle = '#241a10'; g.fillRect(30, -52, 18, 8);
  if (lit) drawFlame(g, 39, -52, 4.6, t, 9, 1);
  if (huddle > 0.05) {
    g.globalAlpha = 0.85 * huddle;
    g.fillStyle = '#33505f';
    g.beginPath();
    g.moveTo(14, -56); g.quadraticCurveTo(39, -72 - huddle * 6, 64, -50); g.lineTo(52, -42); g.quadraticCurveTo(36, -54, 22, -42);
    g.closePath(); g.fill();
  }
  g.restore();
}
const ROAD_BACKDROP = (app) => ({
  id: 'cold-road', skyTop: '#04060e', skyMid: '#0a1322', skyBot: '#101d30', stars: true, aurora: true, clouds: 5,
  farColor: '#0d1626', midColor: '#0a121f', treeColor: '#060b12', groundColor: '#101a28',
  groundY: Math.round(app.H * 0.8),
  decor: (g, W, H, c) => {
    // telephone poles marching, most lines cut
    g.strokeStyle = '#0a111c'; g.lineWidth = 5;
    for (let x = 60; x < W; x += 260) {
      const lean = ((x / 260) % 2 ? 1 : -1) * (3 + (x % 7));
      g.beginPath(); g.moveTo(x, c.groundY + 30); g.lineTo(x + lean, c.groundY - 120); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + lean - 12, c.groundY - 110); g.lineTo(x + lean + 12, c.groundY - 110); g.stroke();
      g.lineWidth = 5;
      if ((x / 260) % 3) {
        g.strokeStyle = 'rgba(120,140,170,0.14)'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + lean, c.groundY - 108);
        g.quadraticCurveTo(x + lean + 130, c.groundY - 70, x + lean + 260, c.groundY - 108);
        g.stroke();
        g.strokeStyle = '#0a111c'; g.lineWidth = 5;
      }
    }
  },
});

/* ================= GUARD — the dark comes calling ================= */
export class GuardGame extends Minigame {
  constructor(app, cfg) {
    super(app, cfg);
    this.time = cfg.time || 90;
    this.left = this.time;
    this.bd = makeBackdrop(app.mkCanvas, cfg.backdrop || GUARD_BACKDROP(app), app.W, app.W, app.H);
    this.fl = makeFlakes(app.W, app.H, 120);
    this.groundY = Math.round(app.H * 0.8);
    this.braziers = (cfg.braziers || [0.22, 0.5, 0.78].map(f => f * app.W)).map(bx => ({ x: bx, y: this.groundY - 40, h: 1, relight: 0 }));
    this.minLit = cfg.minLit ?? 1;
    this.wisps = [];
    this.notes = [];
    this.lureCd = 0;
    this.roster = cfg.maxWisps ?? 7;
    this.leader = null;
    this.leaderT = cfg.leaderAt != null ? this.time - cfg.leaderAt : null;
    this.smoke = makeEmbers();
    this.allOutT = 0;
    this.dawn = 0;
    this.ending = false;
    this.banished = 0;
    this.spawnerT = cfg.firstAt ?? 5;
    this.every = cfg.every ?? 8;
    this.dark = 0.82;
  }
  spawnWisp(side) {
    this.wisps.push({
      x: side < 0 ? -30 : this.W + 30, y: this.H * (0.18 + Math.random() * 0.3),
      vx: 0, vy: 0, state: 'circle', ph: Math.random() * TAU,
      target: null, burn: 0, s: 0.8 + Math.random() * 0.5, fat: 0, orbT: 2,
    });
  }
  update(dt, inp) {
    if (this.over) return;
    if (this.ending) {
      this.t += dt;
      stepEmbers(this.smoke, dt, this.t);
      stepEmbers(this.embers, dt, this.t);
      this.dawn = Math.min(1, this.dawn + dt * 0.5);
      this._endT -= dt;
      if (this._endT <= 0) this.finish(this._res);
      return;
    }
    const G = this.app.G;
    this.t += dt;
    this.left -= dt;
    stepFlakes(this.fl, dt, this.t, 0.25);
    stepEmbers(this.embers, dt, this.t);
    stepEmbers(this.smoke, dt, this.t);
    this.tickMsgs(dt);
    if (this.app.overlay) return;
    if (this.left <= 0) { this.endPhase(); return; }

    const v = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    const sp = 200 * (inp.down('roll') ? 1.5 : 1);
    this.player.vx = lerp(this.player.vx, v * sp, 1 - Math.exp(-12 * dt));
    this.player.x = clamp(this.player.x + this.player.vx * dt, 20, this.W - 20);
    if (v) { this.player.dir = sign(v); this.player.state = 'walk'; this.player.phase += dt * Math.abs(this.player.vx) * 0.08; }
    else this.player.state = 'idle';
    this.player.swing = Math.max(0, this.player.swing - dt * 3);

    this.spawnerT -= dt;
    if (this.spawnerT <= 0 && this.wisps.length < this.roster) {
      this.spawnerT = Math.max(2.8, this.every - (1 - this.left / this.time) * 3.5);
      this.spawnWisp(Math.random() < 0.5 ? -1 : 1);
      if (Math.random() < 0.3 && this.wisps.length < this.roster) this.spawnWisp(Math.random() < 0.5 ? -1 : 1);
      SFX.wisp();
    }
    this.lureCd = Math.max(0, this.lureCd - dt);
    if (inp.consume('song') && this.lureCd <= 0) {
      this.lureCd = 4;
      SFX.whistle();
      this.notes.push({ x: this.player.x, y: this.groundY - 44, r: 10, t: 0 });
      if (G.pell) this.notes.push({ x: this.braziers[1] ? this.braziers[1].x : this.W / 2, y: this.groundY - 30, r: 6, t: 0, small: true });
    }
    if (inp.consume('use')) {
      this.player.swing = 1;
      SFX.whoosh();
      for (const w of this.wisps) {
        if (dist(w.x, w.y, this.player.x, this.groundY - 34) < 78) {
          const a = Math.atan2(w.y - (this.groundY - 34), w.x - this.player.x || 1);
          w.vx += Math.cos(a) * 300; w.vy += Math.sin(a) * 200;
          w.burn += 0.36; w.state = 'flee'; w.ft = 0.9; w.target = null;
        }
      }
      const ld = this.leader;
      if (ld && !ld.done && Math.abs(ld.x - this.player.x) < 64) {
        if (ld.casting) {
          ld.casting = false; ld.knock = 1; ld.interrupts++;
          if (ld.interrupts >= (this.cfg.leaderInterrupts || 3)) { ld.done = true; this.toast('You put your shoulder into the last of his argument. He goes back into the dark empty-handed.'); setTheme('guard'); }
          else this.toast('The snuffer clatters on the stones. He digs for another.');
        }
      }
    }
    if (inp.consume('shoot') && G.ammo > 0) {
      G.ammo--;
      SFX.shot();
      let hit = null;
      for (const w of this.wisps) {
        if (Math.abs(w.y - (this.groundY - 46)) < 30 && ((this.player.dir > 0 && w.x > this.player.x) || (this.player.dir < 0 && w.x < this.player.x))) {
          if (!hit || Math.abs(w.x - this.player.x) < Math.abs(hit.x - this.player.x)) hit = w;
        }
      }
      if (this.leader && !this.leader.done && ((this.player.dir > 0 && this.leader.x > this.player.x) || (this.player.dir < 0 && this.leader.x < this.player.x))) {
        this.leader.done = true; this.leader.shot = true;
        G.flags.slatShot = true;
        G.emitTrustFX(G.applyFX({ trust: { nadia: -1, tomas: -1 } }));
        this.toast('The shot ends the argument. Nobody says a word for a while.');
      } else if (hit) {
        this.banish(hit);
        this.toast('A wisp, unmade. The noise will bring more.');
      } else this.toast('You fire into the dark. The dark does not flinch.');
      for (let i = 0; i < 2 && this.wisps.length < this.roster + 2; i++) this.spawnWisp(this.player.dir > 0 ? -1 : 1);
      for (const w of this.wisps) if (w.state === 'feed') { w.state = 'circle'; w.target = null; }
    }
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.t += dt; n.r += (n.small ? 140 : 250) * dt;
      for (const w of this.wisps) {
        if (dist(w.x, w.y, n.x, n.y) < n.r + 30 && w.state !== 'flee') { w.state = 'lured'; w.tx = this.player.x; w.tt = 2.8; }
      }
      if (n.t > 1.7) this.notes.splice(i, 1);
    }
    for (const w of this.wisps) {
      w.ph += dt * (2 + w.s);
      if (w.state === 'circle') {
        w.orbT -= dt;
        const tx = w.x + Math.cos(w.ph) * 40;
        const ty = this.H * 0.24 + Math.sin(w.ph * 0.9) * 42;
        w.vx = damp(w.vx, (tx - w.x) * 1.2 + (this.player.x < this.W / 2 ? 26 : -26), 2.4, dt);
        w.vy = damp(w.vy, ty - w.y, 2.4, dt);
        if (w.orbT <= 0 && Math.random() < dt * 0.5) {
          const live = this.braziers.map((b, i2) => ({ b, i2 })).filter(o => o.b.h > 0.08);
          if (live.length) { const o = live[(Math.random() * live.length) | 0]; w.state = 'approach'; w.target = o.i2; }
        }
      } else if (w.state === 'approach') {
        const b = this.braziers[w.target];
        if (!b || b.h <= 0.03) { w.state = 'circle'; w.target = null; }
        else {
          const dx = b.x - w.x, dy = (b.y - 18) - w.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = (36 + w.s * 20) * (1 + w.fat);
          w.vx = damp(w.vx, dx / d * spd, 2, dt);
          w.vy = damp(w.vy, dy / d * spd, 2, dt);
          if (d < 18) w.state = 'feed';
        }
      } else if (w.state === 'feed') {
        const b = this.braziers[w.target];
        if (!b || b.h <= 0) { w.state = 'circle'; w.target = null; }
        else {
          w.vx = damp(w.vx, 0, 6, dt); w.vy = damp(w.vy, 0, 6, dt);
          b.h = clamp(b.h - dt * 0.13, 0, 1);
          if (b.h <= 0) { this.toast('A brazier goes white-smoke dark.'); SFX.whoosh(); w.state = 'circle'; w.target = null; }
        }
      } else if (w.state === 'lured') {
        w.tt -= dt;
        const dx = w.tx - w.x, dy = (this.groundY - 66) - w.y;
        const d = Math.hypot(dx, dy) || 1;
        w.vx = damp(w.vx, dx / d * 120, 4, dt);
        w.vy = damp(w.vy, dy / d * 72, 4, dt);
        if (w.tt <= 0) w.state = 'circle';
      } else if (w.state === 'flee') {
        w.ft -= dt;
        if (w.ft <= 0) w.state = 'circle';
      }
      w.x += w.vx * dt; w.y += w.vy * dt;
      w.y = clamp(w.y, 36, this.groundY - 24);
      if (w.x < -80) w.x = -80; if (w.x > this.W + 80) w.x = this.W + 80;
      const dl = dist(w.x, w.y, this.player.x, this.groundY - 34);
      const lanternR = (this.app.G.oil > 0 ? 1 : 0.25) * 155 * (0.5 + 0.5 * clamp(this.app.G.oil / 100, 0, 1));
      if (dl < lanternR && this.app.G.oil > 0) {
        w.burn += dt * (1.05 - (dl / lanternR) * 0.65);
        const push = (1 - dl / lanternR) * 70;
        w.vx += ((w.x - this.player.x) / (dl || 1)) * push * dt * 4;
        w.vy += ((w.y - (this.groundY - 34)) / (dl || 1)) * push * dt * 3;
      }
      for (const b of this.braziers) if (b.h > 0.05 && dist(w.x, w.y, b.x, b.y - 10) < 44) w.burn += dt * 0.55;
      if (w.burn >= 1) this.banish(w);
    }
    this.wisps = this.wisps.filter(w => !w.dead);
    for (const b of this.braziers) {
      if (b.h <= 0) {
        b.relight += dt;
        if (Math.random() < dt * 1.6) spawnEmber(this.smoke, b.x, b.y - 8, 210);
        if (b.relight > (this.cfg.relightAfter ?? 10)) {
          b.relight = 0; b.h = 0.3;
          this.toast('Tomas relights it with shaking hands.');
          SFX.relight();
        }
      }
    }
    if (this.leaderT != null) {
      this.leaderT -= dt;
      if (this.leaderT <= 0 && !this.leader) {
        const live = this.braziers.map((b, i2) => ({ b, i2 })).filter(o => o.b.h > 0.05);
        const o = live.length ? live[live.length - 1] : { b: this.braziers[0], i2: 0 };
        this.leader = { x: this.W + 40, target: o.b, ti: o.i2, casting: false, cast: 0, castT: 2.2, interrupts: 0, done: false, knock: 0 };
        this.toast('Slat walks out of the dark with a snuffer in his fist.');
        setTheme('fight');
        SFX.whoosh();
      }
    }
    if (this.leader && !this.leader.done) {
      const ld = this.leader;
      ld.x = damp(ld.x, ld.target.x - 46, 1.4, dt);
      if (ld.knock > 0) ld.knock -= dt;
      else if (!ld.casting) {
        ld.castT -= dt;
        if (ld.castT <= 0 && this.left > 3) { ld.casting = true; ld.cast = 2.6; }
      }
      if (ld.casting) {
        ld.cast -= dt;
        ld.target.h = clamp(ld.target.h - dt * 0.42, 0, 1);
        if (ld.cast <= 0) { ld.casting = false; ld.castT = 6; if (ld.target.h <= 0) this.toast('He smothers it like a candle at bedtime. Efficient. Hateful.'); }
      }
    }
    const litCount = this.braziers.filter(b => b.h > 0.05).length;
    if (litCount === 0) { this.allOutT += dt; if (this.allOutT > 10) { this.endPhase(); return; } }
    else this.allOutT = 0;
    G.oil = clamp(G.oil - dt * 0.18, 0, G.oilMax);
  }
  banish(w) {
    w.dead = true;
    this.banished++;
    SFX.banish();
    for (let i = 0; i < 6; i++) spawnEmber(this.embers, w.x, w.y, 200);
  }
  endPhase() {
    if (this.ending) return;
    this.ending = true;
    const litCount = this.braziers.filter(b => b.h > 0.05).length;
    setTheme('dawn');
    SFX.bellTower();
    const res = litCount >= this.minLit ? 'win' : 'lose';
    this.dawn = 0.001;
    this._endT = 1.8;
    this._res = res;
  }
  lights() {
    const L = [];
    const G = this.app.G;
    const oilF = G.oil > 0 ? 0.5 + 0.5 * clamp(G.oil / 100, 0, 1) : 0.12;
    L.push({ x: this.player.x, y: this.groundY - 30, r: 185 * oilF, inten: 0.95, flick: 1 });
    for (const b of this.braziers) if (b.h > 0.02) L.push({ x: b.x, y: b.y - 8, r: 120 + 95 * b.h, inten: 0.6 + 0.5 * b.h, flick: 1 });
    for (const w of this.wisps) L.push({ x: w.x, y: w.y, r: 34, inten: 0.6, flick: 0, warm: '140,180,255' });
    L.push({ x: this.W * 0.86, y: this.groundY - 275, r: 150, inten: 0.9, flick: 1, warm: '255,200,130' });
    return L;
  }
  draw(g, t) {
    drawBackdrop(g, this.bd, 0, t, this.W, this.H);
    if (this.dawn > 0) {
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = clamp(this.dawn, 0, 1) * 0.3;
      const grd = g.createLinearGradient(0, 0, 0, this.H * 0.7);
      grd.addColorStop(0, '#ffb36b'); grd.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = grd; g.fillRect(0, 0, this.W, this.H);
      g.restore();
    }
    for (const b of this.braziers) drawBrazier(g, b, t);
    drawActor(g, CAST.tomas, this.W * 0.92, this.groundY, t + 2, { dir: -1, state: 'act', litAmount: 0.8 });
    drawActor(g, CAST.bod, this.W * 0.07, this.groundY, t, { dir: 1, state: 'act', litAmount: 0.7 });
    if (this.app.G.pell && this.braziers[1]) drawActor(g, CAST.pell, this.braziers[1].x - 26, this.groundY, t * 1.2, { dir: 1, litAmount: 0.9 });
    for (const w of this.wisps) drawWisp(g, w, t);
    if (this.leader && !this.leader.done) {
      const ld = this.leader;
      drawActor(g, CAST.slat, ld.x, this.groundY, t, { dir: -1, state: ld.casting ? 'act' : 'idle', litAmount: 0.9 });
      if (ld.casting) {
        g.save();
        g.strokeStyle = 'rgba(190,120,255,0.7)';
        g.setLineDash([4, 6]);
        g.beginPath(); g.moveTo(ld.x - 22, this.groundY - 52); g.lineTo(ld.target.x, ld.target.y - 8); g.stroke();
        g.restore();
      }
    }
    drawActor(g, CAST.miri, this.player.x, this.groundY, t, { dir: this.player.dir, state: this.player.state, phase: this.player.phase, hold: 'lantern', litAmount: 1.25 });
    if (this.player.swing > 0.2) {
      g.save();
      g.strokeStyle = `rgba(255,220,160,${this.player.swing * 0.8})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(this.player.x, this.groundY - 34, 54, this.player.dir > 0 ? -1 : Math.PI - 1, this.player.dir > 0 ? 0.9 : Math.PI + 0.9);
      g.stroke();
      g.restore();
    }
    for (const n of this.notes) {
      g.save();
      g.globalAlpha = clamp(1 - n.t / 1.7, 0, 1) * 0.6;
      g.strokeStyle = '#cfe6ff';
      g.lineWidth = 1.4;
      g.beginPath(); g.arc(n.x, n.y, n.r, 0, TAU); g.stroke();
      g.font = '14px ' + SERIF;
      g.fillStyle = '#cfe6ff';
      for (let i = 0; i < 3; i++) {
        const a = n.t * 2 + i * 2.1;
        g.fillText('♪', n.x + Math.cos(a) * n.r * 0.9 - 4, n.y + Math.sin(a) * n.r * 0.5 - 8 - i * 3);
      }
      g.restore();
    }
    drawFlakes(g, this.fl, 0);
    const L = this.lights();
    renderLighting(this.app.light, L, this.dark - this.dawn * 0.35, '#02040a');
    g.drawImage(this.app.light.canvas, 0, 0);
    applyWarmGlow(g, L, 1);
    drawEmbers(g, this.embers, 0);
    drawEmbers(g, this.smoke, 0);
    drawWind(g, this.W, this.H, t, 0.2);
  }
  drawUI(g, t) {
    g.save();
    g.textAlign = 'center';
    g.font = `600 20px ${SERIF}`;
    g.fillStyle = this.left < 20 ? '#ffcf8a' : '#dfe6f2';
    g.fillText(fmtTime(this.left), this.W / 2, 34);
    g.font = `11px ${SERIF}`;
    g.fillStyle = 'rgba(200,210,228,0.7)';
    g.fillText('until the dawn bells', this.W / 2, 48);
    g.restore();
    g.save();
    g.textAlign = 'center';
    g.font = `12.5px ${SERIF}`;
    g.fillStyle = 'rgba(210,220,235,0.8)';
    g.fillText('[Q] sing to lure · [E] shove into lamplight · [F] the shot you’d rather not take', this.W / 2, this.H - 14);
    g.restore();
    this.drawMsgs(g, 76);
    if (this.lureCd > 0) drawMeter(g, this.W - 130, this.H - 54, 110, 'breath', 1 - this.lureCd / 4, '#9fd0ff');
  }
}
function fmtTime(s) { s = Math.max(0, s); return `${(s / 60) | 0}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }
function drawBrazier(g, b, t) {
  g.save();
  g.translate(b.x, b.y);
  g.fillStyle = '#1a1510';
  g.beginPath();
  g.moveTo(-14, 0); g.lineTo(14, 0); g.lineTo(9, -14); g.lineTo(-9, -14);
  g.closePath(); g.fill();
  g.fillRect(-2, 0, 4, 40);
  if (b.h > 0.02) drawFlame(g, 0, -16, 6 * (0.4 + b.h * 0.8), t, b.x, Math.max(0.25, b.h));
  g.restore();
}
function drawWisp(g, w, t) {
  g.save();
  g.translate(w.x, w.y);
  const flap = Math.sin(t * 13 + w.ph) * 0.6;
  g.globalCompositeOperation = 'screen';
  g.fillStyle = `rgba(150,190,255,${0.22 + 0.1 * w.s})`;
  g.beginPath();
  g.ellipse(-8, 0, 9 + w.fat * 4, 4 + 3 * Math.abs(flap), -0.4, 0, TAU);
  g.ellipse(8, 0, 9 + w.fat * 4, 4 + 3 * Math.abs(flap), 0.4, 0, TAU);
  g.fill();
  const core = g.createRadialGradient(0, 0, 0.5, 0, 0, 10 + w.fat * 5);
  core.addColorStop(0, 'rgba(232,244,255,0.95)');
  core.addColorStop(0.5, 'rgba(140,180,255,0.45)');
  core.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = core;
  g.beginPath(); g.arc(0, 0, 12 + w.fat * 6, 0, TAU); g.fill();
  if (w.burn > 0.35) {
    g.globalAlpha = clamp(w.burn, 0, 1) * 0.6;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(10,10,18,0.55)';
    g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  }
  g.restore();
}
const GUARD_BACKDROP = (app) => ({
  id: 'lighthouse-court', skyTop: '#03050c', skyMid: '#070d1a', skyBot: '#0c1626', stars: true, aurora: true, clouds: 6,
  farColor: '#0b1322', midColor: '#081020', groundColor: '#0d1522', trees: false,
  groundY: Math.round(app.H * 0.8),
  decor: (g, W, H, c) => {
    const x = W * 0.86, base = c.groundY;
    g.fillStyle = '#0c1320';
    g.beginPath();
    g.moveTo(x - 44, base); g.lineTo(x - 24, base - 250); g.lineTo(x + 24, base - 250); g.lineTo(x + 44, base);
    g.closePath(); g.fill();
    g.fillStyle = '#101a2a';
    g.fillRect(x - 30, base - 284, 60, 36);
    g.save();
    g.globalAlpha = 0.14; g.fillStyle = '#88453a';
    for (let i = 0; i < 4; i++) g.fillRect(x - 38 + i * 2, base - 60 - i * 56, 76 - i * 4, 16);
    g.restore();
    g.fillStyle = '#0a111d';
    g.beginPath(); g.moveTo(W * 0.06, base); g.lineTo(W * 0.06 + 30, base - 62); g.lineTo(W * 0.06 + 96, base - 62); g.lineTo(W * 0.06 + 120, base); g.closePath(); g.fill();
    g.strokeStyle = '#0a1018'; g.lineWidth = 5;
    for (const px of [W * 0.34, W * 0.58]) { g.beginPath(); g.moveTo(px, base + 8); g.lineTo(px - 8, base - 40); g.stroke(); }
  },
});

/* ================= COMBAT — the thing we do not want to do ================= */
export class CombatGame extends Minigame {
  constructor(app, cfg) {
    super(app, cfg);
    this.worldW = cfg.arena || this.W;
    this.bd = makeBackdrop(app.mkCanvas, cfg.backdrop || FIGHT_BACKDROP(app), this.W, app.W, app.H);
    this.fl = makeFlakes(app.W, app.H, 90);
    this.foes = (cfg.foes || ['reaver', 'reaver', 'reaver']).map((k, i) => ({
      key: k, x: this.W - 70 - i * 52, hp: k === 'boss' ? 3 : 2, stun: 0, down: 0, tele: 0,
      spd: (k === 'boss' ? 42 : 52) + i * 5, dir: -1, jitter: Math.random() * 4,
    }));
    this.freeze = null;
    this.ci = 0;
    this.shock = 0;
    this.intro = 1.2;
  }
  update(dt, inp) {
    if (this.over) return;
    this.t += dt;
    stepFlakes(this.fl, dt, this.t, 0);
    this.tickMsgs(dt);
    if (this.app.overlay) return;
    this.intro = Math.max(0, this.intro - dt);
    if (this.intro > 0) return;
    if (this.freeze) {
      if (inp.consume('down')) { this.ci = (this.ci + 1) % this.freeze.opts.length; SFX.ui(); }
      if (inp.consume('up')) { this.ci = (this.ci + this.freeze.opts.length - 1) % this.freeze.opts.length; SFX.ui(); }
      if (inp.consume('action')) { const k = this.freeze.opts[this.ci].key; this.freeze = null; this.finish(k); }
      return;
    }
    const G = this.app.G;
    const v = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
    this.player.roll = Math.max(0, this.player.roll - dt);
    if (inp.consume('roll')) { this.player.roll = 0.32; SFX.whoosh(); }
    const sp = 170 * (this.player.roll > 0 ? 2.7 : 1);
    this.player.vx = lerp(this.player.vx, v * sp, 1 - Math.exp(-10 * dt));
    this.player.x = clamp(this.player.x + this.player.vx * dt, 22, this.W - 22);
    if (v) { this.player.dir = sign(v); this.player.state = 'walk'; this.player.phase += dt * Math.abs(this.player.vx) * 0.08; }
    else this.player.state = 'idle';
    this.player.hurt = Math.max(0, this.player.hurt - dt);
    this.player.swing = Math.max(0, this.player.swing - dt * 4);
    this.shock = Math.max(0, this.shock - dt);

    if (inp.consume('use') && this.player.swing <= 0.35) {
      this.player.swing = 1;
      SFX.whoosh();
      for (const f of this.foes) {
        if (f.down > 0) continue;
        const dx = f.x - this.player.x;
        if (Math.abs(dx) < 56 && sign(dx || this.player.dir) === this.player.dir) {
          f.hp--; f.stun = 0.95;
          f.x = clamp(f.x + sign(dx || 1) * 36, 20, this.W - 20);
          SFX.thud();
          if (f.hp <= 0) { f.down = 1; this.toast(f.key === 'boss' ? 'The big one goes down hard into the snow.' : 'One of them stops trying.'); }
        }
      }
    }
    if (inp.consume('shoot') && G.ammo > 0) {
      G.ammo--;
      SFX.shot();
      this.shock = 0.5;
      let hit = null;
      for (const f of this.foes) {
        if (f.down > 0) continue;
        if ((this.player.dir > 0 && f.x > this.player.x) || (this.player.dir < 0 && f.x < this.player.x)) {
          if (!hit || Math.abs(f.x - this.player.x) < Math.abs(hit.x - this.player.x)) hit = f;
        }
      }
      if (hit) { hit.down = 1; hit.shot = true; G.flags.firedShot = true; G.flags.endedSomeone = true; this.toast('Gunshot. Twelve years, and it still sounds like the end of a conversation.'); }
      else this.toast('You fire wide into the dark. The whole valley heard that.');
      for (const f of this.foes) if (!f.down) f.spd += 20;
    }
    let anyUp = false;
    for (const f of this.foes) {
      if (f.down > 0) continue;
      anyUp = true;
      f.stun = Math.max(0, f.stun - dt);
      const dx = this.player.x - f.x;
      f.dir = sign(dx || 1);
      if (f.stun > 0) continue;
      if (Math.abs(dx) > 36) {
        f.tele = 0;
        f.x += sign(dx) * f.spd * (1 + 0.3 * Math.sin(this.t * 2 + f.jitter)) * dt;
      } else {
        f.tele += dt;
        if (f.tele > 0.6) {
          f.tele = -0.7;
          if (this.player.roll <= 0 && this.player.hurt <= 0 && Math.abs(this.player.x - f.x) < 46) {
            G.hp--; this.player.hurt = 1;
            SFX.hurt();
            this.player.x = clamp(this.player.x - sign(this.player.x - f.x) * 26, 22, this.W - 22);
            this.toast('That hurt like it meant it. It did.');
            if (G.hp <= 0) { this.onDowned(); return; }
          } else SFX.thud();
        }
      }
    }
    if (!anyUp) this.promptEnd();
  }
  promptEnd() {
    const G = this.app.G;
    const opts = [{ key: 'standdown', t: 'Step back. Bow. We are performers.' }];
    opts.push({ key: 'rob', t: 'Take their coats and their candle-money. Reparations.' });
    if (G.trust.nadia >= 3) opts.push({ key: 'talk', t: 'Let Nadia talk. She has a voice for this.' });
    opts.push({ key: 'finish', t: 'End it. This is where soldiers live.' });
    this.freeze = { opts };
    setTheme('sad');
  }
  onDowned() {
    this.app.G.hp = 1;
    this.app.G.emitTrustFX(this.app.G.applyFX({ chits: -3, trust: { tomas: 1 } }));
    sting('bad');
    this.finish('pyrrhic');
  }
  draw(g, t) {
    drawBackdrop(g, this.bd, 0, t, this.W, this.H);
    for (const f of this.foes) {
      const c = f.key === 'boss' ? CAST.slat : CAST.hask;
      drawActor(g, { ...c, cloth: '#241d2b', trim: '#7a5f9a' }, f.x, this.groundY, t + f.jitter, {
        dir: f.dir, state: f.down ? 'fall' : f.stun > 0 ? 'idle' : 'walk', phase: t * 5,
        litAmount: 0.85,
      });
      if (f.tele > 0.28 && !f.down) {
        g.save();
        g.globalAlpha = clamp(f.tele * 2, 0, 1);
        g.strokeStyle = '#ff6b52'; g.lineWidth = 2;
        g.beginPath(); g.arc(f.x, this.groundY - 40, 26, 0, TAU); g.stroke();
        g.restore();
      }
    }
    drawActor(g, CAST.miri, this.player.x, this.groundY, t, { dir: this.player.dir, state: this.player.roll > 0 ? 'act' : this.player.state, phase: this.player.phase, hold: this.player.roll > 0 ? null : 'lantern', litAmount: 1.35 });
    drawActor(g, CAST.bod, 30, this.groundY, t, { dir: 1, state: 'act', litAmount: 0.5 });
    drawActor(g, CAST.nadia, 62, this.groundY, t + 1, { dir: 1, state: 'idle', litAmount: 0.42 });
    if (this.app.G.pell) drawActor(g, CAST.pell, 94, this.groundY, t + 2, { dir: 1, litAmount: 0.4 });
    drawFlakes(g, this.fl, 0);
    const L = [
      { x: this.player.x, y: this.groundY - 30, r: 190, inten: 1, flick: 1 },
      { x: 44, y: this.groundY - 30, r: 90, inten: 0.6, flick: 1 },
    ];
    for (const f of this.foes) if (!f.down) L.push({ x: f.x, y: this.groundY - 40, r: 58, inten: 0.5, flick: 1, warm: '255,110,70' });
    renderLighting(this.app.light, L, 0.8, '#030509');
    g.drawImage(this.app.light.canvas, 0, 0);
    applyWarmGlow(g, L, 1.2);
    if (this.shock > 0) { g.fillStyle = `rgba(255,240,200,${this.shock * 0.4})`; g.fillRect(0, 0, this.W, this.H); }
    if (this.player.hurt > 0.6) { g.fillStyle = `rgba(140,20,20,${(this.player.hurt - 0.6) * 0.35})`; g.fillRect(0, 0, this.W, this.H); }
  }
  drawUI(g, t) {
    if (this.intro > 0) {
      g.save();
      g.globalAlpha = clamp(this.intro, 0, 1);
      g.textAlign = 'center';
      g.font = `600 26px ${DISP}`;
      g.fillStyle = '#e8d5a8';
      g.fillText(this.cfg.title || 'IT COMES TO THIS', this.W / 2, this.H / 2 - 40);
      g.restore();
    }
    this.drawMsgs(g, 80);
    if (this.freeze) {
      const boxW = Math.min(this.W - 120, 620);
      roundPanel(g, (this.W - boxW) / 2, this.H / 2 - 110, boxW, 210, 10);
      g.save();
      g.textAlign = 'center';
      g.font = `600 17px ${DISP}`;
      g.fillStyle = '#eee2c8';
      g.fillText('The fight is over. Something still has to be decided.', this.W / 2, this.H / 2 - 76);
      g.restore();
      let cy = this.H / 2 - 52;
      for (let i = 0; i < this.freeze.opts.length; i++) {
        const on = i === this.ci;
        g.save();
        g.fillStyle = on ? 'rgba(28,20,10,0.96)' : 'rgba(10,13,20,0.9)';
        g.strokeStyle = on ? 'rgba(232,182,76,0.85)' : 'rgba(120,140,170,0.3)';
        roundRect(g, (this.W - boxW) / 2 + 24, cy, boxW - 48, 28, 7); g.fill(); g.stroke();
        g.font = `14px ${SERIF}`;
        g.fillStyle = on ? '#f4e8d0' : '#b9c2d2';
        g.fillText(this.freeze.opts[i].t, this.W / 2, cy + 19);
        g.restore();
        cy += 34;
      }
    } else if (this.intro <= 0) {
      g.save();
      g.font = `12.5px ${SERIF}`;
      g.fillStyle = 'rgba(210,220,235,0.75)';
      g.textAlign = 'center';
      g.fillText('[E] shove · [SHIFT] roll away from the swing · [F] gunshot — use your words while you still can', this.W / 2, this.H - 14);
      g.restore();
    }
  }
}
const FIGHT_BACKDROP = (app) => ({
  id: 'bridge-night', skyTop: '#03040a', skyMid: '#080f1c', skyBot: '#0e1626', stars: true, clouds: 3,
  farColor: '#0b1424', midColor: '#081020', trees: false, groundColor: '#0c1420',
  groundY: Math.round(app.H * 0.8),
  decor: (g, W, H, c) => {
    g.fillStyle = '#0a1120';
    for (const [x, w, h] of [[0.18, 26, 120], [0.46, 30, 96], [0.72, 26, 132]]) {
      const px = W * x;
      g.fillRect(px - w / 2, c.groundY - h, w, h + 40);
      g.beginPath();
      g.moveTo(px - w / 2 - 6, c.groundY - h);
      g.lineTo(px + w / 2 + 6, c.groundY - h - 12);
      g.lineTo(px + w / 2, c.groundY - h + 8);
      g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(150,170,200,0.16)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, c.groundY - 22);
    for (let x = 0; x <= W; x += 30) g.lineTo(x, c.groundY - 22 + Math.sin(x / 90) * 6);
    g.stroke();
  },
});
