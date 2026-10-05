// THE BRUTAL WAY. This scene exists exactly once in the game, takes about forty
// seconds, and leaves the palette greyer. It has no music. It has a metronome of
// something else entirely. Miss once and someone else pays for it — that is the whole
// design document, and the whole moral.

import * as art from '../art.js';
import { ui } from '../ui.js';
import { runBeats } from '../beats.js';
import * as audio from '../audio.js';
import { rng, clamp, TAU } from '../util.js';

export function makeFight(G) {
  return {
    kind: 'fight',
    fight: null, t: 0, step: 0, state: 'idle', // idle | telegraph | window | resolve
    timer: 0, resolved: [], hits: 0, R: rng(4),
    moth: { x: 0, y: 0, ang: 0 }, hurt: [],

    enter(step) {
      this.fight = step.fight;
      this.t = 0; this.step = 0; this.hits = 0; this.resolved = []; this.hurt = [];
      this.state = 'beats';
      ui.setChapter(G.chName(), step.fight.name);
      this.promise = this.run(step);
    },

    async run(step) {
      await runBeats(step.fight.intro || [], { state: G.st, apply: (s) => G.applySet(s), g: G });
      ui.hideDialogue();
      for (let i = 0; i < step.fight.exchanges; i++) {
        if (this.quit) return;
        this.step = i;
        this.state = 'telegraph'; this.timer = 0;
        this.moth = { x: 640 + (this.R() - 0.5) * 700, y: 120 + this.R() * 260, ang: 0 };
        await new Promise((r) => { this.stepResolve = r; });
        if (this.quit) return;
      }
      // resolution
      const win = this.hits >= step.fight.exchanges - 1;
      if (win) {
        G.st.flags.mothsWon = true;
        G.applySet({ morale: -6, trust: 2, 'bonds.bram': 2 });
      } else {
        G.applySet({ morale: -8, trust: -3 });
      }
      await runBeats(win ? step.fight.winBeats : step.fight.loseBeats, { state: G.st, apply: (s) => G.applySet(s), g: G });
      await runBeats(step.fight.after || [], { state: G.st, apply: (s) => G.applySet(s), g: G });
      ui.hideDialogue();
      if (!win && this.hurt.length === 0) this.hurt.push('bram');
      if (this.hurt.length) {
        G.st.injury = this.hurt[this.hurt.length - 1];
        G.st.bonds[G.st.injury] = clamp(G.st.bonds[G.st.injury] + 3, 0, 100);
      }
      G.addLog(`The Milestone corridor: ${this.hits}/${step.fight.exchanges}. ${win ? 'The road remembers the shape of you.' : 'The road keeps a deposit.'}`);
      G.advance();
    },

    update(dt) {
      this.t += dt;
      if (this.state === 'telegraph') {
        this.timer += dt;
        const tx = 640 + Math.sin(this.step * 2.1) * 120;
        const p = clamp(this.timer / 1.15, 0, 1);
        this.moth.rx = this.moth.x + (tx - this.moth.x) * p;
        this.moth.ry = this.moth.y + (430 - this.moth.y) * p;
        if (p >= 1) { this.state = 'window'; this.timer = 0; }
      } else if (this.state === 'window') {
        this.timer += dt;
        // the lunge crests; input is judged in key()/pointer()
        if (this.timer > 0.34) { this.resolve(false); }
      }
    },

    resolve(hit) {
      if (this.state !== 'window') return;
      this.state = 'idle';
      if (hit) { this.hits++; audio.thud(1.4); ui.judgment('REPULSE'); this.parryFx = 0.35; }
      else {
        audio.doom();
        const cands = ['dill', 'bram', 'fenn'].filter((w) => !this.hurt.includes(w));
        const who = cands.length ? cands[Math.floor(this.R() * cands.length)] : null;
        if (who) { this.hurt.push(who); ui.toast(`${{ dill: 'ODILE', bram: 'BRAM', fenn: 'FENN' }[who].split(' ').join('')} takes it off the line. It is not an accident.`, 'bad'); }
        G.applySet({ morale: -3 });
      }
      if (this.stepResolve) { const r = this.stepResolve; this.stepResolve = null; r(); }
    },

    input() {
      if (this.state === 'window') this.resolve(true);
      else if (this.state === 'telegraph') this.resolve(false); // flinch early — it costs
    },

    key(ev, down) { if (down) this.input(); },
    pointer(ev, down) { if (down && this.state !== 'beats') this.input(); },

    draw(g, W, H) {
      g.__baseA1 = 1;
      art.backdrop(g, W, H, 'gloom', this.t, { seed: 5, glowStrength: 0.15 });
      const gy = H * 0.86;
      // the troupe in a half-sentence of formation
      art.figure(g, 500, gy, 0.95, { who: 'dill', pose: 'idle', phase: this.t * 2, dir: -1 });
      art.figure(g, 560, gy, 1.05, { who: 'vera', pose: 'point', phase: this.t * 2.4, rim: 'rgba(220,220,235,0.35)', holdsLamp: 1 });
      art.figure(g, 700, gy, 1.15, { who: 'bram', pose: 'idle', phase: this.t * 1.8, dir: -1 });
      art.figure(g, 770, gy, 0.7, { who: 'fenn', pose: 'idle', phase: this.t * 2.2, dir: -1 });
      // the corridor watching
      for (let i = 0; i < 7; i++) {
        art.mothling(g, 120 + (i * 151) % 1040, 140 + ((i * 97) % 220), this.t * 1.4 + i, { s: 0.75 + (i % 3) * 0.1, aggro: 0.7, seed: i * 7 });
      }
      // the lunging one
      if (this.state === 'telegraph' || this.state === 'window') {
        const m = this.moth;
        const mx = m.rx ?? m.x, my = m.ry ?? m.y;
        const ringR = this.state === 'window' ? 30 : 30 + (1 - clamp(this.timer / 1.15, 0, 1)) * 150;
        g.save();
        g.strokeStyle = this.state === 'window' ? 'rgba(255,240,210,0.9)' : 'rgba(150,160,200,0.4)';
        g.lineWidth = this.state === 'window' ? 3 : 1.6;
        g.beginPath(); g.arc(640 + Math.sin(this.step * 2.1) * 120, 430, ringR, 0, TAU); g.stroke();
        art.mothling(g, mx, my, this.t * 3, { s: 1.2, aggro: 1, seed: 3 });
        g.restore();
      }
      if (this.parryFx > 0) {
        this.parryFx -= 0.016;
        g.save(); g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,220,160,${this.parryFx * 1.6})`;
        g.beginPath(); g.arc(640, 430, 90, 0, TAU); g.fill();
        g.restore();
      }
      // desaturate the whole exchange: a grey sheet over the dusk
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = '#0b0c12';
      g.fillRect(0, 0, W, H);
      g.restore();
      art.darkness(g, W, H, [{ x: 560, y: gy - 40, r: 190, core: 0.85 }], 0.85);
      art.vignette(g, W, H, 1.25);
      art.grain(g, W, H, this.t, 99, 2);
    },

    exit() { this.quit = true; if (this.stepResolve) { const r = this.stepResolve; this.stepResolve = null; r(); } ui.hideDialogue(); },
    advance() {}, busy() { return true; },
  };
}
