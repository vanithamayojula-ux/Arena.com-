// THE WATCH — what the troupe calls combat when it can't avoid it: keeping flames
// alive in a room that wants them out. Aim the Sunkey (mouse), relight lamps (click),
// shove what grabs (space). No heroics. Arithmetic, with friends.

import * as art from '../art.js';
import { ui } from '../ui.js';
import { runBeats } from '../beats.js';
import * as audio from '../audio.js';
import { rng, clamp, TAU } from '../util.js';

export function makeWatch(G) {
  return {
    kind: 'watch',
    arena: null, t: 0, time: 0, paused: false, over: false,
    lamps: [], moths: [], humans: [], glow: 100, shoveCd: 0,
    mouse: { x: 640, y: 360 }, bigLamp: null, bigDark: 0, wickUsed: false,
    interludes: [0.34, 0.68], interI: 0, spawnAcc: 0, result: null,
    R: rng(1), promise: null,

    enter(step) {
      this.arena = step.arena;
      const a = step.arena;
      this.R = rng(a.name.length * 331 + 7);
      this.t = 0; this.time = 0; this.paused = false; this.over = false; this.grace = 0;
      this.moths = []; this.humans = []; this.glow = 100; this.shoveCd = 0;
      this.bigDark = 0; this.wickUsed = false;
      this.interI = 0; this.spawnAcc = 0;
      ui.setChapter(G.chName(), `${a.name} · ${a.place}`);
      G.spawnRate0 = 1;
      this.promise = this.run(step);
    },

    layout(W, H) {
      const a = this.arena;
      const finale = !!a.finale;
      const lamps = [];
      if (finale) {
        this.bigLamp = { x: W * 0.5, y: H * 0.6, r: 34, lit: 1, big: true, smother: 0, kind: 'sunkey' };
        lamps.push(this.bigLamp);
        for (let i = 0; i < 4; i++) {
          const side = i % 2, k = Math.floor(i / 2);
          lamps.push({ x: W * (side ? 0.86 - k * 0.1 : 0.14 + k * 0.1), y: H * (0.36 + (i > 1 ? 0.16 : 0)), r: 18, lit: 1, smother: 0 });
        }
      } else {
        for (let i = 0; i < a.lamps; i++) {
          lamps.push({ x: W * (0.14 + (i * 0.72) / (a.lamps - 1)), y: H * 0.66 - (i % 2) * 34, r: 20, lit: 1, smother: 0 });
        }
      }
      this.lamps = lamps;
      this.vy = H * 0.87;
      this.vx = W * 0.5;
    },

    async run(step) {
      const a = step.arena;
      await runBeats(a.intro || [], { state: G.st, apply: (s) => G.applySet(s) });
      ui.hideDialogue();
      this.running = true;
    },

    update(dt) {
      if (!this.running || this.over) return;
      this.t += dt;
      if (this.paused) {
        if (this.pausedT > 0) { this.pausedT -= dt; if (this.pausedT <= 0) this.paused = false; }
        return;
      }
      this.time += dt;
      this.grace = Math.max(0, (this.grace || 0) - dt);
      const a = this.arena;
      const W = 1280, H = 720;
      if (!this.lamps.length) this.layout(W, H);
      this.shoveCd = Math.max(0, this.shoveCd - dt);

      // spawning: pressure curve + mercy modifiers for how the tour has behaved
      const prog = this.time / a.duration;
      let rate = a.spawn * (0.5 + prog) * (G.spawnRate0 || 1);
      if (a.finale) {
        if (G.st.flags.sangAway) rate *= 0.72;
        if (G.st.flags.nuneWavered || G.st.flags.nuneMoved) rate *= 0.8;
        if (G.st.flags.paidDark) rate *= 0.5;
        if (G.st.flags.gaveOil) rate *= 0.9;
      }
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        this.spawnMoth(W, H);
      }
      if (a.humans !== false) {
        this.humanAcc = (this.humanAcc || 0) + dt * 0.14;
        if (this.humanAcc >= 1) { this.humanAcc = 0; this.spawnHuman(W, H); }
      }

      // moths
      for (const m of this.moths) {
        if (m.dead > 0) { m.dead -= dt; continue; }
        // pick a target lamp
        if (!m.target || m.target.lit <= 0 && this.R() > 0.3) m.target = this.pickTarget();
        if (!m.target) continue;
        let tx = m.target.x, ty = m.target.y;
        // beam fear: steering away from the aim cone
        const dx = m.x - this.vx, dy = m.y - this.vy;
        const ang = Math.atan2(dy, dx);
        const aim = Math.atan2(this.mouse.y - (this.vy - 40), this.mouse.x - this.vx);
        const d = Math.hypot(dx, dy);
        let inBeam = false;
        if (d < 460) {
          const diff = Math.abs(((ang - aim + Math.PI * 3) % TAU) - Math.PI);
          if (diff < 0.55) { inBeam = true; m.beamT = (m.beamT || 0) + dt; }
        }
        if (inBeam && m.beamT > 0.55) { m.dead = 0.5; m.fled = true; audio.worry(); continue; }
        const sp = m.sp * (1 + (a.gloom || 0.5) * 0.5);
        const vdx = tx - m.x, vdy = ty - m.y, vd = Math.hypot(vdx, vdy) || 1;
        let mvx = (vdx / vd) * sp, mvy = (vdy / vd) * sp;
        if (inBeam) { mvx -= (dx / d) * sp * 1.7; mvy -= (dy / d) * sp * 1.7; m.beamT = (m.beamT || 0) * 0.5; }
        m.x = clamp(m.x + mvx * dt, -30, W + 30);
        m.y = clamp(m.y + mvy * dt, 20, H);
        // latch the lamp
        if (vd < 46) {
          m.atLamp = (m.atLamp || 0) + dt;
          m.target.smother += dt * 1.05;
          if (m.target.smother >= 1) {
            if (!m.target.extinguished) this.extinguish(m.target);
          }
        } else m.atLamp = 0;
        // grab Vera
        const pd = Math.hypot(m.x - this.vx, m.y - (this.vy - 40));
        if (pd < 42 && this.grace <= 0) {
          this.glow -= dt * 42;
          m.latched = true;
          if (this.glow <= 0) this.blackout();
        } else if (pd >= 42) m.latched = false;
      }
      this.moths = this.moths.filter((m) => !(m.dead < 0));

      // humans (collectors): slower, walk along ground, hammer a lamp
      for (const h of this.humans) {
        if (h.dead > 0) { h.dead -= dt; continue; }
        if (!h.target || h.target.lit <= 0) h.target = this.pickTarget(true);
        if (!h.target) continue;
        const vdx = h.target.x - h.x, vd = Math.abs(vdx);
        h.x += Math.sign(vdx) * Math.min(vd, 34 * dt);
        if (vd < 40) { h.target.smother += dt * 0.62; h.hammerT = (h.hammerT || 0) + dt; if (h.target.smother >= 1 && !h.target.extinguished) this.extinguish(h.target); }
        if (Math.hypot(h.x - this.vx, 0) < 66 && this.grace <= 0) { this.glow -= dt * 26; if (this.glow <= 0) this.blackout(); }
      }
      this.humans = this.humans.filter((h) => !(h.dead < 0));

      // relighting decays smothering slowly on its own
      for (const L of this.lamps) if (!L.extinguished) L.smother = Math.max(0, L.smother - dt * 0.2);

      // big lamp failure clock (finale)
      if (a.finale && this.bigLamp?.extinguished) {
        this.bigDark += dt;
        if (this.bigDark > 16) return this.finish(false);
      }
      if (a.finale && !this.bigLamp?.extinguished) this.bigDark = Math.max(0, this.bigDark - dt * 0.5);

      // dawn meter interludes
      if (a.finale && this.interI < this.interludes.length && prog >= this.interludes[this.interI]) {
        this.interI++;
        this.nuneInterlude();
      }

      if (this.time >= a.duration) this.finish(true);
      G.markHud();
    },

    pickTarget(avoidBig) {
      const cand = this.lamps.filter((L) => (!avoidBig || !L.big) && !L.extinguished);
      if (!cand.length) return null;
      return cand[Math.floor(this.R() * cand.length)];
    },

    spawnMoth(W, H) {
      if (this.moths.filter((m) => !m.dead || m.dead > 0).length > 10) return;
      const edge = this.R();
      const m = {
        x: edge < 0.5 ? -24 : W + 24,
        y: 40 + this.R() * (H * 0.5),
        sp: 26 + this.R() * 22 + (this.time * 0.2),
        seed: Math.floor(this.R() * 99), target: null,
      };
      this.moths.push(m);
    },

    spawnHuman(W, H) {
      if (this.arena.finale) return;
      const side = this.R() > 0.5 ? -30 : W + 30;
      this.humans.push({ x: side, dead: undefined, hammerT: 0, seed: Math.floor(this.R() * 9) });
    },

    extinguish(L) {
      L.extinguished = true; L.lit = 0; L.smother = 0;
      if (L.big) { ui.toast('THE GREAT LAMP IS OUT. Sixteen seconds before the coast believes it.', 'bad'); audio.doom(); return; }
      G.st.lostLamps++;
      ui.toast('A lamp goes out under your nose. Somebody writes that down.', 'bad');
      audio.thud(1.2);
    },

    relight(L) {
      if (!L.extinguished) return;
      const cost = this.arena.relightOil ?? 3;
      if (G.st.oil < cost && !(!this.wickUsed && G.st.wickGift)) {
        ui.toast('Not enough oil for a rescue. Feed the flame before you court it.', 'bad');
        return;
      }
      if (G.st.oil < cost && !this.wickUsed && G.st.wickGift) {
        this.wickUsed = true; G.st.wickGift = false;
        ui.toast('ASHVALE\'S WICK — the spare brass heart takes the relight, free.', 'cold');
      } else {
        G.st.oil = Math.max(0, G.st.oil - cost);
      }
      // clear smothering moths nearby
      for (const m of this.moths) if (m.target === L) { m.dead = 0.4; m.beamT = 0; }
      for (const h of this.humans) if (h.target === L) { h.dead = 0.5; }
      L.extinguished = false; L.lit = 1; L.smother = 0;
      if (L.big) this.bigDark = Math.max(0, this.bigDark - 6);
      G.applySet({ morale: 1 });
      audio.flamethrow();
      G.markHud();
    },

    shove() {
      if (this.shoveCd > 0) return;
      this.shoveCd = 1.6;
      let hit = 0;
      for (const m of this.moths) {
        if (m.dead > 0) continue;
        if (Math.hypot(m.x - this.vx, m.y - (this.vy - 40)) < 92) { m.dead = 0.5; m.x += (m.x - this.vx) * 0.6; hit++; }
      }
      for (const h of this.humans) {
        if (Math.abs(h.x - this.vx) < 110) { h.dead = 0.8; h.x += Math.sign(h.x - this.vx) * 120; hit++; }
      }
      if (hit) { audio.thud(0.8); ui.judgment('SHOVE'); G.applySet({ morale: 0.5 }); }
      else audio.worry();
    },

    blackout() {
      const b = G.st.bonds;
      const who = b.bram >= b.dill && b.bram >= b.fenn ? 'BRAM' : b.dill >= b.fenn ? 'ODILE' : 'FENN';
      const line = {
        BRAM: 'Bram comes out of the dark holding you like the concept of a friend. "NOBODY carries a captain tonight. I am carrying a captain."',
        ODILE: 'Odile\'s hands find the pulse first, the lantern second. "Two minutes off the map. I counted. Both of us did."',
        FENN: 'Fenn drags you by the belt with more opinion than torque. "Signals are a performance! THIS was a performance!"',
      }[who];
      ui.toast('LIGHT OUT — ' + line, 'cold');
      audio.doom();
      G.applySet({ oil: -4, morale: -2 });
      this.glow = 100;
      // the allies drag you (and what's holding you) out of the reach of the rail
      for (const m of this.moths) if (m.latched || (m.target && Math.hypot(m.x - this.vx, m.y - (this.vy - 40)) < 90)) m.dead = 0.5;
      this.grace = 7;
      // brief mercy pause, ticked in-scene so it can never strand you
      this.paused = true;
      this.pausedT = 1.6;
    },

    nuneInterlude() {
      this.paused = true;
      const wav = G.st.flags.nuneWavered || G.st.flags.nuneMoved || G.st.flags.sangToNune || G.st.flags.softVerse;
      const body = wav
        ? 'Nune stands at the stair head, processing nothing. The procession behind him processes him instead, slowly, like weather with opinions. He will not shout. That is the entire problem, and the entire opportunity.'
        : 'Nune climbs to the lamp-room threshold, unhurried, reading the room like a ledger he intends to correct. His voice carries up the stair. It is, annoyingly, a fine voice.';
      const pick = (i) => {
        this.paused = false;
        if ((i === 0 && wav) || i === 1 || (i === 2 && this.R() > 0.4)) {
          G.spawnRate0 *= 0.68;
          ui.toast('The procession slows to consider its options. The spawn of it too.', 'cold');
          ui.toast('//He almost takes one.//', 'cold');
        } else {
          G.spawnRate0 *= 1.18;
          G.st.oil = Math.max(0, G.st.oil - 3);
          ui.toast('He preaches to the dark while the dark holds your candles. (+pressure, −3 oil)', 'bad');
        }
      };
      ui.promptCard({
        kicker: 'THE THRESHOLD', title: 'BROTHER NUNE, MID-VIGIL',
        body: body + ' Choose what you throw at him between relightings.',
        timer: 12,
        choices: [
          { label: 'WARM — "COME HOLD A LAMP. NO FORMS."', note: wav ? 'He has heard better arguments than this and kept this one.' : 'He declines, gently, and his people decline slower.' },
          { label: 'FIRM — "THE LEDGER SAYS THE TOWN CHOSE US."', note: 'You produce the ledger. It exists. It is a playbill. He allows both.' },
          { label: 'WIT — "A CHORUS OF LANTERNS, NUNE? YOU’RE ONE VOICE SHORT."', note: 'The stair giggles. Processions hate giggling.' },
        ],
        onPick: (i) => pick(i),
      });
      ui.setPromptDefault(() => { ui.closePrompt(); pick(G.st.flags.sangToNune || wav ? 0 : 1); });
    },

    async finish(win) {
      if (this.over) return;
      this.over = true; this.running = false;
      const a = this.arena;
      const litCount = this.lamps.filter((L) => L.lit > 0).length;
      if (a.finale && !this.bigLamp?.extinguished) G.st.flags.beaconHeld = true;
      if (a.finale && win && !G.st.flags.beaconHeld) G.st.flags.beaconDark = true;
      if (win) {
        G.applySet({ relit: litCount - (a.finale ? 1 : 0), morale: 6, rep: 2 });
        if (a.finale) G.applySet({ relit: 2, trust: 4 });
        G.addLog(`${a.name}: ${litCount}/${this.lamps.length} lamps held to the end.`);
        ui.toast(`THE RING HOLDS — ${litCount} lamps still lit when it was over.`, 'cold');
      } else {
        G.applySet({ morale: -6, oil: -6, relit: Math.max(0, litCount - (a.finale ? 1 : 0)) });
        if (a.name === 'THE COLLECTION') {
          G.st.flags.taxedOil = true;
          G.applySet({ oil: -6 });
        }
        G.addLog(`${a.name}: the dark filed a counter-report (${litCount} lamps).`);
      }
      if (win && a.name === 'THE COLLECTION' && litCount === this.lamps.length && !G.st.flags.wickGiven) {
        G.st.wickGift = true; G.st.flags.wickGiven = true;
        ui.toast('ASHVALE GIVES THE TROUPE THE BRASS WICK — one free relight, anywhere.', 'cold');
      }
      await runBeats(win ? a.winBeats || [] : a.loseBeats || [], { state: G.st, apply: (s) => G.applySet(s) });
      ui.hideDialogue();
      G.markHud();
      G.advance();
    },

    pointer(ev, isDown) {
      const c = G.canvas;
      const r2 = c.getBoundingClientRect();
      this.mouse.x = (ev.clientX - r2.left) / r2.width * 1280;
      this.mouse.y = (ev.clientY - r2.top) / r2.height * 720;
      if (isDown && this.running && !this.paused && !this.over) {
        for (const L of this.lamps) {
          if (Math.hypot(L.x - this.mouse.x, L.y - this.mouse.y) < 46) { this.relight(L); break; }
        }
      }
    },

    key(ev, down) {
      const k = ev.key.toLowerCase();
      if (down && k === ' ') { ev.preventDefault(); this.shove(); }
      if (ui.hasPromptOpen() && down && /^[1-9]$/.test(k)) ui.pickPrompt(+k - 1);
      if (down && ui.typing && !ui.hasPromptOpen()) ui.skipTyping();
    },

    draw(g, W, H) {
      const a = this.arena;
      g.__baseA1 = 1;
      art.backdrop(g, W, H, a.finale ? 'tower' : 'hall', this.t, {
        lampX: 0.5, lampY: 0.6, lampOn: !this.bigLamp?.extinguished,
      });
      // the lamps rail
      for (const L of this.lamps) {
        const lit = !L.extinguished;
        const smotherK = clamp(L.smother, 0, 1);
        art.lampObject(g, L.x, L.y, L.big ? (L.lit > 0 ? 3.2 : 3.2) : 1.15, lit ? 1 : 0, L.big ? 'sunkey' : 'hall', this.t);
        if (lit && smotherK > 0) {
          g.fillStyle = `rgba(2,3,10,${smotherK * 0.7})`;
          g.beginPath(); g.arc(L.x, L.y - 14, 26 * smotherK + 6, 0, TAU); g.fill();
        }

      }
      // the troupe, on the rail with him
      art.figure(g, this.vx - 150, H * 0.9, 0.95, { who: 'dill', pose: 'sing', phase: this.t * 2 + 1, rim: 'rgba(150,180,235,0.4)' });
      art.figure(g, this.vx + 150, H * 0.9, 1.05, { who: 'bram', pose: 'carry', phase: this.t * 1.7, dir: -1, rim: 'rgba(150,180,235,0.35)' });
      art.figure(g, this.vx + 230, H * 0.9, 0.66, { who: 'fenn', pose: 'puppet', phase: this.t * 2.3, dir: -1, rim: 'rgba(150,180,235,0.4)' });
      art.cinderMoth(g, this.vx + 250, H * 0.9 - 90 + Math.sin(this.t * 1.6) * 9, this.t, 1, 0.9);
      // Vera with the Sunkey raised toward the cursor
      art.figure(g, this.vx, this.vy, 1.05, { who: 'vera', pose: 'point', phase: this.t * 1.3, rim: 'rgba(200,215,250,0.55)' });

      // aim beam — a corridor of warm air, not a laser
      const sy = this.vy - 40;
      const ang = Math.atan2(this.mouse.y - sy, this.mouse.x - this.vx);
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const spread = 0.16 + i * 0.06;
        g.fillStyle = `rgba(255,178,96,${0.05 - i * 0.012})`;
        g.beginPath();
        g.moveTo(this.vx, sy);
        g.lineTo(this.vx + Math.cos(ang - spread) * 480, sy + Math.sin(ang - spread) * 480);
        g.lineTo(this.vx + Math.cos(ang + spread) * 480, sy + Math.sin(ang + spread) * 480);
        g.closePath(); g.fill();
      }
      g.restore();

      // mothings + humans
      for (const m of this.moths) {
        if (m.dead > 0) {
          g.save(); g.globalAlpha = m.dead * 2;
          art.mothling(g, m.x, m.y, this.t, { s: 0.8, aggro: 0, seed: m.seed });
          g.restore();
        } else if (!m.dead) art.mothling(g, m.x, m.y, this.t * 1.1 + m.seed, { s: 0.9, aggro: m.atLamp ? 0.9 : 0.35, seed: m.seed });
      }
      for (const h of this.humans) {
        g.save(); g.globalAlpha = h.dead > 0 ? Math.max(0, h.dead) : 1;
        art.figure(g, h.x, H * 0.92, 0.95, { who: 'crowd', pose: h.hammerT ? 'point' : 'walk', phase: this.t * 3 + h.seed, dir: h.x > this.vx ? -1 : 1, fill: '#03040b', rim: 'rgba(160,170,210,0.25)' });
        g.restore();
      }

      // the light math
      const glowR = 90 + this.glow * 1.3 + Math.sin(this.t * 7) * 3;
      const lights = [
        { x: this.vx, y: sy, r: glowR, core: 0.95 },
        ...this.lamps.filter((L) => !L.extinguished).map((L) => ({ x: L.x, y: L.y - 12, r: (L.big ? 300 : 120) * (1 - clamp(L.smother, 0, 1) * 0.55), core: L.big ? 0.92 : 0.8 })),
      ];
      art.darkness(g, W, H, lights, 0.74);
      for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.5, 0.5, 0.24, this.t);

      // dawn meter (finale) along the top
      if (a.finale) {
        const p = clamp(this.time / a.duration, 0, 1);
        g.save();
        g.fillStyle = 'rgba(8,9,20,0.7)';
        g.beginPath(); g.rect(W * 0.2, 34, W * 0.6, 7); g.fill();
        g.fillStyle = 'rgba(255,190,110,0.85)';
        g.beginPath(); g.rect(W * 0.2, 34, W * 0.6 * p, 7); g.fill();
        g.restore();
      }
      // personal light gauge — a ring around Vera that drains
      g.save();
      g.translate(this.vx, this.vy - 40);
      g.strokeStyle = `rgba(${this.glow > 40 ? '255,190,110' : '209,85,106'},0.75)`;
      g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 52, -TAU / 4, -TAU / 4 + TAU * clamp(this.glow / 100, 0, 1)); g.stroke();
      g.restore();
      if (this.shoveCd > 0) {
        g.save(); g.globalAlpha = this.shoveCd / 1.6;
        g.strokeStyle = 'rgba(160,190,255,0.6)'; g.lineWidth = 6;
        g.beginPath(); g.arc(this.vx, this.vy - 40, 80, 0, TAU); g.stroke();
        g.restore();
      }
      art.ash(g, W, H, this.t, 15, { a: 0.7 });
      art.vignette(g, W, H, 1.05);
      art.grain(g, W, H, this.t, 2);
    },

    exit() { ui.closePrompt(); ui.hideDialogue(); this.running = false; },
    advance() { ui.skipTyping(); },
    busy() { return this.paused; },
  };
}
