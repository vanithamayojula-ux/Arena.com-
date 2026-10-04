// Keyboard, mouse and touch input, normalised into one state object.

import { clamp } from './utils.js';

export function createInput(canvas, dom) {
  const keys = new Set();
  let touchSprint = false;
  const state = {
    x: 0,
    y: 0,
    sprint: false,
    bite: false,
    biteQueued: false,
    aim: 0,
    aimActive: false,
    paused: false,
    touch: false,
  };

  let aimTimer = 0;
  const stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };

  const isTyping = () => {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  };

  function onKeyDown(ev) {
    if (isTyping()) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    keys.add(k);
    if (k === ' ' || k === 'Spacebar') {
      ev.preventDefault();
      state.biteQueued = true;
    }
    if (k === 'p' || k === 'P' || k === 'Escape') {
      ev.preventDefault();
      if (dom.onTogglePause) dom.onTogglePause();
    }
    if (k === 'm' || k === 'M') {
      if (dom.onToggleMute) dom.onToggleMute();
    }
    if (k === 'Enter' && dom.onConfirm) dom.onConfirm();
  }

  function onKeyUp(ev) {
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    keys.delete(k);
  }

  function axis() {
    let x = 0;
    let y = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) x += 1;
    if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) y += 1;
    return { x, y };
  }

  function onPointerMove(ev) {
    const r = canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;
    state.aimScreen = { x: mx, y: my };
    aimTimer = 2.2;
    state.aimActive = true;
  }

  function onPointerDown(ev) {
    if (ev.pointerType === 'touch') return; // handled by the touch rig
    state.biteQueued = true;
    canvas.setPointerCapture?.(ev.pointerId);
  }

  // --- touch rig
  const stickEl = dom.stick;
  const knob = dom.stickKnob;

  function stickStart(ev) {
    ev.preventDefault();
    const r = stickEl.getBoundingClientRect();
    stick.active = true;
    stick.id = ev.pointerId;
    stick.cx = r.left + r.width / 2;
    stick.cy = r.top + r.height / 2;
    stickMove(ev);
  }
  function stickMove(ev) {
    if (!stick.active || ev.pointerId !== stick.id) return;
    ev.preventDefault();
    const dx = ev.clientX - stick.cx;
    const dy = ev.clientY - stick.cy;
    const max = 52;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, max);
    stick.dx = (dx / d) * cl;
    stick.dy = (dy / d) * cl;
    if (knob) knob.style.transform = `translate(${stick.dx}px, ${stick.dy}px)`;
  }
  function stickEnd(ev) {
    if (ev.pointerId !== stick.id) return;
    stick.active = false;
    stick.id = null;
    stick.dx = 0;
    stick.dy = 0;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  if (stickEl) {
    stickEl.addEventListener('pointerdown', stickStart);
    window.addEventListener('pointermove', stickMove, { passive: false });
    window.addEventListener('pointerup', stickEnd);
    window.addEventListener('pointercancel', stickEnd);
  }

  return {
    state,
    stick,
    isTouch: () => state.touch,
    setSprint(v) {
      touchSprint = v;
    },
    queueBite() {
      state.biteQueued = true;
    },
    /** Convert the mouse position into a world-space aim angle. */
    updateAim(camera, canvasSize, dt) {
      aimTimer -= dt;
      if (aimTimer <= 0) state.aimActive = false;
      if (!state.aimScreen || !state.aimActive) return;
      const sx = canvasSize.w / 2;
      const sy = canvasSize.h / 2;
      // aimScreen is in CSS pixels; camera offset is in device pixels
      const scale = canvasSize.dpr || 1;
      const wx = (state.aimScreen.x * scale - sx) / camera.zoom + camera.x;
      const wy = (state.aimScreen.y * scale - sy) / camera.zoom + camera.y;
      state.aim = Math.atan2(wy - camera.playerY, wx - camera.playerX);
    },
    poll() {
      let { x, y } = axis();
      if (stick.active) {
        x += stick.dx / 52;
        y += stick.dy / 52;
      }
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      state.x = x;
      state.y = y;
      state.sprint =
        keys.has('Shift') ||
        keys.has('shift') ||
        touchSprint ||
        (stick.active && m > 0.92);
      const bite = state.biteQueued;
      state.biteQueued = false;
      state.bite = bite;
      return state;
    },
    resetSprint() {
      state.sprint = false;
    },
    clear() {
      keys.clear();
      state.biteQueued = false;
    },
    clamp,
  };
}
