// Boots the game: DOM wiring, HUD adapter, resize handling and the frame loop.

import { createGame } from './game.js';
import { createInput } from './input.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const minimap = $('minimap');
const menu = $('menu');
const pauseEl = $('pause');
const overEl = $('gameover');
const hudEl = $('hud');
const touchEl = $('touch');
const toastEl = $('toast');

const els = {
  score: $('hud-score'),
  combo: $('hud-combo'),
  wave: $('hud-wave'),
  quota: $('hud-quota'),
  timer: $('hud-timer'),
  stamina: $('hud-stamina'),
  health: $('hud-health'),
  hunger: $('hud-hunger'),
  goTitle: $('go-title'),
  goReason: $('go-reason'),
  goScore: $('go-score'),
  goCombo: $('go-combo'),
  goCaught: $('go-caught'),
  goWave: $('go-wave'),
};

const isTouchDevice =
  ('ontouchstart' in window || navigator.maxTouchPoints > 0) &&
  window.matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- HUD adapter

let toastTimer = 0;
function toast(text, color) {
  toastEl.textContent = text;
  toastEl.style.color = color || '#e0b64a';
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1400);
}

function popScore(el) {
  el.classList.remove('pop');
  // restart the CSS animation
  void el.offsetWidth;
  el.classList.add('pop');
}

const hud = {
  show(on) {
    hudEl.classList.toggle('hidden', !on);
  },
  score(v) {
    els.score.textContent = Math.round(v).toLocaleString();
    popScore(els.score);
  },
  combo(v) {
    els.combo.textContent = `x${v}`;
  },
  wave(v) {
    els.wave.textContent = String(v);
  },
  quota(done, total) {
    els.quota.textContent = `${done} / ${total}`;
    $('hud-quota-fill').style.width = `${Math.min(100, (done / total) * 100)}%`;
  },
  timer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    els.timer.textContent = `${s}s`;
    els.timer.classList.toggle('low', s <= 10);
  },
  bars({ stamina, health, hunger }) {
    els.stamina.style.width = `${stamina * 100}%`;
    els.health.style.width = `${health * 100}%`;
    els.hunger.style.width = `${hunger * 100}%`;
    els.health.classList.toggle('danger', health < 0.3);
    els.hunger.classList.toggle('danger', hunger < 0.25);
  },
  toast,
  gameOver({ reason, score, combo, caught, wave }) {
    els.goTitle.textContent = caught === 0 ? 'Not one meal' : 'The valley wins';
    els.goReason.textContent = reason;
    els.goScore.textContent = Math.round(score).toLocaleString();
    els.goCombo.textContent = `x${combo}`;
    els.goCaught.textContent = caught;
    els.goWave.textContent = wave;
    overEl.classList.remove('hidden');
  },
};

const sfx = {
  start: () => audio.start(),
  roar: () => audio.roar(),
  chomp: () => audio.chomp(),
  biteAir: () => audio.biteAir(),
  kill: (p) => audio.kill(p),
  screech: () => audio.screech(),
  hurt: () => audio.hurt(),
  step: (hard) => audio.step(hard),
  combo: (lvl) => audio.combo(lvl),
  waveClear: () => audio.waveClear(),
  gameOver: () => audio.gameOver(),
  ambience: () => audio.startAmbience(),
  stopAmbience: () => audio.stopAmbience(),
};

const game = createGame({ canvas, minimap, hud, sfx });
game.setView({ w: 960, h: 600, dpr: 1 });

// --------------------------------------------------------------------- overlays

function setOverlay(name) {
  menu.classList.toggle('hidden', name !== 'menu');
  pauseEl.classList.toggle('hidden', name !== 'paused');
  overEl.classList.toggle('hidden', name !== 'over');
}

function beginHunt() {
  audio.init();
  setOverlay(null);
  game.start();
  if (isTouchDevice) touchEl.classList.remove('hidden');
}

$('btn-start').addEventListener('click', beginHunt);
$('btn-again').addEventListener('click', () => {
  overEl.classList.add('hidden');
  beginHunt();
});
$('btn-resume').addEventListener('click', () => {
  setOverlay(null);
  game.resume();
});
$('btn-quit').addEventListener('click', () => {
  game.quit();
  setOverlay('menu');
  touchEl.classList.add('hidden');
});

function onTogglePause() {
  if (game.game.state === 'playing') {
    game.pause();
    setOverlay('paused');
  } else if (game.game.state === 'paused') {
    game.resume();
    setOverlay(null);
  }
}

function onToggleMute() {
  const muted = audio.toggleMute();
  toast(muted ? 'MUTED' : 'SOUND ON', '#efe3c8');
}

// ----------------------------------------------------------------------- input

const input = createInput(canvas, {
  stick: $('stick'),
  stickKnob: $('stick-knob'),
  onTogglePause,
  onToggleMute,
  onConfirm() {
    if (game.game.state === 'menu' || game.game.state === 'over') beginHunt();
    else onTogglePause();
  },
});
if (isTouchDevice) {
  input.state.touch = true;
  $('hud-hint').textContent = 'Drag to move · RUN to sprint · BITE to strike';
}

const biteBtn = $('btn-bite');
const sprintBtn = $('btn-sprint');
biteBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.init();
  input.queueBite();
  biteBtn.classList.add('active');
});
biteBtn.addEventListener('pointerup', () => biteBtn.classList.remove('active'));
biteBtn.addEventListener('pointercancel', () => biteBtn.classList.remove('active'));

const setSprintBtn = (on) => (e) => {
  e.preventDefault();
  input.setSprint(on);
  sprintBtn.classList.toggle('active', on);
};
sprintBtn.addEventListener('pointerdown', setSprintBtn(true));
sprintBtn.addEventListener('pointerup', setSprintBtn(false));
sprintBtn.addEventListener('pointercancel', setSprintBtn(false));
sprintBtn.addEventListener('pointerleave', setSprintBtn(false));

window.addEventListener('pointerdown', () => audio.init(), { once: true });
window.addEventListener('keydown', () => audio.init(), { once: true });

// ---------------------------------------------------------------------- resize

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(240, window.innerHeight);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  game.setView({ w, h, dpr });
}
window.addEventListener('resize', resize);
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.game.state === 'playing') {
    game.pause();
    setOverlay('paused');
  }
});

// ------------------------------------------------------------------ frame loop

let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  // Tab-switches can hand us a huge dt; clamp and sub-step for stability.
  dt = Math.min(dt, 0.1);

  const st = input.poll();
  game.setInputStateRef(st);

  if (game.game.state === 'playing') {
    input.updateAim(game.game.camera, game.view, dt);
    let remaining = dt;
    const step = 1 / 120;
    while (remaining > 0) {
      const s = Math.min(step, remaining);
      game.update(s);
      remaining -= s;
      if (game.game.state !== 'playing') break;
    }
    game.updateCamera(dt);
  }

  if (game.game.state === 'playing' || game.game.state === 'paused') {
    game.draw(now / 1000);
  }

  requestAnimationFrame(frame);
}

setOverlay('menu');
requestAnimationFrame(frame);
