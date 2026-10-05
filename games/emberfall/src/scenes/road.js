// The Road: the world's pressure gauge. Walking is free, arriving costs oil, and the
// Gloom is only a rumour while the Sunkey is honest. Encounters stop the tour; the
// tour never stops for long.

import * as art from '../art.js';
import { ui } from '../ui.js';
import * as audio from '../audio.js';
import { clamp, lerp, rng, TAU } from '../util.js';

export function makeRoad(G) {
  return {
    kind: 'road',
    route: null, t: 0,
    progress: 0, veraX: 0.42, gloom: 0,
    keys: {}, glimmers: [], encounter: null,
    done: false, fadeT: 0, moths: [], tested: false,

    enter(step) {
      this.route = step.route;
      const r = this.route;
      this.R = rng(r.seed * 7 + 3);
      this.t = 0; this.progress = 0; this.veraX = 0.42; this.gloom = 0;
      this.done = false; this.fadeT = 0; this.tested = false;
      ui.setChapter(G.chName(), `${r.name} · ${r.place || ''}`);
      audio.ambience(true, { warm: false });
      // glimmer lateral positions, deterministic
      this.glimmers = (r.glimmers || []).map((gl, i) => ({
        ...gl, x: 0.2 + ((gl.at * 977 + i * 31) % 1) * 0.6, taken: false,
      }));
      this.moths = Array.from({ length: r.moths || (r.gloom ? 2 : 0) }, (_, i) => ({
        seed: i * 13 + r.seed, off: i * 0.11,
      }));
      this.encounterQueue = (r.encounters || []).map((e) => ({ ...e, fired: false }));
      void this.R;
      if (r.hint) ui.toast(r.hint, 'cold');
      else ui.toast('MOVE — A / D · The road advances on its own · GLITTER = PICKUPS', 'cold');
    },

    update(dt) {
      this.t += dt;
      const r = this.route;
      if (this.encounter) return; // paused behind a prompt card
      if (this.done) {
        this.fadeT += dt;
        if (this.fadeT > 0.7) { this.finish(); }
        return;
      }

      // walking
      const left = this.keys['a'] || this.keys['arrowleft'];
      const right = this.keys['d'] || this.keys['arrowright'];
      const hustle = this.keys[' '];
      const walk = right ? 1 : left ? -0.7 : 0.12;
      this.veraX = clamp(this.veraX + (right ? 0.24 : left ? -0.24 : 0) * dt, 0.18, 0.86);
      const speed = (1 / r.len) * (0.55 + Math.max(0, walk) * 0.75 + (hustle ? 0.5 : 0));
      this.progress = clamp(this.progress + speed * dt, 0, 1);

      // oil: the road's clock
      const burn = r.burn * (1 + (hustle ? 0.8 : 0)) * (1 + this.gloom * 0.25);
      G.st.oil = Math.max(0, G.st.oil - burn * dt * 6);
      if (hustle) this.fuelTick = (this.fuelTick || 0) + dt;
      if (this.fuelTick > 0.28) { this.fuelTick = 0; audio.tick(false); }

      // gloom from mothing proximity
      const near = this.gloomAt();
      this.gloom = clamp(this.gloom + (near - this.gloom) * dt * 0.35 + (r.gloom || 0) * dt * 0.02, 0, 1);
      if (this.gloom > 0.92 && !this.tested) {
        this.tested = true;
        G.st.oil = Math.max(0, G.st.oil - 3);
        ui.toast('A mothling tests the light. It learns the price. (−3 oil)', 'bad');
        audio.worry();
        setTimeout(() => { this.tested = false; }, 12000);
      }
      if (G.st.oil <= 0.2) {
        ui.toast('THE SUNKEY BURNS ON FUME. The dark is editorialising.', 'bad');
      }

      // glimmer pickups: overlap in progress AND position
      for (const gl of this.glimmers) {
        if (gl.taken) continue;
        const sx = this.glimmerScreenX(gl);
        if (Math.abs(gl.at - this.progress) < 0.03 && Math.abs(sx - this.veraX * 1280) < 64) {
          gl.taken = true;
          this.collect(gl);
        }
      }

      // encounters
      for (const e of this.encounterQueue) {
        if (!e.fired && this.progress >= e.at) { e.fired = true; this.fireEncounter(e); break; }
      }

      if (this.progress >= 1 && !this.done) {
        this.done = true;
        G.spendRouteOil();
      }
      G.markHud();
    },

    gloomAt() {
      // mothing pressure rises late in gloomy routes
      const r = this.route;
      const ramp = this.moths.length ? this.progress : 0;
      return clamp((r.gloom || 0) * (0.25 + ramp * 0.9), 0, 1);
    },

    glimmerScreenX(gl) {
      return clamp(1280 * gl.x + (gl.at - this.progress) * 1280 * 9, -140, 1420);
    },

    collect(gl) {
      if (gl.kind === 'oil') { G.st.oil = clamp(G.st.oil + gl.amount, 0, 100); ui.toast(`+${gl.amount} OIL — ${gl.label}`); }
      else if (gl.kind === 'silver') { G.st.silver += gl.amount; ui.toast(`+${gl.amount} SILVER — ${gl.label}`); }
      else if (gl.kind === 'fragment') G.grantFragment(gl.id);
      audio.flamethrow();
      G.markHud();
    },

    fireEncounter(e) {
      this.encounter = e;
      const p = e.prompt;
      const opts = (p.choices || []).map((c) => ({
        label: c.label,
        cost: c.cost ? (typeof c.cost === 'function' ? c.cost(G.st) : c.cost) : null,
        note: c.note,
        req: c.req ? !!c.req(G.st) : true,
      }));
      ui.promptCard({
        kicker: p.kicker, title: p.title, body: p.body, choices: opts, timer: p.timer,
        onPick: (i) => this.resolveEncounter(e, i),
      });
      if (p.timer) ui.setPromptDefault(() => this.resolveEncounter(e, p.defaultIdx ?? 0));
    },

    resolveEncounter(e, i) {
      const c = e.prompt.choices[i];
      e.choice = i;
      if (c.set) G.applySet(c.set);
      let cont = true;
      if (c.go === 'next') cont = true;
      else if (c.go === 'sing') { G.st.flags.sangAway = true; G.addLog('Sang the swarm off the Milestone Road.'); }
      else if (c.go === 'fight') { G.st.flags.foughtMoths = true; audio.doom(); G.addLog('The corridor, the brutal way.'); }
      if (c.do) { const r2 = c.do(G.st, G); if (r2 && r2.toast) ui.toast(r2.toast, r2.cls); }
      if (c.result === 'pass') ui.toast('The road reopens.', 'cold');
      this.encounter = null;
      G.markHud();
    },

    finish() {
      if (this.route.gloom > 0.5) G.addLog(`Crossed the ${this.route.name}: ${Math.round(100 - G.st.oil)} oil spent.`);
      G.advance();
    },

    key(ev, down) {
      const k = ev.key.toLowerCase();
      this.keys[k] = down;
      if (down && k === ' ') ev.preventDefault();
      if (ui.hasPromptOpen() && down && /^[1-9]$/.test(k)) ui.pickPrompt(+k - 1);
    },

    pointer(ev) {},

    draw(g, W, H) {
      const r = this.route;
      const t = this.t;
      art.backdrop(g, W, H, r.gloom > 0.5 ? 'gloom' : 'road', t + this.progress * 40, { seed: r.seed, townLights: false });

      const gy = H * 0.86;
      const vx = this.veraX * W;
      // the troupe & cart, locked to a walking pace
      const cartX = clamp(vx + 190, 300, W - 180);
      art.cart(g, cartX, gy - 2, 0.85, t, { moving: true, wheel: this.progress * 3000, lamp: G.st.oil > 0 ? 1 : 0.4 });
      art.figure(g, cartX - 120, gy, 0.8, { who: 'dill', pose: 'walk', phase: t * 2.6, rim: 'rgba(150,180,235,0.35)' });
      art.figure(g, cartX + 92, gy, 0.92, { who: 'bram', pose: 'walk', phase: t * 2.4 + 1, rim: 'rgba(150,180,235,0.3)' });
      art.figure(g, cartX + 150, gy - 4, 0.66, { who: 'fenn', pose: 'walk', phase: t * 2.9, rim: 'rgba(150,180,235,0.4)', dir: -1 });
      art.cinderMoth(g, cartX + 150, gy - 84 + Math.sin(t * 1.1) * 8, t, 1, 0.9);
      // Vera, first among silhouettes
      art.figure(g, vx, gy, 0.95, { who: 'vera', pose: 'walk', phase: t * 2.7, rim: 'rgba(190,210,250,0.5)', holdsLamp: 1 });

      // the Sunkey pool: radius honest about the gauge
      const oilR = 70 + G.st.oil * 1.15;
      const lights = [
        { x: vx, y: gy - 34, r: oilR, core: 0.95 },
        { x: cartX - 42, y: gy - 28, r: 96, core: 0.7 },
      ];

      // glimmers
      for (const gl of this.glimmers) {
        if (gl.taken) continue;
        const dProg = gl.at - this.progress;
        if (dProg < -0.06 || dProg > 0.55) continue;
        const x = this.glimmerScreenX(gl);
        const bob = Math.sin(t * 3 + x * 0.01) * 4;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,210,140,${0.5 + 0.3 * Math.sin(t * 5)})`;
        g.beginPath(); g.ellipse(x, gy - 26 + bob, 4.4, 4.4, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,230,170,0.28)';
        g.beginPath(); g.ellipse(x, gy - 26 + bob, 13, 13, 0, 0, TAU); g.fill();
        g.restore();
      }

      // the trailing swarm
      const press = this.gloom;
      for (const m of this.moths) {
        for (let k = 0; k < 3; k++) {
          const mx = lerp(-40, 90, press) + Math.sin(t * (1 + k * 0.3) + m.seed) * (26 - press * 14) - k * 34;
          const my = gy - 60 - k * 30 + Math.cos(t * (0.8 + k * 0.22) + m.off * 9) * 16;
          art.mothling(g, mx, my, t * (1.2 + k * 0.2) + m.seed, { s: 0.8 + k * 0.12, aggro: press * 0.5, seed: m.seed + k });
        }
      }

      art.darkness(g, W, H, lights, 0.6 + press * 0.26);
      for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.55, 0.5, 0.2, t);
      art.fogBands(g, W, gy - 20, 34, t, r.seed, 0.7);
      art.vignette(g, W, H, 0.9 + press * 0.3);
      art.grain(g, W, H, t, 6);

      // progress of the route — a painted lane, not a number
      g.save();
      g.globalAlpha = 0.85;
      g.fillStyle = 'rgba(8,8,18,0.8)';
      g.beginPath(); g.ellipse(W / 2, H - 14, 170, 5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,190,110,0.9)';
      g.beginPath(); g.ellipse(W / 2 - 170 + this.progress * 340, H - 14, 4.5, 4.5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(216,168,92,0.5)';
      g.beginPath(); g.ellipse(W / 2 - 170, H - 14, 2.4, 2.4, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(W / 2 + 170, H - 14, 2.4, 2.4, 0, 0, TAU); g.fill();
      g.restore();
    },

    exit() {
      audio.ambience(false);
      ui.closePrompt();
    },
    advance() {},
    busy() { return !!this.encounter; },
  };
}
