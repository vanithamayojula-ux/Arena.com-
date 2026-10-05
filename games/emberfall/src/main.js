// EMBERFALL — the director. Owns the canvas, the clock, the keys, the chapter spine,
// and the ledger. Everything else is a stage it hands the evening to.

import * as art from './art.js';
import { ui, esc, rich } from './ui.js';
import * as audio from './audio.js';
import { clamp } from './util.js';
import { freshState, loadState, saveState, wipeSave, computeEnding, bondMin, ENDING_TITLES } from './state.js';
import { CHAPTERS, FRAGMENTS, GAME, ENDINGS, TITLE_BLURB, HOWTO, LEDGER_NOTE } from './story.js';
import { makeVignette, makeTransition } from './scenes/vignette.js';
import { makeRoad } from './scenes/road.js';
import { makeNegotiation } from './scenes/negotiation.js';
import { makePerformance } from './scenes/performance.js';
import { makeWatch } from './scenes/watch.js';
import { makeFight } from './scenes/fight.js';

const W = 1280, H = 720;
let canvas, ctx, dpr = 1;
let st = freshState();
let scene = null;
let last = 0, gt = 0;
let running = false;

// ------------------------------------------------------------------ G: the API scenes use
const G = {
  get st() { return st; },
  canvas: null,
  markHud() { ui.syncHud(st); },
  chName() { const ch = CHAPTERS[st.chapter]; return ch ? ch.name.split('—')[0].trim() : 'EMBERFALL'; },
  applySet(set) {
    if (!set) return;
    for (const k of Object.keys(set)) {
      const v = set[k];
      if (k === 'oil') st.oil = clamp(st.oil + v, 0, 100);
      else if (k === 'silver') st.silver = Math.max(0, st.silver + v);
      else if (k === 'morale') st.morale = clamp(st.morale + v, 0, 100);
      else if (k === 'rep') st.rep = Math.max(0, st.rep + v);
      else if (k === 'relit') st.relit = Math.max(0, st.relit + v);
      else if (k === 'trust') st.trust = clamp(st.trust + v, 0, 100);
      else if (k === 'flag') st.flags[v] = true;
      else if (k === 'fragment') G.grantFragment(v);
      else if (k.startsWith('bonds.')) {
        const who = k.slice(6);
        st.bonds[who] = clamp(st.bonds[who] + v, 0, 100);
        ui.bumpBond(who);
      } else if (k === 'mood') { /* performance-local; ignored here */ }
    }
    G.markHud();
  },
  bonds(who, d) { st.bonds[who] = clamp(st.bonds[who] + d, 0, 100); ui.bumpBond(who); G.markHud(); },
  toast(t, c) { ui.toast(t, c); },
  grantFragment(id) {
    if (st.fragments[id]) return;
    st.fragments[id] = true;
    const f = FRAGMENTS[id];
    ui.toast(f ? `FRAGMENT RECOVERED — "${f.title}". Read it in the LEDGER.` : 'You found something somebody wrote down. That is how history starts.', 'cold');
    audio.fanfare();
    G.save();
  },
  addLog(line) { st.log.push(line); if (st.log.length > 60) st.log.shift(); },
  spendRouteOil() { /* the road already charged for itself; kept for scene contract */ },
  save() { saveState(st); },
  advance() { nextStep(); },
};

// ------------------------------------------------------------------ boot
function boot() {
  ui.init();
  canvas = ui.stage;
  G.canvas = canvas;
  ctx = canvas.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);

  const saved = loadState();
  if (saved) st = saved;
  audio.setMuted(!!st.muted);

  window.addEventListener('keydown', onKey, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', (e) => { if (scene?.pointer) scene.pointer(e, false); });
  canvas.addEventListener('pointerdown', (e) => { canvas.focus({ preventScroll: true }); if (scene?.pointer) scene.pointer(e, true); onContinueClick(); });
  window.addEventListener('blur', () => { if (scene?.keys) for (const k of Object.keys(scene.keys)) scene.keys[k] = false; });

  // lane buttons (touch)
  for (const b of ui.laneRow.children) {
    const lane = +b.dataset.lane;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); scene?.touch?.(lane, true); });
    b.addEventListener('pointerup', () => scene?.touch?.(lane, false));
    b.addEventListener('pointerleave', () => scene?.touch?.(lane, false));
  }

  $('btnLedger').addEventListener('click', () => { audio.click(); showLedger('pause'); });
  $('btnMute').addEventListener('click', toggleMute);

  showTitle(!!saved);
}

const $ = (id) => document.getElementById(id);

function resize() {
  const cw = canvas.clientWidth || W;
  dpr = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * (cw / W) * 0.75));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}

function toggleMute() {
  st.muted = !st.muted;
  audio.unlock(); audio.setMuted(st.muted);
  $('btnMute').textContent = st.muted ? '♪ OFF' : '♪ ON';
  $('btnMute').setAttribute('aria-pressed', String(st.muted));
  G.save();
}

// ------------------------------------------------------------------ input
function onKey(e) {
  const k = e.key;
  if (ui.cardIsOpen()) {
    if (k === 'Escape' && running && !ui._endingOpen) ui.hideCard();
    return;
  }
  if (k === 'Escape') { e.preventDefault(); showPause(); return; }
  if (!running) return;
  if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
  if (ui.hasChoiceOpen() && /^[1-9]$/.test(k)) { ui.pickChoice(+k - 1); return; }
  if (k === ' ' && ui.typing) { ui.skipTyping(); return; }
  scene?.key?.(e, true);
}
function onKeyUp(e) { scene?.key?.(e, false); }

function onContinueClick() {
  if (!running || ui.cardIsOpen() || ui.hasPromptOpen()) return;
  if (ui.typing) ui.skipTyping();
  else if (scene?.advance) scene.advance();
}

// ------------------------------------------------------------------ director
function currentStep() {
  const ch = CHAPTERS[st.chapter];
  return ch ? ch.steps[st.step] : null;
}

function nextStep() {
  const ch = CHAPTERS[st.chapter];
  if (!ch) return;
  st.step++;
  while (st.step < ch.steps.length) {
    const s2 = ch.steps[st.step];
    if (s2.condition && !s2.condition(st)) { st.step++; continue; }
    break;
  }
  if (st.step >= ch.steps.length) {
    st.chapter++; st.step = 0;
    saveState(st);
    if (st.chapter >= CHAPTERS.length) { showEndingCard(); return; }
  }
  saveState(st);
  G.markHud();
  runStep();
}

const sceneFactories = {
  vignette: makeVignette, campfire: makeVignette, transition: makeTransition,
  road: makeRoad, negotiation: makeNegotiation, performance: makePerformance,
  watch: makeWatch, fight: makeFight,
};

function runStep() {
  const step = currentStep();
  if (!step) { showEndingCard(); return; }
  if (step.type === 'ending') { showEndingCard(); return; }
  ui.fadeOut(true);
  setTimeout(() => {
    if (scene?.exit) scene.exit();
    const F = sceneFactories[step.type];
    if (!F) { console.warn('unknown step type', step.type); nextStep(); return; }
    scene = F(G);
    scene.enter(step);
    running = true;
    ui.play(true);
    if (step.place) ui.setChapter(G.chName(), step.place);
    ui.fadeOut(false);
    canvas.focus({ preventScroll: true });
    if (!loopOn) { loopOn = true; requestAnimationFrame(loop); }
  }, 360);
}
let loopOn = false;

function loop(ts) {
  if (!running) { loopOn = false; return; } // idle at the title or past the curtain
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts; gt += dt;
  try {
    if (scene && !ui.cardIsOpen()) scene.update?.(dt);
    if (ui.promptTick) ui.promptTick();
    // draw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (scene && scene.draw) scene.draw(ctx, W, H);
    else {
      art.backdrop(ctx, W, H, 'road', gt, { seed: 3 });
      art.vignette(ctx, W, H, 1);
    }
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ title & cards
function menuBtn(id, label, sub) {
  return `<button class="menu-btn${id === 'mBegin' ? ' primary' : ''}" id="${id}">${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
}

function showTitle(canResume) {
  running = false;
  ui.play(false);
  const html = `
    <div class="card-kicker">${esc(GAME.kicker)}</div>
    <div class="card-title">${esc(GAME.title)}<small>${esc(GAME.subtitle)}</small></div>
    <div class="card-rule"></div>
    <p class="card-blurb">${TITLE_BLURB}</p>
    <div class="card-menu">
      ${canResume ? menuBtn('mBegin', 'RESUME THE TOUR', `Chapter ${st.chapter + 1} — ${CHAPTERS[st.chapter]?.name || ''}`) : menuBtn('mBegin', 'BEGIN THE TOUR', 'the whole evening, four chapters and a dawn')}
      <button class="menu-btn" id="mFresh">START A FRESH TOUR<small>the road forgets; the ledger burns</small></button>
      <button class="menu-btn" id="mHelp">HOW TO SURVIVE A SHOW<small>lanterns, stances, three keys, one crowd</small></button>
      <button class="menu-btn" id="mLedger">THE LEDGER<small>numbers, fragments, quiet arithmetic</small></button>
    </div>
    <div class="card-rule"></div>
    <p style="text-align:center;font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace;letter-spacing:0.14em;">WE KEEP IT BURNING — 47TH LIGHT INFANTRY</p>`;
  const fr = ui.showCard(html, { persistent: true });
  ui._endingOpen = false;
  fr.querySelector('#mBegin').addEventListener('click', () => { startTour(!canResume); });
  fr.querySelector('#mFresh').addEventListener('click', () => { wipeSave(); st = freshState(); G.markHud(); startTour(false); });
  fr.querySelector('#mHelp').addEventListener('click', () => { audio.click(); showHelp(); });
  fr.querySelector('#mLedger').addEventListener('click', () => { audio.click(); showLedger('title'); });
}

function startTour(fresh) {
  audio.unlock();
  if (!fresh && st.chapter >= CHAPTERS.length) { showEndingCard(); return; }
  if (fresh) { st = freshState(); G.save(); }
  $('btnMute').textContent = st.muted ? '♪ OFF' : '♪ ON';
  audio.setMuted(st.muted);
  st.chapter = fresh ? 0 : clamp(st.chapter, 0, CHAPTERS.length - 1);
  if (fresh) st.step = 0;
  G.markHud();
  const ch = CHAPTERS[st.chapter];
  while (st.step < ch.steps.length && ch.steps[st.step].condition && !ch.steps[st.step].condition(st)) st.step++;
  ui.hideCard();
  runStep();
}

function showHelp() {
  const rows = HOWTO.map(([k, v]) => `<div class="ledger-row"><span class="l">${k}</span><span class="r">${v}</span></div>`).join('');
  const html = `
    <div class="card-kicker">HOW TO SURVIVE A SHOW</div>
    <div class="card-title" style="font-size:34px;">THE COMPANY'S RULES<small>PRINTED FOR THOSE WHO LEARN AT THE GATE</small></div>
    <div class="card-rule"></div>
    <div class="card-cols">
      <div>
        <h4>THE ROAD</h4><p>${rows}</p>
        <p style="margin-top:8px"><b>OIL is time.</b> It burns while you walk, while you talk, and while you fight. Arrive with some. The dark is a venue that never stops needing lighting.</p>
      </div>
      <div>
        <h4>THE CRAFT</h4>
        <ul>
          <li><b>PERFORM</b> — three acts: <b>juggle</b> (tap on the line), <b>aria</b> (hold through long notes), <b>illusions</b> (answer Cinder's pattern). Keep the applause flames lit; the show is the salary.</li>
          <li><b>NEGOTIATE</b> — every mood has an answer: <b>PROUD / ANXIOUS → WARM</b>, <b>GREEDY / HOSTILE → FIRM</b>, <b>SMUG → WIT</b>, <b>PIETY → READ</b>. ODILE (bond 55+) reads anyone. Levers are spent once, like dignity.</li>
          <li><b>KEEP THE LAMPS</b> — aim the Sunkey with the mouse, click to relight, SPACE to shove. Being grabbed drains your light, not your life. There is no life. That is the point.</li>
          <li><b>THE CAMPFIRE</b> — bonds unlock the best lines you'll ever say to anyone. Spend the quiet on them.</li>
          <li><b>FIGHT</b> — once. Maybe. The ledger remembers both ways.</li>
        </ul>
      </div>
    </div>
    <div class="card-menu"><button class="menu-btn primary" id="hBack">BACK</button></div>`;
  const fr = ui.showCard(html, { persistent: true });
  fr.querySelector('#hBack').addEventListener('click', () => { audio.click(); ui.hideCard(); if (!running) showTitle(!!loadState() && (st.chapter + st.step > 0)); });
}

function ledgerStats() {
  return `
    <div class="ledger-rows">
      <div class="ledger-row"><span class="l">Lamps relit across the world</span><span class="r">🜂 ${st.relit}</span></div>
      <div class="ledger-row"><span class="l">Lamps lost while the troupe watched</span><span class="r">${st.lostLamps}</span></div>
      <div class="ledger-row"><span class="l">Shows given / standing ovations</span><span class="r">${st.shows} / ${st.ovations}</span></div>
      <div class="ledger-row"><span class="l">Lantern oil</span><span class="r">${Math.round(st.oil)} / 100</span></div>
      <div class="ledger-row"><span class="l">Coin (spends nowhere; keeps the books honest)</span><span class="r">${st.silver} ✦</span></div>
      <div class="ledger-row"><span class="l">Troupe spirit / trust</span><span class="r">${Math.round(st.morale)} / ${Math.round(st.trust)}</span></div>
      <div class="ledger-row"><span class="l">The roads say (REP)</span><span class="r">${st.rep}</span></div>
      <div class="ledger-row"><span class="l">Odile · Bram · Fenn (bonds)</span><span class="r">${Math.round(st.bonds.dill)} · ${Math.round(st.bonds.bram)} · ${Math.round(st.bonds.fenn)}</span></div>
      <div class="ledger-row"><span class="l">What the troupe became, so far</span><span class="r">${st.flags.beaconHeld ? 'it held the light' : st.flags.foughtMoths ? 'it fired into the dark' : 'it kept singing'}</span></div>
    </div>`;
}

function fragmentList() {
  return Object.keys(FRAGMENTS).map((id) => {
    const f = FRAGMENTS[id];
    return st.fragments[id]
      ? `<div class="fragment-item"><h5>${esc(f.title)}</h5><p>${rich(f.text)}</p></div>`
      : `<div class="fragment-item locked"><h5>— uncollected fragment —</h5><p>Somebody wrote this down. You haven't found them yet.</p></div>`;
  }).join('');
}

function showLedger(from) {
  const html = `
    <div class="card-kicker">THE LANTERN TROUPE · PLAYBILL & LEDGER</div>
    <div class="card-title" style="font-size:32px;">WHAT KEEPS<small>NOT GOLD. LIGHT.</small></div>
    <div class="card-rule"></div>
    <p class="card-blurb">${esc(LEDGER_NOTE)}</p>
    ${ledgerStats()}
    <div class="card-cols">
      <div><h4>RECOVERED PAPERS</h4>${fragmentList()}</div>
      <div><h4>THE TOUR, IN THE TROUPE'S HAND</h4><div class="log-lines">${st.log.length ? st.log.map((l) => `<div>${rich(l)}</div>`).join('') : '<div><i>So far, nothing worth writing. Give it an evening.</i></div>'}</div></div>
    </div>
    <div class="card-menu"><button class="menu-btn primary" id="lBack">BACK TO THE ROAD</button></div>`;
  const fr = ui.showCard(html, { persistent: true });
  fr.querySelector('#lBack').addEventListener('click', () => {
    audio.click();
    ui.hideCard();
    if (from !== 'title' && running) { /* scene resumes */ }
    else showTitle(!!loadState() && (st.chapter + st.step > 0));
  });
}

function showPause() {
  const html = `
    <div class="card-kicker">THE INTERVAL</div>
    <div class="card-title" style="font-size:32px;">THE TOUR PAUSES<small>THE DARK POLITELY WAITS</small></div>
    <div class="card-rule"></div>
    ${ledgerStats()}
    <div class="card-menu">
      <button class="menu-btn primary" id="pResume">RESUME</button>
      <button class="menu-btn" id="pRestart">RESTART THIS CHAPTER<small>same mistakes, fresher shoes</small></button>
      <button class="menu-btn" id="pLedger">THE LEDGER</button>
      <button class="menu-btn" id="pTitle">RETURN TO TITLE<small>the save keeps the evening exactly as you left it</small></button>
    </div>`;
  const fr = ui.showCard(html, { persistent: true });
  fr.querySelector('#pResume').addEventListener('click', () => { audio.click(); ui.hideCard(); });
  fr.querySelector('#pRestart').addEventListener('click', () => {
    audio.click();
    st.step = 0; st.oil = Math.max(st.oil, 55);
    saveState(st); ui.hideCard(); runStep();
  });
  fr.querySelector('#pLedger').addEventListener('click', () => { audio.click(); showLedger('pause'); });
  fr.querySelector('#pTitle').addEventListener('click', () => { audio.click(); G.save(); ui.hideCard(); running = false; if (scene?.exit) scene.exit(); showTitle(true); });
}

function curtainLines() {
  const out = [];
  const B = st.bonds;
  out.push(B.dill >= 68 ? 'ODILE keeps a second list now: living, and *again.* She reads it at every campfire like scripture, which is a word for "receipts."'
    : B.dill >= 40 ? 'ODILE mends the good strap onto the wrong kit so nobody has to ask which is which. That is the whole apology.'
    : 'ODILE has begun counting exits in every hall. Old triage habit, new arithmetic. She has not forgiven the arithmetic.');
  out.push(B.bram >= 68 ? 'BRAM keeps the fire at every camp now, and nobody files for it. The dark is, per the doctrine, shouted at until it apologises. It usually does.'
    : B.bram >= 40 ? 'BRAM still builds the fire wrong on purpose. The wind gets in; the flames dance; he pretends not to watch the gaps between lamps.'
    : 'BRAM stopped asking where the camp sits relative to the lanterns. That is either progress or the end of a man. Nobody can tell. Nobody says.');
  out.push(B.fenn >= 68 ? 'FENN has three villages on the wire and one on his conscience. He signs his bulletins "Lantern Troupe, Informal." It is the proudest sentence he owns.'
    : B.fenn >= 40 ? 'FENN taught the slow-burn trick at two crossroads. He has begun to be called, by people with no better word, "sir."'
    : 'FENN files everything to nobody now. The wire hums back half of what he deserves. He keeps transmitting anyway, which is either heroism or fourteen.');
  return out;
}

function showEndingCard() {
  running = false;
  const id = computeEnding(st);
  const e = ENDINGS[id] || ENDINGS.sorrow;
  const fr = Object.keys(st.fragments).length + '/' + Object.keys(FRAGMENTS).length;
  const html = `
    <div class="card-kicker">CURTAIN · ${esc(ENDING_TITLES[id] || e.title)}</div>
    <div class="card-title" style="font-size:clamp(26px,4.4vw,44px);">${esc(e.title)}<small>EMBERFALL — A LANTERN-TROUPE STORY</small></div>
    <div class="card-rule"></div>
    <div class="ending-epigraph">${rich(e.epigraph || '')}</div>
    <div class="log-lines" style="margin-bottom:24px">
      ${e.lines.map((l) => `<div style="margin:8px 0">${rich(l)}</div>`).join('')}
    </div>
    <div class="card-cols">
      <div><h4>THE COMPANY'S ENDING NUMBERS</h4>${ledgerStats()}</div>
      <div><h4>THE TROUPE, AS OF THIS DAWN</h4>
        <div class="log-lines">${curtainLines().map((l) => `<div>${rich(l)}</div>`).join('')}
        <div><i>Fragments recovered: ${fr}. ${fr.startsWith(Object.keys(FRAGMENTS).length) ? 'Every paper found. The archive is you.' : 'Somebody else will read what you didn\'t.'}</i></div>
        </div>
      </div>
    </div>
    <div class="card-menu">
      <button class="menu-btn primary" id="eAgain">RIDE THE TOUR AGAIN<small>four chapters, a new kind of arithmetic</small></button>
      <button class="menu-btn" id="eLedger">READ THE PAPERS</button>
    </div>
    <div class="card-rule"></div>
    <p style="text-align:center;font-size:12.5px;color:var(--muted);font-style:italic;">Applause is ambient. It is not billable. — AUDITOR PELL, RELUCTANTLY</p>`;
  const f = ui.showCard(html, { persistent: true });
  ui._endingOpen = true;
  f.querySelector('#eAgain').addEventListener('click', () => {
    ui._endingOpen = false;
    audio.click();
    wipeSave(); st = freshState(); G.markHud();
    ui.hideCard();
    showTitle(false);
    setTimeout(() => startTour(false), 80);
  });
  f.querySelector('#eLedger').addEventListener('click', () => { audio.click(); showLedger('title'); });
  audio.fanfare();
  G.save();
}

// go
// A quiet window for tooling and the headless soak test — gameplay never looks at it.
if (typeof window !== 'undefined') {
  window.__emberfall = { G, get scene() { return scene; }, get running() { return running; }, startTour, showTitle };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
