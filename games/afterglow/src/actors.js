/* AFTERGLOW — the cast. Everyone is a brush-cut silhouette with a rim of lantern
   light; portraits for dialogue are painted faces in oval frames. */

import { TAU, clamp, rng, makeNoise1D, fbm1 } from './util.js';
import { PAL } from './paint.js';

/* name, cloth, trim, hat, build, blurb */
export const CAST = {
  miri: { name: 'Miri', cloth: '#33505f', trim: '#d9a13f', hat: 'goggles', build: 1.0,
    who: 'Ex- corporal. Juggler, fire-eater, our excuse-maker.' },
  bod: { name: 'Bodfrie', cloth: '#4f3a2c', trim: '#9a6b3f', hat: 'helm', build: 1.28,
    who: 'Ex-sapper. Strongman, tuba. Once disarmed a mine with a soup spoon.' },
  nadia: { name: 'Nadia', cloth: '#54323e', trim: '#b98a8a', hat: 'hood', build: 0.96,
    who: 'Ex-markswoman. Ventriloquist. Argues with her own dummy and usually loses.' },
  tomas: { name: 'Tomas', cloth: '#3c4f3d', trim: '#8fbf7a', hat: 'tophat', build: 0.9,
    who: 'Ex-field medic. Rope-walker. Seventeen, tragically hopeful.' },
  pell: { name: 'Pell', cloth: '#39435c', trim: '#7d97c4', hat: 'ears', build: 0.62,
    who: 'Found on the road. Signs with his hands. Keeps count of the dark.' },
  hask: { name: 'Sergeant Hask', cloth: '#2f3a46', trim: '#6e7f8d', hat: 'peaked', build: 1.06,
    who: 'Vellum Hollow militia. Owns one joke and uses it often.' },
  vek: { name: 'Almoner Vek', cloth: '#4c3f22', trim: '#c8a24a', hat: 'chancellor', build: 1.0,
    who: 'Wick Trust. Sells candles; also sells the list of who lit them.' },
  sable: { name: 'Cantor Sable', cloth: '#232c47', trim: '#7f96d1', hat: 'veil', build: 1.02,
    who: 'Lamplight Choir. Convinced the sun is listening to us.' },
  fenn: { name: 'Grandsire Fenn', cloth: '#3a3630', trim: '#9a8d6f', hat: 'shawl', build: 0.9,
    who: 'Oldest living memory of daylight in Hollow.' },
  slat: { name: 'Slat', cloth: '#3d3244', trim: '#a06fd0', hat: 'antlers', build: 1.08,
    who: 'Wisp Reaver chief. Collects extinguishers the way we collect applause.' },
  anna: { name: 'Anna', cloth: '#41313b', trim: '#c99a86', hat: 'scarf', build: 0.98,
    who: 'Innkeeper. Pays in stew, thanks and gossip, mostly stew.' },
  crowd: { name: 'The crowd', cloth: '#20293a', trim: '#5a6a80', hat: 'none', build: 1, who: '' },
  narrator: { name: '', cloth: '#000', trim: '#000', hat: 'none', build: 1, who: '' },
};

function figureStyle(g, c) {
  g.fillStyle = c.cloth;
}

/* Full-body figure. pose: idle|walk|act|sit|salute|fall ; dir: 1 right, -1 left */
export function drawActor(g, c, x, y, t, opts = {}) {
  const { dir = 1, phase = 0, state = 'idle', scale = 1, lantern = true, rimSide = -dir, hold = null, litAmount = 1 } = opts;
  const b = (c.build || 1) * 30 * scale; // torso height
  const sway = state === 'walk' ? Math.sin(phase) : Math.sin(t * 1.6 + x * 0.01) * 0.18;
  const bob = state === 'walk' ? Math.abs(Math.sin(phase)) * 2.2 : Math.sin(t * 1.6 + x * 0.01) * 0.8;
  const fall = state === 'fall';
  g.save();
  g.translate(x, y);
  if (fall) { g.rotate(dir * 1.35); g.translate(0, -b * 0.4); }
  g.scale(dir, 1);

  const dark = '#0a0f18';
  const rim = `rgba(255,196,120,${0.5 * litAmount})`;

  // legs
  const ls = state === 'walk' ? Math.sin(phase) * 0.5 : sway * 0.1;
  g.strokeStyle = dark;
  g.lineCap = 'round';
  g.lineWidth = b * 0.16;
  for (const [sgn, sw] of [[1, ls], [-1, -ls]]) {
    g.beginPath();
    g.moveTo(sgn * b * 0.1, -b * 0.42 + bob * 0.5);
    g.quadraticCurveTo(sgn * b * (0.14 + sw * 0.2), -b * 0.2, sgn * b * (0.06 + sw * 0.62), 0);
    g.stroke();
    // rim on leading leg
    g.save();
    g.strokeStyle = rim; g.lineWidth = b * 0.05;
    g.beginPath();
    g.moveTo(sgn * b * (0.14 + sw * 0.2), -b * 0.38 + bob * 0.5);
    g.quadraticCurveTo(sgn * b * (0.2 + sw * 0.24), -b * 0.2, sgn * b * (0.12 + sw * 0.66), -b * 0.02);
    g.stroke();
    g.restore();
  }

  // coat — asymmetric brush blob
  g.fillStyle = c.cloth;
  g.beginPath();
  g.moveTo(-b * 0.36, -b * 0.4);
  g.bezierCurveTo(-b * 0.46, -b * 0.9, -b * 0.3, -b * 1.18, 0, -b * 1.2);
  g.bezierCurveTo(b * 0.3, -b * 1.18, b * 0.46, -b * 0.9, b * 0.36, -b * 0.4);
  g.bezierCurveTo(b * 0.42, -b * 0.1, b * 0.1, -b * 0.02 + sway * 3, 0, -b * 0.08);
  g.bezierCurveTo(-b * 0.16, -b * 0.02 - sway * 3, -b * 0.42, -b * 0.1, -b * 0.36, -b * 0.4);
  g.closePath();
  g.fill();
  // cloth shading + rim
  g.save();
  g.globalCompositeOperation = 'screen';
  g.fillStyle = c.trim; g.globalAlpha = 0.16;
  g.beginPath();
  g.ellipse(b * 0.2, -b * 0.8, b * 0.14, b * 0.34, -0.2, 0, TAU);
  g.fill();
  g.restore();
  g.strokeStyle = rim; g.lineWidth = 1.5;
  g.beginPath();
  g.arc(0, -b * 0.82, b * 0.42, -1.15, -0.15);
  g.stroke();

  // arms
  const armSw = state === 'act' ? Math.sin(t * 7) * 0.9 : state === 'walk' ? Math.sin(phase + Math.PI) * 0.45 : sway * 0.2;
  g.strokeStyle = dark; g.lineWidth = b * 0.13;
  for (const [sgn, sw] of [[1, armSw], [-1, -armSw]]) {
    g.beginPath();
    const ax = sgn * b * 0.26, ay = -b * 1.02;
    const hx = ax + sgn * b * 0.28 - sw * sgn * b * 0.3, hy = ay + b * 0.4 - sw * b * 0.36;
    g.moveTo(ax, ay);
    g.quadraticCurveTo(ax + sgn * b * 0.2, ay + b * 0.2, hx, hy);
    g.stroke();
  }
  if (hold === 'lantern') {
    const lx = b * 0.54, ly = -b * 0.62;
    g.strokeStyle = '#1a2230'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(b * 0.42, -b * 0.78); g.lineTo(lx, ly); g.stroke();
    drawLantern(g, lx, ly, t, 1);
  } else if (hold === 'torch') {
    g.strokeStyle = '#241a12'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(b * 0.36, -b * 0.96); g.lineTo(b * 0.62, -b * 1.36); g.stroke();
  }

  // head
  const hy = -b * 1.34, hr = b * 0.185;
  g.fillStyle = '#0b1018';
  g.beginPath(); g.ellipse(0, hy, hr * 1.05, hr, sway * 0.1, 0, TAU); g.fill();
  // face-side rim from the fire
  g.strokeStyle = rim; g.lineWidth = 2;
  g.beginPath(); g.arc(0, hy, hr * 1.02, -1.9, -0.5); g.stroke();

  drawHat(g, c, 0, hy, hr, t, b);
  g.restore();
}

function drawHat(g, c, x, y, r, t, b) {
  const hy = y;
  g.save();
  g.translate(x, hy);
  switch (c.hat) {
    case 'goggles':
      g.fillStyle = '#131a26';
      g.beginPath(); g.ellipse(0, -r * 0.75, r * 1.02, r * 0.5, 0, Math.PI, 0); g.fill();
      g.strokeStyle = c.trim; g.lineWidth = 1.6;
      g.beginPath(); g.arc(-r * 0.4, -r * 0.9, r * 0.32, 0, TAU); g.stroke();
      g.beginPath(); g.arc(r * 0.42, -r * 0.9, r * 0.32, 0, TAU); g.stroke();
      break;
    case 'helm':
      g.fillStyle = '#1b2330';
      g.beginPath(); g.arc(0, -r * 0.25, r * 1.18, Math.PI * 0.96, Math.PI * 2.04); g.fill();
      g.fillRect(-r * 1.18, -r * 0.35, r * 2.36, r * 0.34);
      g.fillStyle = c.trim; g.globalAlpha = 0.7;
      g.fillRect(-r * 0.14, -r * 1.5, r * 0.28, r * 0.9);
      break;
    case 'hood':
      g.fillStyle = '#1a1420';
      g.beginPath(); g.moveTo(-r * 1.35, r * 0.5);
      g.quadraticCurveTo(-r * 1.5, -r * 1.5, 0, -r * 1.5);
      g.quadraticCurveTo(r * 1.5, -r * 1.5, r * 1.1, r * 0.2);
      g.quadraticCurveTo(r * 0.2, -r * 0.4, -r * 1.35, r * 0.5);
      g.fill();
      g.strokeStyle = 'rgba(255,196,120,0.28)';
      g.beginPath(); g.moveTo(-r * 1.2, r * 0.3); g.quadraticCurveTo(0, -r * 1.6, r * 1.0, r * 0.0); g.stroke();
      break;
    case 'tophat':
      g.fillStyle = '#141c14';
      g.fillRect(-r * 1.3, -r * 0.2, r * 2.6, r * 0.28);
      g.fillRect(-r * 0.8, -r * 1.9, r * 1.6, r * 1.75);
      g.fillStyle = c.trim; g.globalAlpha = 0.85;
      g.fillRect(-r * 0.8, -r * 0.75, r * 1.6, r * 0.3);
      // a sad sprig of dried flower
      g.strokeStyle = '#7f8f6a'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(r * 0.5, -r * 1.8); g.lineTo(r * 0.8, -r * 2.6); g.stroke();
      break;
    case 'ears':
      g.fillStyle = '#2a3145';
      g.beginPath(); g.ellipse(0, -r * 0.6, r * 1.12, r * 0.9, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#454f6e';
      g.beginPath(); g.ellipse(-r * 0.95, -r * 0.2, r * 0.42, r * 0.72, -0.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(r * 0.95, -r * 0.2, r * 0.42, r * 0.72, 0.5, 0, TAU); g.fill();
      break;
    case 'peaked':
      g.fillStyle = '#18202b';
      g.beginPath(); g.ellipse(0, -r * 0.55, r * 1.05, r * 0.55, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#0f1520';
      g.beginPath(); g.ellipse(r * 0.5, -r * 0.1, r * 1.15, r * 0.3, -0.12, 0, Math.PI); g.fill();
      g.strokeStyle = c.trim; g.globalAlpha = 0.6;
      g.beginPath(); g.moveTo(-r, -r * 0.32); g.lineTo(r * 1.4, -r * 0.32); g.stroke();
      break;
    case 'chancellor':
      g.fillStyle = '#221b0e';
      g.beginPath(); g.ellipse(0, -r * 0.5, r * 1.02, r * 0.72, 0, Math.PI, 0); g.fill();
      g.fillStyle = c.trim;
      g.fillRect(-r * 0.12, -r * 1.15, r * 0.24, r * 0.55);
      g.beginPath(); g.arc(0, -r * 1.25, r * 0.28, 0, TAU); g.fill();
      break;
    case 'veil':
      g.fillStyle = 'rgba(60,74,120,0.55)';
      g.beginPath(); g.moveTo(-r * 1.3, -r * 0.4);
      g.quadraticCurveTo(0, -r * 1.8, r * 1.3, -r * 0.4);
      g.lineTo(r * 1.6, r * 1.4); g.lineTo(-r * 1.6, r * 1.4);
      g.fill();
      break;
    case 'shawl':
      g.fillStyle = '#2c2921';
      g.beginPath(); g.ellipse(0, -r * 0.18, r * 1.22, r * 0.8, 0, Math.PI, 0); g.fill();
      break;
    case 'antlers':
      g.strokeStyle = '#4a3f57'; g.lineWidth = 2;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * r * 0.6, -r * 0.7);
        g.lineTo(s * r * 1.1, -r * 1.9);
        g.moveTo(s * r * 0.9, -r * 1.3); g.lineTo(s * r * 1.6, -r * 1.5);
        g.moveTo(s * r * 1.0, -r * 1.6); g.lineTo(s * r * 0.5, -r * 2.1);
        g.stroke();
      }
      break;
    case 'scarf':
      g.fillStyle = '#3a2530';
      g.beginPath(); g.ellipse(0, -r * 0.55, r * 1.08, r * 0.62, 0, Math.PI, 0); g.fill();
      g.strokeStyle = c.trim; g.lineWidth = r * 0.3; g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(-r * 0.6, 0);
      g.quadraticCurveTo(-r * 2, r * 0.6 + Math.sin(t * 3) * 2, -r * 2.4, r * 1.6);
      g.stroke();
      break;
    default:
      // messy hair
      g.strokeStyle = '#10141c'; g.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(-r + i * r * 0.5, -r * 0.9);
        g.lineTo(-r + i * r * 0.5 + (i % 2 ? 2 : -2), -r * 1.4);
        g.stroke();
      }
  }
  g.restore();
}

/* The troupe lantern — every scene has one. */
export function drawLantern(g, x, y, t, lit = 1, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = '#222c3c'; g.lineWidth = 2;
  g.beginPath(); g.arc(0, -6, 4, Math.PI, 0); g.stroke();
  g.fillStyle = '#111826';
  g.beginPath();
  g.moveTo(-5, -6); g.lineTo(5, -6); g.lineTo(6.5, 8); g.lineTo(-6.5, 8);
  g.closePath(); g.fill();
  if (lit > 0.02) {
    g.save(); g.globalCompositeOperation = 'screen';
    const fl = 0.8 + Math.sin(t * 13 + x) * 0.2;
    const rg = g.createRadialGradient(0, 1, 1, 0, 1, 12);
    rg.addColorStop(0, `rgba(255,220,150,${0.95 * lit * fl})`);
    rg.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = rg;
    g.fillRect(-14, -14, 28, 28);
    g.restore();
  }
  g.restore();
}

/* Props carried when idle on stage */
export function drawProp(g, c, x, y, t, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (c === CAST.bod) { // tuba "Siegfried"
    g.strokeStyle = '#7a5b22'; g.lineWidth = 6;
    g.beginPath(); g.arc(10, -8, 10, -2.4, 2.2); g.stroke();
    g.fillStyle = '#c79a3f';
    g.beginPath(); g.ellipse(23, -14, 8, 6, -0.5, 0, TAU); g.fill();
  } else if (c === CAST.nadia) { // marionette
    g.strokeStyle = 'rgba(220,230,255,0.4)'; g.lineWidth = 1;
    for (const [px, py] of [[-4, 6], [4, 6]]) { g.beginPath(); g.moveTo(px, -14); g.lineTo(px * 1.6, py); g.stroke(); }
    g.fillStyle = '#6b4a58';
    g.beginPath(); g.ellipse(0, 10, 5, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#d9c6a8'; g.beginPath(); g.arc(0, 2, 3.6, 0, TAU); g.fill();
    g.fillStyle = '#111'; g.fillRect(-2.4, 1.2, 1.6, 1.6); g.fillRect(0.8, 1.2, 1.6, 1.6);
  }
  g.restore();
}

/* ---- portraits ---- */
export function drawPortrait(g, x, y, r, key, mood = 0, t = 0) {
  const c = CAST[key] || CAST.crowd;
  const R = rng(key.length * 977);
  g.save();
  g.translate(x, y);
  // frame
  g.fillStyle = 'rgba(10,14,22,0.85)';
  g.beginPath(); g.ellipse(0, 0, r + 3, r + 3, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(217,161,63,0.55)'; g.lineWidth = 1.4;
  g.beginPath(); g.ellipse(0, 0, r + 1.6, r + 1.6, 0, 0, TAU); g.stroke();
  // inner backdrop wash
  const bg = g.createLinearGradient(0, -r, 0, r);
  bg.addColorStop(0, c.cloth);
  bg.addColorStop(1, '#0a0e16');
  g.save();
  g.beginPath(); g.ellipse(0, 0, r, r, 0, 0, TAU); g.clip();
  g.fillStyle = bg; g.fillRect(-r, -r, r * 2, r * 2);

  const sk = key === 'pell' ? '#c3b291' : PAL.skin;
  // shoulders
  g.fillStyle = c.cloth;
  g.beginPath(); g.ellipse(0, r * 1.05, r * 0.95, r * 0.55, 0, 0, Math.PI); g.fill();
  g.fillStyle = c.trim; g.globalAlpha = 0.28;
  g.beginPath(); g.ellipse(-r * 0.5, r * 1.02, r * 0.4, r * 0.5, 0.3, 0, Math.PI); g.fill();
  g.globalAlpha = 1;
  // head
  g.fillStyle = sk;
  g.beginPath(); g.ellipse(0, -r * 0.05, r * 0.5, r * 0.58, 0, 0, TAU); g.fill();
  // shadow side
  g.fillStyle = 'rgba(20,16,24,0.38)';
  g.beginPath(); g.ellipse(-r * 0.2, -r * 0.05, r * 0.34, r * 0.56, 0, 0, TAU); g.fill();
  // rim light from right (firelight)
  g.strokeStyle = 'rgba(255,190,110,0.8)'; g.lineWidth = r * 0.07;
  g.beginPath(); g.arc(0, -r * 0.05, r * 0.51, -1.35, 1.15); g.stroke();
  // eyes
  const blink = (Math.sin(t * 0.7 + x) > 0.985) ? 0.15 : 1;
  g.fillStyle = '#151218';
  const ey = -r * 0.1 + (mood === 2 ? -1 : 0);
  g.beginPath(); g.ellipse(r * 0.18, ey, r * 0.045, r * 0.07 * blink + 0.4, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(-r * 0.12, ey, r * 0.045, r * 0.07 * blink + 0.4, 0, 0, TAU); g.fill();
  // brows by mood: 0 neutral 1 amused 2 angry 3 sad 4 wary
  g.strokeStyle = 'rgba(30,24,28,0.9)'; g.lineWidth = r * 0.045; g.lineCap = 'round';
  const bl = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  if (mood === 1) { bl(-r * 0.22, ey - r * 0.12, -r * 0.04, ey - r * 0.16); bl(r * 0.08, ey - r * 0.16, r * 0.26, ey - r * 0.12); }
  if (mood === 2) { bl(-r * 0.24, ey - r * 0.08, -r * 0.05, ey - r * 0.18); bl(r * 0.07, ey - r * 0.18, r * 0.26, ey - r * 0.08); }
  if (mood === 3) { bl(-r * 0.24, ey - r * 0.18, -r * 0.06, ey - r * 0.1); bl(r * 0.06, ey - r * 0.1, r * 0.24, ey - r * 0.18); }
  if (mood === 4) { bl(-r * 0.24, ey - r * 0.13, -r * 0.06, ey - r * 0.13); bl(r * 0.06, ey - r * 0.18, r * 0.26, ey - r * 0.1); }
  if (mood === 0) { bl(-r * 0.22, ey - r * 0.14, -r * 0.06, ey - r * 0.14); bl(r * 0.06, ey - r * 0.14, r * 0.24, ey - r * 0.14); }
  // mouth: smile / flat / sneer
  g.beginPath();
  if (mood === 1) g.arc(r * 0.04, r * 0.16, r * 0.14, 0.2, Math.PI - 0.5);
  else if (mood === 2) g.arc(r * 0.04, r * 0.3, r * 0.16, Math.PI + 0.4, -0.4);
  else { g.moveTo(-r * 0.08, r * 0.2); g.lineTo(r * 0.18, r * 0.19 + (mood === 3 ? 0.02 * r : 0)); }
  g.strokeStyle = 'rgba(40,20,22,0.9)'; g.lineWidth = r * 0.05; g.stroke();
  // stubble / lines for old folks
  if (key === 'fenn') {
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-r * 0.3 + i * 4, -r * 0.3 + i * 8); g.lineTo(-r * 0.12 + i * 4, -r * 0.32 + i * 8); g.stroke(); }
  }
  drawHat(g, c, 0, -r * 0.42, r * 0.5, t, r);
  g.restore();
  g.restore();
}

/* Crowd silhouettes for performance scenes. */
export function makeCrowd(n, W, H, seed) {
  const R = rng(seed || 99);
  const a = [];
  for (let i = 0; i < n; i++) {
    a.push({
      x: R() * W, y: H - 6 - R() * (H * 0.16), s: 0.5 + R() * 0.8,
      ph: R() * TAU, child: R() < 0.18, raise: R() < 0.3 ? R() * TAU : -1, hue: R(),
    });
  }
  a.sort((p, q) => p.y - q.y);
  return a;
}
export function drawCrowd(g, crowd, t, cheer, W, H) {
  for (const p of crowd) {
    const bob = Math.sin(t * 2.4 + p.ph) * (1 + cheer * 5) * 0.8;
    const s = p.s * (p.child ? 0.62 : 1) * 26;
    const dark = p.y < H * 0.88 ? `rgba(8,12,20,${0.8 + p.hue * 0.2})` : 'rgba(5,8,14,0.95)';
    g.save();
    g.translate(p.x, p.y + bob);
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(-s * 0.4, 0);
    g.quadraticCurveTo(-s * 0.5, -s * 0.9, 0, -s * 1.05);
    g.quadraticCurveTo(s * 0.5, -s * 0.9, s * 0.4, 0);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(0, -s * 1.18, s * 0.26, 0, TAU); g.fill();
    if (p.raise > 0 && cheer > 0.4) {
      g.strokeStyle = dark; g.lineWidth = s * 0.16; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s * 0.3, -s * 0.8);
      g.quadraticCurveTo(s * 0.5, -s * 1.2, s * 0.42, -s * 1.5 - Math.sin(t * 6 + p.ph) * s * 0.15);
      g.stroke();
    }
    g.restore();
  }
}
