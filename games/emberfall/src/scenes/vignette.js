// Vignette scenes: pure story beats over a painted backdrop. Campfires, arrivals,
// the quiet before the lamp. The cast stands in the firelight and talks; the game's
// job is to make the talking feel like weather.

import * as art from '../art.js';
import { runBeats } from '../beats.js';
import { ui } from '../ui.js';
import * as audio from '../audio.js';
import { TAU, clamp } from '../util.js';

export function makeVignette(G) {
  return {
    kind: 'vignette',
    t: 0, step: null, promise: null,

    enter(step) {
      this.step = step;
      const camp = step.type === 'campfire';
      ui.setChapter(G.chName(), step.place || '');
      if (!camp) audio.ambience(true, { warm: false });
      this.promise = this.play(step, camp);
    },

    async play(step, camp) {
      await runBeats(step.beats || [], {
        state: G.st,
        g: G,
        apply: (set) => G.applySet(set),
        fx: (fx) => this.doFx(fx),
        onAct: () => {},
      });
      if (camp) G.save();
      G.advance();
    },

    doFx(fx) {
      if (fx.fragment) G.grantFragment(fx.fragment);
      if (fx.toast) ui.toast(fx.toast[0], fx.toast[1]);
    },

    update(dt) { this.t += dt; },

    draw(g, W, H) {
      const step = this.step;
      const o = { ...step };
      g.__baseA1 = 1;
      art.backdrop(g, W, H, step.bg || 'road', this.t, o);

      // the cast, if the step wants them
      const cast = step.cast || { vera: { x: 0.45 } };
      const lights = [];
      const gy = H * 0.86;
      if (cast.cart) art.cart(g, cast.cart.x * W, gy - 2, 0.95, this.t, { moving: false, lamp: 1 });
      let ci = 0;
      const order = ['bram', 'dill', 'fenn', 'vera', 'keeper', 'odile'];
      for (const who of Object.keys(cast).filter((k) => k !== 'cart').sort((a, b2) => order.indexOf(a) === -1 ? 99 : order.indexOf(a))) {
        const c = cast[who];
        const x = (c.x ?? 0.2 + ci * 0.16) * W;
        const sway = Math.sin(this.t * 0.8 + ci * 2.1);
        const pose = c.pose || (step.type === 'campfire' ? 'sit' : 'idle');
        art.figure(g, x, gy + (pose === 'sit' ? 10 : 0), c.s || 1.05, {
          who: who === 'odile' ? 'dill' : who, pose, phase: this.t * 1.2 + ci, dir: c.dir || 1,
          rim: 'rgba(150,180,235,0.4)', holdsLamp: who === 'vera',
        });
        ci++;
      }
      // Cinder, always mid-flight near the cart or the captain
      const cy = gy - 120 + Math.sin(this.t * 1.3) * 9;
      art.cinderMoth(g, (cast.fenn ? cast.fenn.x : 0.5) * W + Math.sin(this.t * 0.7) * 46, cy, this.t, 1.15, 0.8);
      lights.push({ x: (cast.fenn ? cast.fenn.x : 0.5) * W + Math.sin(this.t * 0.7) * 46, y: cy, r: 60, core: 0.5 });

      if (step.bg === 'camp') {
        lights.push({ x: W * 0.5, y: gy - 8, r: 240, core: 0.85 });
        art.vignette(g, W, H, 0.9);
      } else if (step.bg === 'road' || step.bg === 'gloom') {
        const lv = cast.vera ? cast.vera.x : 0.45;
        lights.push({ x: lv * W, y: gy - 60, r: 150 + G.st.oil * 0.6, core: 0.75 });
        lights.push({ x: (cast.cart ? cast.cart.x : 0.7) * W, y: gy - 66, r: 130, core: 0.7 });
      } else if (step.bg === 'tower' || step.bg === 'cliff') {
        lights.push({ x: W * (step.lampX || 0.5), y: H * (step.lampY || 0.5), r: 320, core: 0.9 });
      } else {
        lights.push({ x: W * 0.5, y: gy - 90, r: 210, core: 0.8 });
        if (step.lamps) for (const L of step.lamps) lights.push({ x: L.x * W, y: L.y * H, r: 130, core: 0.75 });
      }

      const heavy = step.bg === 'camp' ? 0.5 : 0.66;
      art.darkness(g, W, H, lights, heavy);
      for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.62, 0.55, 0.25, this.t);
      art.vignette(g, W, H, 1);
      art.grain(g, W, H, this.t, 4);
    },

    exit() { audio.ambience(false); ui.hideDialogue(); },
    advance() { ui.skipTyping(); },
    busy() { return false; },
  };
}

export function makeTransition(G) {
  return {
    kind: 'transition',
    enter(step) {
      G.save();
      const html = `
        <div class="card-kicker">THE TOUR CONTINUES</div>
        <div class="card-title">${step.title}<small>${step.place || ''}</small></div>
        <div class="card-rule"></div>
        <p class="card-blurb">${step.sub ? `<i>${step.sub}</i>` : ''}</p>
        <div class="card-menu">
          <button class="menu-btn primary" id="tGo">NEXT: ${step.place || 'THE ROAD'}</button>
        </div>`;
      const fr = ui.showCard(html, { persistent: true });
      fr.querySelector('#tGo').addEventListener('click', () => { audio.click(); ui.hideCard(); G.advance(); });
    },
    update() {}, draw() {}, exit() {}, advance() {}, busy() { return false; },
  };
}
