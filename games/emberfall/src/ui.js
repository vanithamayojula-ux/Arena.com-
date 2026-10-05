// The DOM half of the game: playbill cards, the dialogue box, the HUD. The canvas
// paints the world; the words live up here, in typefaces that survived the Dimming.

import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  stage: null, hud: null, dlg: null, prompt: null, cardScreen: null, cardFrame: null,
  toasts: null, fade: null, laneRow: null, judge: null,
  typing: false, typingDone: null, muted: false, fast: false,

  init() {
    this.stage = $('stage');
    this.hud = $('hud');
    this.dlg = { root: $('dialogue'), sp: $('dlgSpeaker'), tx: $('dlgText'), ch: $('dlgChoices'), hint: $('dlgHint') };
    this.prompt = {
      root: $('promptCard'), kicker: $('promptKicker'), title: $('promptTitle'),
      body: $('promptBody'), ch: $('promptChoices'), timerWrap: $('promptTimer'), timer: $('promptTimer').firstElementChild,
    };
    this.cardScreen = $('cardScreen');
    this.cardFrame = $('cardFrame');
    this.toasts = $('toasts');
    this.fade = $('fadeout');
    this.laneRow = $('laneRow');
    this.judge = $('judgmentPop');
  },

  play(on) {
    document.body.classList.toggle('playing', !!on);
    document.body.classList.toggle('scene-title', !on);
  },

  setChapter(label, place) {
    $('hudChapter').textContent = label;
    $('hudPlace').textContent = place || '';
  },

  syncHud(s) {
    const oilP = clamp(s.oil, 0, 100);
    $('oilFill').style.width = oilP + '%';
    $('oilNum').textContent = Math.round(s.oil);
    const oilTrack = $('oilFill').parentElement;
    oilTrack.classList.toggle('low', oilP < 24);
    $('moraleFill').style.width = clamp(s.morale, 0, 100) + '%';
    $('repNum').textContent = s.rep;
    $('relitNum').textContent = s.relit;
    for (const [id, key] of [['bondDill', 'dill'], ['bondBram', 'bram'], ['bondFenn', 'fenn']]) {
      const el = $(id);
      el.querySelector('s').style.width = clamp(s.bonds[key], 0, 100) + '%';
      el.classList.toggle('warm', s.bonds[key] >= 60);
    }
  },

  bumpBond(who) {
    const el = who === 'dill' ? $('bondDill') : who === 'bram' ? $('bondBram') : $('bondFenn');
    if (!el) return;
    el.classList.remove('bumped'); void el.offsetWidth; el.classList.add('bumped');
  },

  toast(text, cls) {
    const d = document.createElement('div');
    d.className = 'toast' + (cls ? ' ' + cls : '');
    d.textContent = text;
    this.toasts.appendChild(d);
    setTimeout(() => d.remove(), 3700);
  },

  judgment(text, miss) {
    const j = this.judge;
    j.textContent = text;
    j.classList.toggle('miss', !!miss);
    j.classList.remove('go'); void j.offsetWidth; j.classList.add('go');
    j.hidden = false;
  },

  // ------------------------------------------------------------ dialogue
  say(speaker, text, tone) {
    const { sp, tx, ch, hint } = this.dlg;
    ch.innerHTML = '';
    ch.style.display = 'none';
    hint.style.display = '';
    sp.textContent = speaker || '';
    sp.className = 'dlg-speaker' + (tone ? ' ' + tone : '');
    sp.style.display = speaker ? '' : 'none';
    this.typing = true;
    this.typingDone = null;
    // strip control marks: *amber*, //muted//, keep plain text for speed
    const clean = String(text).replace(/\*/g, '').replace(/\/\/(.*)\/\//g, '$1');
    this._clean = clean;
    const full = clean;
    tx.innerHTML = '';
    let i = 0;
    const speed = full.length > 240 ? 10 : 18; // chars per tick
    const tickType = () => {
      if (!this.typing) return;
      i = Math.min(full.length, i + speed);
      tx.textContent = clean.slice(0, i);
      if (i < full.length) setTimeout(tickType, 16);
      else { this.typing = false; const cb = this.typingDone; this.typingDone = null; if (cb) cb(); }
    };
    tickType();
  },

  skipTyping() {
    this.typing = false;
    if (this._clean !== undefined) this.dlg.tx.textContent = this._clean;
    const cb = this.typingDone; this.typingDone = null; if (cb) cb();
  },

  hideDialogue() { this.dlg.root.hidden = true; },
  showInDialogue() { this.dlg.root.hidden = false; },

  offerChoices(opts, onPick) {
    const ch = this.dlg.ch;
    ch.innerHTML = '';
    ch.style.display = '';
    this.dlg.hint.style.display = 'none';
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      const locked = o.req === false;
      b.innerHTML = `<span class="kbd">${i + 1}</span>${o.label}` +
        (o.cost ? `<span class="cost">${o.cost}</span>` : '') +
        (o.reqNote ? `<span class="req">${o.reqNote}</span>` : '');
      if (locked) b.classList.add('locked');
      b.addEventListener('click', () => { if (locked) return; this._choiceCb = null; onPick(i); });
      ch.appendChild(b);
    });
    this._choiceCb = onPick;
    this._choiceN = opts.length;
  },

  pickChoice(i) {
    if (this._choiceCb && i < this._choiceN) { const cb = this._choiceCb; this._choiceCb = null; cb(i); }
  },

  hasChoiceOpen() { return !!this._choiceCb; },

  // ------------------------------------------------------------ prompt card
  promptCard({ kicker, title, body, choices, onPick, timer }) {
    const p = this.prompt;
    p.root.hidden = false;
    p.kicker.textContent = kicker || '';
    p.title.textContent = title || '';
    p.body.textContent = body || '';
    p.ch.innerHTML = '';
    p.timerWrap.hidden = !timer;
    choices.forEach((c, i) => {
      const b = document.createElement('button');
      const locked = c.req === false;
      b.innerHTML = `${c.label}` + (c.cost ? `<span class="cost">${c.cost}</span>` : '') + (c.note ? `<span class="note">${c.note}</span>` : '');
      if (locked) b.classList.add('locked');
      b.addEventListener('click', () => { if (!locked) { this.closePrompt(); onPick(i); } });
      p.ch.appendChild(b);
    });
    this._promptCb = onPick;
    this._promptN = choices.length;
    this._promptTimer = timer || 0;
    this._promptT0 = performance.now();
  },

  promptTick() { // called by main loop while a timed prompt is open
    if (!this._promptTimer || this.prompt.root.hidden) return;
    const left = 1 - (performance.now() - this._promptT0) / (this._promptTimer * 1000);
    this.prompt.timer.style.width = clamp(left, 0, 1) * 100 + '%';
    if (left <= 0) {
      const cb = this._promptDefault;
      this._promptTimer = 0;
      if (cb) { this.closePrompt(); cb(); }
    }
  },

  setPromptDefault(fn) { this._promptDefault = fn; },
  closePrompt() { this.prompt.root.hidden = true; this._promptTimer = 0; },
  hasPromptOpen() { return !this.prompt.root.hidden; },
  pickPrompt(i) {
    if (!this.hasPromptOpen()) return;
    const btns = this.prompt.ch.children;
    if (btns[i] && !btns[i].classList.contains('locked')) {
      this.closePrompt();
      const cb = this._promptCb; this._promptCb = null; if (cb) cb(i);
    }
  },

  // ------------------------------------------------------------ card screens
  showCard(html, opts = {}) {
    this.cardFrame.innerHTML = html;
    this.cardScreen.classList.add('open');
    this._cardOnClose = opts.onClose || null;
    this._cardPersistent = !!opts.persistent;
    if (opts.mount) opts.mount(this.cardFrame);
    return this.cardFrame;
  },
  hideCard() {
    this.cardScreen.classList.remove('open');
    const cb = this._cardOnClose; this._cardOnClose = null;
    if (cb) cb();
  },
  cardIsOpen() { return this.cardScreen.classList.contains('open'); },

  fadeOut(on) { this.fade.classList.toggle('on', on); },

  // ------------------------------------------------------------ lanes
  showLanes(on) { this.laneRow.hidden = !on; },
  laneHit(lane) {
    const b = this.laneRow.children[lane];
    if (!b) return;
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    setTimeout(() => b.classList.remove('hit'), 110);
  },
};

export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// rich inline marks: *amber*, //muted// — used for cards; dialogue strips them
export function rich(t) {
  return esc(t)
    .replace(/\*([^*]+)\*/g, '<b>$1</b>')
    .replace(/\/\/([^/]+)\/\//g, '<span class="whisper">$1</span>');
}

export function resolveTx(tx, s) {
  if (typeof tx === 'function') return tx(s);
  return String(tx);
}
