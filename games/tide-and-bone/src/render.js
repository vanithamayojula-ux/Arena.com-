/* TIDE & BONE — the painter. Canvas 2D: wet organic tiles that pulse,
   bone-white figures rimmed by lantern light, and the red-veined terror of
   WRATHFUL mode. Reads engine state; writes zero state of its own. */

import { T, WALK, HARVEST, moodOf } from './engine.js';

const C = {
  abyss: '#0a0a12',
  rock: '#141824', rock2: '#1c2230',
  wall: '#0d1018', wallTop: '#232a3a',
  flesh: '#8b2e3c', fleshDeep: '#5c1d29', fleshLite: '#b8506a',
  floor: '#2a1622', floor2: '#3a2233',
  bone: '#e8eaf0',
  vent: '#05060c',
  glow: '#4da3ff', glowDim: '#1c3f66',
  danger: '#ff0033',
  gold: '#e8b64c',
  mite: '#a33b4d', spitter: '#3fb6a8', reaver: '#8f93a8',
};

export function makeRenderer(canvas, state0) {
  const ctx = canvas.getContext('2d');
  let t = 0, shakeMag = 0, flash = 0, flashColor = C.glow;
  let floats = []; // {x,y,text,t0,color}
  let blasts = []; // {x,y,t0}
  let tracers = [];

  function size() { return canvas.width; } // CSS size handled by layout; canvas px = logical*dpr in main

  function consumeEvents(events) {
    for (const e of events) {
      if (e.t === 'shake') shakeMag = Math.max(shakeMag, e.mag);
      else if (e.t === 'float') floats.push({ x: e.x, y: e.y, text: e.text, t0: t, color: C.gold });
      else if (e.t === 'blast') blasts.push({ x: e.x, y: e.y, t0: t });
      else if (e.t === 'tracer') tracers.push({ x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, t0: t });
      else if (e.t === 'hitfx') { shakeMag = Math.max(shakeMag, 2.2); floats.push({ x: e.x, y: e.y, text: `-${e.n}`, t0: t, color: C.bone }); }
      else if (e.t === 'hurt') { flash = 1; flashColor = C.danger; }
      else if (e.t === 'heal') { flash = 0.6; flashColor = C.glow; }
      else if (e.t === 'slide') { flash = 1; flashColor = e.kind === 'death' ? C.danger : C.glow; shakeMag = Math.max(shakeMag, e.kind === 'gale' ? 14 : 5); }
      else if (e.t === 'extract') { flash = 1; flashColor = C.gold; }
    }
  }

  function draw(state, dt) {
    t += dt;
    const W = size(), H = canvas.height;
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // shake
    if (shakeMag > 0.15) {
      g.translate((Math.sin(t * 61) * shakeMag), (Math.cos(t * 53) * shakeMag * 0.8));
      shakeMag *= Math.pow(0.0012, dt); // fast decay
    }
    g.fillStyle = C.abyss;
    g.fillRect(-20, -20, W + 40, H + 40);
    drawAbyss(g, W, H);

    const m = state.map;
    const ts = Math.floor(Math.min((W - 16) / m.w, (H - 16) / m.h));
    const ox = Math.floor((W - ts * m.w) / 2), oy = Math.floor((H - ts * m.h) / 2);
    const mood = moodOf(state);

    // tiles
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x, tile = m.tiles[i];
      const px = ox + x * ts, py = oy + y * ts;
      drawTile(g, m, tile, i, x, y, px, py, ts, mood, state.zone === 'shell');
    }
    // closed-walls (wrath pulse) on top of their tile
    if (m.closed.size) for (const i of m.closed) {
      const x = i % m.w, y = (i / m.w) | 0;
      const px = ox + x * ts, py = oy + y * ts;
      const p = 0.5 + 0.5 * Math.sin(t * 5 + i);
      g.fillStyle = `rgba(139,46,60,${0.55 + 0.3 * p})`;
      roundRect(g, px + 2, py + 2, ts - 4, ts - 4, 6); g.fill();
      g.strokeStyle = `rgba(255,0,51,${0.35 + 0.4 * p})`; g.lineWidth = 2; g.stroke();
      vein(g, px + ts / 2, py + ts / 2, ts * 0.34, t + i, C.danger, 0.5);
    }
    // corpses
    for (const c of state.corpses) {
      if (c.zone !== state.zone) continue;
      const px = ox + c.x * ts, py = oy + c.y * ts;
      g.fillStyle = 'rgba(232,234,240,0.24)';
      g.beginPath(); g.ellipse(px + ts / 2, py + ts * 0.66, ts * 0.3, ts * 0.16, 0, 0, 7); g.fill();
      g.fillStyle = C.bone;
      for (let k = 0; k < 3; k++) { g.fillRect(px + ts * (0.3 + k * 0.16), py + ts * 0.56 - (k % 2) * 3, 3, 3); }
    }
    // enemies
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      drawEnemy(g, e, ox + e.x * ts, oy + e.y * ts, ts);
    }
    // player (with a little lantern world-light)
    const p = state.player;
    lantern(g, ox + p.x * ts + ts / 2, oy + p.y * ts + ts / 2, ts * 2.6);
    drawPlayer(g, p, ox + p.x * ts, oy + p.y * ts, ts);

    // fx layers
    for (const fl of floats) drawFloat(g, fl, ox, oy, ts);
    for (const b of blasts) drawBlast(g, b, ox, oy, ts);
    for (const tr of tracers) drawTracer(g, tr, ox, oy, ts);
    floats = floats.filter(f => t - f.t0 < 1.1);
    blasts = blasts.filter(b => t - b.t0 < 0.5);
    tracers = tracers.filter(b => t - b.t0 < 0.28);

    // wrath vignette
    if (mood === 'WRATHFUL') {
      const pul = 0.28 + 0.1 * Math.sin(t * 6);
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
      vg.addColorStop(0, 'rgba(255,0,51,0)'); vg.addColorStop(1, `rgba(255,0,51,${pul})`);
      g.fillStyle = vg; g.fillRect(-20, -20, W + 40, H + 40);
    } else if (mood === 'AGITATED') {
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(255,0,51,0)'); vg.addColorStop(1, 'rgba(160,20,50,0.12)');
      g.fillStyle = vg; g.fillRect(-20, -20, W + 40, H + 40);
    }
    // action flash
    if (flash > 0.02) {
      g.fillStyle = flashColor; g.globalAlpha = flash * 0.16;
      g.fillRect(-20, -20, W + 40, H + 40);
      g.globalAlpha = 1;
      flash *= Math.pow(0.0001, dt);
    }
    return { ts, ox, oy }; // main uses for click mapping
  }

  function drawAbyss(g, W, H) {
    // drifting spores / dimension motes
    for (let i = 0; i < 26; i++) {
      const sx = ((i * 173 + Math.sin(t * 0.3 + i) * 20 + t * 6) % (W + 40)) - 20;
      const sy = ((i * 97 + t * (8 + (i % 5) * 3)) % (H + 40)) - 20;
      g.fillStyle = i % 4 === 0 ? 'rgba(77,163,255,0.16)' : 'rgba(139,46,60,0.14)';
      g.fillRect(sx, sy, 2, 2);
    }
  }

  function drawTile(g, m, tile, i, x, y, px, py, ts, mood, isShell) {
    const seed = m.decor[i];
    const wet = (seed & 1) ? 0.5 : 0.9;
    if (tile === T.ABYSS) {
      g.fillStyle = 'rgba(6,8,16,0.9)';
      roundRect(g, px + 1, py + 1, ts - 2, ts - 2, 5); g.fill();
      return;
    }
    if (tile === T.WALL || tile === T.SPUR) {
      const base = isShell ? C.wall : '#3d1220';
      g.fillStyle = base;
      roundRect(g, px + 1, py + 1, ts - 2, ts - 2, 7); g.fill();
      g.fillStyle = isShell ? C.wallTop : '#54202f';
      roundRect(g, px + 3, py + 3 + (tile === T.SPUR ? -3 : 0), ts - 6, ts * 0.42, 6); g.fill();
      if (!isShell) vein(g, px + ts / 2, py + ts * 0.7, ts * 0.3, t * 0.6 + seed, C.fleshLite, 0.25);
      if (tile === T.SPUR) { g.fillStyle = 'rgba(232,234,240,0.75)'; spike(g, px + ts / 2, py + ts * 0.55, ts * 0.28); }
      return;
    }
    // floors: rock (shell) or meat (organ)
    const pul = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.7);
    let base = isShell ? (seed % 2 ? C.rock : C.rock2) : C.floor;
    if (tile === T.FLESH) base = mood === 'WRATHFUL' ? '#7e2130' : C.flesh;
    if (tile === T.POOL) base = '#12303a';
    if (tile === T.VENT) base = C.vent;
    g.fillStyle = base;
    roundRect(g, px + 1, py + 1, ts - 2, ts - 2, 5); g.fill();
    // wet gloss streak
    g.fillStyle = `rgba(232,234,240,${0.03 + 0.05 * wet * (0.5 + 0.5 * Math.sin(t * 1.3 + seed * 3))})`;
    g.beginPath(); g.ellipse(px + ts * 0.34, py + ts * 0.3, ts * 0.22, ts * 0.07, -0.6, 0, 7); g.fill();

    if (tile === T.FLESH) {
      // breathing bumps + harvestable shimmer
      g.fillStyle = `rgba(184,80,106,${0.22 + 0.18 * pul})`;
      g.beginPath(); g.arc(px + ts * 0.62, py + ts * 0.55, ts * (0.14 + 0.02 * pul), 0, 7); g.fill();
      g.beginPath(); g.arc(px + ts * 0.3, py + ts * 0.68, ts * (0.1 + 0.02 * pul), 0, 7); g.fill();
      g.strokeStyle = `rgba(255,0,51,${mood === 'WRATHFUL' ? 0.5 + 0.3 * pul : 0.12})`;
      g.lineWidth = mood === 'WRATHFUL' ? 2 : 1;
      roundRect(g, px + 2, py + 2, ts - 4, ts - 4, 4); g.stroke();
      if (mood === 'WRATHFUL' && pul > 0.8) vein(g, px + ts / 2, py + ts / 2, ts * 0.3, t, C.danger, 0.6);
    } else if (tile === T.ORE) {
      g.fillStyle = `rgba(232,182,76,${0.5 + 0.4 * pul})`;
      crystal(g, px + ts * 0.55, py + ts * 0.5, ts * 0.16);
      g.fillStyle = 'rgba(232,234,240,0.8)';
      crystal(g, px + ts * 0.38, py + ts * 0.62, ts * 0.1);
    } else if (tile === T.VENT) {
      // sphincter swirl
      g.save();
      g.translate(px + ts / 2, py + ts / 2);
      g.rotate(t * 0.8);
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = `rgba(77,163,255,${0.5 - k * 0.14})`;
        g.lineWidth = 2.4 - k * 0.6;
        g.beginPath(); g.arc(0, 0, ts * (0.16 + k * 0.09), k * 2, k * 2 + 4.4); g.stroke();
      }
      g.restore();
      g.fillStyle = `rgba(139,46,60,${0.3 + 0.2 * pul})`;
      g.beginPath(); g.arc(px + ts / 2, py + ts / 2, ts * 0.42, 0, 7); g.stroke();
    } else if (tile === T.EXTRACT) {
      g.fillStyle = 'rgba(10,14,22,0.6)';
      roundRect(g, px + 2, py + 2, ts - 4, ts - 4, 4); g.fill();
      for (let k = 0; k < 3; k++) {
        const a = 0.35 + 0.4 * Math.sin(t * 3 + k * 1.8 + i);
        g.strokeStyle = `rgba(77,163,255,${a})`;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(px + ts * 0.24, py + ts * (0.68 - k * 0.16));
        g.lineTo(px + ts * 0.5, py + ts * (0.5 - k * 0.16));
        g.lineTo(px + ts * 0.76, py + ts * (0.68 - k * 0.16));
        g.stroke();
      }
    } else if (tile === T.POOL) {
      g.fillStyle = `rgba(63,182,168,${0.2 + 0.12 * pul})`;
      g.beginPath(); g.ellipse(px + ts / 2, py + ts * 0.6, ts * 0.32, ts * 0.16, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(232,234,240,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(px + ts / 2, py + ts * 0.6, ts * 0.32 + 2 * Math.sin(t * 2 + i), ts * 0.16, 0, 0, 7); g.stroke();
    } else if (tile === T.FLOOR && !isShell) {
      vein(g, px + ts / 2, py + ts / 2, ts * 0.24, t * 0.5 + seed * 2, 'rgba(184,80,106,0.35)', 0.35);
    }
  }

  function drawPlayer(g, p, px, py, ts) {
    const bob = Math.sin(t * 4) * ts * 0.03;
    const cx = px + ts / 2, cy = py + ts * 0.58 + bob;
    g.save();
    if (p.brace > 0) {
      g.strokeStyle = `rgba(77,163,255,${0.55 + 0.25 * Math.sin(t * 8)})`;
      g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy - ts * 0.08, ts * 0.44, 0, 7); g.stroke();
    }
    // scavenger: bone-white cloaked figure
    g.fillStyle = p.alive ? C.bone : '#5a5f6e';
    g.beginPath();
    g.moveTo(cx, cy - ts * 0.34);
    g.quadraticCurveTo(cx + ts * 0.2, cy - ts * 0.18, cx + ts * 0.15, cy + ts * 0.18);
    g.lineTo(cx - ts * 0.15, cy + ts * 0.18);
    g.quadraticCurveTo(cx - ts * 0.2, cy - ts * 0.18, cx, cy - ts * 0.34);
    g.fill();
    // head + facing pip
    g.beginPath(); g.arc(cx, cy - ts * 0.4, ts * 0.09, 0, 7); g.fill();
    g.fillStyle = C.glow;
    g.beginPath(); g.arc(cx + p.facing.x * ts * 0.1, cy - ts * 0.4 + p.facing.y * ts * 0.1, ts * 0.035, 0, 7); g.fill();
    // blade
    g.strokeStyle = 'rgba(232,234,240,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + ts * 0.16, cy); g.lineTo(cx + ts * 0.3, cy - ts * 0.2); g.stroke();
    g.restore();
  }

  function drawEnemy(g, e, px, py, ts) {
    const cx = px + ts / 2, cy = py + ts / 2;
    const wob = Math.sin(t * 6 + px) * ts * 0.03;
    if (e.type === 'mite') {
      g.fillStyle = C.mite;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(cx + Math.cos(k * 2.1 + t) * ts * 0.12, cy + Math.sin(k * 2.1 + t) * ts * 0.1 + wob, ts * 0.11, 0, 7);
        g.fill();
      }
      g.strokeStyle = 'rgba(255,0,51,0.5)'; g.lineWidth = 1;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(cx, cy); const a = k * 1.57 + 0.4; g.lineTo(cx + Math.cos(a) * ts * 0.3, cy + Math.sin(a) * ts * 0.3); g.stroke(); }
    } else if (e.type === 'spitter') {
      g.fillStyle = '#173d3a';
      g.beginPath(); g.ellipse(cx, cy + wob, ts * 0.3, ts * 0.24, 0, 0, 7); g.fill();
      g.fillStyle = C.spitter;
      g.beginPath(); g.arc(cx, cy + wob - ts * 0.04, ts * (0.14 + 0.03 * Math.sin(t * 3)), 0, 7); g.fill();
      g.fillStyle = 'rgba(63,182,168,0.35)';
      g.beginPath(); g.arc(cx, cy + wob, ts * 0.36 + 0.03 * ts * Math.sin(t * 3), 0, 7); g.fill();
    } else { // reaver
      g.fillStyle = '#2c3140';
      g.beginPath();
      g.moveTo(cx, cy - ts * 0.32);
      g.quadraticCurveTo(cx + ts * 0.24, cy - ts * 0.1, cx + ts * 0.18, cy + ts * 0.26);
      g.lineTo(cx - ts * 0.18, cy + ts * 0.26);
      g.quadraticCurveTo(cx - ts * 0.24, cy - ts * 0.1, cx, cy - ts * 0.32);
      g.fill();
      g.fillStyle = C.danger;
      g.fillRect(cx - ts * 0.12, cy - ts * 0.14, ts * 0.24, 2.4); // visor
      if (e.loot > 0) { g.fillStyle = C.gold; crystal(g, cx + ts * 0.26, cy + ts * 0.1, ts * 0.09); }
      if (e.state === 'flee') { g.strokeStyle = 'rgba(232,182,76,0.5)'; g.strokeRect(px + 2, py + 2, ts - 4, ts - 4); }
    }
    // hp pips
    const fr = Math.max(0, e.hp / e.maxHp);
    g.fillStyle = 'rgba(10,10,18,0.7)'; g.fillRect(px + ts * 0.18, py + 1, ts * 0.64, 3);
    g.fillStyle = fr > 0.5 ? C.danger : '#ff8199';
    g.fillRect(px + ts * 0.18, py + 1, ts * 0.64 * fr, 3);
  }

  function lantern(g, cx, cy, r) {
    const lg = g.createRadialGradient(cx, cy, 4, cx, cy, r);
    lg.addColorStop(0, 'rgba(232,182,76,0.14)');
    lg.addColorStop(1, 'rgba(232,182,76,0)');
    g.fillStyle = lg;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  }
  function vein(g, x, y, r, seedC, color, a) {
    g.strokeStyle = typeof color === 'string' && color[0] === 'r' ? color : color;
    g.globalAlpha = a;
    g.lineWidth = 1.4;
    g.beginPath();
    for (let k = 0; k <= 5; k++) {
      const ang = seedC * 0.4 + k * 1.25;
      const rr = r * (0.4 + 0.6 * Math.abs(Math.sin(seedC + k * 2.1)));
      const vx = x + Math.cos(ang) * rr, vy = y + Math.sin(ang) * rr * 0.7;
      k ? g.lineTo(vx, vy) : g.moveTo(vx, vy);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  function crystal(g, x, y, r) {
    g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x + r * 0.7, y); g.lineTo(x, y + r * 0.6); g.lineTo(x - r * 0.7, y);
    g.closePath(); g.fill();
  }
  function spike(g, x, y, r) {
    g.beginPath();
    g.moveTo(x - r, y + r); g.lineTo(x, y - r); g.lineTo(x + r, y + r);
    g.closePath(); g.fill();
  }
  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }
  function drawFloat(g, f, ox, oy, ts) {
    const k = (t - f.t0) / 1.1;
    g.globalAlpha = 1 - k;
    g.fillStyle = f.color;
    g.font = `700 ${Math.round(ts * 0.32)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText(f.text, ox + f.x * ts + ts / 2, oy + f.y * ts - k * ts * 0.8);
    g.globalAlpha = 1;
  }
  function drawBlast(g, b, ox, oy, ts) {
    const k = (t - b.t0) / 0.5;
    g.strokeStyle = `rgba(232,234,240,${0.9 * (1 - k)})`;
    g.lineWidth = 3;
    g.beginPath(); g.arc(ox + b.x * ts + ts / 2, oy + b.y * ts + ts / 2, ts * (0.4 + 1.4 * k), 0, 7); g.stroke();
    g.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`;
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785 + t;
      g.beginPath();
      g.moveTo(ox + b.x * ts + ts / 2 + Math.cos(a) * ts * 0.5 * (1 + k), oy + b.y * ts + ts / 2 + Math.sin(a) * ts * 0.5 * (1 + k));
      g.lineTo(ox + b.x * ts + ts / 2 + Math.cos(a) * ts * (0.9 + 1.6 * k), oy + b.y * ts + ts / 2 + Math.sin(a) * ts * (0.9 + 1.6 * k));
      g.stroke();
    }
  }
  function drawTracer(g, tr, ox, oy, ts) {
    const k = (t - tr.t0) / 0.28;
    g.strokeStyle = `rgba(63,182,168,${0.85 * (1 - k)})`;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(ox + tr.x0 * ts + ts / 2, oy + tr.y0 * ts + ts / 2);
    g.lineTo(ox + (tr.x0 + (tr.x1 - tr.x0) * Math.min(1, k * 1.35)) * ts + ts / 2, oy + (tr.y0 + (tr.y1 - tr.y0) * Math.min(1, k * 1.35)) * ts + ts / 2);
    g.stroke();
  }

  return { draw, consumeEvents, get shake() { return shakeMag; } };
}
