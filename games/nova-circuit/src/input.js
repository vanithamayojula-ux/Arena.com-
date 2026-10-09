// Keyboard / gamepad / touch input. Edge actions (missile, item, dodge) are queued
// per scheme and consumed by the sim, levels (steer, boost, fire...) are polled.

const SCHEMES = {
  p1: { left: ['KeyA'], right: ['KeyD'], climb: ['KeyW'], brake: ['KeyS'], boost: ['ShiftLeft'], fire: ['Space'], missile: ['KeyE'], item: ['KeyQ'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], climb: ['ArrowUp'], brake: ['ArrowDown'], boost: ['ShiftRight', 'Slash'], fire: ['Enter', 'NumpadEnter'], missile: ['Period'], item: ['Comma'] },
};
SCHEMES.all = {};
for (const k of Object.keys(SCHEMES.p1)) SCHEMES.all[k] = [...SCHEMES.p1[k], ...SCHEMES.p2[k]];
SCHEMES.all.boost.push('KeyB');
SCHEMES.all.fire.push('KeyJ');
SCHEMES.all.missile.push('KeyK', 'KeyX');
SCHEMES.all.item.push('KeyC', 'KeyL');

export class Input {
  constructor() {
    this.keys = new Set();
    this.pending = { p1: this.blank(), p2: this.blank(), all: this.blank() };
    this.lastTap = {};
    this.touch = { left: false, right: false, boost: false, fire: false, climb: false, brake: false };
    this.enabled = false;
    this.onPause = null;
    window.addEventListener('keydown', (e) => this.down(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.padPrev = [];
  }
  blank() { return { missile: false, item: false, dodge: 0 }; }

  down(e) {
    if (this.enabled && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab')) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') this.onPause?.();
    for (const sch of ['p1', 'p2', 'all']) {
      const m = SCHEMES[sch];
      if (m.missile.includes(e.code)) this.pending[sch].missile = true;
      if (m.item.includes(e.code)) this.pending[sch].item = true;
      for (const [dir, list] of [[-1, m.left], [1, m.right]]) {
        if (list.includes(e.code)) {
          const key = sch + dir;
          const now = performance.now();
          if (now - (this.lastTap[key] || -1e9) < 260) this.pending[sch].dodge = dir;
          this.lastTap[key] = now;
        }
      }
    }
  }

  any(list) { for (const c of list) if (this.keys.has(c)) return true; return false; }

  pad(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const list = [];
    for (const p of pads) if (p && p.connected) list.push(p);
    return list[i] || null;
  }

  /** Fill ship.input from the given scheme ('p1' | 'p2' | 'all'). */
  apply(ship, scheme, padIndex = 0) {
    const inp = ship.input;
    const m = SCHEMES[scheme];
    let steer = (this.any(m.right) ? 1 : 0) - (this.any(m.left) ? 1 : 0);
    let climb = this.any(m.climb), brake = this.any(m.brake), boost = this.any(m.boost), fire = this.any(m.fire);
    const pend = this.pending[scheme];
    if (pend.missile) { inp.missile = true; pend.missile = false; }
    if (pend.item) { inp.item = true; pend.item = false; }
    if (pend.dodge) { inp.dodge = pend.dodge; pend.dodge = 0; }
    if (scheme === 'all') {
      steer += (this.touch.right ? 1 : 0) - (this.touch.left ? 1 : 0);
      climb = climb || this.touch.climb; brake = brake || this.touch.brake; boost = boost || this.touch.boost; fire = fire || this.touch.fire;
      if (this.touch.missile) { inp.missile = true; this.touch.missile = false; }
      if (this.touch.item) { inp.item = true; this.touch.item = false; }
      if (this.touch.dodge) { inp.dodge = this.touch.dodge; this.touch.dodge = 0; }
    }
    const gp = this.pad(padIndex);
    if (gp) {
      const ax = Math.abs(gp.axes[0]) > 0.14 ? gp.axes[0] : 0;
      if (ax) steer = ax;
      const ay = gp.axes[1] || 0;
      if (ay < -0.55 || gp.buttons[12]?.pressed) climb = true;
      if (ay > 0.6 || gp.buttons[13]?.pressed || (gp.buttons[6]?.value || 0) > 0.3) brake = true;
      if (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed) boost = true;
      if ((gp.buttons[7]?.value || 0) > 0.25) fire = true;
      const prev = this.padPrev[padIndex] || [];
      const edge = (b) => gp.buttons[b]?.pressed && !prev[b];
      if (edge(2)) inp.missile = true;
      if (edge(3)) inp.item = true;
      if (edge(4)) inp.dodge = -1;
      if (edge(5)) inp.dodge = 1;
      this.padPrev[padIndex] = gp.buttons.map((b) => b.pressed);
    }
    inp.steer = Math.max(-1, Math.min(1, steer));
    inp.climb = climb; inp.brake = brake; inp.boost = boost; inp.fire = fire;
  }

  /** True if any menu-confirm style press happened on a gamepad this frame. */
  clear() { this.keys.clear(); for (const k of Object.keys(this.pending)) this.pending[k] = this.blank(); }
}

/** Wire the on-screen touch buttons (shown only on touch devices). */
export function bindTouch(root, input) {
  const hold = (el, key) => {
    const on = (e) => { e.preventDefault(); input.touch[key] = true; el.classList.add('down'); };
    const off = (e) => { e.preventDefault(); input.touch[key] = false; el.classList.remove('down'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    window.addEventListener('mouseup', () => { if (input.touch[key]) { input.touch[key] = false; el.classList.remove('down'); } });
  };
  const tap = (el, fn) => {
    const f = (e) => { e.preventDefault(); fn(); };
    el.addEventListener('touchstart', f, { passive: false });
    el.addEventListener('mousedown', f);
  };
  for (const el of root.querySelectorAll('[data-hold]')) hold(el, el.dataset.hold);
  for (const el of root.querySelectorAll('[data-tap]')) tap(el, () => { const k = el.dataset.tap; if (k === 'dodgeL') input.touch.dodge = -1; else if (k === 'dodgeR') input.touch.dodge = 1; else input.touch[k] = true; });
}
