// All dinosaurs are drawn as vector shapes at runtime — no image assets.
// Shapes are authored pointing along +x; the caller rotates by entity.angle.

import { TAU, clamp } from './utils.js';

function limb(g, x0, y0, x1, y1, x2, y2, width, color) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** Tapered, wiggling tail built as a filled ribbon. */
function tail(g, u, phase, length, baseW, color, tipColor) {
  const segs = 8;
  const top = [];
  const bot = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -1.1 * u - t * length;
    const w = baseW * (1 - t) * (1 - t * 0.25);
    const wig = Math.sin(phase * 0.9 - t * 2.6) * u * 0.55 * t * t;
    top.push([x, wig - w]);
    bot.push([x, wig + w]);
  }
  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= segs; i++) g.lineTo(top[i][0], top[i][1]);
  for (let i = segs; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  // darker underside stripe
  g.beginPath();
  g.moveTo(bot[0][0], bot[0][1]);
  for (let i = 1; i <= segs; i++) g.lineTo(bot[i][0], bot[i][1]);
  g.strokeStyle = tipColor;
  g.lineWidth = Math.max(1, baseW * 0.4);
  g.stroke();
}

/** Two running legs for a biped. */
function bipedLegs(g, u, phase, hipX, color, dark) {
  for (const side of [-1, 1]) {
    const p = phase + (side > 0 ? 0 : Math.PI);
    const swing = Math.sin(p);
    const lift = Math.max(0, Math.cos(p));
    const hx = hipX;
    const hy = side * 0.34 * u;
    const kx = hx + swing * 0.55 * u;
    const ky = hy + side * 0.42 * u;
    const fx = kx + swing * 0.5 * u;
    const fy = ky + side * (0.18 + lift * 0.22) * u;
    limb(g, hx, hy, kx, ky, fx, fy, u * 0.42, side > 0 ? color : dark);
    // claws
    g.strokeStyle = '#2a2018';
    g.lineWidth = Math.max(1, u * 0.13);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + u * 0.3, fy);
    g.stroke();
  }
}

/** Four legs for a quadruped. */
function quadLegs(g, u, phase, color, dark, spread = 0.9) {
  const hips = [
    [-0.85 * u * spread, -1],
    [-0.85 * u * spread, 1],
    [0.7 * u * spread, -1],
    [0.7 * u * spread, 1],
  ];
  hips.forEach(([hx, side], i) => {
    const p = phase + (i % 2 === 0 ? 0 : Math.PI) + (i > 1 ? Math.PI / 2 : 0);
    const swing = Math.sin(p) * 0.42;
    const lift = Math.max(0, Math.cos(p));
    const hy = side * 0.34 * u;
    const kx = hx + swing * u;
    const ky = hy + side * 0.3 * u;
    const fx = kx + swing * u * 0.6;
    const fy = ky + side * (0.1 + lift * 0.16) * u;
    limb(g, hx, hy, kx, ky, fx, fy, u * 0.2, i % 2 === 0 ? color : dark);
  });
}

function shade(hex, amt) {
  // hex like #rrggbb
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = clamp(Math.round(r + amt), 0, 255);
  g = clamp(Math.round(g + amt), 0, 255);
  b = clamp(Math.round(b + amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------------- theropods

/** T-rex and raptors: bipedal, big head, long counter-balancing tail. */
function drawTheropod(g, e, opts) {
  const u = e.scale * 13;
  const c = opts;
  const phase = e.moving ? e.phase : Math.sin(e.phase * 0.25) * 0.4;

  // tail
  tail(g, u, phase, 2.6 * u, 0.62 * u, c.body, shade(c.body, -34));

  // legs
  bipedLegs(g, u, phase, -0.15 * u, shade(c.body, -22), shade(c.body, -58));

  // body
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0, 0, 1.25 * u, 0.78 * u, 0, 0, TAU);
  g.fill();
  // belly
  g.fillStyle = c.belly;
  g.globalAlpha = 0.85;
  g.beginPath();
  g.ellipse(-0.1 * u, 0.24 * u, 0.95 * u, 0.4 * u, 0, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
  // flank stripes
  g.strokeStyle = c.stripe;
  g.lineWidth = u * 0.13;
  for (let i = 0; i < 3; i++) {
    const x = -0.7 * u + i * 0.5 * u;
    g.beginPath();
    g.moveTo(x, -0.7 * u);
    g.lineTo(x - 0.14 * u, -0.1 * u);
    g.stroke();
  }

  // tiny arms
  const armSwing = Math.sin(phase) * 0.12 * u;
  g.strokeStyle = shade(c.body, -18);
  g.lineWidth = u * 0.16;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(0.55 * u, side * 0.45 * u);
    g.lineTo(0.8 * u + armSwing, side * 0.6 * u);
    g.stroke();
  }

  // neck + head
  const jaw = opts.jawOpen || 0;
  g.fillStyle = c.body;
  g.beginPath();
  g.moveTo(0.5 * u, -0.5 * u);
  g.quadraticCurveTo(1.5 * u, -0.42 * u, 1.75 * u, -0.2 * u);
  g.lineTo(1.75 * u, 0.28 * u);
  g.quadraticCurveTo(1.4 * u, 0.5 * u, 0.5 * u, 0.5 * u);
  g.closePath();
  g.fill();

  // skull
  g.save();
  g.translate(1.7 * u, 0);
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0.42 * u, 0, 0.85 * u, 0.36 * u, 0, 0, TAU);
  g.fill();
  // lower jaw drops on a bite
  g.save();
  g.translate(-0.2 * u, 0.16 * u);
  g.rotate(jaw * 0.5);
  g.fillStyle = shade(c.body, -30);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1.05 * u, 0.02 * u);
  g.lineTo(1.0 * u, 0.3 * u);
  g.lineTo(0, 0.28 * u);
  g.closePath();
  g.fill();
  // teeth
  g.fillStyle = '#f2ead2';
  for (let i = 0; i < 4; i++) {
    const tx = 0.2 * u + i * 0.22 * u;
    g.beginPath();
    g.moveTo(tx, 0.02 * u);
    g.lineTo(tx + 0.09 * u, -0.14 * u);
    g.lineTo(tx + 0.18 * u, 0.02 * u);
    g.closePath();
    g.fill();
  }
  g.restore();
  // upper teeth
  g.fillStyle = '#f2ead2';
  for (let i = 0; i < 4; i++) {
    const tx = 0.25 * u + i * 0.22 * u;
    g.beginPath();
    g.moveTo(tx, 0.1 * u);
    g.lineTo(tx + 0.09 * u, 0.26 * u);
    g.lineTo(tx + 0.18 * u, 0.1 * u);
    g.closePath();
    g.fill();
  }
  // eye + brow
  g.fillStyle = '#2a1d10';
  g.beginPath();
  g.arc(0.42 * u, -0.14 * u, 0.13 * u, 0, TAU);
  g.fill();
  g.fillStyle = '#e0b64a';
  g.beginPath();
  g.arc(0.45 * u, -0.15 * u, 0.07 * u, 0, TAU);
  g.fill();
  // crest for raptors
  if (c.crest) {
    g.fillStyle = c.crest;
    for (let i = 0; i < 4; i++) {
      const bx = -0.2 * u + i * 0.24 * u;
      g.beginPath();
      g.moveTo(bx, -0.3 * u);
      g.lineTo(bx + 0.12 * u, -0.62 * u);
      g.lineTo(bx + 0.24 * u, -0.28 * u);
      g.closePath();
      g.fill();
    }
  }
  g.restore();

  // dorsal scutes down the spine
  g.fillStyle = shade(c.body, -40);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = 0.9 * u - t * 2.2 * u;
    const wig = Math.sin(phase * 0.9 - t * 2.6) * u * 0.5 * t * t;
    const s = (1 - t) * 0.22 * u + 0.05 * u;
    g.beginPath();
    g.moveTo(x - s, wig - 0.05 * u);
    g.lineTo(x, wig - s * 1.9);
    g.lineTo(x + s, wig - 0.05 * u);
    g.closePath();
    g.fill();
  }
}

// ----------------------------------------------------------------- herbivores

/** Gazelle / parasaur / triceratops — quadrupeds with a raised head. */
function drawQuadruped(g, e, c) {
  const u = e.scale * 13;
  const phase = e.moving ? e.phase : Math.sin(e.phase * 0.3) * 0.3;
  const blown = e.blown ? Math.sin(e.phase * 8) * 0.05 : 0;

  // tail
  g.strokeStyle = shade(c.body, -20);
  g.lineWidth = u * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-1.15 * u, 0);
  g.quadraticCurveTo(
    -1.6 * u,
    Math.sin(phase) * 0.3 * u,
    -1.9 * u,
    Math.sin(phase) * 0.5 * u
  );
  g.stroke();

  quadLegs(g, u, phase, shade(c.body, -14), shade(c.body, -46), 1.0);

  // body
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0, 0, 1.25 * u, 0.7 * u, 0, 0, TAU);
  g.fill();
  g.fillStyle = c.belly;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.ellipse(-0.1 * u, 0.2 * u, 0.9 * u, 0.34 * u, 0, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
  // saddle marking
  g.strokeStyle = c.stripe;
  g.lineWidth = u * 0.22;
  g.beginPath();
  g.moveTo(-0.6 * u, 0);
  g.lineTo(0.6 * u, 0);
  g.stroke();

  // neck rising to the head
  g.save();
  g.translate(0.95 * u, 0);
  g.rotate(blown);
  g.fillStyle = c.body;
  g.beginPath();
  g.moveTo(-0.2 * u, -0.34 * u);
  g.quadraticCurveTo(0.6 * u, -0.42 * u, 0.95 * u, -0.2 * u);
  g.lineTo(0.9 * u, 0.3 * u);
  g.quadraticCurveTo(0.4 * u, 0.44 * u, -0.2 * u, 0.34 * u);
  g.closePath();
  g.fill();

  // head
  g.save();
  g.translate(1.0 * u, 0);
  g.fillStyle = shade(c.body, 8);
  g.beginPath();
  g.ellipse(0.3 * u, 0, 0.52 * u, 0.3 * u, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#2a2018';
  g.beginPath();
  g.arc(0.72 * u, 0, 0.07 * u, 0, TAU);
  g.fill();
  g.fillStyle = '#1d150e';
  g.beginPath();
  g.arc(0.24 * u, -0.12 * u, 0.07 * u, 0, TAU);
  g.fill();

  if (c.horns === 'gazelle') {
    g.strokeStyle = '#3a2d1e';
    g.lineWidth = u * 0.11;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.16 * u, side * 0.16 * u);
      g.quadraticCurveTo(0.06 * u, side * 0.4 * u, -0.18 * u, side * 0.5 * u);
      g.stroke();
    }
  } else if (c.horns === 'crest') {
    g.fillStyle = c.crest || '#c98f3a';
    g.beginPath();
    g.moveTo(0.1 * u, -0.2 * u);
    g.quadraticCurveTo(-0.25 * u, -0.62 * u, -0.75 * u, -0.8 * u);
    g.quadraticCurveTo(-0.2 * u, -0.5 * u, -0.05 * u, -0.12 * u);
    g.closePath();
    g.fill();
  } else if (c.horns === 'frill') {
    // frill
    g.fillStyle = c.crest || '#9c8a5e';
    g.beginPath();
    g.ellipse(-0.05 * u, 0, 0.3 * u, 0.66 * u, 0, 0, TAU);
    g.fill();
    g.strokeStyle = shade(c.crest || '#9c8a5e', -40);
    g.lineWidth = u * 0.05;
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + (i / 6) * 2.4;
      g.beginPath();
      g.moveTo(-0.05 * u, 0);
      g.lineTo(-0.05 * u + Math.cos(a) * 0.3 * u, Math.sin(a) * 0.66 * u);
      g.stroke();
    }
    // three horns
    g.fillStyle = '#e8dcc0';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(0.3 * u, side * 0.18 * u);
      g.lineTo(0.95 * u, side * 0.34 * u);
      g.lineTo(0.32 * u, side * 0.3 * u);
      g.closePath();
      g.fill();
    }
    g.beginPath();
    g.moveTo(0.62 * u, 0);
    g.lineTo(1.05 * u, 0);
    g.lineTo(0.62 * u, 0.1 * u);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.restore();
}

// --------------------------------------------------------------------- public

export function drawShadow(g, e, squash = 1) {
  const r = e.radius * 1.5 * (e.scale ? 1 : 1);
  g.fillStyle = 'rgba(8,16,8,0.32)';
  g.beginPath();
  g.ellipse(e.x + r * 0.22, e.y + r * 0.34, r * 1.15, r * 0.72 * squash, e.angle, 0, TAU);
  g.fill();
}

/** Jaw-open amount for the player's bite animation. */
function jawOpenFor(e) {
  if (!e.biting) return 0;
  const t = e.biteTimer;
  const total = e.cfg.biteWindup + e.cfg.biteStrike;
  const k = 1 - t / total;
  // snap open fast, then close
  return k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.55);
}

export function drawCreature(g, e, time) {
  g.save();
  g.translate(e.x, e.y);
  g.rotate(e.angle);
  if (e.lunge) g.translate(e.lunge * 6, 0);

  const cfg = e.cfg;
  if (e.kind === 'trex') {
    drawTheropod(g, e, {
      body: '#6f7a3f',
      belly: '#c9c48a',
      stripe: '#4a5228',
      jawOpen: jawOpenFor(e),
    });
  } else if (e.kind === 'raptor') {
    drawTheropod(g, e, {
      body: cfg.body,
      belly: cfg.belly,
      stripe: cfg.stripe,
      crest: '#d9622b',
      jawOpen: 0.25,
    });
  } else if (e.kind === 'triceratops') {
    drawQuadruped(g, e, { ...cfg, horns: 'frill', crest: '#a8946a' });
  } else if (e.kind === 'parasaurolophus') {
    drawQuadruped(g, e, { ...cfg, horns: 'crest', crest: '#d98f3a' });
  } else {
    drawQuadruped(g, e, { ...cfg, horns: 'gazelle' });
  }

  // damage flash
  if (e.flash > 0) {
    g.globalAlpha = e.flash * 0.55;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, e.radius * 1.7, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  // "exhausted" tell: a blown animal breathes hard
  if (e.blown) {
    g.save();
    g.globalAlpha = 0.5 + Math.sin(time * 12) * 0.25;
    g.fillStyle = '#efe3c8';
    g.beginPath();
    g.arc(e.x, e.y - e.radius * 2.4, 3, 0, TAU);
    g.fill();
    g.restore();
  }
  // alert tell
  if (e.alert > 0.2 && e.kind !== 'trex' && e.kind !== 'raptor') {
    g.save();
    g.globalAlpha = e.alert * 0.9;
    g.strokeStyle = '#e0b64a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(e.x - 5, e.y - e.radius * 2.6);
    g.lineTo(e.x + 5, e.y - e.radius * 2.6);
    g.stroke();
    g.restore();
  }
}

/** The bite cone, briefly, so the player can read their reach. */
export function drawBiteCone(g, e) {
  if (!e.biting) return;
  const t = 1 - e.biteTimer / (e.cfg.biteWindup + e.cfg.biteStrike);
  g.save();
  g.translate(e.x, e.y);
  g.rotate(e.angle);
  g.globalAlpha = 0.28 * (1 - t);
  const grad = g.createRadialGradient(0, 0, e.radius, 0, 0, e.cfg.biteRange);
  grad.addColorStop(0, 'rgba(255,240,190,0.75)');
  grad.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, e.cfg.biteRange, -e.cfg.biteArc * 0.5, e.cfg.biteArc * 0.5);
  g.closePath();
  g.fill();
  g.restore();
  g.globalAlpha = 1;
}

/** Aim reticle showing where the jaws point. */
export function drawAim(g, e, active) {
  if (!active) return;
  const r = e.cfg.biteRange;
  g.save();
  g.globalAlpha = 0.35;
  g.strokeStyle = 'rgba(239,227,200,0.8)';
  g.lineWidth = 1.5;
  g.setLineDash([6, 8]);
  g.beginPath();
  g.arc(e.x, e.y, r, e.angle - e.cfg.biteArc * 0.5, e.angle + e.cfg.biteArc * 0.5);
  g.stroke();
  g.setLineDash([]);
  g.restore();
  g.globalAlpha = 1;
}
