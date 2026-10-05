/* AFTERGLOW — Stage: the small, hand-painted dioramas you walk through between
   set-pieces. Interaction points glow; the troupe trails behind you like ducklings. */

import { clamp, lerp, damp, TAU, check } from './util.js';
import { PAL, makeBackdrop, drawBackdrop, drawWind, makeFlakes, stepFlakes, drawFlakes, drawFlame, makeEmbers, spawnEmber, stepEmbers, drawEmbers, advanceFlicker, renderLighting, applyWarmGlow } from './paint.js';
import { CAST, drawActor, drawPortrait, drawLantern } from './actors.js';
import { SFX } from './audio.js';
import { roundRect, drawDialogue as uiDrawDialogue } from './ui.js';

export class Stage {
  constructor(app, def) {
    this.app = app;
    this.def = def;
    this.W = app.W; this.H = app.H;
    this.worldW = def.worldW || 1600;
    this.groundY = (def.groundY != null ? def.groundY : Math.round(app.H * 0.78));
    this.bd = makeBackdrop(app.mkCanvas, def, this.worldW, this.W, this.H);
    this.fl = makeFlakes(this.W, this.H, def.flakes ?? 90);
    this.embers = makeEmbers();
    this.camX = 0;
    this.t = 0;
    this.wind = def.wind || 0;
    const sx = def.spawn?.x != null ? def.spawn.x : 120;
    this.player = { x: sx, y: this.groundY, vx: 0, dir: 1, phase: 0, state: 'idle', lanternLit: true };
    // the troupe train
    this.follow = (def.follow || ['bod', 'nadia', 'tomas']).filter(k => !def.noFollowAll).map((k, i) => ({ key: k, x: sx - 42 - i * 36, y: this.groundY, dir: 1, phase: i * 1.3, bob: Math.random() * 6 }));
    if (app.G.pell && def.pell !== false) this.follow.push({ key: 'pell', x: sx - 42 - this.follow.length * 36, y: this.groundY, dir: 1, phase: 2.2, bob: 3 });
    this.npcs = (def.npcs || []).map(n => ({ ...n, phase: Math.random() * 6 }));
    this.done = false;
    this.prompt = null;
    this.lockMove = !!def.locked;
    this.fx = def.fx || {};
  }

  lights(t) {
    const L = [];
    const d = this.def;
    // the troupe lantern rides with the player
    if (this.player.lanternLit) {
      const px = this.player.x - this.camX, py = this.groundY - 30;
      const oilF = 0.45 + 0.55 * clamp(this.app.G.oil / 100, 0, 1);
      L.push({ x: px, y: py, r: 170 * oilF, inten: 0.95 * oilF, flick: 1 });
    }
    for (const f of (d.lights || [])) {
      const x = f.x - this.camX;
      if (x < -300 || x > this.W + 300) continue;
      const lit = f.if ? check(f.if, this.app.G) : true;
      if (!lit) continue;
      L.push({ x, y: f.y ?? this.groundY - 26, r: (f.r || 130) * (f.mul || 1), inten: f.inten ?? 1, flick: 1, warm: f.warm ?? '255,178,96' });
    }
    return L;
  }

  update(dt, inp) {
    this.t += dt;
    advanceFlicker(dt);
    stepFlakes(this.fl, dt, this.t, this.wind);
    stepEmbers(this.embers, dt, this.t);
    if (Math.random() < dt * 3) for (const f of (this.def.lights || [])) if (f.embers !== false && Math.abs(f.x - this.player.x) < 900) spawnEmber(this.embers, f.x, (f.y ?? this.groundY - 26) - 6);

    if (this.locked || this.app.overlay) { this.player.state = 'idle'; return; }
    const left = inp.down('left'), right = inp.down('right');
    const sp = (this.def.speed || 132) * (inp.down('roll') ? 1.55 : 1);
    let v = (right ? 1 : 0) - (left ? 1 : 0);
    if (v) {
      this.player.dir = v;
      this.player.state = 'walk';
      if (Math.random() < dt * (inp.down('roll') ? 9 : 6)) SFX.step();
    } else this.player.state = 'idle';
    this.player.vx = lerp(this.player.vx, v * sp, 1 - Math.exp(-12 * dt));
    this.player.x = clamp(this.player.x + this.player.vx * dt, 24, this.worldW - 24);
    this.player.phase += dt * Math.abs(this.player.vx) * 0.075;

    // follow train
    let prev = this.player.x - this.player.dir * 30;
    for (const f of this.follow) {
      const target = prev - this.player.dir * 6;
      f.x = damp(f.x, target, 5.5, dt);
      f.dir = this.player.dir;
      if (Math.abs(target - f.x) > 4) f.state = 'walk'; else f.state = 'idle';
      f.phase += dt * Math.abs(target - f.x) * 0.09;
      prev = f.x - this.player.dir * 38;
    }
    for (const n of this.npcs) {
      if (n.patrol) {
        n.x += (n.dir || 1) * (n.speed || 26) * dt;
        if (n.x > n.patrol[1]) n.dir = -1;
        if (n.x < n.patrol[0]) n.dir = 1;
      }
    }

    // interaction points
    this.prompt = null;
    const pts = (this.def.points || []).filter(p => !p.if || check(p.if, this.app.G));
    for (const p of pts) {
      if (Math.abs(p.x - this.player.x) < 34) {
        this.prompt = p;
        break;
      }
    }
    if (this.prompt && inp.consume('use')) this.trigger(this.prompt);
    if (this.app.autofire && this.prompt) this.trigger(this.prompt);
  }

  trigger(p) {
    if (p._used && p.once) return;
    p._used = true;
    if (p.sfx) SFX[p.sfx] && SFX[p.sfx]();
    if (p.fx) this.app.G.emitTrustFX(this.app.G.applyFX(p.fx));
    if (p.run) {
      this.app.flow.play(p.run, () => {
        if (p.exit) this.finish();
        else this.prompt = null;
      });
    } else if (p.exit) this.finish();
  }
  finish() {
    if (this.done) return;
    this.done = true;
    this.app.closeScene();
  }

  draw(g, t) {
    const { W, H } = this;
    const targetCam = clamp(this.player.x - W / 2, 0, Math.max(0, this.worldW - W));
    this.camX = damp(this.camX, targetCam, 8, this.app.dt || 0.016);
    g.save();
    drawBackdrop(g, this.bd, this.camX, t, W, H);
    g.restore();

    // flames baked in scene (drawn with wobble)
    for (const f of (this.def.lights || [])) {
      if (f.flame === false) continue;
      if (f.if && !check(f.if, this.app.G)) continue;
      const x = f.x - this.camX, y = f.y ?? this.groundY - 20;
      if (x > -80 && x < W + 80) drawFlame(g, x, y, f.size || 4, t, f.x);
    }
    // scene decor overlays drawn live (banners sway etc.)
    if (this.def.live) this.def.live(g, this, t, this.camX);

    // npcs
    for (const n of this.npcs) {
      if (!n.if || check(n.if, this.app.G)) {
        const c = CAST[n.char] || CAST.crowd;
        drawActor(g, c, n.x - this.camX, (n.y != null ? n.y : this.groundY), t + (n.phase || 0), {
          dir: n.dir || 1, state: n.state || 'idle', scale: n.scale || 1, hold: n.hold, litAmount: this.lightAt(n.x),
        });
      }
    }
    // follow train, then player
    for (let i = this.follow.length - 1; i >= 0; i--) {
      const f = this.follow[i];
      const c = CAST[f.key];
      drawActor(g, c, f.x - this.camX, this.groundY, t + f.bob, { dir: f.dir, state: f.state, phase: f.phase, hold: f.key === 'nadia' ? null : null, litAmount: this.lightAt(f.x) });
    }
    const pc = CAST[this.app.G.playerChar || 'miri'];
    drawActor(g, pc, this.player.x - this.camX, this.groundY, t, {
      dir: this.player.dir, state: this.player.state, phase: this.player.phase,
      hold: 'lantern', litAmount: this.lightAt(this.player.x),
    });

    // interaction markers
    const pts = (this.def.points || []).filter(p => !p.if || check(p.if, this.app.G));
    for (const p of pts) {
      if (p.once && p._used) continue;
      const x = p.x - this.camX;
      if (x < -40 || x > W + 40) continue;
      const near = Math.abs(p.x - this.player.x) < 34;
      const y = (p.y ?? this.groundY) - 46 + Math.sin(t * 3 + p.x) * 2.5;
      g.save();
      g.globalAlpha = near ? 0.95 : 0.5 + Math.sin(t * 2 + p.x) * 0.12;
      g.fillStyle = p.icon === 'note' ? '#9fd0ff' : PAL.ember;
      g.font = '15px "Spectral", Georgia, serif';
      g.textAlign = 'center';
      g.fillText(p.icon === 'note' ? '♪' : p.icon === 'exit' ? '➤' : '✦', x, y - 6);
      if (p.label && near) {
        g.font = '12.5px "Spectral", Georgia, serif';
        g.fillStyle = 'rgba(235,238,246,0.95)';
        g.fillText(p.label, x, y + 12);
      }
      g.restore();
    }
    // prompt chip
    if (this.prompt && !this.app.overlay) {
      const p = this.prompt;
      g.save();
      g.textAlign = 'center';
      g.font = '12.5px "Spectral", Georgia, serif';
      const txt = `[E] ${p.label || 'look'}`;
      const w = g.measureText(txt).width + 22;
      const x = clamp(p.x - this.camX, W / 2 - 240, W / 2 + 240);
      g.fillStyle = 'rgba(8,10,16,0.8)';
      roundRect(g, x - w / 2, this.groundY - 132, w, 24, 12); g.fill();
      g.strokeStyle = 'rgba(232,182,76,0.6)'; roundRect(g, x - w / 2, this.groundY - 132, w, 24, 12); g.stroke();
      g.fillStyle = '#f0e6cf';
      g.fillText(txt, x, this.groundY - 115);
      g.restore();
    }

    // flakes behind the darkness
    drawFlakes(g, this.fl, this.camX);
    // darkness mask
    const dark = this.def.dark ?? 0.35;
    if (dark > 0.02) {
      const L = this.lights(t);
      renderLighting(this.app.light, L, dark, this.def.darkTint || '#04060d');
      g.save();
      g.drawImage(this.app.light.canvas, 0, 0);
      g.restore();
      applyWarmGlow(g, L, 1);
    }
    drawEmbers(g, this.embers, this.camX);
    if (this.wind > 0) drawWind(g, W, H, t, this.wind * 0.5);
  }

  lightAt(worldX) {
    // rim light strength from player's lantern + static lights (cheap estimate)
    let v = 0.12;
    if (this.player.lanternLit) v += Math.max(0, 1 - Math.abs(worldX - this.player.x) / 190) * 0.8 * clamp(this.app.G.oil / 60, 0.15, 1);
    for (const f of (this.def.lights || [])) {
      if (f.if && !check(f.if, this.app.G)) continue;
      v += Math.max(0, 1 - Math.abs(worldX - f.x) / (f.r || 130)) * 0.7;
    }
    return clamp(v, 0, 1.4);
  }
}
