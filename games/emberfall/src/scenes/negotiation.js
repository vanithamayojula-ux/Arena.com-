// The Argument: combat by other means. Four stances, one tell, and a stack of levers
// you've been earning since the first scene. Nobody dies. Somebody always files.

import * as art from '../art.js';
import { ui, rich } from '../ui.js';
import { runBeats } from '../beats.js';
import * as audio from '../audio.js';
import { rng, clamp } from '../util.js';

const TONE_COLOR = {
  proud: '#ffc37a', envious: '#ffc37a', anxious: '#9db8e6', scared: '#9db8e6',
  greedy: '#d8a85c', hostile: '#d1556a', guarded: '#d1556a',
  smug: '#b48ac4', pious: '#b48ac4',
  mournful: '#8fa3c8', tired: '#8fa3c8',
};

// the answer-key: which stance actually lands on which mood
const BEST = {
  proud: 'warm', envious: 'warm', anxious: 'warm', scared: 'warm', mournful: 'warm', tired: 'warm',
  greedy: 'firm', hostile: 'firm', guarded: 'firm',
  smug: 'wit',
  pious: 'read',
};

const STANCES = [
  { key: 'warm', label: 'WARM — be the room he wants it to be' },
  { key: 'firm', label: 'FIRM — stand where the 47th stood' },
  { key: 'wit', label: 'WIT — make the joke before they do' },
  { key: 'read', label: 'READ — let Odile find the thread' },
];

export function makeNegotiation(G) {
  return {
    kind: 'negotiation',
    npc: null, t: 0, guard: 0, ex: 0, revealed: false, usedLevers: {},
    tone: 'proud', phase: 'intro', result: null, promise: null,
    bgKind: 'village',

    enter(step) {
      this.npc = step.npc;
      this.t = 0; this.guard = step.npc.guard; this.ex = 0;
      this.revealed = !!step.npc.revealStart; this.usedLevers = {};
      this.phase = 'run'; this.result = null;
      this.bgKind = { pell: 'village', prim: 'bridge', nune: 'hall' }[step.npc.id] || 'village';
      ui.setChapter(G.chName(), `NEGOTIATION · ${step.npc.name}`);
      this.R = rng(step.npc.id.length * 977 + G.st.rep * 31 + 5);
      this.promise = this.run(step);
      audio.ambience(true, { warm: true });
    },

    nextTone() {
      const keys = Object.keys(this.npc.lines);
      const idx = Math.floor(this.R() * keys.length);
      // pressure escalates: later exchanges harden the mood
      const harden = this.ex >= 3 ? 1 : 0;
      const k = keys[(idx + harden * (this.npc.id === 'nune' ? 3 : 2)) % keys.length];
      this.tone = k;
      return k;
    },

    async run(step) {
      const npc = this.npc;
      await runBeats(npc.intro || [], { state: G.st, apply: (s) => G.applySet(s) });
      let outcome = null;
      while (this.guard > 0 && this.ex < npc.exchanges) {
        const tone = this.nextTone();
        this.phase = 'choose';
        this.tone = tone;
        const lines = npc.lines[tone] || Object.values(npc.lines)[0];
        const line = lines[Math.floor(this.R() * lines.length)];
        ui.say(npc.name, line, npc.tone === 'villain' ? 'villain' : 'cold');
        await new Promise((r) => { const t0 = performance.now(); const poll = () => (ui.typing ? requestAnimationFrame(poll) : r()); poll(); });
        await new Promise((r) => setTimeout(r, 240));
        const opts = STANCES.map((s) => ({ label: s.label }));
        const levers = (npc.levers || []).filter((l) => !this.usedLevers[l.key] && (l.req ? l.req(G.st) : true));
        for (const l of levers) opts.push({ label: `✦ ${l.label}`, note: l.note });
        const pick = await new Promise((res) => ui.offerChoices(opts, res));
        G.markHud();
        if (pick < 4) {
          const stance = STANCES[pick].key;
          this.ex++;
          if (stance === 'read') {
            const dill = G.st.bonds.dill >= 55 || npc.revealStart;
            this.revealed = true;
            if (!dill && this.R() > 0.5) {
              ui.toast('A guess dressed as insight. He notices both. (+6 guard)', 'bad');
              this.guard += 6; this.fumble(); continue;
            }
            ui.toast(`Odile, under breath: "${({ pious: 'grief under the hymn', smug: 'wanting under the sneer', mournful: 'relief waiting for permission', hostile: 'fear with better posture', proud: 'a man auditing his own funeral', guarded: 'someone who has to be first' })[this.tone] || 'I have it.'}" — tell read.`, 'cold');
          }
          const hit = BEST[this.tone] === stance;
          if (hit) {
            this.guard = Math.max(0, this.guard - 18);
            G.applySet({ morale: 1 });
            audio.choice();
            ui.toast('The line lands. Something in the room rebalances.', 'cold');
          } else {
            this.guard = Math.min(120, this.guard + 5);
            this.fumble();
          }
        } else {
          const lever = levers[pick - 4];
          this.usedLevers[lever.key] = true;
          this.ex++;
          this.guard = Math.max(0, this.guard - (lever.guard || 15));
          if (lever.reveal) this.revealed = true;
          if (lever.set) G.applySet(lever.set);
          if (lever.do) lever.do(G.st, G);
          audio.fanfare();
          ui.toast('LEVER PULLED — the argument changes shape.', 'cold');
        }
      }
      if (this.guard <= 0) outcome = 'win';
      if (!outcome) {
        this.phase = 'endgame';
        outcome = await this.endgame(npc);
      }
      this.phase = 'outro';
      if (outcome === 'win') {
        await runBeats(this.winBeats || npc.winBeats || [], { state: G.st, apply: (s) => G.applySet(s) });
        if (npc.win?.set) G.applySet(npc.win.set);
        if (npc.win?.toast) ui.toast(npc.win.toast);
        audio.fanfare();
      } else {
        await runBeats(this.loseBeatsOverride || npc.loseBeats || [], { state: G.st, apply: (s) => G.applySet(s) });
        if (npc.lose?.set) G.applySet(npc.lose.set);
        audio.doom();
      }
      G.addLog(`${npc.name}: ${outcome === 'win' ? 'the seal slides' : 'the seal holds'} (${this.ex} exchanges).`);
      G.markHud();
      ui.hideDialogue();
      this.result = outcome;
      G.advance();
    },

    fumble() {
      audio.thud(0.7);
      G.st.oil = Math.max(0, G.st.oil - 2);
      G.applySet({ morale: -1 });
      ui.toast('A misstep. He bills missteps. (−2 oil)', 'bad');
    },

    async endgame(npc) {
      const eg = npc.endgame;
      const opts = eg.choices.map((c) => ({
        label: c.label, note: c.note,
        cost: c.cost ? (typeof c.cost === 'function' ? c.cost(G.st) : c.cost) : null,
        req: c.req ? !!c.req(G.st) : true,
      }));
      const pick = await new Promise((res) => {
        ui.offerChoices(opts, (i) => { ui._choiceCb = null; res(i); });
      });
      const c = eg.choices[pick];
      if (c.set) G.applySet(c.set);
      if (c.beats) { this.winBeats = c.beats; return 'win'; }
      if (c.loseBeats) { this.loseBeatsOverride = c.loseBeats; return 'lose'; }
      if (c.win) return 'win';
      if (c.joint) { G.st.flags.jointBill = true; return 'win'; }
      if (c.bluff || c.stall) {
        const chance = c.winChance || 0.55;
        const ok = Math.random() < chance;
        ui.toast(ok ? (c.stall ? 'He leaves a card. You keep the night.' : 'The bluff rides the room’s roar. It lands.') : (c.stall ? 'The delay is *noted* and billed.' : 'The room loves it. The ledger does not.'), ok ? 'cold' : 'bad');
        if (ok && c.bluff) G.applySet({ rep: 1 });
        return ok ? 'win' : 'lose';
      }
      return 'lose';
    },

    update(dt) { this.t += dt; },

    key(ev, down) {
      if (!down) return;
      const k = ev.key.toLowerCase();
      if (ui.hasPromptOpen() && /^[1-9]$/.test(k)) { ui.pickPrompt(+k - 1); return; }
      if (ui.hasChoiceOpen() && /^[1-9]$/.test(k)) ui.pickChoice(+k - 1);
    },

    pointer(ev) {
      if (ui.typing && this.phase !== 'choose' && this.phase !== 'endgame') ui.skipTyping();
    },

    draw(g, W, H) {
      const npc = this.npc;
      g.__baseA1 = 1;
      const bg = this.bgKind;
      art.backdrop(g, W, H, bg, this.t, { seed: 8, lamps: [{ x: W * 0.12, y: H * 0.4 }] });
      const nx = W * 0.66, ny = H * 0.8;
      // the opposition, with his mood written in a colour he can't stop
      const col = TONE_COLOR[this.tone] || '#999';
      art.figure(g, nx, ny, 1.06, {
        who: npc.id === 'nune' ? 'nun' : npc.id === 'pell' ? 'auditor' : 'villager',
        pose: this.guard < 30 ? 'kneel' : this.phase === 'choose' ? 'point' : 'idle',
        phase: this.t * 1.4, dir: -1, rim: 'rgba(150,180,235,0.5)',
      });
      if (this.phase === 'choose' || this.phase === 'endgame') {
        g.save(); g.globalCompositeOperation = 'lighter';
        const bob = Math.sin(this.t * 2.2) * 3;
        g.fillStyle = col;
        g.beginPath(); g.arc(nx - 14, ny - 128 + bob, 3.6, 0, 6.28); g.fill();
        g.restore();
      }
      // the troupe, behind the captain
      const tx = W * 0.3;
      art.figure(g, tx, H * 0.8, 1.02, { who: 'vera', pose: 'prompt', phase: this.t * 1.1, rim: 'rgba(190,210,250,0.55)', holdsLamp: 1 });
      art.figure(g, tx - 70, H * 0.8, 0.95, { who: 'dill', pose: 'idle', phase: this.t * 0.9 + 2, rim: 'rgba(150,180,235,0.35)' });
      art.figure(g, tx - 140, H * 0.8, 1.15, { who: 'bram', pose: 'idle', phase: this.t * 0.8 + 4, rim: 'rgba(150,180,235,0.3)' });
      art.figure(g, tx + 46, H * 0.8, 0.7, { who: 'fenn', pose: 'idle', phase: this.t * 1.05 + 1, dir: -1, rim: 'rgba(150,180,235,0.4)' });

      // the guard: embers of certainty, burning down as you land lines
      const total = npc.guard, each = 18;
      const n = Math.ceil(this.guard / each);
      g.save();
      g.translate(W * 0.5, 58);
      for (let i = 0; i < Math.ceil(total / each); i++) {
        const lit = i < n;
        g.globalCompositeOperation = lit ? 'lighter' : 'source-over';
        g.fillStyle = lit ? 'rgba(255,190,110,0.85)' : 'rgba(40,44,66,0.8)';
        g.beginPath(); g.arc(-Math.ceil(total / each) * 12 / 2 + i * 12, 0, lit ? 4.4 : 3, 0, 6.28); g.fill();
      }
      g.restore();
      if (this.revealed && this.phase === 'choose') {
        // Odile narrates the tell; the engine shows the word honestly
        const tag = { proud: 'PROUD — feed the ego, then open the hand', anxious: 'ANXIOUS — warmth, and fast', greedy: 'GREEDY — name the number he can’t refuse', hostile: 'HOSTILE — do not flinch', smug: 'SMUG — puncture it, gently, in public', pious: 'PIETY — find the crack under the hymn', mournful: 'MOURNFUL — grieve beside him', tired: 'TIRED — offer rest, demand nothing', scared: 'AFRAID — calm, certain, kind', guarded: 'GUARDED — steady pressure' }[this.tone];
        if (tag) ui.dlg.tx.setAttribute('data-tell', tag);
      }

      const lights = [
        { x: tx, y: H * 0.8 - 30, r: 150, core: 0.8 },
        { x: nx, y: ny - 40, r: 190, core: 0.6 },
      ];
      if (bg === 'hall') lights.push({ x: W * 0.12, y: H * 0.4, r: 170, core: 0.7 });
      art.darkness(g, W, H, lights, 0.55);
      for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.55, 0.45, 0.2, this.t);
      art.vignette(g, W, H, 0.8);
      art.grain(g, W, H, this.t, 9);
    },

    exit() { audio.ambience(false); ui.hideDialogue(); },
    advance() { ui.skipTyping(); },
    busy() { return true; },
  };
}
