/* LUMEN PROTOCOL — the city painter. One canvas behind the dialogue: vertical
   sprawl in parallax layers, weather, per-location moods. Deterministic-ish
   noise; no assets, no network. Reads {bg, t}; writes photons. */

const HUES = {
  shaft:  { sky: ['#05060d', '#0c1424'], neon: '#3fd8ff', accent: '#ff2d78', rain: 1.3 },
  bar:    { sky: ['#0b0710', '#170d18'], neon: '#ffb347', accent: '#3fd8ff', rain: 0.5 },
  alley:  { sky: ['#06080f', '#0e1622'], neon: '#8f5bff', accent: '#3fd8ff', rain: 1.1 },
  market: { sky: ['#050a12', '#0b1d24'], neon: '#3fd8ff', accent: '#ff5b5b', rain: 1.0 },
  recon:  { sky: ['#0a0512', '#1b0b22'], neon: '#ff2d78', accent: '#3fd8ff', rain: 0.7 },
  vault:  { sky: ['#04060c', '#0a121c'], neon: '#5affc8', accent: '#ffb347', rain: 0.3 },
  tower:  { sky: ['#070714', '#101c33'], neon: '#3fd8ff', accent: '#ffffff', rain: 0.6 },
  roof:   { sky: ['#0a0a18', '#152441'], neon: '#ff2d78', accent: '#3fd8ff', rain: 1.5 },
};

function hash(n) { let x = Math.imul(n + 1, 2654435761); x ^= x >>> 15; x = Math.imul(x, 2246822519); x ^= x >>> 13; return (x >>> 0) / 4294967296; }
const lerp = (a, b, t) => a + (b - a) * t;

export function makeCity(canvas, bgKey = 'shaft') {
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  let bg = bgKey, t = 0;
  let flash = 0, mood = 0; // mood: 0 neutral .. 1 wrathful neon (wrath of the city when relic maxes)
  const drops = [];
  for (let i = 0; i < 130; i++) drops.push({ x: hash(i * 3) , y: hash(i * 7), s: 0.02 + hash(i * 11) * 0.05, l: 0.03 + hash(i * 13) * 0.07 });

  function resize() {
    dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    W = canvas.clientWidth || 960; H = canvas.clientHeight || 540;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  function setBg(k) { if (HUES[k]) bg = k; }
  function pulse(a) { flash = Math.max(flash, a); }

  function frame(dt) {
    t += dt;
    if (!W || canvas.clientWidth !== W / 1) resize();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hue = HUES[bg] || HUES.shaft;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, hue.sky[0]); sky.addColorStop(1, hue.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    drawFar(hue);
    drawMid(hue);
    if (bg === 'shaft') drawShaft(hue);
    else if (bg === 'bar') drawBar(hue);
    else if (bg === 'market') drawMarket(hue);
    else if (bg === 'vault') drawVault(hue);
    else if (bg === 'roof' || bg === 'tower') drawRoof(hue, bg === 'tower');
    else drawAlley(hue);
    drawRain(hue);
    drawHaze(hue);
    if (flash > 0.01) { g.fillStyle = `rgba(200,240,255,${flash * 0.10})`; g.fillRect(0, 0, W, H); flash *= 0.9; }
    drawScanlines();
  }

  function neonCol(a = 1) { const c = hexa((HUES[bg] || HUES.shaft).neon, a); return c; }
  function hexa(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawFar(hue) {
    // far towers, window grid flicker
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer ? 0.55 : 0.32;
      g.fillStyle = layer ? 'rgba(10,16,28,0.92)' : 'rgba(6,10,18,0.9)';
      const seed = layer * 100;
      let x = -((t * 4 * depth) % 160) - 160;
      for (let i = 0; x < W + 160; i++, x += 60 + hash(seed + i) * 90) {
        const w = 42 + hash(seed + i * 3) * 70, h = H * (0.35 + hash(seed + i * 7) * 0.4);
        g.fillRect(x, H - h, w, h);
        // windows
        const cols = Math.floor(w / 9), rows = Math.floor(h / 12);
        for (let cxi = 0; cxi < cols; cxi++) for (let ry = 0; ry < rows; ry++) {
          const on = hash(seed + i * 97 + cxi * 13 + ry * 31 + Math.floor(t * 0.5)) > 0.82;
          if (!on) continue;
          g.fillStyle = hash(seed + cxi + ry) > 0.86 ? hexa(hue.accent, 0.35) : 'rgba(160,200,255,0.22)';
          g.fillRect(x + 4 + cxi * 9, H - h + 6 + ry * 12, 3, 5);
        }
        g.fillStyle = layer ? 'rgba(10,16,28,0.92)' : 'rgba(6,10,18,0.9)';
      }
    }
  }

  function drawMid(hue) {
    // hanging cables + a slow blimp-light
    g.strokeStyle = 'rgba(40,60,90,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x0 = ((i * 211 + Math.sin(t * 0.1 + i) * 8) % (W + 200)) - 100;
      g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + 60, H * 0.3, x0 + 10, H * 0.62); g.stroke();
    }
    const bx = (t * 14) % (W + 300) - 150, by = H * 0.16 + Math.sin(t * 0.7) * 5;
    g.fillStyle = 'rgba(18,24,38,0.9)'; g.beginPath(); g.ellipse(bx, by, 34, 10, 0, 0, 7); g.fill();
    g.fillStyle = neonCol(0.8); g.fillRect(bx - 20, by + 8, 40, 2);
  }

  function drawRain(hue) {
    const wind = Math.sin(t * 0.23) * 0.35 + 0.2;
    g.strokeStyle = 'rgba(140,180,230,0.20)';
    g.lineWidth = 1;
    const rate = (HUES[bg] || HUES.shaft).rain;
    for (const d of drops) {
      d.y += (d.s * 3.2) * rate; if (d.y > 1) { d.y -= 1; d.x = hash(d.x * 1000 + t) ; }
      d.x -= 0.0009 * wind * rate; if (d.x < 0) d.x += 1;
      const px = d.x * W, py = d.y * H;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + wind * 6, py + d.l * H); g.stroke();
    }
    // neon reflections on the "street"
    const rg = g.createLinearGradient(0, H * 0.86, 0, H);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, neonCol(0.10 + 0.03 * Math.sin(t * 2)));
    g.fillStyle = rg; g.fillRect(0, H * 0.86, W, H * 0.14);
  }

  function drawHaze(hue) {
    const hg = g.createLinearGradient(0, H * 0.3, 0, H);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(5,8,14,0.55)');
    g.fillStyle = hg; g.fillRect(0, H * 0.3, W, H * 0.7);
  }

  function sign(x, y, w, txtCol, flickerSeed) {
    const on = hash(Math.floor(t * 8) * 31 + flickerSeed) > 0.12;
    g.fillStyle = on ? txtCol : 'rgba(60,60,80,0.35)';
    g.fillRect(x, y, w, 3);
    g.fillRect(x, y - 14, 3, 14);
    g.fillRect(x + w - 3, y - 14, 3, 14);
    if (on) { g.fillStyle = txtCol.replace(/[\d.]+\)$/, '0.18)'); g.fillRect(x - 6, y - 6, w + 12, 12); }
  }

  function drawShaft(hue) {
    // elevator interior: cables, passing floor numbers, rivets
    g.fillStyle = 'rgba(8,10,16,0.85)';
    const pad = W * 0.14;
    g.fillRect(0, 0, pad, H); g.fillRect(W - pad, 0, pad, H);
    g.strokeStyle = 'rgba(90,120,160,0.25)'; g.lineWidth = 2;
    g.strokeRect(pad, 8, W - pad * 2, H - 16);
    for (const cx of [pad * 0.5, W - pad * 0.5]) {
      g.strokeStyle = 'rgba(70,90,120,0.6)';
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
    }
    const floorF = (t * 9) % 30;
    g.fillStyle = neonCol(0.85); g.font = `700 ${Math.round(H * 0.13)}px monospace`; g.textAlign = 'center';
    for (let k = -1; k < 4; k++) {
      const fy = H * 0.5 + ((floorF + k * 120) % (H * 1.4)) - H * 0.7;
      g.globalAlpha = 0.5;
      g.fillText('T-' + (38 - Math.floor((floorF + k * 120) / 12)), W / 2, fy);
      g.globalAlpha = 1;
    }
    sign(pad + 18, H * 0.22, 60, neonCol(0.9), 3);
    sign(W - pad - 78, H * 0.66, 60, hexa(hue.accent, 0.9), 9);
  }
  function drawBar(hue) {
    const y = H * 0.72;
    g.fillStyle = 'rgba(12,8,14,0.9)'; g.fillRect(W * 0.08, y, W * 0.84, H * 0.16);
    // bottles
    for (let i = 0; i < 9; i++) {
      const bx = W * 0.12 + i * W * 0.085;
      g.fillStyle = 'rgba(255,179,71,0.5)';
      g.globalAlpha = 0.35 + 0.5 * hash(i + Math.floor(t * 0.4 + i * 2) * 0.01);
      g.fillRect(bx, y - 26, 8, 24); g.globalAlpha = 1;
    }
    sign(W * 0.3, y - 54, W * 0.4, neonCol(0.9), 5); // lantern sign
    // one hanging lantern, swaying
    const lx = W * 0.5 + Math.sin(t * 1.1) * 10;
    g.strokeStyle = 'rgba(120,130,160,0.4)'; g.beginPath(); g.moveTo(W * 0.5, 0); g.lineTo(lx, H * 0.2); g.stroke();
    const lg = g.createRadialGradient(lx, H * 0.2 + 10, 2, lx, H * 0.2 + 10, 90);
    lg.addColorStop(0, 'rgba(255,179,71,0.5)'); lg.addColorStop(1, 'rgba(255,179,71,0)');
    g.fillStyle = lg; g.fillRect(lx - 100, H * 0.2 - 90, 200, 200);
    g.fillStyle = '#ffb347'; g.fillRect(lx - 7, H * 0.2, 14, 20);
    // two figures at the bar
    figure(W * 0.34, y + 2, 1, 'rgba(20,24,34,0.95)');
    figure(W * 0.62, y + 2, -1, 'rgba(24,18,26,0.95)');
  }
  function drawAlley(hue) {
    g.fillStyle = 'rgba(6,8,14,0.9)';
    g.beginPath();
    g.moveTo(0, H); g.lineTo(0, H * 0.1); g.lineTo(W * 0.3, H * 0.3); g.lineTo(W * 0.3, H * 0.75);
    g.lineTo(W * 0.7, H * 0.75); g.lineTo(W * 0.7, H * 0.3); g.lineTo(W, H * 0.12); g.lineTo(W, H); g.closePath(); g.fill();
    for (let i = 0; i < 4; i++) sign(W * (0.32 + i * 0.09), H * (0.34 + (i % 2) * 0.18), W * 0.06, hexa(hue.neon, 0.8), i * 17);
    g.fillStyle = 'rgba(143,91,255,0.15)'; g.fillRect(W * 0.3, H * 0.75, W * 0.4, H * 0.25); // puddle glow
    figure(W * 0.5, H * 0.73, -1, 'rgba(30,26,44,0.95)'); // Vaun
    const cr = g.createRadialGradient(W * 0.5 + 60, H * 0.71, 2, W * 0.5 + 60, H * 0.71, 26);
    cr.addColorStop(0, 'rgba(255,91,91,0.8)'); cr.addColorStop(1, 'rgba(255,91,91,0)'); // the cat-camera eye
    g.fillStyle = cr; g.fillRect(W * 0.5 + 30, H * 0.68, 60, 40);
  }
  function drawMarket(hue) {
    const wy = H * 0.7;
    // water
    g.fillStyle = 'rgba(10,24,30,0.95)'; g.fillRect(0, wy, W, H - wy);
    for (let i = 0; i < 7; i++) {
      const px = ((i * 137 + t * 7) % (W + 80)) - 40;
      g.strokeStyle = 'rgba(90,180,200,0.12)'; g.beginPath(); g.moveTo(px, wy + 12 + (i % 3) * 18); g.quadraticCurveTo(px + 22, wy + 6 + (i % 3) * 18, px + 44, wy + 12 + (i % 3) * 18); g.stroke();
    }
    // floating stalls
    for (let i = 0; i < 3; i++) {
      const bx = W * (0.16 + i * 0.3), bob = Math.sin(t * 0.9 + i * 2) * 4;
      g.fillStyle = 'rgba(14,12,20,0.95)'; g.fillRect(bx, wy - 60 + bob, 120, 60);
      g.fillStyle = i === 1 ? 'rgba(90,255,200,0.16)' : 'rgba(255,91,91,0.14)';
      g.fillRect(bx + 8, wy - 52 + bob, 104, 14);
      sign(bx + 20, wy - 68 + bob, 80, hexa([hue.neon, hue.accent, hue.neon][i], 0.85), i * 31);
      figure(bx + (i === 1 ? 92 : 26), wy - 4 + bob, i === 1 ? -1 : 1, 'rgba(18,20,28,0.95)');
    }
    // canopy struts
    g.strokeStyle = 'rgba(60,80,110,0.4)';
    for (let i = 0; i < 5; i++) { const x = W * 0.1 + i * W * 0.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, wy - 60); g.stroke(); }
  }
  function drawVault(hue) {
    // concentric doors, cold green
    const cx = W / 2, cy = H * 0.52;
    for (let r = 190; r > 40; r -= 26) {
      g.strokeStyle = `rgba(90,255,200,${0.08 + (r % 52 === 0 ? 0.14 : 0)})`;
      g.lineWidth = r % 52 === 0 ? 3 : 1.2;
      g.beginPath(); g.arc(cx, cy, r + Math.sin(t + r) * 2, 0, 7); g.stroke();
    }
    g.save(); g.translate(cx, cy); g.rotate(t * 0.2);
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillStyle = 'rgba(90,255,200,0.25)'; g.fillRect(120, -3, 44, 6); }
    g.restore();
    const lg2 = g.createRadialGradient(cx, cy, 4, cx, cy, 90);
    lg2.addColorStop(0, 'rgba(90,255,200,0.5)'); lg2.addColorStop(1, 'rgba(90,255,200,0)');
    g.fillStyle = lg2; g.fillRect(cx - 100, cy - 100, 200, 200);
    figure(cx - 130, cy + 130, 1, 'rgba(14,18,22,0.95)'); // courier before the door
  }
  function drawRoof(hue, isTower) {
    // above the clouds: cloud sea + antenna forest + broadcast rings
    g.fillStyle = 'rgba(14,18,34,0.9)';
    g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.66);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, H * 0.66 + Math.sin(x * 0.01 + t * 0.5) * 10);
    g.lineTo(W, H); g.closePath(); g.fill();
    const cx = W * 0.5, cy = H * 0.66;
    const rings = isTower ? 3 : 5;
    for (let i = 0; i < rings; i++) {
      const r = ((t * 46 + i * 70) % 380);
      g.strokeStyle = `rgba(255,45,120,${Math.max(0, 0.5 - r / 380)})`;
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy - 90, r, r * 0.34, 0, 0, 7); g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const ax = W * 0.12 + i * W * 0.15, ah = 60 + hash(i * 7) * 90;
      g.strokeStyle = 'rgba(70,90,120,0.7)'; g.beginPath(); g.moveTo(ax, cy - 92); g.lineTo(ax, cy - 92 - ah); g.stroke();
      g.fillStyle = hash(Math.floor(t * 2) + i) > 0.5 ? 'rgba(255,80,80,0.9)' : 'rgba(255,80,80,0.25)';
      g.fillRect(ax - 2, cy - 96 - ah, 4, 4);
    }
    figure(cx - 20, cy - 94, 1, 'rgba(16,14,24,0.95)');
    figure(cx + 60, cy - 94, -1, 'rgba(22,18,26,0.9)');
    if (!isTower) { g.fillStyle = 'rgba(10,12,22,0.8)'; g.fillRect(cx - 80, cy - 170, 160, 46); g.strokeStyle = neonCol(0.8); g.strokeRect(cx - 80, cy - 170, 160, 46); }
  }
  function figure(x, y, dir, col) {
    const bob = Math.sin(t * 2 + x * 0.05) * 1.5;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y - 34 + bob);
    g.quadraticCurveTo(x + 9 * dir, y - 24, x + 7, y);
    g.lineTo(x - 7, y);
    g.quadraticCurveTo(x - 9 * dir, y - 24, x, y - 34 + bob);
    g.fill();
    g.beginPath(); g.arc(x, y - 40 + bob, 5, 0, 7); g.fill();
  }

  function drawScanlines() {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = (t * 14) % 4; y < H; y += 4) g.fillRect(0, y, W, 1);
  }

  resize();
  return { frame, setBg, resize, pulse, get t() { return t; } };
}
