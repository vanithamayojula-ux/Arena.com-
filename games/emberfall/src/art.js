// EMBERFALL painter — every pixel of the world is procedural, tuned for one look:
// a blue-violet dusk so cold the amber lamps hurt, silhouettes with rim light,
// fog that remembers being weather, ash that never decides to be snow.
//
// Rules (so tools/shot.mjs can rasterise the exact same code headless):
//   - only these ctx calls: save/restore, translate/scale, beginPath/moveTo/lineTo/
//     quadraticCurveTo/arc/closePath, fill/stroke/fillRect/clearRect, gradients
//     (linear+radial with stops), globalAlpha, globalCompositeOperation
//     ('source-over'|'lighter'|'destination-out'|'multiply'), drawImage of offscreen
//     canvases created via makeLayer. No text on canvas — all words live in the DOM.

import { clamp, lerp, rng, fbm, noise1, TAU, hexToRgb } from './util.js';

export const PAL = {
  skyTop: '#060711',
  skyMid: '#141a33',
  skyLow: '#2a2440',
  horizon: '#3d2f44',
  glowWarm: '#ff9d4d',
  glowPale: '#ffd9a0',
  hillFar: '#1b2140',
  hillMid: '#131832',
  hillNear: '#0b0f22',
  ground: '#070a16',
  fore: '#04060d',
  ink: '#05070d',
  rim: '#8fb4e8',
  blood: '#5e2033',
  moth: '#010208',
  eye: '#d7e2ff',
};

// --------------------------------------------------------------- tiny canvas shim
export function makeLayer(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function grad(g, kind, args, stops) {
  const gr = kind === 'l' ? g.createLinearGradient(...args) : g.createRadialGradient(...args);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function rect(g, x, y, w, h) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); g.fill(); }

function ell(g, x, y, rx, ry, a0 = 0, a1 = TAU) {
  g.save(); g.translate(x, y);
  const s = ry / (rx || 0.0001);
  g.scale(1, s);
  g.beginPath(); g.arc(0, 0, rx, a0, a1); g.closePath(); g.fill();
  g.restore();
}

function tri(g, x1, y1, x2, y2, x3, y3) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath(); g.fill();
}

function poly(g, pts, close = true) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[i][0], pts[i][1]); }
  if (close) g.closePath();
  g.fill();
}

function limb(g, x1, y1, x2, y2, w, fill, rim, rimA = 0.5) {
  if (rim) {
    g.strokeStyle = rim; g.globalAlpha = rimA * 0.34 * g.__baseA1;
    g.lineWidth = w + 1.7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.globalAlpha = g.__baseA1;
  }
  g.strokeStyle = fill; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

// ensure __baseA1 exists so limb() can restore alpha (headless shim tolerates reads of undefined -> 1)
function baseA(g) { return g.globalAlpha === undefined ? 1 : g.globalAlpha; }

// --------------------------------------------------------------- sky & atmosphere

export function sky(g, W, H, t, o = {}) {
  const hz = o.horizonY || H * 0.62;
  const low = o.low || PAL.skyLow, mid = o.mid || PAL.skyMid, top = o.top || PAL.skyTop;
  g.fillStyle = grad(g, 'l', [0, 0, 0, hz], [[0, top], [0.62, mid], [1, low]]);
  rect(g, 0, 0, W, hz + 2);
  // warm smear near the horizon — the sun's last rent, paid monthly
  if (o.horizonGlow !== 0) {
    const gx = o.glowX === undefined ? W * 0.72 : o.glowX;
    g.fillStyle = grad(g, 'r', [gx, hz, 0, gx, hz, W * 0.55], [
      [0, `rgba(255,148,72,${0.16 * (o.glowStrength || 1)})`],
      [0.45, `rgba(154,86,84,${0.08 * (o.glowStrength || 1)})`],
      [1, 'rgba(61,47,68,0)'],
    ]);
    rect(g, 0, hz - H * 0.4, W, H * 0.42);
  }
  dimSun(g, o.sunX === undefined ? W * 0.74 : o.sunX, o.sunY === undefined ? hz - H * 0.16 : o.sunY, o.sunR || 9, t, o.sunA === undefined ? 1 : o.sunA);
  clouds(g, W, hz, t, o.seed || 7, o.cloudA === undefined ? 1 : o.cloudA);
  if (o.stars !== false) stars(g, W, hz * 0.72, t, (o.seed || 7) + 13);
}

export function dimSun(g, x, y, r, t, a = 1) {
  // "a sixpence behind wet wool"
  const fl = 0.92 + 0.08 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 2);
  g.save();
  g.fillStyle = grad(g, 'r', [x, y, 0, x, y, r * 9], [
    [0, `rgba(255,214,150,${0.16 * a * fl})`],
    [0.3, `rgba(206,140,110,${0.06 * a * fl})`],
    [1, 'rgba(120,80,90,0)'],
  ]);
  rect(g, x - r * 9, y - r * 9, r * 18, r * 18);
  g.fillStyle = `rgba(255,224,170,${0.5 * a * fl})`;
  ell(g, x, y, r, r * 0.92);
  g.fillStyle = `rgba(255,240,205,${0.34 * a * fl})`;
  ell(g, x - r * 0.12, y - r * 0.12, r * 0.55, r * 0.5);
  g.restore();
}

export function stars(g, W, h, t, seed) {
  const R = rng(seed);
  g.save();
  for (let i = 0; i < 46; i++) {
    const x = R() * W, y = R() * h, r = 0.6 + R() * 1.1;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + R()) + i * 2.4);
    g.fillStyle = `rgba(190,205,235,${(0.05 + 0.14 * R()) * tw})`;
    ell(g, x, y, r, r);
  }
  g.restore();
}

export function clouds(g, W, hz, t, seed, a = 1) {
  g.save();
  for (let i = 0; i < 7; i++) {
    const R = rng(seed * 31 + i);
    const cy = hz * (0.18 + R() * 0.62);
    const cw = W * (0.3 + R() * 0.5), ch = 10 + R() * 22;
    const drift = t * (2 + R() * 3) + R() * W * 3;
    for (let k = 0; k < 3; k++) {
      const x = ((drift * (0.25 + k * 0.1) + i * 137 + k * 90) % (W + cw)) - cw * 0.5;
      const aa = (0.05 + 0.05 * k) * a * (1 - cy / hz * 0.5);
      g.fillStyle = `rgba(${k === 2 ? '74,60,86' : '40,42,68'},${aa})`;
      ell(g, x + k * cw * 0.22, cy, cw * (0.3 + k * 0.18), ch * (0.7 + k * 0.3));
    }
  }
  g.restore();
}

// --------------------------------------------------------------- land & structures

export function ridge(g, W, baseY, amp, seed, fill, t = 0, freq = 3.1) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(-4, baseY + 220);
  const step = 16;
  for (let x = -4; x <= W + 4; x += step) {
    const y = baseY - fbm(seed, x / (W / freq), 3) * amp - Math.sin(x / 90 + t * 0.05) * amp * 0.06;
    g.lineTo(x, y);
  }
  g.lineTo(W + 4, baseY + 220);
  g.closePath(); g.fill();
}

export function deadTree(g, x, y, s, seed, o = {}) {
  const R = rng(seed);
  g.save(); g.translate(x, y); g.scale(o.mirror ? -1 : 1, 1);
  g.strokeStyle = o.fill || PAL.fore; g.lineCap = 'round';
  const branch = (bx, by, len, ang, w, d) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    if (d <= 0) return;
    const n = 1 + (R() > 0.42 ? 1 : 0);
    for (let i = 0; i < n + 1; i++) {
      const a2 = ang + (i - n / 2) * (0.5 + R() * 0.45) + (R() - 0.5) * 0.2;
      branch(ex, ey, len * (0.52 + R() * 0.24), a2, Math.max(0.6, w * 0.55), d - 1);
    }
  };
  branch(0, 0, 34 * s, -Math.PI / 2 + (R() - 0.5) * 0.5, 7.5 * s, 3);
  if (o.leaves) { // ragged canopy of ash-tufts
    g.fillStyle = o.leaves;
    for (let i = 0; i < 5; i++) ell(g, (R() - 0.5) * 60 * s, -40 * s - R() * 40 * s, (8 + R() * 12) * s, (4 + R() * 6) * s);
  }
  g.restore();
}

function houseRow(g, x0, y0, w, seed, o = {}) {
  const R = rng(seed);
  const t = o.t || 0;
  let x = x0;
  while (x < x0 + w) {
    const bw = 30 + R() * 66, bh = 26 + R() * 58;
    const fill = o.fill || '#080b16';
    g.fillStyle = fill;
    const roof = R() > 0.35;
    poly(g, [[x, y0], [x, y0 - bh], [x + bw, y0 - bh], [x + bw, y0]], true);
    if (roof) {
      const peak = y0 - bh - (8 + R() * 16);
      poly(g, [[x - 3, y0 - bh], [x + bw / 2 + (R() - 0.5) * bw * 0.3, peak], [x + bw + 3, y0 - bh]], true);
    } else {
      poly(g, [[x + bw * 0.15, y0 - bh], [x + bw * 0.15, y0 - bh - 6], [x + bw * 0.85, y0 - bh - 6], [x + bw * 0.85, y0 - bh]], true);
    }
    if (R() > 0.5) { // chimney
      const cx = x + bw * (0.2 + R() * 0.6);
      rect(g, cx, y0 - bh - 16, 5, 18);
      if (o.smoke) {
        for (let i = 0; i < 4; i++) {
          const sp = ((t * 9 + i * 26 + R() * 40) % 90);
          g.fillStyle = `rgba(120,110,130,${0.12 * (1 - sp / 90)})`;
          ell(g, cx + 2 + Math.sin((t + i) * 1.7) * 5, y0 - bh - 20 - sp, 4 + sp * 0.16, 3 + sp * 0.1);
        }
      }
    }
    if (o.windows !== false) {
      const nw = 1 + Math.floor(R() * 3);
      for (let i = 0; i < nw; i++) {
        const wx = x + 6 + (bw - 12) * ((i + 0.5) / nw) - 2, wy = y0 - bh + 8 + R() * (bh - 20);
        const lit = R() > (o.dark ? 0.75 : 0.45);
        if (lit) {
          const fl = 0.75 + 0.25 * Math.sin(t * (2 + R() * 3) + i * 7 + seed);
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = `rgba(255,166,80,${0.16 * fl})`;
          ell(g, wx + 2, wy + 3, 11, 9);
          g.restore();
          g.fillStyle = `rgba(255,198,120,${0.85 * fl})`;
        } else {
          g.fillStyle = 'rgba(16,18,32,0.9)';
        }
        rect(g, wx, wy, 4, 5);
      }
    }
    x += bw + 2 + R() * 10;
  }
}

export function town(g, x0, y0, w, seed, o = {}) {
  houseRow(g, x0, y0, w, seed, o);
}

export function lighthouse(g, x, baseY, s, t, o = {}) {
  g.save(); g.translate(x, baseY); g.scale(s, s);
  const rock = o.rock || PAL.fore;
  // rock shelf
  g.fillStyle = rock;
  poly(g, [[-110, 4], [-84, -26], [-40, -34], [30, -36], [76, -28], [116, 4]], true);
  // tower: tapered, slightly leaning with age
  const H = 190, wB = 40, wT = 24;
  g.fillStyle = '#0a0d1b';
  poly(g, [[-wB / 2, -10], [wB / 2, -10], [wT / 2, -H], [-wT / 2, -H]], true);
  // pale band where paint remembers the sun
  g.fillStyle = 'rgba(190,196,220,0.08)';
  poly(g, [[-wB / 2 - 2, -24], [wB / 2 + 2, -24], [wT / 2, -H + 16], [-wT / 2, -H + 16]], true);
  for (let i = 0; i < 4; i++) { // struts of scaffolding left from the relief
    const yy = -H * (0.2 + i * 0.18);
    g.fillStyle = 'rgba(6,8,16,0.9)';
    rect(g, -wB / 2 - 4, yy, wB + 8, 3);
  }
  // gallery + lamp room
  g.fillStyle = '#070a15';
  rect(g, -wT / 2 - 6, -H - 6, wT + 12, 7);
  rect(g, -wT / 2 + 2, -H - 26, wT - 4, 21);
  // dome
  ell(g, 0, -H - 26, wT / 2, 8, Math.PI, TAU);
  // the light itself
  const on = o.lit === false ? 0 : 1;
  if (on) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const fl = 0.86 + 0.14 * Math.sin(t * 9.3) * Math.sin(t * 2.1);
    g.fillStyle = grad(g, 'r', [0, -H - 16, 2, 0, -H - 16, 130], [
      [0, `rgba(255,232,180,${0.85 * fl})`],
      [0.25, `rgba(255,170,86,${0.4 * fl})`],
      [1, 'rgba(255,140,60,0)'],
    ]);
    ell(g, 0, -H - 16, 130, 130);
    // rotating beams: light you can almost hear
    const rot = t * (o.beamSpeed === undefined ? 0.5 : o.beamSpeed);
    for (let b = 0; b < 2; b++) {
      const ang = rot + b * Math.PI;
      const facing = Math.max(0.25, Math.abs(Math.cos(ang)));
      const len = 340, sp = 0.055 + 0.03 * Math.abs(Math.cos(ang * 2));
      const tx = Math.cos(ang) * len, ty = -H - 16 + Math.sin(ang) * len * 0.24;
      g.fillStyle = grad(g, 'l', [0, -H - 16, tx, ty], [
        [0, `rgba(255,214,150,${0.20 * facing})`],
        [0.5, `rgba(255,180,104,${0.09 * facing})`],
        [1, 'rgba(255,160,80,0)'],
      ]);
      g.beginPath();
      g.moveTo(0, -H - 16);
      g.lineTo(Math.cos(ang - sp) * len, -H - 16 + Math.sin(ang - sp) * len * 0.24);
      g.lineTo(Math.cos(ang + sp) * len, -H - 16 + Math.sin(ang + sp) * len * 0.24);
      g.closePath(); g.fill();
    }
    g.restore();
  }
  g.restore();
}

// --------------------------------------------------------------- warm light

export function lampGlow(g, x, y, r, warmth = 1, flick = 0, t = 0) {
  const fl = 1 - flick * (0.5 + 0.5 * Math.sin(t * 11.7 + x * 0.13) * Math.sin(t * 5.1 + y * 0.07));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = grad(g, 'r', [x, y, 0, x, y, r], [
    [0, `rgba(255,222,164,${0.30 * warmth * fl})`],
    [0.18, `rgba(255,186,108,${0.20 * warmth * fl})`],
    [0.38, `rgba(255,158,74,${0.115 * warmth * fl})`],
    [0.60, `rgba(232,120,62,${0.055 * warmth * fl})`],
    [0.80, `rgba(206,96,58,${0.022 * warmth * fl})`],
    [1, 'rgba(120,50,40,0)'],
  ]);
  ell(g, x, y, r, r * 0.9);
  g.restore();
}

export function lampObject(g, x, y, s, lit, kind = 'brass', t = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const body = '#0a0c16', metal = lit ? 'rgba(255,190,110,0.9)' : 'rgba(120,120,140,0.5)';
  if (kind === 'street') {
    g.strokeStyle = '#0a0c16'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 26); g.lineTo(0, -34); g.stroke();
    g.fillStyle = body;
    poly(g, [[-7, -36], [7, -36], [5, -50], [-5, -50]], true);
    if (lit) { g.fillStyle = 'rgba(255,190,110,0.85)'; poly(g, [[-4, -38], [4, -38], [3, -48], [-3, -48]], true); }
    g.restore();
    if (lit) lampGlow(g, x, y - 44 * s, 46 * s, 1, 0.25, t);
    return;
  }
  if (kind === 'sunkey') {
    // the big brass lantern: a reliquary with a caged flame
    g.fillStyle = body;
    ell(g, 0, 0, 16, 13);
    if (lit) {
      g.fillStyle = 'rgba(255,214,140,0.62)';
      ell(g, 0, -1, 11, 9);
      g.fillStyle = 'rgba(255,246,224,0.92)';
      ell(g, 0, -2, 5.2, 6.4);
    } else {
      g.fillStyle = 'rgba(60,64,84,0.8)';
      ell(g, 0, -1, 11, 9);
    }
    g.fillStyle = metal;
    g.beginPath();
    g.moveTo(-17, 1); g.lineTo(17, 1); g.lineTo(13, 4.5); g.lineTo(-13, 4.5);
    g.closePath(); g.fill();
    g.strokeStyle = metal; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-9, 1); g.quadraticCurveTo(0, -16, 9, 1); g.stroke();
    g.beginPath(); g.moveTo(0, 1); g.lineTo(0, -13); g.stroke();
    g.restore();
    if (lit) lampGlow(g, x, y - 2, Math.min(340, 82 * s), 0.85, 0.18, t);
    return;
  }
  // brass hall lantern
  g.fillStyle = body;
  rect(g, -1.5, -26, 3, 8);
  poly(g, [[-9, -18], [9, -18], [7, -6], [-7, -6]], true);
  g.fillStyle = 'rgba(180,140,80,0.28)';
  poly(g, [[-7, -17], [7, -17], [5.4, -7], [-5.4, -7]], true);
  if (lit) {
    g.fillStyle = 'rgba(255,208,130,0.95)';
    ell(g, 0, -12, 3.4, 4.6);
  }
  g.fillStyle = body;
  poly(g, [[-10, -6], [10, -6], [6, -1], [-6, -1]], true);
  g.restore();
  if (lit) lampGlow(g, x, y - 12 * s, 52 * s, 1, 0.3, t);
}

// --------------------------------------------------------------- people

const WHO = {
  vera: { h: 1.0, shoulder: 0.62, coat: true, hair: 'bun', props: 'lantern-staff' },
  dill: { h: 0.94, shoulder: 0.52, scarf: true, hair: 'wave' },
  bram: { h: 1.22, shoulder: 1.05, hunched: false, hair: 'crop' },
  fenn: { h: 0.72, shoulder: 0.5, hat: true, hair: 'tuft' },
  keeper: { h: 1.02, shoulder: 0.7, coat: true, stoop: 3, hair: 'long' },
  crowd: { h: 0.9, shoulder: 0.6, hair: 'any' },
  villager: { h: 0.95, shoulder: 0.62, hair: 'any' },
  auditor: { h: 0.98, shoulder: 0.6, ledger: true, hair: 'pin' },
  nun: { h: 1.0, shoulder: 0.6, hood: true, hair: 'hood' },
};

// who, pose: walk|idle|juggle|sing|prompt|puppet|sit|kneel|point|carry|conduct|stand
export function figure(g, x, y, s, o = {}) {
  const w = WHO[o.who] || WHO.crowd;
  const pose = o.pose || 'idle';
  const ph = o.phase || 0;
  const dir = o.dir || 1;
  const ink = o.fill || PAL.ink;
  const rim = o.rim === undefined ? 'rgba(140,170,225,0.5)' : o.rim;
  g.save();
  g.translate(x, y);
  g.scale(dir * s * w.h, s * w.h);

  const bob = pose === 'walk' ? Math.abs(Math.sin(ph * 2)) * 2.4 : Math.sin(ph) * 0.9;
  const hipY = -34 - bob;
  const shY = hipY - 30 * w.shoulder;
  const headR = 9.4;
  const headY = shY - headR - 3;
  g.__baseA1 = baseA(g);

  // legs
  const swing = pose === 'walk' ? Math.sin(ph * 2) : (pose === 'kneel' ? 0.2 : 0.06 * Math.sin(ph));
  if (pose === 'sit') {
    limb(g, 0, hipY, 12, hipY + 4, 7.2, ink, rim);
    limb(g, 12, hipY + 4, 13, hipY + 20, 6.4, ink, rim);
  } else if (pose === 'kneel') {
    limb(g, 0, hipY, 10, hipY + 14, 7.2, ink, rim);
    limb(g, 10, hipY + 14, 20, hipY + 14, 6.4, ink, rim);
  } else {
    limb(g, 0, hipY, 9 * swing + 3, 0, 7.4, ink, rim);
    limb(g, 0, hipY, -9 * swing + 3, 0, 7.4, ink, rim);
  }
  // torso
  g.fillStyle = ink;
  poly(g, [[-8.4 * w.shoulder * 1.32, shY], [8.4 * w.shoulder * 1.32, shY], [6.2, hipY + 2], [-6.2, hipY + 2]], true);
  // coat tails
  if (w.coat) {
    poly(g, [[-7 * w.shoulder * 1.3, shY + 6], [-4, hipY + 16 + (pose === 'walk' ? 4 * Math.abs(Math.sin(ph)) : 0)], [-1, hipY + 8], [-6, shY + 2]], true);
  }
  if (w.scarf && pose !== 'sit') {
    g.strokeStyle = 'rgba(122,64,84,0.8)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(2, shY - 2);
    g.quadraticCurveTo(14 + Math.sin(ph) * 3, shY + 8, 18 + Math.sin(ph * 0.7) * 6, shY + 26);
    g.stroke();
  }
  // arms by pose
  const arm = (a1x, a1y, a2x, a2y, a3x, a3y) => {
    limb(g, a1x, a1y, a2x, a2y, 6, ink, rim);
    limb(g, a2x, a2y, a3x, a3y, 5.2, ink, rim);
  };
  const shL = -7 * w.shoulder * 1.3, shR = 7 * w.shoulder * 1.3;
  if (pose === 'juggle') {
    arm(shL, shY, shL - 7, shY - 9, shL - 3, shY - 20);
    arm(shR, shY, shR + 7, shY - 9, shR + 3, shY - 20);
  } else if (pose === 'sing' || pose === 'conduct') {
    arm(shL, shY, shL - 12, shY - 4 + Math.sin(ph) * 3, shL - 20, shY - 14 + Math.sin(ph) * 5);
    arm(shR, shY, shR + 3, shY + 8, shR - 3, shY + 2);
  } else if (pose === 'prompt' || pose === 'point') {
    arm(shL, shY, shL - 6, shY + 8, shL - 2, shY + 16);
    arm(shR, shY, shR + 12, shY - 6, shR + 22, shY - 12 - (pose === 'point' ? 4 : 0));
  } else if (pose === 'puppet') {
    arm(shL, shY, shL - 4, shY + 10, shL, shY + 18);
    arm(shR, shY, shR + 9, shY - 12, shR + 13, shY - 24);
  } else if (pose === 'carry') {
    arm(shL, shY, shL + 10, shY + 6, shL + 18, shY + 2);
    arm(shR, shY, shR + 12, shY + 6, shR + 19, shY + 1);
  } else { // walk / idle / sit / kneel
    const sw = pose === 'walk' ? Math.sin(ph * 2) : 0.1 * Math.sin(ph);
    arm(shL, shY, shL - 3 - sw * 5, shY + 12, shL - 4 - sw * 8, shY + 24);
    arm(shR, shY, shR + 3 + sw * 5, shY + 12, shR + 4 + sw * 8, shY + 24);
  }
  // head + hair (with a cold crescent of rim, light always from the sea side)
  if (rim) {
    g.strokeStyle = rim; g.globalAlpha = (o.rimA === undefined ? 0.4 : o.rimA) * 0.4;
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(-2.5, headY - 1, headR + 0.9, Math.PI * 1.08, Math.PI * 1.75); g.stroke();
    g.globalAlpha = g.__baseA1;
  }
  const tilt = pose === 'sing' ? -0.22 : pose === 'kneel' ? 0.24 : 0;
  g.save();
  g.translate(tilt * 3, headY + (pose === 'walk' ? -bob * 0.4 : 0));
  g.rotate(tilt);
  g.fillStyle = ink;
  ell(g, 0, 0, headR, headR * 1.06);
  g.fillStyle = ink;
  if (w.hat) { poly(g, [[-10, -6], [10, -6], [7, -13], [-7, -13]], true); rect(g, -12, -6.5, 24, 2.6); }
  else if (w.hair === 'bun') { ell(g, -2, -9, 4.6, 4.2); ell(g, 5, -7, 4, 3.4); }
  else if (w.hair === 'crop') { ell(g, 0, -6.6, headR * 0.96, 3.4); }
  else if (w.hair === 'wave') { poly(g, [[-9, -4], [-6, -10], [3, -11], [8, -6], [9, 6], [11, 14], [5, 10], [2, -3], [-4, -4]], true); }
  else if (w.hood) { poly(g, [[-10, -2], [-6, -12], [6, -12], [10, -2], [8, 8], [-8, 8]], true); }
  else if (w.hair === 'long') { poly(g, [[-8, -8], [8, -8], [9, 10], [-9, 10]], true); }
  else if (w.hair === 'pin') { rect(g, -1.5, -headR - 7, 3, 8); ell(g, 0, -headR - 8, 2.6, 2.2); }
  else if (w.hair === 'tuft') { poly(g, [[-2, -9], [3, -14], [5, -8]], true); }
  else { ell(g, (g.__r || 0), -7, 8, 4); }
  g.restore();
  // props — a held lantern, Cinder on the wrist, juggling orbs
  if (o.holdsLamp) lampObject(g, 20, shY + 22, 0.8, o.lampLit === undefined ? 1 : o.lampLit, 'brass', ph * 4);
  if (pose === 'juggle') {
    for (let i = 0; i < 3; i++) {
      const tp = ph * 1.6 + i * TAU / 3;
      const bx = Math.cos(tp) * 15, by = shY - 26 - Math.abs(Math.sin(tp)) * 16;
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,178,96,0.55)'; ell(g, bx, by, 4.6, 4.6);
      g.restore();
      g.fillStyle = '#c7884a'; ell(g, bx, by, 3.4, 3.4);
    }
  }
  if (w.ledger) { g.fillStyle = '#141726'; rect(g, shR - 4, shY + 2, 12, 9); g.fillStyle = 'rgba(200,210,235,0.25)'; rect(g, shR - 2.5, shY + 3.5, 9, 6); }
  g.restore();
  // rim glow from a nearby warm source handled by caller lampGlow layers
}

export function cinderMoth(g, x, y, t, s = 1, glow = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const flap = Math.sin(t * 14);
  g.fillStyle = 'rgba(30,34,58,0.92)';
  ell(g, 0, 0, 3.4, 5);
  g.fillStyle = `rgba(${160 + glow * 95},${130 + glow * 70},${90 + glow * 30},${0.5 + glow * 0.4})`;
  poly(g, [[-1, -2], [-10 - flap * 3, -8 - flap * 3], [-12 - flap * 3, 1]], true);
  poly(g, [[1, -2], [10 + flap * 3, -8 - flap * 3], [12 + flap * 3, 1]], true);
  if (glow > 0.05) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,190,110,${0.5 * glow})`;
    ell(g, 0, 1, 4 + glow * 3, 3 + glow * 2);
    g.restore();
  }
  g.restore();
}

export function mothling(g, x, y, t, o = {}) {
  // what the dark sends when it has forgotten how to ask
  const s = o.s || 1, aggro = o.aggro || 0, seed = o.seed || 1;
  const N = noise1(seed, t * 1.3);
  g.save(); g.translate(x, y);
  g.scale(s * (1 + aggro * 0.14), s * (1 + aggro * 0.14));
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgba(2,3,10,${0.5 + aggro * 0.4})`;
  ell(g, 0, 0, 16 + N * 5, 10 + noise1(seed + 1, t * 1.7) * 5);
  ell(g, 6, 4, 10, 7 + N * 3);
  g.restore();
  g.fillStyle = `rgba(2,3,12,${0.85 + aggro * 0.15})`;
  ell(g, 0, 0, 12 + N * 3, 8 + noise1(seed + 2, t * 2.1) * 3);
  // wings — torn shawls
  const fl = Math.sin(t * (9 + aggro * 6));
  g.fillStyle = `rgba(5,7,20,${0.65})`;
  poly(g, [[-3, -1], [-22 - fl * 7, -7 - fl * 3], [-15 - fl * 5, 5]], true);
  poly(g, [[3, -1], [22 + fl * 7, -7 - fl * 3], [15 + fl * 5, 5]], true);
  // eyes — the only light it keeps, borrowed
  g.save(); g.globalCompositeOperation = 'lighter';
  const eg = 0.35 + aggro * 0.6;
  g.fillStyle = `rgba(215,226,255,${eg})`;
  ell(g, -3.4, -1.4, 1.7, 1.7); ell(g, 3.4, -1.4, 1.7, 1.7);
  if (aggro > 0.4) { g.fillStyle = `rgba(255,110,90,${(aggro - 0.4) * 0.5})`; ell(g, 0, 0, 10, 6); }
  g.restore();
  g.restore();
}

export function crowdRow(g, x0, y0, count, s, seed, mood, t) {
  // mood 0..1 decides bob amplitude and raised hands
  const R = rng(seed);
  const amp = 1 + mood * 6;
  for (let i = 0; i < count; i++) {
    const px = x0 + i * (18 + R() * 12) * s;
    const ph = t * (1.4 + R() * 1.2) + R() * 6;
    const bob = Math.abs(Math.sin(ph)) * amp;
    const who = R() > 0.82 ? 'auditor' : R() > 0.7 ? 'keeper' : 'crowd';
    figure(g, px, y0 + bob * 0.4, s * (0.75 + R() * 0.32), {
      who, pose: mood > 0.66 && R() > 0.72 ? 'prompt' : mood > 0.4 && R() > 0.6 ? 'sing' : 'idle',
      phase: ph, fill: '#04060e',
      rim: `rgba(150,180,235,${0.12 + mood * 0.2})`,
    });
  }
}

// --------------------------------------------------------------- weather & polish

export function fogBands(g, W, y, h, t, seed, a = 1) {
  g.save();
  for (let i = 0; i < 5; i++) {
    const R = rng(seed * 91 + i);
    const yy = y + R() * h - h * 0.5;
    const len = W * (0.35 + R() * 0.4), hh = 7 + R() * 16;
    const x = ((t * (3 + R() * 6) + R() * 999) % (W + len)) - len;
    g.fillStyle = `rgba(122,132,168,${(0.035 + R() * 0.05) * a})`;
    ell(g, x + len / 2, yy + Math.sin(t * 0.5 + i) * 4, len, hh);
  }
  g.restore();
}

export function ash(g, W, H, t, seed, o = {}) {
  const R = rng(seed);
  const n = o.n === undefined ? 60 : o.n;
  const col = o.col || '216,219,232';
  g.save();
  for (let i = 0; i < n; i++) {
    const sp = 12 + R() * 26;
    const x0 = R() * W, off = R() * H;
    const y = (off + t * sp * (o.up ? -1 : 1)) % (H + 30) - 15;
    const sw = Math.sin(t * (0.4 + R() * 0.8) + i * 2.99) * (14 + R() * 22);
    const r = 0.6 + R() * 1.5;
    g.fillStyle = `rgba(${col},${(0.05 + R() * 0.12) * (o.a === undefined ? 1 : o.a)})`;
    ell(g, (x0 + sw + W) % W, y, r, r * (o.streak ? 2.4 : 1));
  }
  g.restore();
}

export function vignette(g, W, H, a = 1, o = {}) {
  g.save();
  g.fillStyle = grad(g, 'r', [W / 2, H * 0.46, H * 0.36, W / 2, H * 0.5, H * 0.92], [
    [0, 'rgba(0,0,0,0)'],
    [1, `rgba(1,2,6,${0.62 * a})`],
  ]);
  rect(g, 0, 0, W, H);
  g.restore();
}

export function grain(g, W, H, t, seed, a = 1) {
  const R = rng(seed + Math.floor(t * 14) * 7919);
  g.save();
  for (let i = 0; i < 130; i++) {
    const x = R() * W, y = R() * H, v = R();
    g.fillStyle = v > 0.5 ? `rgba(255,240,220,${0.028 * a})` : `rgba(0,0,10,${0.045 * a})`;
    rect(g, x, y, 1.6, 1.6);
  }
  g.restore();
}

// the signature move of this world: paint the night, then burn holes in it.
// lights = [{x,y,r,warmth,flick}] — darkness drawn into a layer, composited back.
export function darkness(g, W, H, lights, base = 0.78, o = {}) {
  if (o.darkFn) { o.darkFn(g, W, H, lights, base, o); return; }
  if (typeof document === 'undefined') return; // headless: the shot tool composites its own darkness
  if (!g.__darkLayer || g.__darkLayer.width !== W || g.__darkLayer.height !== H) {
    g.__darkLayer = makeLayer(W, H);
  }
  const c = g.__darkLayer, cg = c.getContext('2d');
  cg.globalCompositeOperation = 'source-over';
  cg.clearRect(0, 0, W, H);
  cg.fillStyle = `rgba(3,4,11,${base})`;
  cg.fillRect(0, 0, W, H);
  cg.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const r = Math.max(4, L.r);
    cg.fillStyle = grad(cg, 'r', [L.x, L.y, 0, L.x, L.y, r], [
      [0, `rgba(0,0,0,${L.core === undefined ? 0.95 : L.core})`],
      [0.42, `rgba(0,0,0,${(L.core === undefined ? 0.95 : L.core) * 0.58})`],
      [0.72, 'rgba(0,0,0,0.24)'],
      [0.92, 'rgba(0,0,0,0.06)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    cg.fillRect(L.x - r, L.y - r, r * 2, r * 2);
  }
  g.save();
  g.globalCompositeOperation = o.mode || 'source-over';
  g.drawImage(c, 0, 0, W, H);
  g.restore();
}

// --------------------------------------------------------------- set-dressing bits

export function banner(g, x, y, w, h, t, o = {}) {
  // a troupe banner hung between poles — reads even in silhouette
  const sag = 6 + Math.sin(t * 0.9) * 1.6;
  g.fillStyle = o.fill || '#2a1622';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.quadraticCurveTo(x + w * 0.5, y + sag, x, y);
  g.closePath(); g.fill();
  poly(g, [[x, y], [x + w, y], [x + w, y + h - sag * 0.4], [x + w * 0.5, y + h + sag], [x, y + h - sag * 0.4]], true);
  g.fillStyle = o.emblem || 'rgba(255,190,110,0.75)';
  ell(g, x + w / 2, y + h * 0.62, h * 0.16, h * 0.16);
  g.fillStyle = o.emblem || 'rgba(255,190,110,0.6)';
  ell(g, x + w / 2, y + h * 0.62, h * 0.07, h * 0.07);
}

export function fence(g, x0, x1, y, s, seed) {
  const R = rng(seed);
  g.strokeStyle = '#0a0d18'; g.lineWidth = 2.6 * s; g.lineCap = 'round';
  let x = x0;
  const ys = [];
  while (x < x1) {
    const hgt = (10 + R() * 8) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - hgt); g.stroke();
    ys.push([x, y - hgt * (0.4 + R() * 0.2)]);
    x += (10 + R() * 10) * s;
  }
  g.lineWidth = 1.6 * s;
  g.beginPath();
  for (let i = 0; i < ys.length; i++) { if (i) g.lineTo(ys[i][0], ys[i][1]); else g.moveTo(ys[i][0], ys[i][1]); }
  g.stroke();
}

export function cart(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const rock = Math.sin(t * 2.6) * (o.moving ? 1.1 : 0.2);
  g.translate(0, -Math.abs(Math.sin(t * 2.6)) * (o.moving ? 1 : 0));
  // wheels
  g.strokeStyle = 'rgba(130,150,200,0.22)'; g.lineWidth = 4.6;
  for (const [wx, wr] of [[-30, 12], [26, 10]]) { g.beginPath(); g.arc(wx, -wr, wr, 0, TAU); g.stroke(); }
  for (const [wx, wr] of [[-30, 12], [26, 10]]) {
    g.save(); g.translate(wx, -wr); g.rotate((o.wheel || 0) / wr);
    g.strokeStyle = '#0a0d18'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, wr, 0, TAU); g.stroke();
    g.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * TAU / 5) * wr, Math.sin(i * TAU / 5) * wr); g.stroke(); }
    g.restore();
  }
  // bed
  g.fillStyle = 'rgba(120,140,190,0.2)';
  poly(g, [[-46, -24 - rock], [48, -24 + rock], [44, -12 + rock], [-42, -12 - rock]], true);
  g.fillStyle = '#0a0d18';
  poly(g, [[-44, -22 - rock], [46, -22 + rock], [42, -13 + rock], [-40, -13 - rock]], true);
  // canopy arcs
  g.strokeStyle = '#0c1020'; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(-34 + i * 26, -22 + (i ? rock : rock));
    g.quadraticCurveTo(-22 + i * 26, -56 - rock, -8 + i * 26, -22 + rock);
    g.stroke();
  }
  g.fillStyle = '#1c1424';
  poly(g, [[-40, -22], [-30, -50], [34, -48], [46, -20], [30, -24], [-24, -26]], true);
  g.strokeStyle = 'rgba(150,170,220,0.16)'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-40, -22); g.lineTo(-30, -50); g.lineTo(34, -48); g.lineTo(46, -20);
  g.stroke();
  banner(g, -26, -46, 40, 9, t + 2, { fill: 'rgba(46,24,38,0.95)' });
  // the cart's own lamp
  lampObject(g, -42, -30 + rock, 0.62, o.lamp === undefined ? 1 : o.lamp, 'brass', t * 3);
  // crates
  g.fillStyle = '#0a0d18';
  rect(g, -6, -34 + rock, 16, 12); rect(g, 12, -30 + rock, 12, 9);
  g.restore();
}

// --------------------------------------------------------------- backdrops

// one function per place, used by scenes AND by tools/shot.mjs so screenshots are
// honest frames, not fan-art. t = seconds, o = scene-tuned options.
export function backdrop(g, W, H, kind, t = 0, o = {}) {
  const gy = o.groundY || H * 0.78;
  if (kind === 'duskfield' || kind === 'road' || kind === 'gloom') {
    const gloom = kind === 'gloom';
    sky(g, W, H, t, {
      seed: o.seed || 3, horizonY: gy - 40, glowStrength: gloom ? 0.4 : 1,
      low: gloom ? '#1c1730' : undefined, mid: gloom ? '#0d1226' : undefined,
      horizonGlow: gloom ? 0.4 : 1,
    });
    ridge(g, W, gy - 66, 46, (o.seed || 3) + 11, PAL.hillFar, t * 0.06, 2.2);
    ridge(g, W, gy - 34, 30, (o.seed || 3) + 21, PAL.hillMid, t * 0.09, 3);
    // ground plane, and the town standing on it like a tenant with papers
    g.fillStyle = grad(g, 'l', [0, gy, 0, H], [[0, '#0a0e1c'], [1, PAL.ground]]);
    rect(g, 0, gy, W, H - gy + 2);
    if (o.town !== false) town(g, -20, gy + 2, W * 0.5, (o.seed || 3) + 31, { t, dark: !o.townLights, fill: '#0e1226' });
    ridge(g, W, gy + 26, 10, (o.seed || 3) + 41, PAL.hillNear, t * 0.14, 4);
    // the road itself
    g.fillStyle = 'rgba(30,26,40,0.5)';
    poly(g, [[-10, H], [W * 0.34, gy], [W * 0.42, gy], [-40, H]], false);
    poly(g, [[W * 0.34, gy], [W * 0.42, gy], [W + 60, H], [W - 200, H]], false);
    fence(g, 0, W, gy + 26, 1, (o.seed || 3) + 5);
    for (let i = 0; i < 5; i++) {
      const tx = (i / 5) * W + ((o.seed || 3) * 37 + i * 91) % 60;
      deadTree(g, tx, gy - 6 + (i % 2) * 10, 0.6 + (i % 3) * 0.25, i * 13 + (o.seed || 3), { leaves: gloom ? undefined : 'rgba(24,20,40,0.9)' });
    }
    if (kind !== 'gloom') fogBands(g, W, gy - 10, 44, t, (o.seed || 3) + 9, 0.8);
    ash(g, W, H, t, (o.seed || 3) + 7, { a: gloom ? 1.6 : 1 });
    if (o.distantLamp) {
      lampObject(g, W * 0.375, gy - 44, 0.5, 1, 'street', t);
    }
  } else if (kind === 'village' || kind === 'square') {
    const night = kind === 'square' ? true : o.night;
    sky(g, W, H, t, { seed: o.seed || 9, horizonY: gy - 30, glowStrength: night ? 0.5 : 1 });
    ridge(g, W, gy - 90, 40, (o.seed || 9) + 2, PAL.hillFar, 0, 2.4);
    // houses around the square
    town(g, -10, gy - 8, W + 20, (o.seed || 9) + 5, { t, smoke: true, dark: false, fill: '#0a0e1c' });
    g.fillStyle = grad(g, 'l', [0, gy, 0, H], [[0, '#0c101e'], [1, '#05070f']]);
    rect(g, 0, gy, W, H - gy + 2);
    // well / fountain in the middle
    g.fillStyle = '#0a0d18';
    ell(g, W * 0.5, gy + 40, 66, 18);
    g.fillStyle = '#10152a';
    ell(g, W * 0.5, gy + 36, 58, 14);
    g.fillStyle = 'rgba(60,90,130,0.25)';
    ell(g, W * 0.5, gy + 38, 52, 11);
    if (o.lamp !== false) lampObject(g, W * 0.5, gy + 16, 0.9, night && o.lampOn !== false ? 1 : (o.lampOn === undefined ? 1 : 0), 'street', t);
    fogBands(g, W, gy + 30, 40, t, 3, 0.9);
    ash(g, W, H, t, 12, { a: 0.8 });
  } else if (kind === 'stage') {
    // interior, painted in warm browns with red drapes
    g.fillStyle = grad(g, 'l', [0, 0, 0, H], [[0, '#160d16'], [0.6, '#1c1018'], [1, '#0d0810']]);
    rect(g, 0, 0, W, H);
    const dw = W * 0.16;
    for (const side of [0, 1]) {
      const x0 = side ? W - dw : 0;
      g.fillStyle = grad(g, 'l', [x0, 0, x0 + dw, 0], side ? [[0, 'rgba(64,14,26,0.95)'], [1, 'rgba(20,6,14,1)']] : [[0, 'rgba(20,6,14,1)'], [1, 'rgba(64,14,26,0.95)']]);
      rect(g, x0, 0, dw, H);
      g.fillStyle = 'rgba(120,40,60,0.12)';
      for (let i = 0; i < 6; i++) {
        const fx = x0 + dw * (0.12 + i * 0.15);
        poly(g, [[fx, 0], [fx + 8, 0], [fx + 20 + Math.sin(i + t * 0.4) * 2, H], [fx + 8, H]], true);
      }
    }
    // valance
    g.fillStyle = 'rgba(74,16,32,0.9)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.12);
    for (let x = W; x >= 0; x -= W / 12) g.quadraticCurveTo(x - W / 24, H * 0.12 + (x % (W / 6) === 0 ? 20 : 20), x - W / 12, H * 0.12);
    g.closePath(); g.fill();
    // boards
    const py = o.floorY || H * 0.8;
    g.fillStyle = grad(g, 'l', [0, py, 0, H], [[0, '#241722'], [1, '#0d0810']]);
    rect(g, 0, py, W, H - py + 2);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 9; i++) rect(g, 0, py + (H - py) * i / 9, W, 1.4);
    // footlights
    for (let i = 0; i <= 10; i++) {
      const x = W * (0.08 + i * 0.084);
      lampObject(g, x, py - 2, 0.55, o.foot !== false ? 1 : 0, 'brass', t + i * 3);
    }
    // back-wall painted drop: a fake sunset over fake hills (the troupe sells the sun by the evening)
    const bx = W * 0.15, by = H * 0.2, bw = W * 0.66, bh = py - by - 6;
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#191531';
    rect(g, bx, by, bw, bh);
    g.fillStyle = grad(g, 'l', [0, by, 0, by + bh], [[0, 'rgba(32,30,64,0)'], [0.55, 'rgba(86,60,84,0.5)'], [1, 'rgba(150,88,60,0.55)']]);
    rect(g, bx, by, bw, bh);
    g.fillStyle = '#221d3d';
    g.beginPath();
    g.moveTo(bx, by + bh);
    for (let x = bx; x <= bx + bw; x += 18) {
      g.lineTo(x, by + bh - 26 - fbm(5, (x - bx) / (bw / 3), 2) * 26);
    }
    g.lineTo(bx + bw, by + bh); g.closePath(); g.fill();
    g.fillStyle = 'rgba(20,17,36,0.9)';
    g.beginPath();
    g.moveTo(bx, by + bh);
    for (let x = bx; x <= bx + bw; x += 22) {
      g.lineTo(x, by + bh - 12 - fbm(9, (x - bx) / (bw / 2.2), 2) * 14);
    }
    g.lineTo(bx + bw, by + bh); g.closePath(); g.fill();
    dimSun(g, bx + bw * 0.3, by + bh * 0.34, 8, t, 0.65);
    g.globalAlpha = 0.8;
    g.strokeStyle = 'rgba(10,8,16,1)'; g.lineWidth = 5;
    g.beginPath(); g.rect(bx, by, bw, bh); g.stroke();
    g.restore();
    if (o.backLamp) { lampObject(g, W * 0.88, H * 0.42, 0.8, 1, 'hall', t); }
  } else if (kind === 'camp') {
    sky(g, W, H, t, { seed: 21, horizonY: gy - 20, stars: true, glowStrength: 0.7 });
    ridge(g, W, gy - 50, 40, 31, PAL.hillFar, 0, 2);
    ridge(g, W, gy - 22, 26, 32, PAL.hillMid, 0, 2.6);
    ridge(g, W, gy, 12, 33, PAL.hillNear, 0, 3);
    g.fillStyle = grad(g, 'l', [0, gy, 0, H], [[0, '#0c0f1e'], [1, '#060812']]);
    rect(g, 0, gy, W, H - gy + 2);
    // ring of stones + fire pit
    const fx = o.fireX || W * 0.5, fy = o.fireY || gy + 46;
    g.fillStyle = '#171b2c';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ell(g, fx + Math.cos(a) * 46, fy + Math.sin(a) * 15, 7, 4.4); }
    if (o.fire !== false) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const fl = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 3.7);
      g.fillStyle = grad(g, 'r', [fx, fy - 6, 0, fx, fy - 6, 92], [
        [0, `rgba(255,208,140,${0.5 * fl})`], [0.45, `rgba(255,140,60,${0.22 * fl})`], [0.8, `rgba(255,110,48,${0.07 * fl})`], [1, 'rgba(255,90,40,0)'],
      ]);
      ell(g, fx, fy - 6, 118, 84);
      for (let i = 0; i < 5; i++) {
        const fh = 16 + 12 * Math.abs(Math.sin(t * (6 + i) + i * 2));
        g.fillStyle = `rgba(255,${150 + i * 18},80,${0.5 - i * 0.07})`;
        poly(g, [[fx - 10 + i * 4, fy - 2], [fx - 5 + i * 4 + Math.sin(t * 8 + i) * 2, fy - fh], [fx + i * 4, fy - 2]], true);
      }
      g.restore();
    }
    // cart parked behind
    cart(g, o.cartX || W * 0.82, gy + 8, 1.1, t, { moving: false, lamp: 1 });
    deadTree(g, W * 0.14, gy + 16, 1.5, 77, {});
    ash(g, W, H, t, 42, { a: 0.7, col: '255,190,120' });
  } else if (kind === 'bridge') {
    sky(g, W, H, t, { seed: 44, horizonY: H * 0.55, horizonGlow: 0.8 });
    ridge(g, W, H * 0.52, 46, 45, PAL.hillFar, 0, 1.8);
    // water below, barely there
    const wy = H * 0.7;
    g.fillStyle = grad(g, 'l', [0, wy, 0, H], [[0, '#0b1226'], [1, '#060a18']]);
    rect(g, 0, wy, W, H - wy);
    for (let i = 0; i < 10; i++) {
      const ww = 40 + (i * 53) % 90, xx = (i * W) / 10, yy = wy + 8 + ((i * 31) % 40);
      g.fillStyle = `rgba(130,150,200,${0.05 + (i % 3) * 0.02})`;
      g.save(); g.translate(xx, yy + Math.sin(t * 1.4 + i) * 2); rect(g, 0, 0, ww, 2); g.restore();
    }
    // the bridge deck and arches
    g.strokeStyle = '#070a15'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(-20, wy - 26); g.lineTo(W + 20, wy - 26); g.stroke();
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(W * 0.2, wy - 26); g.quadraticCurveTo(W * 0.32, wy - 78, W * 0.44, wy - 26); g.stroke();
    g.beginPath(); g.moveTo(W * 0.56, wy - 26); g.quadraticCurveTo(W * 0.68, wy - 78, W * 0.8, wy - 26); g.stroke();
    // toll gate frame
    g.fillStyle = '#0a0d18';
    rect(g, W * 0.46, wy - 130, 12, 104); rect(g, W * 0.54, wy - 130, 12, 104);
    poly(g, [[W * 0.44, wy - 130], [W * 0.58, wy - 130], [W * 0.51, wy - 160]], true);
    banner(g, W * 0.44, wy - 124, W * 0.14, 10, t, { fill: 'rgba(46,20,38,0.9)', emblem: 'rgba(220,200,255,0.4)' });
    // a lantern at the gate — someone lives here, terribly
    lampObject(g, W * 0.472, wy - 92, 0.8, o.gateLamp === undefined ? 1 : o.gateLamp, 'brass', t);
    fogBands(g, W, wy, 30, t, 4, 1.4);
    ash(g, W, H, t, 8, {});
  } else if (kind === 'hall') {
    // lamphall interior: arcade arches, hanging lamps
    g.fillStyle = grad(g, 'l', [0, 0, 0, H], [[0, '#100d1e'], [0.7, '#171022'], [1, '#0a0813']]);
    rect(g, 0, 0, W, H);
    const py = o.floorY || H * 0.72;
    // arches
    g.fillStyle = '#070611';
    for (let i = 0; i < 5; i++) {
      const ax = (i + 0.5) * (W / 5);
      g.beginPath();
      g.moveTo(ax - 66, py); g.lineTo(ax - 66, py - 120);
      g.quadraticCurveTo(ax, py - 210, ax + 66, py - 120); g.lineTo(ax + 66, py);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(20,16,40,0.9)';
      g.beginPath();
      g.moveTo(ax - 56, py); g.lineTo(ax - 56, py - 114);
      g.quadraticCurveTo(ax, py - 196, ax + 56, py - 114); g.lineTo(ax + 56, py);
      g.closePath(); g.fill();
      g.fillStyle = '#070611';
      g.fillRect(ax - 78, py - 216, 12, 216);
      g.fillRect(ax + 66, py - 216, 12, 216);
    }
    g.fillStyle = grad(g, 'l', [0, py, 0, H], [[0, '#1a1426'], [1, '#0a0813']]);
    rect(g, 0, py, W, H - py + 2);
    // reflections on the flagstones
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25;
    for (const L of o.lamps || []) {
      g.fillStyle = grad(g, 'l', [L.x, py, L.x, H], [[0, 'rgba(255,170,90,0.4)'], [1, 'rgba(255,170,90,0)']]);
      rect(g, L.x - 20, py, 40, H - py);
    }
    g.restore();
    (o.lamps || []).forEach((L, i) => lampObject(g, L.x, L.y, 0.8, o.lampLit ? o.lampLit[i] : 1, 'hall', t + i));
  } else if (kind === 'tower') {
    // the lamp room, up close: brass ribs and the great wick
    g.fillStyle = grad(g, 'l', [0, 0, 0, H], [[0, '#131027'], [1, '#0a0813']]);
    rect(g, 0, 0, W, H);
    g.strokeStyle = 'rgba(120,90,50,0.13)'; g.lineWidth = 2.4;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(W * 0.5 + (i - 3) * W * 0.14, 0); g.lineTo(W * 0.5 + (i - 3) * W * 0.18, H); g.stroke(); }
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(0, H * (0.2 + i * 0.24)); g.lineTo(W, H * (0.2 + i * 0.24)); g.stroke(); }
    // the great lamp on its plinth
    const lx = o.lampX || W * 0.5, ly = o.lampY || H * 0.62;
    g.fillStyle = '#0b0d19';
    poly(g, [[lx - 60, H * 0.84], [lx + 60, H * 0.84], [lx + 44, ly + 34], [lx - 44, ly + 34]], true);
    lampObject(g, lx, ly, 3.4, o.lampOn === undefined ? 1 : o.lampOn, 'sunkey', t);
    // windows: three tall lights of cold sea, mullioned
    for (let i = 0; i < 3; i++) {
      const wx = W * (0.16 + i * 0.34);
      const wy0 = H * 0.14, wy1 = H * 0.44;
      g.fillStyle = '#0c1226';
      g.beginPath();
      g.moveTo(wx - 26, wy1); g.lineTo(wx - 26, wy0 + 26);
      g.quadraticCurveTo(wx, wy0 - 8, wx + 26, wy0 + 26);
      g.lineTo(wx + 26, wy1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(96,124,182,0.16)';
      g.beginPath();
      g.moveTo(wx - 20, wy1 - 4); g.lineTo(wx - 20, wy0 + 28);
      g.quadraticCurveTo(wx, wy0 + 2, wx + 20, wy0 + 28);
      g.lineTo(wx + 20, wy1 - 4); g.closePath(); g.fill();
      g.fillStyle = 'rgba(140,170,220,0.10)';
      rect(g, wx - 1.5, wy0 + 4, 3, wy1 - wy0 - 10);
    }
  } else if (kind === 'cliff') {
    sky(g, W, H, t, { seed: 51, horizonY: H * 0.52, horizonGlow: 0.9, glowX: W * 0.5 });
    // the sea, flat and pewter, one hard waterline
    const wy = H * 0.52;
    g.fillStyle = 'rgba(150,170,215,0.14)';
    rect(g, 0, wy - 1, W * 0.62, 2.2);
    g.fillStyle = grad(g, 'l', [0, wy, 0, H], [[0, '#0d1330'], [1, '#05070f']]);
    rect(g, 0, wy, W, H - wy);
    for (let i = 0; i < 14; i++) {
      const yy = wy + 10 + ((i * 41) % (H - wy - 14));
      g.fillStyle = `rgba(140,160,210,${0.03 + (i % 4) * 0.012})`;
      rect(g, (i * 173) % W, yy, 50 + (i % 5) * 30, 1.6);
    }
    // the headland: a cape that ends at the water, like everything else here
    const wy124 = wy - 124;
    g.fillStyle = '#0a0d1a';
    g.beginPath();
    g.moveTo(W + 40, 560);
    g.lineTo(W + 40, wy124 - 6);
    g.lineTo(W * 0.915, wy124 - 18);
    g.lineTo(W * 0.845, wy124 - 22);
    g.lineTo(W * 0.74, wy124 - 4);
    g.lineTo(W * 0.665, wy124 + 34);
    g.lineTo(W * 0.6, wy - 46);
    g.lineTo(W * 0.545, wy + 2);
    // the shore: where the rock finally kneels
    g.quadraticCurveTo(W * 0.62, wy + 52, W * 0.76, wy + 92);
    g.quadraticCurveTo(W * 0.9, wy + 140, W + 40, wy + 190);
    g.closePath(); g.fill();
    // the day, remembering the ridge from behind
    g.fillStyle = 'rgba(126,136,196,0.10)';
    poly(g, [[W * 0.665, wy124 + 34], [W * 0.74, wy124 - 4], [W * 0.845, wy124 - 22], [W * 0.915, wy124 - 18], [W + 40, wy124 - 6], [W + 40, wy124 + 10], [W * 0.9, wy124 + 4], [W * 0.84, wy124 - 10], [W * 0.75, wy124 + 6], [W * 0.68, wy124 + 44]], true);
    // surf, thin and patient, along the whole shore
    g.strokeStyle = 'rgba(170,190,235,0.14)'; g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(W * 0.545, wy + 2);
    g.quadraticCurveTo(W * 0.62, wy + 52, W * 0.76, wy + 92);
    g.quadraticCurveTo(W * 0.9, wy + 140, W + 40, wy + 190);
    g.stroke();
    lighthouse(g, W * 0.775, wy124 - 16, 0.72, t, { lit: o.lit !== false });
    fogBands(g, W * 0.55, wy + 20, 52, t, 12, 1.35);
    ash(g, W, H, t, 9, {});
    // the pilgrim's stair, cut into the cliff's face and ending at the shore
    g.strokeStyle = 'rgba(150,160,210,0.08)'; g.lineWidth = 3;
    g.setLineDash([12, 16]);
    g.beginPath();
    g.moveTo(W * 0.6, wy + 66);
    g.quadraticCurveTo(W * 0.655, wy + 8, W * 0.64, wy - 46);
    g.quadraticCurveTo(W * 0.66, wy124 + 26, W * 0.7, wy124 + 18);
    g.stroke();
    g.setLineDash([]);
  } else if (kind === 'council') {
    g.fillStyle = grad(g, 'l', [0, 0, 0, H], [[0, '#120e1c'], [1, '#0a0813']]);
    rect(g, 0, 0, W, H);
    // long table of the Candleholders
    g.fillStyle = '#0d0a16';
    poly(g, [[W * 0.12, H * 0.62], [W * 0.88, H * 0.62], [W, H * 0.74], [0, H * 0.74]], true);
    g.fillStyle = 'rgba(90,60,60,0.12)';
    poly(g, [[W * 0.14, H * 0.6], [W * 0.86, H * 0.6], [W * 0.88, H * 0.62], [W * 0.12, H * 0.62]], true);
    for (let i = 0; i < 7; i++) {
      const sx = W * (0.16 + i * 0.115);
      figure(g, sx, H * 0.62 + 4, 0.62, { who: i === 3 ? 'auditor' : 'crowd', pose: 'idle', phase: t + i * 2, dir: i < 3 ? 1 : -1, rim: 'rgba(140,160,210,0.25)' });
      if (i % 2 === 0) lampObject(g, sx + 14, H * 0.6, 0.4, 1, 'brass', t + i * 5);
    }
    // banner of the Wickwright Union: a flame inside a stamp
    banner(g, W * 0.3, H * 0.1, W * 0.4, H * 0.14, t, { fill: 'rgba(30,26,48,0.9)', emblem: 'rgba(160,180,230,0.5)' });
    (o.lamps || []).forEach((L, i) => lampObject(g, L.x, L.y, 0.7, 1, 'hall', t + i * 2));
  } else if (kind === 'lamproom-dark') {
    g.fillStyle = '#070611'; rect(g, 0, 0, W, H);
    g.strokeStyle = 'rgba(80,70,50,0.15)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * W / 8, 0); g.lineTo(i * W / 8, H); g.stroke(); }
  } else {
    g.fillStyle = '#060812'; rect(g, 0, 0, W, H);
    ash(g, W, H, t, 1, {});
  }
}

// convenience for scenes that want a hex-free palette reference
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}

export function crowdHeadsSilhouette(g, W, y, seed, t, mood, o = {}) {
  const R = rng(seed);
  for (let i = 0; i < (o.n || 40); i++) {
    const x = R() * W, dy = (i % 3) * 14;
    const bob = Math.abs(Math.sin(t * (1 + R()) + i)) * (1 + mood * 7);
    g.fillStyle = `rgba(2,3,9,${0.9 - dy * 0.02})`;
    ell(g, x, y + dy - bob, 8 + R() * 4, 10 + R() * 5);
    ell(g, x, y + dy + 16 - bob, 16 + R() * 8, 14);
  }
}
