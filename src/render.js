// All dinosaurs are drawn as vector shapes at runtime — no image assets.
// Shapes are authored pointing along +x; the caller rotates by entity.angle.
//
// The look is built in layers for readability and richness:
//   base silhouette -> belly shadow -> dorsal highlight -> outline -> details
// and the whole body is posed each frame (gait, banking lean, sprint stretch,
// head bob, speed-tied tail swish) so the animals read as alive.

import { TAU, clamp, lerp } from './utils.js';

const OUTLINE = 'rgba(16,22,14,0.55)';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = clamp(Math.round(r + amt), 0, 255);
  g = clamp(Math.round(g + amt), 0, 255);
  b = clamp(Math.round(b + amt), 0, 255);
  return `rgb(${r},${g},${b})`;
}

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

/** Per-frame pose derived from an entity's velocity and turn rate. */
function poseFor(e) {
  const sp = e.speed || 0;
  const moving = sp > 12;
  const run = clamp(sp / 340, 0, 1);
  return {
    gait: moving ? e.phase : Math.sin(e.phase * 0.3) * 0.35,
    lean: e.turnLean || 0,
    run,
    stretch: run * 0.15,
    bob: Math.sin(e.phase * 2) * (0.25 + 0.75 * run),
    swish: 0.35 + 0.65 * run,
    moving,
  };
}

/** Tapered, wiggling tail ribbon. `swish` scales the amplitude with speed. */
function tail(g, u, phase, length, baseW, color, tipColor, swish = 1) {
  const segs = 9;
  const top = [];
  const bot = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = -1.1 * u - t * length;
    const w = baseW * (1 - t) * (1 - t * 0.25);
    const wig = Math.sin(phase * 0.9 - t * 2.6) * u * 0.6 * t * t * swish;
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
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, u * 0.08);
  g.stroke();
  // darker underside stripe
  g.beginPath();
  g.moveTo(bot[0][0], bot[0][1]);
  for (let i = 1; i <= segs; i++) g.lineTo(bot[i][0], bot[i][1]);
  g.strokeStyle = tipColor;
  g.lineWidth = Math.max(1, baseW * 0.35);
  g.stroke();
}

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
    const fy = ky + side * (0.18 + lift * 0.3) * u;
    limb(g, hx, hy, kx, ky, fx, fy, u * 0.4, side > 0 ? color : dark);
    g.strokeStyle = '#241b12';
    g.lineWidth = Math.max(1, u * 0.13);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + u * 0.3, fy);
    g.stroke();
  }
}

function quadLegs(g, u, phase, color, dark, spread = 1) {
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
    const fy = ky + side * (0.1 + lift * 0.2) * u;
    limb(g, hx, hy, kx, ky, fx, fy, u * 0.2, i % 2 === 0 ? color : dark);
  });
}

/** Soft dorsal highlight + belly shadow + outline over the body ellipse. */
function bodyShading(g, u, c, rx, ry) {
  // belly shadow
  g.fillStyle = shade(c.body, -26);
  g.globalAlpha = 0.5;
  g.beginPath();
  g.ellipse(-0.12 * u, 0.3 * u, rx * 0.85, ry * 0.45, 0, 0, TAU);
  g.fill();
  // dorsal highlight toward the head/top
  g.fillStyle = shade(c.body, 26);
  g.globalAlpha = 0.4;
  g.beginPath();
  g.ellipse(0.25 * u, -0.28 * u, rx * 0.62, ry * 0.4, -0.2, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
  // outline for separation from the ground
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, u * 0.09);
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, TAU);
  g.stroke();
}

// ------------------------------------------------------------------- theropods

function drawTheropod(g, e, c, pose) {
  const u = e.scale * 13;
  const { gait, bob, swish } = pose;

  tail(g, u, gait, 2.7 * u, 0.62 * u, c.body, shade(c.body, -40), swish);
  bipedLegs(g, u, gait, -0.15 * u, shade(c.body, -24), shade(c.body, -60));

  // body
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0, 0, 1.25 * u, 0.78 * u, 0, 0, TAU);
  g.fill();
  bodyShading(g, u, c, 1.25 * u, 0.78 * u);

  // flank stripes
  g.strokeStyle = c.stripe;
  g.lineWidth = u * 0.13;
  g.globalAlpha = 0.8;
  for (let i = 0; i < 3; i++) {
    const x = -0.7 * u + i * 0.5 * u;
    g.beginPath();
    g.moveTo(x, -0.66 * u);
    g.quadraticCurveTo(x - 0.1 * u, -0.3 * u, x - 0.16 * u, 0.05 * u);
    g.stroke();
  }
  g.globalAlpha = 1;

  // tiny arms
  const armSwing = Math.sin(gait) * 0.14 * u;
  g.strokeStyle = shade(c.body, -18);
  g.lineWidth = u * 0.15;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(0.55 * u, side * 0.45 * u);
    g.quadraticCurveTo(0.72 * u, side * 0.55 * u, 0.82 * u + armSwing, side * 0.6 * u);
    g.stroke();
  }

  // neck + head (head pumps forward with the stride)
  const pump = Math.sin(gait * 2) * 0.12 * u;
  const jaw = c.jawOpen || 0;
  g.save();
  g.translate(pump, 0);

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
  g.rotate(bob * 0.06);
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0.42 * u, 0, 0.85 * u, 0.36 * u, 0, 0, TAU);
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, u * 0.08);
  g.stroke();
  // brow ridge
  g.fillStyle = shade(c.body, -18);
  g.beginPath();
  g.ellipse(0.36 * u, -0.2 * u, 0.4 * u, 0.12 * u, 0, 0, TAU);
  g.fill();

  // lower jaw drops on a bite
  g.save();
  g.translate(-0.2 * u, 0.16 * u);
  g.rotate(jaw * 0.55);
  g.fillStyle = shade(c.body, -30);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(1.05 * u, 0.02 * u);
  g.lineTo(1.0 * u, 0.3 * u);
  g.lineTo(0, 0.28 * u);
  g.closePath();
  g.fill();
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
  // eye
  g.fillStyle = '#241708';
  g.beginPath();
  g.arc(0.42 * u, -0.13 * u, 0.13 * u, 0, TAU);
  g.fill();
  g.fillStyle = '#e0b64a';
  g.beginPath();
  g.arc(0.45 * u, -0.14 * u, 0.06 * u, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(0.47 * u, -0.16 * u, 0.025 * u, 0, TAU);
  g.fill();

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
  g.restore(); // skull
  g.restore(); // neck pump

  // dorsal scutes down the spine, swaying with the tail
  g.fillStyle = shade(c.body, -46);
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const x = 0.9 * u - t * 2.3 * u;
    const wig = Math.sin(gait * 0.9 - t * 2.6) * u * 0.5 * t * t * swish;
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

function drawQuadruped(g, e, c, pose) {
  const u = e.scale * 13;
  const { gait, bob, swish } = pose;
  const blown = e.blown ? Math.sin(e.phase * 8) * 0.05 : 0;

  // tail
  g.strokeStyle = shade(c.body, -20);
  g.lineWidth = u * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-1.15 * u, 0);
  g.quadraticCurveTo(-1.6 * u, Math.sin(gait) * 0.3 * u * swish, -1.95 * u, Math.sin(gait) * 0.5 * u * swish);
  g.stroke();

  quadLegs(g, u, gait, shade(c.body, -14), shade(c.body, -48), 1.0);

  // body
  g.fillStyle = c.body;
  g.beginPath();
  g.ellipse(0, 0, 1.25 * u, 0.7 * u, 0, 0, TAU);
  g.fill();
  bodyShading(g, u, c, 1.25 * u, 0.7 * u);

  // saddle marking
  g.strokeStyle = c.stripe;
  g.lineWidth = u * 0.2;
  g.globalAlpha = 0.85;
  g.beginPath();
  g.moveTo(-0.6 * u, 0);
  g.lineTo(0.6 * u, 0);
  g.stroke();
  g.globalAlpha = 1;

  // neck + raised head (bobs with the stride)
  g.save();
  g.translate(0.95 * u, 0);
  g.rotate(blown + bob * 0.04);
  g.fillStyle = c.body;
  g.beginPath();
  g.moveTo(-0.2 * u, -0.34 * u);
  g.quadraticCurveTo(0.6 * u, -0.42 * u, 0.95 * u, -0.2 * u);
  g.lineTo(0.9 * u, 0.3 * u);
  g.quadraticCurveTo(0.4 * u, 0.44 * u, -0.2 * u, 0.34 * u);
  g.closePath();
  g.fill();

  g.save();
  g.translate(1.0 * u, 0);
  g.fillStyle = shade(c.body, 10);
  g.beginPath();
  g.ellipse(0.3 * u, 0, 0.52 * u, 0.3 * u, 0, 0, TAU);
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = Math.max(1, u * 0.07);
  g.stroke();
  g.fillStyle = '#241b12';
  g.beginPath();
  g.arc(0.72 * u, 0, 0.07 * u, 0, TAU);
  g.fill();
  g.fillStyle = '#170f08';
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
    g.strokeStyle = shade(c.crest || '#c98f3a', -30);
    g.lineWidth = u * 0.05;
    g.stroke();
  } else if (c.horns === 'frill') {
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
  g.restore(); // head
  g.restore(); // neck
}

// --------------------------------------------------------------------- public

export function drawShadow(g, e) {
  const r = e.radius * 1.5;
  // soften + stretch the shadow slightly with speed for a grounded feel
  const stretch = 1 + clamp(e.speed / 900, 0, 0.25);
  g.fillStyle = 'rgba(8,16,8,0.3)';
  g.beginPath();
  g.ellipse(e.x + r * 0.22, e.y + r * 0.34, r * 1.15 * stretch, r * 0.7, e.angle, 0, TAU);
  g.fill();
}

function jawOpenFor(e) {
  if (!e.biting) return 0;
  const t = e.biteTimer;
  const total = e.cfg.biteWindup + e.cfg.biteStrike;
  const k = 1 - t / total;
  return k < 0.45 ? k / 0.45 : Math.max(0, 1 - (k - 0.45) / 0.55);
}

export function drawCreature(g, e, time) {
  const pose = poseFor(e);
  g.save();
  g.translate(e.x, e.y);
  g.rotate(e.angle + pose.lean * 0.06);
  // banking + sprint stretch about the body axis
  g.scale(1 + pose.stretch, 1 - pose.stretch * 0.5 - Math.abs(pose.lean) * 0.05);
  if (e.lunge) g.translate(e.lunge * 7, 0);

  const cfg = e.cfg;
  if (e.kind === 'trex') {
    drawTheropod(g, e, { body: '#6f7a3f', belly: '#c9c48a', stripe: '#4a5228', jawOpen: jawOpenFor(e) }, pose);
  } else if (e.kind === 'raptor') {
    drawTheropod(g, e, { body: cfg.body, belly: cfg.belly, stripe: cfg.stripe, crest: '#d9622b', jawOpen: 0.25 }, pose);
  } else if (e.kind === 'triceratops') {
    drawQuadruped(g, e, { ...cfg, horns: 'frill', crest: '#a8946a' }, pose);
  } else if (e.kind === 'parasaurolophus') {
    drawQuadruped(g, e, { ...cfg, horns: 'crest', crest: '#d98f3a' }, pose);
  } else {
    drawQuadruped(g, e, { ...cfg, horns: 'gazelle' }, pose);
  }

  if (e.flash > 0) {
    g.globalAlpha = e.flash * 0.55;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, e.radius * 1.7, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  // exhausted tell
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

/** Motion streaks behind a sprinting creature. */
export function drawSpeedLines(g, e) {
  if (!e.moving || e.speed < 300) return;
  const k = clamp((e.speed - 300) / 200, 0, 1);
  const back = e.angle + Math.PI;
  g.save();
  g.globalAlpha = 0.35 * k;
  g.strokeStyle = 'rgba(239,236,210,0.9)';
  g.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    const off = i * e.radius * 0.7;
    const px = e.x + Math.cos(back + Math.PI / 2) * off;
    const py = e.y + Math.sin(back + Math.PI / 2) * off;
    const len = e.radius * (1.4 + 1.2 * k) + i * 0;
    g.beginPath();
    g.moveTo(px + Math.cos(back) * e.radius, py + Math.sin(back) * e.radius);
    g.lineTo(px + Math.cos(back) * (e.radius + len), py + Math.sin(back) * (e.radius + len));
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Animated shimmer on water, drawn just above the ground layer. */
export function drawWaterFX(g, world, time, viewRect) {
  const { left, top, right, bottom } = viewRect;
  for (const w of world.water) {
    if (w.x + w.rx < left || w.x - w.rx > right || w.y + w.ry < top || w.y - w.ry > bottom) continue;
    g.save();
    g.translate(w.x, w.y);
    g.rotate(w.rot);
    // two slow counter-drifting highlight bands
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.35 + i / 3 + w.wobble / 100) % 1;
      const y = lerp(-w.ry * 0.7, w.ry * 0.7, t);
      const halfW = w.rx * Math.sqrt(Math.max(0.05, 1 - (y / w.ry) ** 2));
      g.globalAlpha = 0.16 * Math.sin(t * Math.PI);
      g.strokeStyle = '#dff2f2';
      g.lineWidth = 2.4;
      g.beginPath();
      g.ellipse(0, y, halfW * 0.8, 3.5, 0, 0, Math.PI);
      g.stroke();
    }
    // a few glints
    g.globalAlpha = 0.22;
    g.fillStyle = '#eafcff';
    for (let i = 0; i < 4; i++) {
      const a = time * 0.8 + (i * TAU) / 4 + w.wobble;
      const gx = Math.cos(a) * w.rx * 0.5;
      const gy = Math.sin(a * 1.3) * w.ry * 0.4;
      const tw = 0.5 + 0.5 * Math.sin(time * 3 + i * 2);
      g.globalAlpha = 0.25 * tw;
      g.fillRect(gx - 2, gy - 0.8, 4 * tw + 1, 1.6);
    }
    g.restore();
  }
  g.globalAlpha = 1;
}
