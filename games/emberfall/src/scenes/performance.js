// THE SHOW. Three acts, one crowd, no second chances until the encore.
//   tap act    — Bram juggling: hit D F J as the orb crosses the line
//   hold act   — Odile's aria: press and sustain through the long notes
//   pattern act— Fenn's illusions: Cinder flashes a phrase, you answer it
// Applause is the health bar. Hecklers, mishaps, and Choir processions interrupt —
// everything you do under the lights is also part of the show.

import * as art from '../art.js';
import { ui } from '../ui.js';
import { runBeats } from '../beats.js';
import * as audio from '../audio.js';
import { rng, clamp, TAU } from '../util.js';

const LANE_KEYS = { d: 0, f: 1, j: 2, arrowleft: 0, arrowdown: 1, arrowright: 2, ' ': 1 };
const LANE_C = ['255,178,96', '255,140,150', '140,220,205'];

export function makePerformance(G) {
  return {
    kind: 'performance',
    show: null, t: 0, actI: 0, notes: [], mood: 40, streak: 0,
    state: 'act-intro', stateT: 0, keys: {}, actT: 0, judged: 0, total: 0,
    burst: [], pattern: null, eventUsed: {}, R: null, paused: false,
    holdState: {}, promise: null,

    enter(step) {
      this.show = step.show;
      const sh = this.show;
      ui.setChapter(G.chName(), `${sh.name} · ${sh.place}`);
      ui.showLanes(true);
      this.t = 0; this.actI = -1; this.mood = sh.mood0 ?? 40; this.streak = 0;
      this.eventUsed = {}; this.burst = []; this.paused = false;
      this.R = rng(sh.acts.length * 7919 + Math.floor(G.st.oil) * 31 + G.st.shows * 7 + 17);
      this.promise = this.run();
    },

    genAct(act) {
      const beat = 60 / act.bpm;
      const notes = [];
      const total = act.bars * 4;
      const R = this.R;
      if (act.kind === 'pattern') return { kind: 'pattern', beat, total, calls: [], notes: [] };
      for (let b2 = 0; b2 < total; b2++) {
        const t = 2 + b2 * beat;
        if (b2 % 4 === 0 && R() < 0.35) continue; // let the downbeat breathe
        if (R() < (act.density ?? 0.5)) {
          const lane = Math.floor(R() * 3);
          if (act.kind === 'hold' && R() < 0.75) {
            const len = (1.6 + R() * 1.6) * beat;
            notes.push({ t, lane, hold: len });
            b2 += Math.max(2, Math.round(len / beat));
          } else {
            notes.push({ t, lane, hold: 0 });
          }
        }
      }
      return { kind: act.kind, beat, total, notes, intro: act.intro };
    },

    async run() {
      const sh = this.show;
      await new Promise((r) => setTimeout(r, ui.fast ? 5 : 400));
      for (let i = 0; i < sh.acts.length; i++) {
        this.actI = i;
        const act = this.genAct(sh.acts[i]);
        this.act = act;
        this.notes = act.notes;
        this.judged = 0; this.total = this.notes.length || 6;
        this.actT = 0; this.holdState = {}; this.pattern = null;
        if (act.kind === 'pattern') this.setupPattern(act);
        this.state = 'act-intro'; this.stateT = 0;
        ui.say('ACT ' + (i + 1) + ' / ' + sh.acts.length, sh.acts[i].intro);
        await new Promise((r) => setTimeout(r, ui.fast ? 5 : Math.min(4200, 1600 + (sh.acts[i].intro || '').length * 12)));
        ui.hideDialogue();
        this.state = 'count'; this.stateT = 0;
        await new Promise((r) => setTimeout(r, ui.fast ? 5 : 1800));
        this.state = 'play';
        await new Promise((res) => { this.actResolve = res; });
      }
      await this.finale();
    },

    setupPattern(act) {
      const calls = [];
      const R = this.R;
      const count = Math.max(2, Math.floor(act.total / 8));
      for (let c = 0; c < count; c++) {
        const seq = [];
        const n = 3 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) seq.push(Math.floor(R() * 3));
        calls.push({ seq, idx: 0, fails: 0, t: 1.5 + c * (n * 0.55 + 3.2), phase: 'idle', flashT: 0, inputIdx: 0 });
      }
      this.pattern = { calls, done: 0 };
    },

    // ------------------------------------------------------------------ update
    update(dt) {
      this.t += dt;
      if (this.paused) return;
      this.stateT += dt;

      if (this.state === 'count') {
        if (!this._lastCount) { audio.tick(true); this._lastCount = 0; }
        const n = Math.floor(this.stateT / 0.45);
        if (n !== this._lastCount) { this._lastCount = n; if (n < 4) audio.tick(true); }
        return;
      }
      if (this.state !== 'play') return;

      if (this.act.kind === 'pattern') this.updatePattern(dt);
      else this.updateChart(dt);

      // scheduled interruptions
      for (const ev of this.show.events || []) {
        if (this.eventUsed[ev.title]) continue;
        if (this.actI === ev.atAct && this.barNow() >= (ev.atBar ?? 0)) {
          this.eventUsed[ev.title] = true;
          this.fireEvent(ev);
          break;
        }
      }

      // act end
      if (this.act.kind === 'pattern') {
        if (this.pattern.done >= this.pattern.calls.length) this.endAct();
      } else if (this.actT > this.act.total * this.act.beat + 2.6) this.endAct();
      else {
        // auto-miss passed taps
        for (const n of this.notes) {
          if (n.hit || n.missed || n.pendingHold) continue;
          if (this.actT - n.t > (n.hold ? 0.35 : 0.24)) { n.missed = true; this.judge(n, 'miss'); }
        }
      }
      G.markHud();
    },

    barNow() { return Math.floor(this.actT / (this.act.beat * 4)); },

    updateChart(dt) {
      this.actT += dt;
      const beat = this.act.beat;
      const idx = Math.floor(this.actT / beat);
      if (idx !== this._tick) { this._tick = idx; audio.tick(idx % 4 === 0); }
      // hold release check
      for (const n of this.notes) {
        if (n.holding) {
          const endT = n.t + n.hold;
          if (!this.keysLane(n.lane)) {
            // released — grade by coverage
            const held = clamp((this.actT - n.t) / n.hold, 0, 1);
            n.holding = false; n.hit = true; this.judged++;
            this.scoreNote(held > 0.82 ? 'perfect' : held > 0.5 ? 'great' : 'ok', held);
          } else if (this.actT > endT + 0.3) {
            n.holding = false; n.hit = true; this.judged++;
            this.scoreNote('perfect', 1);
          }
        }
      }
    },

    updatePattern(dt) {
      this.actT += dt;
      const p = this.pattern;
      const call = p.calls.find((c) => c.phase !== 'done');
      if (!call) return;
      if (this.actT < call.t) return;
      if (call.phase === 'idle') { call.phase = 'show'; call.flashT = 0; call.idx = 0; }
      if (call.phase === 'show') {
        call.flashT += dt;
        const step = 0.5;
        const n = Math.floor(call.flashT / step);
        if (n !== call._shown) {
          call._shown = n;
          if (n < call.seq.length) { this.flashLane(call.seq[n], 1); audio.judgment('ok'); }
          else { call.phase = 'input'; call.inputIdx = 0; call.window = step * call.seq.length + 1.4; }
        }
        return;
      }
      if (call.phase === 'input') {
        call.window -= dt;
        if (call.window <= 0) {
          call.fails++;
          this.mood = clamp(this.mood - 2.4, 0, 100);
          if (call.fails >= 2) { call.phase = 'done'; p.done++; this.scoreNote('miss'); }
          else { call.phase = 'show'; call.flashT = 0; call._shown = -1; ui.toast('Cinder replays the trick. Slower. Judgier.', 'cold'); }
        }
      }
    },

    fireEvent(ev) {
      this.paused = true;
      const opts = (ev.choices || []).map((c) => ({ label: c.label, note: c.note, cost: null, req: c.req ? !!c.req(G.st) : true }));
      ui.promptCard({
        kicker: 'MID-SHOW', title: ev.title, body: ev.body, choices: opts, timer: ev.timer,
        onPick: (i) => {
          const c = ev.choices[i];
          if (c.set) {
            if (c.set.mood) this.mood = clamp(this.mood + c.set.mood, 0, 100);
            const rest = { ...c.set }; delete rest.mood; delete rest.flag;
            if (Object.keys(rest).length) G.applySet(rest);
            if (c.set.flag) G.st.flags[c.set.flag] = true;
          }
          this.paused = false;
          ui.toast(c.note || '…and the show goes on.', 'cold');
        },
      });
      if (ev.timer) ui.setPromptDefault(() => {
        const c = ev.choices[0];
        if (c?.set?.mood) this.mood = clamp(this.mood + c.set.mood, 0, 100);
        this.paused = false;
      });
    },

    keysLane(lane) {
      for (const k of Object.keys(this.keys)) if (LANE_KEYS[k] === lane && this.keys[k]) return true;
      return this.touchLane === lane;
    },

    judge(n, kind) {
      if (kind === 'miss') { n.pendingHold = false; this.judged++; this.scoreNote('miss'); }
    },

    scoreNote(grade, holdRatio = 1) {
      const add = { perfect: 3, great: 2, ok: 0.8, miss: -2.4 }[grade];
      this.streak = grade === 'miss' ? 0 : this.streak + 1;
      const bonus = this.streak >= 8 ? 0.4 : 0;
      this.mood = clamp(this.mood + (grade === 'miss' ? add : add + bonus), 0, 100);
      if (grade === 'miss') { audio.judgment('miss'); ui.judgment('OFF', true); }
      else {
        audio.judgment(grade);
        ui.judgment(grade === 'perfect' ? 'PERFECT' : grade === 'great' ? 'GREAT' : 'OK');
        if (this.streak > 0 && this.streak % 12 === 0) ui.toast(`The ${['square', 'hall', 'pit'][Math.floor(this.R() * 3)]} catches fire with applause. ×${this.streak} streak`, 'cold');
      }
    },

    press(lane) {
      if (this.state !== 'play' || this.paused) return;
      ui.laneHit(lane);
      if (this.act.kind === 'pattern') {
        const call = this.pattern.calls.find((c) => c.phase === 'input');
        if (call) {
          const want = call.seq[call.inputIdx];
          this.flashLane(lane, 0.7);
          if (lane === want) {
            call.inputIdx++;
            if (call.inputIdx >= call.seq.length) {
              call.phase = 'done'; this.pattern.done++;
              for (let i = 0; i < call.seq.length; i++) this.scoreNote('perfect');
            } else audio.tick(false);
          } else {
            call.fails++;
            call.phase = call.fails >= 2 ? 'done' : 'show';
            if (call.phase === 'done') { this.pattern.done++; this.scoreNote('miss'); }
            else { call.flashT = 0; call._shown = -1; ui.toast('Wrong shape. The crowd corrects you, unhelpfully.', 'bad'); }
          }
        }
        return;
      }
      // find nearest unjudged note in this lane
      let best = null, bestD = 0.36;
      for (const n of this.notes) {
        if (n.hit || n.missed || n.lane !== lane) continue;
        const d = Math.abs(this.actT - n.t);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (best) {
        const grade = bestD < 0.1 ? 'perfect' : bestD < 0.2 ? 'great' : 'ok';
        if (best.hold) {
          best.hit = true; best.holding = true; best.pendingHold = false;
          this.scoreNote(grade);
        } else {
          best.hit = true; this.judged++;
          this.scoreNote(grade);
        }
        this.burst.push({ lane, t: 0.4 });
        return;
      }
      // whiff: soft penalty only near the line (anti-mash)
      for (const n of this.notes) {
        if (n.hit || n.missed || n.lane !== lane) continue;
        if (Math.abs(this.actT - n.t) < 0.75) { audio.thud(0.4); break; }
      }
    },

    flashLane(lane, a) { this.burst.push({ lane, t: 0.3, flash: a }); },

    endAct() {
      if (this.state === 'done') return;
      this.state = 'done';
      if (this.actResolve) { const r = this.actResolve; this.actResolve = null; r(); }
    },

    // ------------------------------------------------------------------ finale
    async finale() {
      const sh = this.show;
      ui.showLanes(false);
      ui.closePrompt();
      const m = this.mood;
      const win = m >= (sh.target ?? 55);
      const ovation = win && m >= (sh.target ?? 55) + 16;
      G.st.shows++;
      if (win) {
        if (ovation) G.st.ovations++;
        G.applySet({ oil: 10 + (ovation ? 6 : 0), silver: 8 + (ovation ? 5 : 0), rep: ovation ? 3 : 1, morale: ovation ? 7 : 4 });
        if (ovation) G.st.flags['ovation_' + (sh.name || '').slice(0, 6)] = true;
        audio.fanfare();
        ui.toast(ovation ? 'STANDING OVATION — the hat overflows with spendable applause.' : 'The show pays. Barely. Exactly as budgeted.', 'cold');
      } else {
        G.applySet({ morale: -6, silver: 2 });
        audio.doom();
        ui.toast('It did not land. Somebody in Ashvale will quote this night for years.', 'bad');
      }
      G.addLog(`${sh.name}: ${Math.round(m)}% applause (${win ? 'the room was yours' : 'the room was rented'}).`);
      await runBeats(win ? sh.outroWin || [] : sh.outroFlop || [], { state: G.st, apply: (s) => G.applySet(s), g: G });
      ui.hideDialogue();
      G.markHud();
      G.advance();
    },

    // ------------------------------------------------------------------ input
    key(ev, down) {
      const k = ev.key.toLowerCase();
      if (ev.code === 'Space') ev.preventDefault();
      if (down && LANE_KEYS[k] !== undefined && this.state === 'play' && !this.paused) this.press(LANE_KEYS[k]);
      this.keys[k] = down;
      if (ui.hasPromptOpen() && down && /^[1-9]$/.test(k)) ui.pickPrompt(+k - 1);
    },
    touch(lane, down) {
      this.touchLane = down ? lane : -1;
      if (down) this.press(lane);
    },

    // ------------------------------------------------------------------ draw
    draw(g, W, H) {
      const sh = this.show;
      const onRoad = !!sh.onRoad;
      g.__baseA1 = 1;
      art.backdrop(g, W, H, onRoad ? 'gloom' : 'stage', this.t, { floorY: H * 0.78, foot: !onRoad, seed: 4 });
      const stageY = onRoad ? H * 0.86 : H * 0.76;

      // actors per act
      const actKind = this.act?.kind;
      art.figure(g, W * 0.16, stageY, 0.9, { who: 'vera', pose: 'prompt', phase: this.t * 1.2, rim: 'rgba(190,210,250,0.5)', holdsLamp: 1 });
      const perf = (i, who, pose) => art.figure(g, W * (0.4 + i * 0.2), stageY, 1.05, { who, pose: actKind ? pose : 'idle', phase: this.t * (2 + i), rim: `rgba(${LANE_C[i]},0.45)` });
      perf(0, 'bram', 'juggle'); perf(1, 'dill', 'sing'); perf(2, 'fenn', 'puppet');
      if (!onRoad) art.cinderMoth(g, W * 0.8 + Math.sin(this.t) * 20, stageY - 120 + Math.sin(this.t * 1.7) * 10, this.t, 1.1, this.act?.kind === 'pattern' ? 1 : 0.6);

      // crowd
      const moodN = clamp(this.mood / 100, 0, 1);
      if (!onRoad) {
        art.crowdHeadsSilhouette(g, W, H * 0.93, 61, this.t, moodN, { n: 46 });
      } else {
        // the swarm, watching. judging. keeping time.
        for (let i = 0; i < 9; i++) {
          art.mothling(g, W * (0.08 + (i * 0.101) % 0.9), H * (0.3 + ((i * 0.037) % 0.25)), this.t * (0.9 + i * 0.1), { seed: i * 3 + 2, s: 0.7 + (i % 3) * 0.15, aggro: 0.2 + moodN * 0.3 });
        }
      }

      // lanes & notes
      if (this.state === 'play' || this.state === 'count') {
        const judgeY = H * 0.66;
        const lw = 86, gap = 22;
        const x0 = W / 2 - (lw * 1.5 + gap);
        g.save();
        for (let i = 0; i < 3; i++) {
          const x = x0 + i * (lw + gap);
          g.fillStyle = 'rgba(6,7,16,0.55)';
          g.beginPath(); g.rect(x, 0, lw, judgeY + 26); g.fill();
          g.strokeStyle = `rgba(${LANE_C[i]},0.25)`; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x, judgeY + 26); g.moveTo(x + lw, 0); g.lineTo(x + lw, judgeY + 26); g.stroke();
          // judgment plate
          const hot = this.keysLane(i);
          g.fillStyle = `rgba(${LANE_C[i]},${hot ? 0.5 : 0.16})`;
          g.beginPath(); g.arc(x + lw / 2, judgeY, hot ? 26 : 20, 0, TAU); g.fill();
        }
        // notes
        const speed = 300;
        if (this.act && this.act.notes) {
          for (const n of this.notes) {
            if (n.hit && !n.holding) continue;
            const dtN = n.t - this.actT;
            if (dtN > (judgeY + 80) / speed || n.missed) continue;
            const x = x0 + n.lane * (lw + gap) + lw / 2;
            const y = judgeY - dtN * speed;
            if (n.hold) {
              const h = n.hold * speed;
              g.fillStyle = `rgba(${LANE_C[n.lane]},0.3)`;
              g.beginPath(); g.rect(x - 14, y - h, 28, h); g.fill();
              g.fillStyle = `rgba(${LANE_C[n.lane]},0.85)`;
              g.beginPath(); g.arc(x, y - h, 12, 0, TAU); g.fill();
            }
            g.save();
            g.globalCompositeOperation = 'lighter';
            g.fillStyle = `rgba(${LANE_C[n.lane]},0.4)`;
            g.beginPath(); g.arc(x, n.hold ? y : y, 17, 0, TAU); g.fill();
            g.restore();
            g.fillStyle = `rgba(255,240,210,0.95)`;
            g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill();
            g.fillStyle = `rgba(${LANE_C[n.lane]},0.9)`;
            g.beginPath(); g.arc(x, y, 6.2, 0, TAU); g.fill();
          }
        }
        // hit bursts
        for (let i = this.burst.length - 1; i >= 0; i--) {
          const bu = this.burst[i];
          bu.t -= 0.016;
          if (bu.t <= 0) { this.burst.splice(i, 1); continue; }
          const x = x0 + bu.lane * (lw + gap) + lw / 2;
          const a = bu.flash ? bu.flash : bu.t;
          g.save(); g.globalCompositeOperation = 'lighter';
          g.strokeStyle = `rgba(${LANE_C[bu.lane]},${a})`; g.lineWidth = 2.5;
          g.beginPath(); g.arc(x, judgeY, 14 + (0.4 - bu.t) * 90, 0, TAU); g.stroke();
          g.restore();
        }
        // countdown flames
        if (this.state === 'count') {
          const n = clamp(this.stateT / 1.8, 0, 1);
          g.save(); g.globalCompositeOperation = 'lighter';
          g.fillStyle = `rgba(255,190,110,${0.8 * (1 - n)})`;
          g.beginPath(); g.arc(W / 2, judgeY - 40, 12 + n * 260, 0, TAU); g.fill();
          g.restore();
        }
        g.restore();

        // the applause flame-row, upper right — mood, painted not numeric
        g.save();
        const fx = W - 40, fy = 54;
        for (let i = 0; i < 10; i++) {
          const on = this.mood >= (i + 1) * 10 - 3;
          const xx = fx - i * 16;
          if (on) {
            g.save(); g.globalCompositeOperation = 'lighter';
            g.fillStyle = 'rgba(255,180,90,0.5)';
            g.beginPath(); g.arc(xx, fy, 7, 0, TAU); g.fill();
            g.restore();
            g.fillStyle = 'rgba(255,220,150,0.95)';
          } else g.fillStyle = 'rgba(50,54,80,0.6)';
          g.beginPath();
          const fl = on ? Math.sin(this.t * 9 + i) * 1.6 : 0;
          g.moveTo(xx, fy + 4);
          g.quadraticCurveTo(xx - 3.4, fy - 3, xx + fl * 0.4, fy - 9 - fl);
          g.quadraticCurveTo(xx + 3.4, fy - 3, xx, fy + 4);
          g.fill();
        }
        g.restore();
      }

      const lights = [
        { x: W * 0.4, y: stageY - 70, r: 260 + this.mood * 1.6, core: 0.75 },
        { x: W * 0.6, y: stageY - 70, r: 240 + this.mood * 1.6, core: 0.75 },
      ];
      if (!onRoad) lights.push({ x: W * 0.5, y: H * 0.99, r: 300, core: 0.6 });
      else lights.push({ x: W * 0.16, y: stageY - 40, r: 210, core: 0.8 });
      art.darkness(g, W, H, lights, onRoad ? 0.72 : 0.34);
      art.vignette(g, W, H, onRoad ? 1 : 0.75);
      art.grain(g, W, H, this.t, 3);
    },

    exit() {
      ui.showLanes(false);
      ui.closePrompt();
      ui.hideDialogue();
      this.state = 'exited';
      if (this.actResolve) { const r = this.actResolve; this.actResolve = null; r(); }
    },
    advance() { ui.skipTyping(); },
    busy() { return true; },
  };
}
