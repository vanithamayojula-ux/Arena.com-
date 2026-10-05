/* AFTERGLOW — the flow: a tiny program-stack interpreter that turns story data
   into gameplay (cards, scenes, talks, minigames, conditionals). Story never
   touches the engine; it just lists steps. */

import { clamp, check, applyEffects } from './util.js';
import { setTheme, SFX, sting, windGust } from './audio.js';

export class Dialogue {
  /* def: { nodes:{id:{lines:[[who,text,mood?]|"narration",...], next, then, effect, choices:[{t,go,if,effect,note,sfx}]}},
     or {lines:[...]} linear shorthand; `after` effect applies on completion. */
  constructor(G, def, onDone) {
    this.G = G; this.def = def || {}; this.onDone = onDone;
    this.node = null; this.lineI = -1; this.shown = ''; this.full = '';
    this.who = null; this.mood = 0; this.done = false; this.finished = false;
    this.speed = G.textSpeed || 60;
    this.choices = null; this.ci = 0;
    if (this.def.nodes && this.def.lines) {
      const startId = this.def.start || (typeof this.def.nodes.start === 'string' ? this.def.nodes.start : Object.keys(this.def.nodes)[0]);
      this.nodes = { pre: { lines: this.def.lines, next: startId }, ...this.def.nodes };
      this.startId = 'pre';
    } else if (this.def.nodes) {
      this.nodes = { ...this.def.nodes };
      this.startId = this.def.start || (typeof this.nodes.start === 'string' ? this.nodes.start : (this.nodes.one ? 'one' : Object.keys(this.nodes)[0]));
      if (typeof this.nodes.start === 'string') delete this.nodes.start;
    } else {
      this.nodes = { one: { lines: this.def.lines || [] } };
      this.startId = 'one';
    }
    this.follow = [];
  }
  start() { this.goto(this.startId); }
  goto(id) {
    const node = this.nodes[id];
    if (!node) { this.finish(); return; }
    this.node = node; this.nodeId = id;
    if (node.effect) this.G.emitTrustFX(applyEffects(this.G, node.effect));
    if (node.sfx) SFX[node.sfx] && SFX[node.sfx]();
    this.lineI = -1;
    this.nextLine();
  }
  nextLine() {
    const lines = this.node.lines || [];
    this.lineI++;
    if (this.lineI >= lines.length) { this.lineReady(); return; }
    const L = lines[this.lineI];
    if (Array.isArray(L)) { this.who = L[0]; this.full = String(L[1]); this.mood = L[2] || 0; }
    else { this.who = 'narrator'; this.full = String(L); this.mood = 0; }
    this.shown = ''; this.done = false;
    if (this.who && this.who !== 'narrator') SFX.soft();
  }
  lineReady() {
    const n = this.node;
    this.choices = null;
    if (n.choices) {
      const list = n.choices.filter(c => check(c.if, this.G));
      if (list.length) {
        if (n.choicePrompt) { this.full = n.choicePrompt; this.shown = this.full; this.done = true; this.awaitChoice = true; return; }
        this.choices = list; this.ci = 0; return;
      }
    }
    this.advance();
  }
  advance() {
    const n = this.node;
    if (typeof n.next === 'string') this.goto(n.next);
    else if (typeof n.nextFn === 'function') { const r = n.nextFn(this.G); r ? this.goto(r) : this.finish(); }
    else this.finish();
  }
  update(dt, inp) {
    if (this.finished) return;
    if (this.awaitChoice) {
      if (inp.consume('action') || inp.consume('down')) { this.awaitChoice = false; this.choices = this.node.choices.filter(c => check(c.if, this.G)); this.ci = 0; }
      return;
    }
    if (this.choices) {
      if (inp.consume('down')) { this.ci = (this.ci + 1) % this.choices.length; SFX.ui(); }
      if (inp.consume('up')) { this.ci = (this.ci + this.choices.length - 1) % this.choices.length; SFX.ui(); }
      if (inp.consume('action')) {
        const c = this.choices[this.ci];
        if (c.sfx) SFX[c.sfx] && SFX[c.sfx]();
        if (c.effect) this.G.emitTrustFX(applyEffects(this.G, c.effect));
        if (c.then) this.follow.push(...c.then);
        if (c.go) this.goto(c.go);
        else this.advance();
      }
      return;
    }
    if (!this.done) {
      let sp = this.speed;
      const tail = this.shown.slice(-2);
      if (/[,.…]$/.test(tail)) sp *= 0.35;
      else if (/[!?—]$/.test(tail)) sp *= 0.55;
      this.shown = this.full.slice(0, Math.floor(this.shown.length + dt * sp + 1));
      if (this.shown.length >= this.full.length) this.done = true;
      if (inp.consume('action')) { this.shown = this.full; this.done = true; }
    } else if (inp.consume('action') || inp.consume('use')) {
      this.nextLine();
    }
  }
  finish() {
    if (this.finished) return;
    if (this.node && this.node.then) this.follow.push(...this.node.then);
    if (this.def.then) this.follow.push(...this.def.then);
    if (this.def.after) applyEffects(this.G, this.def.after);
    this.finished = true;
  }
}

export class Flow {
  constructor(app) {
    this.app = app;
    this.stack = [];
    this.timer = null;
  }
  play(steps, onEnd) {
    if (!steps || !steps.length) { if (onEnd) onEnd(); return; }
    this.stack.push({ list: steps, i: 0, onEnd });
    this.advance();
  }
  cur() { return this.stack[this.stack.length - 1] || null; }
  depth() { return this.stack.length; }
  advance() {
    let guard = 0;
    while (guard++ < 200) {
      const fr = this.cur();
      if (!fr) return;
      if (fr.i >= fr.list.length) {
        this.stack.pop();
        if (fr.onEnd) fr.onEnd();
        continue;
      }
      const step = fr.list[fr.i++];
      try { this.runStep(step); }
      catch (e) { console.error('[afterglow] step failed', JSON.stringify(step && step.s ? step.s : step), e); this.advance(); }
      return; // blocking steps resolve via callbacks; immediate ones call advance() themselves
    }
  }
  runStep(s) {
    const app = this.app, G = app.G;
    if (!s) { this.advance(); return; }
    if (typeof s === 'function') { s(app, G, this); this.advance(); return; }
    switch (s.s) {
      case 'do': {
        const r = s.fn && s.fn(app, G);
        if (s.save && r !== undefined) G.flags[s.save] = r;
        this.advance();
        break;
      }
      case 'if': {
        const ok = check(s.cond, G);
        const list = ok ? s.then : s.else;
        if (list && list.length) this.play(list, () => this.advance());
        else this.advance();
        break;
      }
      case 'wait':
        this.timer = { t: s.t || 0.6, cb: () => { this.timer = null; this.advance(); } };
        break;
      case 'music':
        setTheme(s.name);
        this.advance();
        break;
      case 'sfx':
        if (s.name && SFX[s.name]) SFX[s.name]();
        if (s.sting) sting(s.sting);
        this.advance();
        break;
      case 'toast':
        app.toast(s.text, s.color);
        this.advance();
        break;
      case 'gust':
        windGust(s.a ?? 0.25, s.d ?? 1.6);
        this.advance();
        break;
      case 'card': {
        const card = { ...s };
        for (const k of ['title', 'sub', 'hint', 'kicker']) if (typeof card[k] === 'function') card[k] = card[k](G);
        app.openCard(card, () => this.advance());
        break;
      }
      case 'talk':
        app.openTalk(s, () => this.advance());
        break;
      case 'scene':
        app.openScene(s.id, s, () => this.advance());
        break;
      case 'sceneExit':
        if (app.scene) app.scene.finish();
        else this.advance();
        break;
      case 'perf':
        app.openPerf(s, () => this.advance());
        break;
      case 'negotiate':
        app.openNegotiate(s, () => this.advance());
        break;
      case 'road':
        app.openRoad(s, () => this.advance());
        break;
      case 'guard':
        app.openGuard(s, () => this.advance());
        break;
      case 'combat':
        app.openCombat(s, () => this.advance());
        break;
      case 'save':
        app.save();
        this.advance();
        break;
      case 'endact':
        app.endAct(s.act != null ? s.act : G.act + 1);
        break;
      case 'title':
        app.toTitle();
        break;
      case 'credits':
        app.openCredits(() => app.toTitle());
        break;
      default:
        console.warn('[afterglow] unknown step', s);
        this.advance();
    }
  }
  update(dt) {
    if (this.timer) {
      this.timer.t -= dt;
      if (this.timer.t <= 0) { const cb = this.timer.cb; this.timer.cb = null; cb(); }
    }
  }
}
