/* AFTERGLOW — input: keyboard first, touch overlay for phones/tablets. */

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'action', Enter: 'action', KeyJ: 'actJ', KeyK: 'actK',
  KeyE: 'use', KeyQ: 'song', KeyF: 'shoot', ShiftLeft: 'roll', ShiftRight: 'roll',
  Digit1: 'm1', Digit2: 'm2', Digit3: 'm3',
  Escape: 'menu', Tab: 'tab',
};

export function makeInput(canvas) {
  const held = {};
  const pressed = {};
  const listeners = [];

  function set(name, on) {
    if (on) { if (!held[name]) pressed[name] = true; held[name] = true; }
    else held[name] = false;
    for (const fn of listeners) fn(name, on);
  }
  const down = e => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (['left', 'right', 'up', 'down', 'action', 'menu', 'tab'].includes(k) || e.code === 'Space') e.preventDefault();
    set(k, true);
  };
  const up = e => { const k = KEYMAP[e.code]; if (k) set(k, false); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

  // ---- touch overlay (two d-pad halves + action buttons) ----
  const touch = { el: null, on: true };
  function buildTouch() {
    const el = document.createElement('div');
    el.className = 'touch-layer';
    el.innerHTML = `
      <div class="t-side t-left"><button data-k="left" aria-label="left">◀</button><button data-k="right" aria-label="right">▶</button></div>
      <div class="t-side t-right">
        <button class="t-a" data-k="action" aria-label="action">A</button>
        <button class="t-b" data-k="use" aria-label="use">E</button>
        <button class="t-c" data-k="song" aria-label="song">♪</button>
        <button class="t-d" data-k="roll" aria-label="roll">⤵</button>
      </div>`;
    canvas.parentElement.appendChild(el);
    el.querySelectorAll('button').forEach(btn => {
      const k = btn.dataset.k;
      const on = e => { e.preventDefault(); set(k, true); btn.classList.add('down'); };
      const off = e => { e.preventDefault(); set(k, false); btn.classList.remove('down'); };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off);
      btn.addEventListener('touchcancel', off);
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
    });
    touch.el = el;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) el.classList.add('show');
  }
  buildTouch();

  return {
    held,
    consume(name) { const v = pressed[name]; pressed[name] = false; return v; },
    down(name) { return !!held[name]; },
    onTap(fn) { listeners.push(fn); },
    showTouch(on) { touch.el && touch.el.classList.toggle('show', on); },
    destroy() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      touch.el && touch.el.remove();
    },
  };
}
