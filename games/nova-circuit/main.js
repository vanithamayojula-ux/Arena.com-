// NOVA CIRCUIT — game shell: menus, race lifecycle, championship, local + online play.
import { buildTrack } from './src/track.js';
import { TRACKS } from './src/trackdefs.js';
import { Race, SHIPS, LIVERIES, ROSTER, DIFFICULTIES, POINTS } from './src/sim.js';
import { Renderer } from './src/renderer.js';
import { ShipPreview } from './src/preview.js';
import { HUD, fmtTime } from './src/hud.js';
import { Input, bindTouch } from './src/input.js';
import { Sfx } from './src/audio.js';
import { Net } from './src/net.js';
import { NetSession } from './src/netgame.js';
import * as store from './src/save.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const MUSIC = [
  { bpm: 132, root: 45, scale: 'dorian', seed: 3 },
  { bpm: 142, root: 40, scale: 'phrygian', seed: 7 },
  { bpm: 138, root: 43, scale: 'minor', seed: 11 },
  { bpm: 150, root: 38, scale: 'harm', seed: 19 },
];
const TOUCH = 'ontouchstart' in window || (window.matchMedia && matchMedia('(pointer:coarse)').matches);

const G = {
  save: store.load(),
  mode: 'menu', // 'menu' | 'race'
  race: null, cfg: null, humans: [], huds: [], vps: [], rects: [], cams: [],
  paused: false, acc: 0, endTimer: -1, resultsShown: false,
  tracks: [], net: null, ns: null, lobby: null, champ: null,
  screen: 'menu', stack: [], setupMode: 'quick',
  attract: { t: 0, camIdx: 0, ship: 0 },
  quality: 2, fpsAcc: 0, fpsN: 0, qCool: 0, forcedQ: params.has('q') ? +params.get('q') : null,
  lastCount: null, sfxThrottle: {},
};
window.G = G; // handy for debugging / tests

const renderer = new Renderer($('#gl'));
const sfx = new Sfx();
const input = new Input();
if (TOUCH) bindTouch($('#touch'), input);

// ---------------------------------------------------------------- utilities
const frames = (n = 1) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
const rngSeed = () => (Math.random() * 1e9) | 0;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
}
const persist = () => store.save(G.save);
const shipDef = (id) => SHIPS.find((s) => s.id === id) || SHIPS[0];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 4 - n));

// ------------------------------------------------------------ screen manager
function show(id, { push = true } = {}) {
  if (push && G.screen && G.screen !== id) G.stack.push(G.screen);
  G.screen = id;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 's-' + id || (s.classList.contains('overlay') && s.id === 's-' + id)));
  // overlays stack on top of the race; non-overlay screens replace
  if (id !== 'setup' && id !== 'hangar' && id !== 'online') stopPreviews();
  const sc = $('#s-' + id);
  $('#views').style.display = id === 'race' || id === 'pause' || id === 'loading' ? '' : 'none';
  setTimeout(() => { const f = sc.querySelector('.go:not(.hidden)') || sc.querySelector('.primary, .chips button.on, button:not(.back)'); f && f.focus({ preventScroll: true }); }, 60);
  sfx.ui('move');
}
function back() {
  if (G.screen === 'brief') { show('menu', { push: false }); G.stack = []; return; }
  const prev = G.stack.pop() || 'menu';
  if (G.screen === 'online' && G.net) leaveOnline();
  show(prev, { push: false });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-back]');
  if (b) { sfx.ui('back'); back(); }
});

// spatial focus navigation (keyboard + gamepad)
function nav(dx, dy) {
  const scr = $('.screen.active');
  if (!scr) return;
  const items = $$('button:not([disabled]), a[href], input[type=range]', scr).filter((e) => e.offsetParent !== null);
  if (!items.length) return;
  let cur = items.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { items[0].focus(); return; }
  const cr = cur.getBoundingClientRect();
  const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  let best = null, bs = Infinity;
  for (const it of items) {
    if (it === cur) continue;
    const r = it.getBoundingClientRect();
    const ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
    const along = dx ? ex * dx : ey * dy, across = dx ? Math.abs(ey) : Math.abs(ex);
    if (along <= 4) continue;
    const sc = along + across * 2.2;
    if (sc < bs) { bs = sc; best = it; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); sfx.ui('move'); }
}
window.addEventListener('keydown', (e) => {
  if (G.mode === 'race' && G.screen !== 'pause') return;
  if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.target && e.target.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;
  const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (m) { e.preventDefault(); nav(...m); }
});
let padPrev = {};
function padNav() {
  if (G.mode === 'race' && G.screen !== 'pause') return;
  const gp = (navigator.getGamepads ? [...navigator.getGamepads()] : []).find((p) => p && p.connected);
  if (!gp) return;
  const st = { u: gp.buttons[12]?.pressed || gp.axes[1] < -0.6, d: gp.buttons[13]?.pressed || gp.axes[1] > 0.6, l: gp.buttons[14]?.pressed || gp.axes[0] < -0.6, r: gp.buttons[15]?.pressed || gp.axes[0] > 0.6, a: gp.buttons[0]?.pressed, b: gp.buttons[1]?.pressed, s: gp.buttons[9]?.pressed };
  const edge = (k) => st[k] && !padPrev[k];
  if (edge('u')) nav(0, -1); if (edge('d')) nav(0, 1); if (edge('l')) nav(-1, 0); if (edge('r')) nav(1, 0);
  if (edge('a')) document.activeElement?.click?.();
  if (edge('b') || edge('s') && G.screen === 'pause') { if (G.screen === 'pause') togglePause(); else if (G.screen !== 'menu') { sfx.ui('back'); back(); } }
  padPrev = st;
}
// first interaction unlocks audio
const unlock = () => { sfx.init(); sfx.setVolumes(G.save.settings.music, G.save.settings.sfx); if (!G.musicOn) startMenuMusic(); };
window.addEventListener('pointerdown', unlock, { once: false });
window.addEventListener('keydown', unlock, { once: false });
function startMenuMusic() { if (!sfx.ctx) return; G.musicOn = true; sfx.startMusic({ bpm: 112, root: 41, scale: 'minor', seed: 5, intensity: 0.35, menu: true }); }
document.addEventListener('click', (e) => { if (e.target.closest('button') && !e.target.closest('[data-back]')) sfx.ui('click'); });

// -------------------------------------------------------------- chip helpers
function bindChips(root, getter, setter) {
  $$('.chips', root).forEach((c) => {
    const key = c.dataset.opt;
    if (!key) return;
    const refresh = () => $$('button', c).forEach((b) => b.classList.toggle('on', String(getter(key)) === b.dataset.v));
    c.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; setter(key, b.dataset.v); refresh(); });
    c._refresh = refresh; refresh();
  });
}
const refreshChips = (root) => $$('.chips', root).forEach((c) => c._refresh && c._refresh());

// -------------------------------------------------------------- track thumbs
function drawTrackMap(canvas, track, { lineW = 4, glow = true } = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const { N, P } = track;
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (let i = 0; i < N; i++) { a = Math.min(a, P[i * 3]); b = Math.max(b, P[i * 3]); c = Math.min(c, P[i * 3 + 2]); d = Math.max(d, P[i * 3 + 2]); }
  const pad = 24, sc = Math.min((W - pad * 2) / (b - a), (H - pad * 2) / (d - c));
  const ox = (W - (b - a) * sc) / 2 - a * sc, oz = (H - (d - c) * sc) / 2 - c * sc;
  const path = () => { g.beginPath(); for (let i = 0; i <= N; i += 2) { const k = i % N; const x = P[k * 3] * sc + ox, y = P[k * 3 + 2] * sc + oz; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
  const pal = track.def.art.palette;
  g.lineJoin = g.lineCap = 'round';
  if (glow) { g.strokeStyle = pal.grid; g.globalAlpha = 0.25; g.lineWidth = lineW * 3.2; path(); g.stroke(); }
  g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = lineW + 3; path(); g.stroke();
  g.strokeStyle = pal.accent; g.lineWidth = lineW; path(); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(P[0] * sc + ox - lineW * 1.4, P[2] * sc + oz - 2, lineW * 2.8, 4);
}

// ---------------------------------------------------------------- pilot UI
const previews = [];
function stopPreviews() { previews.forEach((p) => p.stop()); }
function norm(v, a, b) { return Math.max(0.1, Math.min(1, (v - a) / (b - a))); }
function buildPilot(container, key, title) {
  const wrap = document.createElement('div');
  wrap.className = 'pilot';
  wrap.innerHTML = `<h3><span>${title}</span><span class="liv"></span></h3><canvas></canvas>
  <div class="nm"><b></b><span></span></div><p></p>
  <div class="stats"></div><div class="shipsel"></div><div class="swatches"></div>`;
  container.appendChild(wrap);
  const prev = new ShipPreview($('canvas', wrap));
  previews.push(prev);
  const prof = G.save[key];
  const sel = $('.shipsel', wrap), sw = $('.swatches', wrap);
  SHIPS.forEach((s) => { const b = document.createElement('button'); b.textContent = s.name; b.dataset.id = s.id; sel.appendChild(b); });
  LIVERIES.forEach((l, i) => { const b = document.createElement('button'); b.style.background = l.a; b.style.color = l.a; b.title = l.name; b.dataset.i = i; sw.appendChild(b); });
  const refresh = () => {
    const s = shipDef(prof.ship);
    $$('button', sel).forEach((b) => b.classList.toggle('on', b.dataset.id === prof.ship));
    $$('button', sw).forEach((b) => b.classList.toggle('on', +b.dataset.i === prof.livery));
    $('.nm b', wrap).textContent = s.name; $('.nm span', wrap).textContent = s.role;
    $('p', wrap).textContent = s.blurb;
    $('.liv', wrap).textContent = LIVERIES[prof.livery].name;
    $('.stats', wrap).innerHTML = [['SPEED', norm(s.speed, 0.88, 1.1)], ['HANDLING', norm(s.handling, 0.8, 1.25)], ['ARMOR', norm(s.armor, 0.7, 1.6)], ['BOOST', norm(s.boost, 0.88, 1.15)]].map(([n, v]) => `<div class="stat">${n}<i><u style="width:${v * 100}%"></u></i></div>`).join('');
    prev.setShip(prof.ship, prof.livery);
  };
  sel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; prof.ship = b.dataset.id; persist(); refresh(); sfx.ui('click'); });
  sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; prof.livery = +b.dataset.i; persist(); refresh(); });
  refresh();
  return { wrap, prev, refresh };
}

// ------------------------------------------------------------- setup screens
const SETUP_CFG = {
  championship: { title: 'CHAMPIONSHIP', blocks: ['difficulty'], pilots: 1, go: 'START CHAMPIONSHIP ▶' },
  quick: { title: 'QUICK RACE', blocks: ['track', 'laps', 'rivals', 'difficulty', 'combat'], pilots: 1, go: 'START RACE ▶' },
  trial: { title: 'TIME TRIAL', blocks: ['track', 'laps'], pilots: 1, go: 'START TRIAL ▶' },
  local2p: { title: 'LOCAL 2-PLAYER', blocks: ['track', 'laps', 'rivals', 'difficulty', 'combat'], pilots: 2, go: 'START DUEL ▶' },
};
function buildTrackCards() {
  const box = $('#trackCards');
  box.innerHTML = '';
  G.tracks.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'tcard'; b.dataset.i = i;
    const pal = t.def.art.palette;
    b.style.background = `radial-gradient(circle at 70% 30%, ${pal.grid}33, ${pal.base} 70%)`;
    b.innerHTML = `<canvas width="300" height="150"></canvas><div class="st">${stars(t.def.difficulty)}</div><div class="tx"><b>${t.def.name}</b><small>${t.def.place}</small></div>`;
    drawTrackMap($('canvas', b), t, { lineW: 3 });
    box.appendChild(b);
  });
  box.addEventListener('click', (e) => { const b = e.target.closest('.tcard'); if (!b) return; G.save.setup.track = +b.dataset.i; persist(); markTrack(); });
}
function markTrack() { $$('#trackCards .tcard').forEach((b) => b.classList.toggle('on', +b.dataset.i === G.save.setup.track)); }

let setupPilots = [];
function openSetup(mode) {
  G.setupMode = mode;
  const cfg = SETUP_CFG[mode];
  $('#setupTitle').textContent = cfg.title;
  $('#setupGo').textContent = cfg.go;
  $$('#setupOpts .opt-block').forEach((b) => b.classList.toggle('hide', !cfg.blocks.includes(b.dataset.for)));
  const rv = $('.chips[data-opt=rivals]');
  $$('button', rv).forEach((b) => (b.style.display = mode === 'local2p' && +b.dataset.v === 5 ? 'none' : ''));
  if (mode === 'local2p' && G.save.setup.rivals > 4) G.save.setup.rivals = 4;
  refreshChips($('#setupOpts')); markTrack();
  const box = $('#pilots'); box.innerHTML = ''; previews.length = 0; setupPilots = [];
  setupPilots.push(buildPilot(box, 'p1', cfg.pilots > 1 ? 'PILOT 1 · WASD' : 'YOUR SHIP'));
  if (cfg.pilots > 1) setupPilots.push(buildPilot(box, 'p2', 'PILOT 2 · ARROWS'));
  show('setup');
  previews.forEach((p) => p.start());
}

function openHangar() {
  const box = $('#hangarPilot'); box.innerHTML = ''; previews.length = 0;
  buildPilot(box, 'p1', 'YOUR SHIP');
  const rec = $('#records');
  rec.innerHTML = '<div class="rr h"><span>CIRCUIT</span><span>BEST LAP</span><span>BEST 3-LAP</span></div>' + G.tracks.map((t) => { const r = G.save.records[t.id]; return `<div class="rr"><span>${t.def.name}</span><span>${r && r.lap ? fmtTime(r.lap) : '--:--.--'}</span><span>${r && r.race && r.race[3] ? fmtTime(r.race[3]) : '--:--.--'}</span></div>`; }).join('');
  const c = G.save.career;
  $('#career').innerHTML = `<div><span>RACES</span><b>${c.races}</b></div><div><span>VICTORIES</span><b>${c.wins}</b></div><div><span>TAKEDOWNS</span><b>${c.kills}</b></div><div><span>CHAMPIONSHIP TITLES</span><b>${c.titles}</b></div>`;
  show('hangar');
  previews.forEach((p) => p.start());
}

// ----------------------------------------------------------- grid builder
function buildGrid({ humans, rivals, difficulty, seed, order = null }) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES[1];
  const used = new Set(humans.map((h) => h.livery));
  const pool = ROSTER.slice();
  // deterministic shuffle
  let s = seed || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const ai = (order ? order.filter((n) => !humans.some((h) => h.name === n)).map((n) => ROSTER.find((r) => r.name === n)).filter(Boolean) : pool).slice(0, rivals).map((r, i) => {
    let liv = r.livery;
    if (used.has(liv)) liv = LIVERIES.findIndex((_, k) => !used.has(k));
    used.add(liv);
    return { name: r.name, ship: r.ship, livery: liv, human: false, skill: Math.max(0.1, Math.min(1, diff.skill + (((i * 37) % 11) - 5) * 0.014)) };
  });
  const N = humans.length + ai.length;
  const specs = [];
  if (order) {
    const all = [...humans.map((h) => ({ ...h, human: true })), ...ai];
    all.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    all.forEach((r, i) => specs.push({ ...r, grid: i }));
  } else {
    const hg = Math.min(N - humans.length, Math.floor(N * 0.55));
    let slot = 0;
    const taken = new Set();
    humans.forEach((h, i) => { const g = Math.min(N - 1, hg + i); taken.add(g); specs.push({ ...h, human: true, grid: g }); });
    let g = 0;
    ai.forEach((a) => { while (taken.has(g)) g++; specs.push({ ...a, grid: g++ }); slot++; });
  }
  return specs;
}
const humanSpec = (key, slot, name) => ({ name, ship: G.save[key].ship, livery: G.save[key].livery, slot });

// --------------------------------------------------------------- race start
const SCHEMES = [['all'], ['p1', 'p2']];
async function startRace(cfg) {
  $('#loadText').textContent = 'BUILDING CIRCUIT…';
  show('loading', { push: false });
  await frames(2);
  teardownRace();
  stopAttract();
  const track = G.tracks[cfg.trackIdx];
  const race = new Race({ track, racers: cfg.racers, laps: cfg.laps, seed: cfg.seed || rngSeed(), mode: cfg.mode || 'race', combat: cfg.combat, difficulty: cfg.difficulty ?? 1 });
  G.cfg = cfg; G.race = race; G.mode = 'race'; G.paused = false; G.endTimer = -1; G.resultsShown = false; G.acc = 0; G.lastCount = null;
  G.humans = race.ships.filter((s) => s.local && s.human);
  G.humans.sort((a, b) => a.slot - b.slot);
  G.cams = G.humans.map((_, i) => (G.save.settings.cam === 'nose' ? 'nose' : 'chase'));
  renderer.attachRace(race);
  buildViews();
  if (cfg.online) G.ns = new NetSession(race, G.net, G.net.pid);
  input.clear(); input.enabled = true;
  G.humans.forEach((h, i) => h.input && 0);
  $('#touch').classList.toggle('hidden', !(TOUCH && G.humans.length === 1));
  sfx.stopMusic(); G.musicOn = false;
  sfx.init(); sfx.startMusic({ ...MUSIC[cfg.trackIdx % MUSIC.length], intensity: 0.5 });
  layoutViews();
  renderer.render(0, race, currentViews());
  await frames(1);
  $$('.screen').forEach((s) => s.classList.remove('active'));
  G.screen = 'race'; G.stack = [];
  $('#views').style.display = '';
}

function buildViews() {
  const host = $('#views');
  host.innerHTML = ''; G.huds = []; G.vps = [];
  G.humans.forEach((h, i) => {
    const vp = document.createElement('div');
    vp.className = 'vp';
    host.appendChild(vp);
    const keys = G.humans.length > 1 ? (i === 0 ? 'Q' : ',') : (TOUCH ? '' : 'Q');
    const hud = new HUD(vp, { keys: keys ? `[${keys}]` : '', hint: i === 0 && G.cfg.mode !== 'attract' ? (G.humans.length > 1 ? 'P1: A/D · SPACE · SHIFT · E · Q     P2: ◀▶ · ENTER · R-SHIFT · . · ,' : (TOUCH ? '' : 'A/D STEER · SPACE FIRE · SHIFT BOOST · E MISSILE · Q ITEM · DOUBLE-TAP A/D TO DODGE')) : '' });
    hud.setTrack(G.race.track);
    G.huds.push(hud); G.vps.push(vp);
  });
  setTimeout(() => G.huds.forEach((h) => h.q.hint && (h.q.hint.style.opacity = 0)), 9000);
  $('#splitline').classList.toggle('hidden', G.humans.length < 2);
}
function layoutViews() {
  const W = innerWidth, H = innerHeight;
  const n = Math.max(1, G.humans.length);
  G.rects = [];
  for (let i = 0; i < n; i++) G.rects.push(n === 1 ? { x: 0, y: 0, w: W, h: H } : { x: 0, y: i * (H / 2) + (i ? 1.5 : 0), w: W, h: H / 2 - 1.5 });
  G.vps.forEach((vp, i) => {
    const r = G.rects[i];
    vp.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    vp.firstElementChild && (vp.style.fontSize = Math.max(8, Math.min(20, Math.min(r.h / 46, r.w / 70))) + 'px');
  });
}
function currentViews() {
  if (G.mode === 'race' && G.humans.length) return G.humans.map((s, i) => ({ ship: s, cam: G.cams[i], rect: G.rects[i] }));
  return [{ ship: G.attract.focus || G.race.ships[0], cam: G.attract.cam || 'chase', rect: { x: 0, y: 0, w: innerWidth, h: innerHeight } }];
}

function teardownRace() {
  $('#views').innerHTML = ''; G.huds = []; G.vps = []; G.humans = [];
  $('#touch').classList.add('hidden'); $('#splitline').classList.add('hidden');
  input.enabled = false; sfx.setEngine(false, 0, false);
  G.ns = null; G.paused = false;
}

// ------------------------------------------------------------------ attract
async function startAttract() {
  const idx = G.attractTrack ?? Math.floor(Math.random() * G.tracks.length);
  G.attractTrack = (idx + 1) % G.tracks.length;
  teardownRace();
  const racers = ROSTER.slice(0, 6).map((r, i) => ({ name: r.name, ship: r.ship, livery: r.livery, skill: 0.75 + (i % 3) * 0.08 }));
  const race = new Race({ track: G.tracks[idx], racers, laps: 99, seed: rngSeed(), mode: 'attract', combat: true, difficulty: 2, instantStart: true });
  G.race = race; G.mode = 'menu'; G.cfg = null;
  renderer.attachRace(race);
  for (let i = 0; i < 60 * 4; i++) race.step(STEP);
  race.drain();
  G.attract = { t: 0, camIdx: 0, focus: race.order[1], cam: 'chase' };
}
function stopAttract() { G.attract = { t: 0, camIdx: 0 }; }
const ATTRACT_CAMS = ['chase', 'side', 'heli', 'chase', 'nose', 'side'];
function tickAttract(dt) {
  const a = G.attract; a.t -= dt;
  if (a.t <= 0 || (a.focus && !a.focus.alive && a.t < 5)) {
    a.t = 6.5;
    a.camIdx = (a.camIdx + 1) % ATTRACT_CAMS.length;
    a.cam = ATTRACT_CAMS[a.camIdx];
    const o = G.race.order.filter((s) => s.alive);
    a.focus = o[Math.min(o.length - 1, a.camIdx % 3)] || G.race.ships[0];
  }
}

// ---------------------------------------------------------- pause / quit
function togglePause() {
  if (G.mode !== 'race') return;
  if (G.screen === 'pause') { resumeRace(); return; }
  if (G.screen !== 'race') return;
  const online = !!G.cfg.online;
  $('#pRestart').classList.toggle('hidden', online || G.cfg.kind === 'champ');
  $('#s-pause h2').textContent = online ? 'MENU' : 'PAUSED';
  if (!online) G.paused = true;
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $('#s-pause').classList.add('active'); G.screen = 'pause';
  input.enabled = false; sfx.setEngine(false, 0, false);
  setTimeout(() => $('#pResume').focus(), 50);
}
function resumeRace() {
  G.paused = false; $('#s-pause').classList.remove('active'); G.screen = 'race'; input.enabled = true; input.clear();
}
input.onPause = () => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (G.mode === 'race') togglePause();
  else if (G.screen !== 'menu' && G.screen !== 'loading') { sfx.ui('back'); back(); }
};
$('#touchPause').addEventListener('click', togglePause);
$('#pResume').onclick = resumeRace;
$('#pRestart').onclick = () => { resumeRace(); startRace(G.cfg); };
$('#pSettings').onclick = () => { $('#s-pause').classList.remove('active'); G.stack.push('pause'); openSettings(); };
$('#pQuit').onclick = () => quitToMenu();
async function quitToMenu() {
  if (G.net) leaveOnline();
  G.stack = []; $('#s-pause').classList.remove('active');
  await startAttract();
  G.screen = ''; show('menu', { push: false });
  updateMenu();
  if (sfx.ctx) { sfx.stopMusic(); startMenuMusic(); }
}

// ---------------------------------------------------------------- events
const near = (ship) => G.humans.includes(ship);
function throttle(key, ms) { const n = performance.now(); if (n - (G.sfxThrottle[key] || 0) < ms) return false; G.sfxThrottle[key] = n; return true; }
function nearestHumanDist(dist) {
  let d = 1e9; const L = G.race.track.length;
  for (const h of G.humans) { let x = Math.abs(dist - h.dist) % L; if (x > L / 2) x = L - x; d = Math.min(d, x); }
  return d;
}
function procEvents(ev) {
  const race = G.race;
  for (const e of ev) {
    for (let i = 0; i < G.huds.length; i++) G.huds[i].onEvent(e, G.humans[i], race);
    if (e.type === 'raceEnd' && G.mode === 'race' && G.endTimer < 0 && !G.resultsShown) G.endTimer = 3.2;
    if (e.type === 'left') toast(`${e.ship.name} LEFT THE RACE`);
    if (G.mode !== 'race') continue;
    const mine = near(e.ship);
    switch (e.type) {
      case 'go': sfx.countdown(0); break;
      case 'laser': if (mine) sfx.laser(true); else if (nearestHumanDist(e.bullet.dist) < 160 && throttle('l', 70)) sfx.laser(false); break;
      case 'missile': if (mine) sfx.missile(true); else if (nearestHumanDist(e.ship.dist) < 300) sfx.missile(false); break;
      case 'explode': sfx.explosion(true, Math.max(0.2, 1 - nearestHumanDist(e.ship.dist) / 500)); break;
      case 'blast': sfx.explosion(!!e.big, Math.max(0.15, 1 - nearestHumanDist(e.dist) / 400)); break;
      case 'damage': if (mine) sfx.hit(); break;
      case 'spark': if (nearestHumanDist(e.dist) < 120 && throttle('sp', 60)) sfx.spark(); break;
      case 'wall': if (mine) sfx.wall(); break;
      case 'land': if (mine) sfx.land(e.impact); break;
      case 'bump': if (near(e.a) || near(e.b)) sfx.bump(); break;
      case 'pickup': if (mine) sfx.pickup(e.kind); break;
      case 'boostPad': if (mine) sfx.boostPad(); break;
      case 'jumpPad': if (mine) sfx.jumpPad(); break;
      case 'emp': sfx.emp(); break;
      case 'overdrive': if (mine) sfx.overdrive(); break;
      case 'mineDrop': if (mine) sfx.mineDrop(); break;
      case 'dodge': if (mine) sfx.dodge(); break;
      case 'evade': if (mine) sfx.evade(); break;
      case 'lap': if (mine) sfx.lap(e.best); break;
      case 'finish': if (mine) sfx.finish(e.ship.place <= 3); break;
      case 'locked': if (mine) sfx.lockTone('locked'); break;
      case 'locking': if (mine) sfx.lockTone('locking'); break;
      case 'overheat': if (mine) sfx.overheat(); break;
      case 'respawn': if (mine) sfx.respawn(); break;
      default: break;
    }
  }
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function stepOnce() {
  const race = G.race;
  if (G.mode === 'race') {
    G.humans.forEach((s, i) => {
      if (s.autopilot) return;
      const sch = G.humans.length > 1 ? SCHEMES[1][i] : SCHEMES[0][0];
      input.apply(s, sch, i);
    });
  }
  race.step(STEP);
  const ev = race.drain();
  if (G.ns) { G.ns.outgoing(ev); G.ns.tick(STEP); }
  renderer.handleEvents(ev);
  procEvents(ev);
}
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.25, (now - last) / 1000); last = now;
  const dt = Math.min(0.05, raw);
  const race = G.race;
  if (!race) return;
  padNav();
  if (!G.paused) {
    G.acc += dt;
    let n = 0;
    while (G.acc >= STEP && n < 5) { stepOnce(); G.acc -= STEP; n++; }
    if (n === 5) G.acc = 0;
  }
  if (G.mode === 'menu') tickAttract(dt);
  const views = currentViews();
  renderer.render(G.paused ? 0 : dt, race, views);
  if (G.mode === 'race') {
    G.huds.forEach((h, i) => h.update(race, G.humans[i], renderer, i, dt));
    const h0 = G.humans[0];
    if (h0 && !G.paused && G.screen === 'race') {
      sfx.setEngine(h0.alive && race.state !== 'countdown', h0.speedFrac, h0.boosting);
      if (G.humans.some((h) => h.incoming > 0 && h.alive)) sfx.warning();
      sfx.setMusicIntensity(0.5 + (h0.lap >= race.laps ? 0.3 : 0) + (h0.boosting ? 0.15 : 0));
    }
    if (race.state === 'countdown') {
      const c = Math.ceil(race.countdown);
      if (c !== G.lastCount) { if (c > 0 && G.lastCount !== null) sfx.countdown(c); else if (c > 0) sfx.countdown(c); G.lastCount = c; }
    }
    if (G.endTimer >= 0 && !G.paused) { G.endTimer -= dt; if (G.endTimer < 0) showResults(); }
  }
  monitorPerf(raw);
  if (G.save.settings.fps) { G.fpsN++; G.fpsAcc += raw; if (G.fpsAcc > 0.5) { $('#fps').textContent = Math.round(G.fpsN / G.fpsAcc) + ' fps · Q' + G.quality; G.fpsAcc = 0; G.fpsN = 0; } }
}
function applyQuality() {
  const q = G.save.settings.quality;
  G.quality = G.forcedQ ?? (q === 'auto' ? (G.autoQ ?? (TOUCH ? 1 : 2)) : +q);
  renderer.setQuality(G.quality);
}
function monitorPerf(raw) {
  $('#fps').classList.toggle('hidden', !G.save.settings.fps);
  if (G.forcedQ !== null || G.save.settings.quality !== 'auto' || raw > 0.2) return;
  G.perfAcc = (G.perfAcc || 0) + raw; G.perfN = (G.perfN || 0) + 1; G.qCool -= raw;
  if (G.perfN >= 90) {
    const fps = G.perfN / G.perfAcc;
    G.perfAcc = 0; G.perfN = 0;
    if (fps < 38 && G.quality > 0 && G.qCool <= 0) { G.autoQ = G.quality - 1; G.qCool = 4; applyQuality(); }
  }
}
function resize() {
  renderer.resize(innerWidth, innerHeight);
  layoutViews();
}
window.addEventListener('resize', resize);
window.addEventListener('keydown', (e) => {
  if (G.mode === 'race' && G.screen === 'race' && e.code === 'KeyV' && !e.repeat) G.cams[0] = G.cams[0] === 'chase' ? 'nose' : 'chase';
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'race' && G.screen === 'race' && !G.cfg?.online) togglePause(); });

// ------------------------------------------------------------------ results
function rowHTML(cls, cells) { return `<div class="tr ${cls || ''}">${cells.map((c) => `<span>${c}</span>`).join('')}</div>`; }
const dot = (liv) => `<i class="dot" style="background:${LIVERIES[liv % LIVERIES.length].a}"></i>`;
function showResults() {
  if (G.resultsShown) return;
  G.resultsShown = true;
  const race = G.race, cfg = G.cfg;
  const res = race.results || race.buildResults();
  input.enabled = false; sfx.setEngine(false, 0, false);
  sfx.setMusicIntensity(0.3);
  const me = G.humans[0];
  const myRow = res.find((r) => r.ship === me);
  // records
  let rec = { lap: false, race: false };
  if (me && myRow && myRow.finished && !cfg.online) {
    rec = store.recordResult(G.save, race.track.id, race.laps, me.bestLap, me.finishTime);
  }
  if (me && !cfg.online && cfg.kind !== 'attract') {
    G.save.career.races++; if (myRow && myRow.place === 1 && res.length > 1) G.save.career.wins++;
    G.save.career.kills += me.kills;
  }
  let title = 'RACE RESULTS', banner = '', buttons = [];
  const multi = G.humans.length > 1;
  if (cfg.mode === 'trial') {
    title = 'TIME TRIAL';
    banner = `${fmtTime(me.finishTime)}<small>${rec.race ? 'NEW BEST TIME · ' : ''}${rec.lap ? 'NEW BEST LAP' : 'BEST LAP ' + fmtTime(me.bestLap)}</small>`;
  } else if (multi) {
    const w = res[0].ship;
    banner = `${esc(w.name)} WINS<small>${race.track.def.name}</small>`;
  } else if (myRow) {
    const p = myRow.place;
    const word = ['', 'VICTORY', 'SECOND PLACE', 'THIRD PLACE'][p] || `${p}TH PLACE`;
    banner = `<span style="color:${p === 1 ? '#ffd23a' : p <= 3 ? '#9fe8ff' : '#fff'}">${word}</span><small>${race.track.def.name}${rec.race ? ' · NEW RECORD' : ''}${cfg.kind === 'champ' ? ` · +${myRow.points} PTS` : ''}</small>`;
    p === 1 && sfx.finish(true);
  }
  // championship bookkeeping
  if (cfg.kind === 'champ') {
    const ch = G.champ;
    for (const r of res) ch.points[r.ship.name] = (ch.points[r.ship.name] || 0) + r.points;
    ch.wins += myRow && myRow.place === 1 ? 1 : 0;
    ch.round++;
    G.save.champ = ch.round >= TRACKS.length ? null : ch;
    title = `ROUND ${ch.round} COMPLETE`;
    buttons = ch.round >= TRACKS.length
      ? [['STANDINGS ▶', () => showFinal(), true]]
      : [['STANDINGS ▶', () => showBrief(), true]];
  } else if (cfg.online) {
    buttons = [['BACK TO LOBBY', () => backToLobby(), true], ['LEAVE ROOM', () => quitToMenu()]];
  } else {
    buttons = [['RACE AGAIN', () => startRace({ ...cfg, seed: rngSeed() }), true], ['CHANGE SETUP', async () => { await quitToMenu(); openSetup(G.setupMode); }], ['MAIN MENU', () => quitToMenu()]];
  }
  persist();
  $('#resTitle').textContent = title;
  $('#resBanner').innerHTML = banner;
  const showPts = race.combat && cfg.kind === 'champ';
  $('#resTable').innerHTML = rowHTML('h', ['#', 'PILOT', 'TIME', 'BEST LAP', 'KILLS', showPts ? 'PTS' : '']) + res.map((r) => rowHTML(r.ship.human && r.ship.local ? 'me' : '', [r.place, dot(r.ship.livery) + esc(r.ship.name) + (r.ship.left ? ' (LEFT)' : ''), r.finished ? fmtTime(r.time) : 'DNF', isFinite(r.bestLap) ? fmtTime(r.bestLap) : '--', r.kills, showPts ? '+' + r.points : ''])).join('');
  setButtons(buttons);
  show('results', { push: false });
}
function setButtons(list) {
  const f = $('#resButtons'); f.innerHTML = '';
  for (const [label, fn, go] of list) { const b = document.createElement('button'); b.textContent = label; if (go) b.className = 'go'; b.onclick = fn; f.appendChild(b); }
}

// ------------------------------------------------------------- championship
const champStandings = (ch) => {
  const rows = Object.entries(ch.points).map(([name, pts]) => ({ name, pts }));
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
};
function newChampionship() {
  const diff = G.save.setup.difficulty;
  const rivals = ROSTER.slice(0, 5).map((r) => r.name);
  const ch = { round: 0, difficulty: diff, name: G.save.name, ship: G.save.p1.ship, livery: G.save.p1.livery, rivals, points: {}, wins: 0 };
  ch.points[ch.name] = 0; rivals.forEach((r) => (ch.points[r] = 0));
  G.champ = ch; G.save.champ = ch; persist();
  showBrief();
}
function showBrief() {
  const ch = G.champ;
  if (ch.round >= TRACKS.length) return showFinal();
  const t = G.tracks[ch.round];
  $('#briefRound').textContent = `ROUND ${ch.round + 1} / ${TRACKS.length}`;
  $('#briefPlace').textContent = t.def.place.toUpperCase();
  const h1 = $('#briefName'); h1.textContent = t.def.name; h1.style.color = t.def.art.palette.accent;
  $('#briefBlurb').textContent = t.def.blurb;
  $('#briefStats').innerHTML = `<div><small>LAPS</small><b>${t.def.laps}</b></div><div><small>LAP LENGTH</small><b>${(t.length / 1000).toFixed(1)} KM</b></div><div><small>THREAT</small><b style="color:#ffc83a">${stars(t.def.difficulty)}</b></div><div><small>RIVALS</small><b>${DIFFICULTIES[ch.difficulty].name}</b></div>`;
  drawTrackMap($('#briefMap'), t, { lineW: 5 });
  const rows = champStandings(ch);
  $('#briefTable').className = 'table compact';
  $('#briefTable').innerHTML = rows.map((r, i) => rowHTML(r.name === ch.name ? 'me' : '', [i + 1, esc(r.name), r.pts])).join('');
  $('#briefNew').classList.toggle('hidden', ch.round === 0);
  G.screen === 'brief' || show('brief', { push: false });
  $('#briefGo').focus();
}
function launchChampRound() {
  const ch = G.champ;
  const ti = ch.round;
  const standings = champStandings(ch).map((r) => r.name);
  const hum = [{ name: ch.name, ship: ch.ship, livery: ch.livery, slot: 0 }];
  const order = ch.round === 0 ? [...ch.rivals.slice(0, 4), ch.name, ch.rivals[4]] : standings;
  const racers = buildGrid({ humans: hum, rivals: 5, difficulty: ch.difficulty, seed: ch.round + 1, order });
  startRace({ kind: 'champ', mode: 'race', trackIdx: ti, laps: G.tracks[ti].def.laps, combat: true, difficulty: Math.min(3, ch.difficulty), racers });
}
function showFinal() {
  const ch = G.champ;
  const rows = champStandings(ch);
  const pos = rows.findIndex((r) => r.name === ch.name) + 1;
  if (pos === 1) { G.save.career.titles++; sfx.finish(true); }
  G.save.champ = null; persist();
  $('#resTitle').textContent = 'CHAMPIONSHIP STANDINGS';
  $('#resBanner').innerHTML = pos === 1 ? `<span style="color:#ffd23a">CHAMPION!</span><small>${ch.wins} VICTORIES · ${DIFFICULTIES[ch.difficulty].name}</small>` : `FINISHED ${pos}${['', 'ST', 'ND', 'RD'][pos] || 'TH'}<small>${ch.wins} VICTORIES · ${DIFFICULTIES[ch.difficulty].name} — TRY AGAIN FOR THE TITLE</small>`;
  $('#resTable').innerHTML = rowHTML('h', ['#', 'PILOT', '', '', '', 'PTS']) + rows.map((r, i) => rowHTML(r.name === ch.name ? 'me' : '', [i + 1, esc(r.name), '', '', '', r.pts])).join('');
  setButtons([['MAIN MENU', () => { G.champ = null; quitToMenu(); }, true]]);
  show('results', { push: false });
  updateMenu();
}
$('#briefGo').onclick = launchChampRound;
$('#briefNew').onclick = () => { if (confirm('Abandon this championship and start over?')) { G.save.champ = null; G.champ = null; show('menu', { push: false }); openSetup('championship'); } };

// -------------------------------------------------------------------- menu
function updateMenu() {
  const c = G.save.champ;
  $('#champLabel').textContent = c && c.round < TRACKS.length ? `CONTINUE · ROUND ${c.round + 1}` : 'CHAMPIONSHIP';
  const cr = G.save.career;
  $('#menuFoot').textContent = `${G.save.name} · ${cr.races} RACES · ${cr.wins} WINS · ${cr.titles} TITLES`;
}
function menuGo(what) {
  switch (what) {
    case 'championship':
      if (G.save.champ && G.save.champ.round < TRACKS.length) { G.champ = G.save.champ; showBrief(); }
      else openSetup('championship');
      break;
    case 'quick': case 'trial': case 'local2p': openSetup(what); break;
    case 'hangar': openHangar(); break;
    case 'controls': show('controls'); break;
    case 'settings': openSettings(); break;
    case 'online': openOnline(); break;
    default: break;
  }
}
$('#menuList').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) menuGo(b.dataset.go); });

$('#setupGo').onclick = () => {
  const mode = G.setupMode, s = G.save.setup;
  if (mode === 'championship') return newChampionship();
  const hum = [humanSpec('p1', 0, G.save.name || 'PILOT')];
  if (mode === 'local2p') { hum[0].name = 'PILOT 1'; hum.push(humanSpec('p2', 1, 'PILOT 2')); if (hum[1].livery === hum[0].livery) hum[1].livery = (hum[0].livery + 1) % LIVERIES.length; }
  const trial = mode === 'trial';
  const rivals = trial ? 0 : s.rivals;
  const seed = rngSeed();
  const racers = buildGrid({ humans: hum, rivals, difficulty: s.difficulty, seed });
  startRace({ kind: mode, mode: trial ? 'trial' : 'race', trackIdx: s.track, laps: s.laps, combat: !trial && !!+s.combat, difficulty: s.difficulty, racers, seed });
};

// ----------------------------------------------------------------- settings
function openSettings() {
  const st = G.save.settings;
  $('#setMusic').value = st.music * 100; $('#setSfx').value = st.sfx * 100;
  refreshChips($('#s-settings'));
  show('settings');
}
function bindSettings() {
  const st = G.save.settings;
  $('#setMusic').oninput = (e) => { st.music = e.target.value / 100; sfx.setVolumes(st.music, st.sfx); persist(); };
  $('#setSfx').oninput = (e) => { st.sfx = e.target.value / 100; sfx.setVolumes(st.music, st.sfx); persist(); if (throttle('t', 150)) sfx.pickup('ammo'); };
  bindChips($('#s-settings'), (k) => st[k], (k, v) => { st[k] = k === 'quality' ? v : (k === 'fps' ? +v : v); if (k === 'quality') { G.autoQ = undefined; applyQuality(); } persist(); });
  $('#setReset').onclick = () => { if (confirm('Erase all records, career stats and championship progress?')) { const keep = G.save.settings; G.save = store.DEFAULTS(); G.save.settings = keep; persist(); updateMenu(); toast('PROGRESS RESET'); } };
}

// ------------------------------------------------------------------- online
let onlineReady = false;
function openOnline() {
  $('#onName').value = G.save.name === 'PILOT' ? '' : G.save.name;
  $('#onNote').className = 'note'; $('#onNote').textContent = 'Create a room and share the 4-letter code with friends. Up to 6 pilots; weapons and power-ups are fully synced.';
  if (G.net && G.net.room) showLobby(); else { $('#onConnect').classList.remove('hidden'); $('#onLobby').classList.add('hidden'); $('#onStart').classList.add('hidden'); }
  show('online');
}
function netError(e) {
  const n = $('#onNote');
  n.className = 'note err';
  n.textContent = /Failed to fetch|reach|NetworkError|Unexpected token|JSON/i.test(String(e.message)) ? 'Online play needs the Arena server (node server.js) — the relay is not reachable here.' : e.message;
}
function myProfile() { return { name: G.save.name, ship: G.save.p1.ship, livery: G.save.p1.livery }; }
function takeName() {
  const v = $('#onName').value.trim().toUpperCase().replace(/[^A-Z0-9 _.-]/g, '').slice(0, 12);
  G.save.name = v || 'PILOT'; persist();
}
async function enterRoom(fn) {
  takeName();
  try {
    leaveOnline();
    G.net = new Net();
    wireNet(G.net);
    await fn(G.net);
    G.lobby = { profiles: new Map(), set: { track: G.save.setup.track, laps: 3, combat: 1 } };
    G.lobby.profiles.set(G.net.pid, myProfile());
    if (G.net.isHost) broadcastRoster(); else G.net.send({ t: 'profile', ...myProfile() }, 'host');
    showLobby();
  } catch (e) { netError(e); G.net?.close(); G.net = null; }
}
$('#onCreate').onclick = () => enterRoom((n) => n.create(G.save.name));
$('#onJoin').onclick = () => { const c = $('#onCode').value.trim().toUpperCase(); if (c.length !== 4) { netError(new Error('Enter the 4-letter room code')); return; } enterRoom((n) => n.join(c, G.save.name)); };
$('#onName').addEventListener('input', takeName);
$('#onCopy').onclick = () => { const u = `${location.origin}${location.pathname}?room=${G.net.room}`; navigator.clipboard?.writeText(u).then(() => toast('LINK COPIED'), () => toast(u)); };
function leaveOnline() {
  if (G.net) { G.net.close(); G.net = null; }
  G.lobby = null; G.ns = null;
}
function wireNet(net) {
  net.onSys = (d) => {
    if (d.sys === 'join') { if (net.isHost) broadcastRoster(); }
    else if (d.sys === 'leave') {
      G.lobby?.profiles.delete(d.pid);
      G.ns?.playerLeft(d.pid);
      if (net.isHost) broadcastRoster(); else renderLobby();
    } else if (d.sys === 'host') {
      if (net.isHost) { toast('YOU ARE NOW THE HOST'); broadcastRoster(); }
      renderLobby();
    } else if (d.sys === 'disconnected') { toast('CONNECTION LOST'); if (G.mode === 'race') quitToMenu(); else { leaveOnline(); openOnline(); } }
  };
  net.onMsg = (from, m) => {
    switch (m.t) {
      case 'profile': if (net.isHost && G.lobby) { G.lobby.profiles.set(from, { name: m.name, ship: m.ship, livery: m.livery }); broadcastRoster(); } break;
      case 'roster': if (G.lobby) { G.lobby.profiles = new Map(m.list.map((p) => [p.pid, p])); G.lobby.set = m.set; renderLobby(); } break;
      case 'start': onlineStart(m); break;
      default: G.ns?.onMsg(from, m);
    }
  };
}
function broadcastRoster() {
  const L = G.lobby, net = G.net;
  if (!L || !net) return;
  // drop profiles of players no longer in the room; keep room order stable
  for (const pid of [...L.profiles.keys()]) if (!net.players.has(pid)) L.profiles.delete(pid);
  L.profiles.set(net.pid, myProfile());
  const list = [...net.players.keys()].filter((pid) => L.profiles.has(pid)).map((pid) => ({ pid, ...L.profiles.get(pid) }));
  net.send({ t: 'roster', list, set: L.set });
  L.profiles = new Map(list.map((p) => [p.pid, p]));
  renderLobby();
}
function showLobby() {
  $('#onConnect').classList.add('hidden'); $('#onLobby').classList.remove('hidden');
  $('#onRoom').textContent = G.net.room;
  renderLobby();
}
function renderLobby() {
  const net = G.net, L = G.lobby;
  if (!net || !L || $('#onLobby').classList.contains('hidden')) return;
  const rows = [...net.players.keys()].map((pid) => ({ pid, ...(L.profiles.get(pid) || { name: net.players.get(pid), ship: 'viper', livery: 0 }) }));
  $('#onPlayers').className = 'table lobby';
  $('#onPlayers').innerHTML = rowHTML('h', ['PILOT', 'SHIP', '']) + rows.map((r) => rowHTML(r.pid === net.pid ? 'me' : '', [dot(r.livery) + esc(r.name), shipDef(r.ship).name, r.pid === net.host ? 'HOST' : ''])).join('');
  const me = G.save.p1;
  $('#onShips').innerHTML = SHIPS.map((s) => `<button data-id="${s.id}" class="${s.id === me.ship ? 'on' : ''}">${s.name}</button>`).join('');
  $('#onSwatches').innerHTML = LIVERIES.map((l, i) => `<button data-i="${i}" style="background:${l.a};color:${l.a}" class="${i === me.livery ? 'on' : ''}"></button>`).join('');
  const host = net.isHost;
  $('#onHost').classList.toggle('hidden', !host);
  $('#onTracks').innerHTML = G.tracks.map((t, i) => `<button data-v="${i}" class="${+L.set.track === i ? 'on' : ''}">${t.def.name}</button>`).join('');
  $$('#onLaps button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +L.set.laps));
  $$('#onCombat button').forEach((b) => b.classList.toggle('on', +b.dataset.v === +L.set.combat));
  $('#onStart').classList.toggle('hidden', !host);
  $('#onStart').disabled = rows.length < 1;
  $('#onWait').textContent = host ? (rows.length < 2 ? 'Waiting for pilots to join… (you can also start solo)' : `${rows.length} pilots ready.`) : 'Waiting for the host to start the race…';
  if (!host) $('#onWait').textContent += `   ${G.tracks[L.set.track].def.name} · ${L.set.laps} LAPS · ${+L.set.combat ? 'WEAPONS ON' : 'RACE ONLY'}`;
}
function profileChanged() {
  persist();
  const L = G.lobby, net = G.net;
  if (!L || !net) return;
  L.profiles.set(net.pid, myProfile());
  if (net.isHost) broadcastRoster(); else { net.send({ t: 'profile', ...myProfile() }, 'host'); renderLobby(); }
}
$('#onShips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; G.save.p1.ship = b.dataset.id; profileChanged(); });
$('#onSwatches').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; G.save.p1.livery = +b.dataset.i; profileChanged(); });
function hostSet(k, v) { if (!G.net?.isHost) return; G.lobby.set[k] = +v; broadcastRoster(); }
$('#onTracks').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) hostSet('track', b.dataset.v); });
$('#onLaps').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) hostSet('laps', b.dataset.v); });
$('#onCombat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) hostSet('combat', b.dataset.v); });
$('#onStart').onclick = () => {
  const net = G.net, L = G.lobby;
  if (!net?.isHost) return;
  broadcastRoster();
  const racers = [...net.players.keys()].map((pid) => ({ pid, ...(L.profiles.get(pid) || myProfile()) }));
  const msg = { t: 'start', seed: rngSeed(), track: +L.set.track, laps: +L.set.laps, combat: +L.set.combat, racers };
  net.send(msg);
  net.flush();
  onlineStart(msg);
};
function onlineStart(m) {
  const net = G.net;
  if (!net) return;
  const racers = m.racers.map((r, i) => ({ id: r.pid, owner: r.pid, name: r.name, ship: r.ship, livery: r.livery, human: true, remote: r.pid !== net.pid, slot: r.pid === net.pid ? 0 : -1, grid: i }));
  startRace({ kind: 'online', online: true, mode: 'race', trackIdx: m.track, laps: m.laps, combat: !!m.combat, difficulty: 1, racers, seed: m.seed });
}
async function backToLobby() {
  const net = G.net;
  await startAttract();
  G.screen = ''; G.stack = ['menu'];
  if (net && net.room) { show('online', { push: false }); showLobby(); } else show('menu', { push: false });
}
window.addEventListener('beforeunload', () => G.net?.close());

// --------------------------------------------------------------------- boot
async function boot() {
  show('loading', { push: false });
  $('#loadText').textContent = 'CALIBRATING GRAVITY COILS…';
  await frames(2);
  G.tracks = TRACKS.map((def) => buildTrack(def));
  G.tracks.forEach((t) => (t.def = t.def || TRACKS.find((d) => d.id === t.id)));
  applyQuality();
  resize();
  buildTrackCards();
  bindChips($('#setupOpts'), (k) => G.save.setup[k], (k, v) => { G.save.setup[k] = +v; persist(); });
  bindSettings();
  const ts = $('#onLaps'); void ts;
  await startAttract();
  updateMenu();
  const room = params.get('room');
  G.screen = '';
  if (room) { show('menu', { push: false }); openOnline(); $('#onCode').value = room.toUpperCase().slice(0, 4); }
  else show('menu', { push: false });
  requestAnimationFrame((t) => { last = t; frame(t); });
  if (params.has('autostart')) { // dev/testing hook: ?autostart=<track>
    const ti = +params.get('autostart') || 0;
    const racers = buildGrid({ humans: [humanSpec('p1', 0, 'PILOT')], rivals: 5, difficulty: 1, seed: 5 });
    startRace({ kind: 'quick', mode: 'race', trackIdx: ti, laps: 3, combat: true, difficulty: 1, racers });
  }
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:0;color:#f88;background:#000;padding:20px;z-index:99">Nova Circuit failed to start:\n${esc(e.stack || e)}</pre>`); });
