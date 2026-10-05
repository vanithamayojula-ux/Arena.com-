// EMBERFALL frame recorder — renders honest stills of the real scene painters with
// the software rasteriser (tools/painter.mjs), so the hub thumbnails are actual
// frames of the game, including its darkness compositing.
//
//   node tools/shot.mjs        # writes screenshots/*.png
//
// Uses the same art.js as the browser; the only difference is the compositor.

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RasterCanvas, writePng } from './painter.mjs';

// document shim so art.js's makeLayer (used by darkness compositing) works headless
globalThis.document = { createElement: () => new RasterCanvas(1, 1) };

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
mkdirSync(OUT, { recursive: true });

const art = await import('../src/art.js');

const W = 1280, H = 720;

function canvas() {
  const cv = new RasterCanvas(W, H);
  const g = cv.getContext('2d');
  g.__baseA1 = 1;
  return { cv, g };
}

function shot(name, fn) {
  const { cv, g } = canvas();
  fn(g);
  const bytes = writePng(join(OUT, name), cv);
  console.log(`  wrote screenshots/${name} (${Math.round(bytes / 1024)} KB)`);
}

// -------------------------------------------------------------- 1 · the road
shot('frame.png', (g) => {
  const t = 4.1;
  art.backdrop(g, W, H, 'road', t, { seed: 3, townLights: false });
  const gy = H * 0.86;
  // the far half of Hollow Mill, across the field, sitting on the ground line
  art.town(g, W * 0.52, H * 0.771, W * 0.52, 91, { t, dark: true, fill: '#0c101f', windows: false });
  art.cart(g, 820, gy - 6, 1.12, t, { moving: true, wheel: 900, lamp: 1 });
  art.figure(g, 706, gy - 4, 1.02, { who: 'dill', pose: 'walk', phase: 9, rim: 'rgba(150,180,235,0.5)' });
  art.figure(g, 928, gy - 4, 1.18, { who: 'bram', pose: 'walk', phase: 8, rim: 'rgba(150,180,235,0.4)' });
  art.figure(g, 978, gy - 8, 0.84, { who: 'fenn', pose: 'walk', phase: 10, dir: -1, rim: 'rgba(150,180,235,0.5)' });
  art.cinderMoth(g, 690, gy - 150, t, 1.2, 0.9);
  art.figure(g, 520, gy - 6, 1.16, { who: 'vera', pose: 'walk', phase: 11, rim: 'rgba(190,210,250,0.7)', holdsLamp: 1 });
  for (let i = 0; i < 3; i++) {
    art.mothling(g, 46 + i * 58, gy - 150 - i * 30 + Math.sin(t + i) * 8, t * 1.2 + i, { s: 0.95 + i * 0.12, aggro: 0.35, seed: i * 5 + 1 });
  }
  const lights = [
    { x: 520, y: gy - 44, r: 220, core: 0.95 },
    { x: 786, y: gy - 40, r: 140, core: 0.7 },
  ];
  art.darkness(g, W, H, lights, 0.66);
  for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.62, 0.5, 0.2, t);
  art.fogBands(g, W, gy - 20, 34, t, 3, 0.8);
  art.vignette(g, W, H, 1);
  art.grain(g, W, H, t, 6);
});

// -------------------------------------------------------------- 2 · the show
shot('stage.png', (g) => {
  const t = 2.6;
  art.backdrop(g, W, H, 'stage', t, { floorY: H * 0.78 });
  const stageY = H * 0.76;
  art.figure(g, W * 0.16, stageY, 0.9, { who: 'vera', pose: 'prompt', phase: 3, rim: 'rgba(190,210,250,0.5)', holdsLamp: 1 });
  art.figure(g, W * 0.4, stageY, 1.05, { who: 'bram', pose: 'juggle', phase: 4.4, rim: 'rgba(255,178,96,0.5)' });
  art.figure(g, W * 0.6, stageY, 1.05, { who: 'dill', pose: 'sing', phase: 2.1, rim: 'rgba(255,140,150,0.5)' });
  art.figure(g, W * 0.8, stageY, 1.05, { who: 'fenn', pose: 'puppet', phase: 1.2, rim: 'rgba(140,220,205,0.5)' });
  art.cinderMoth(g, W * 0.84, stageY - 130, t, 1.15, 1);
  art.crowdHeadsSilhouette(g, W, H * 0.93, 61, t, 0.8, { n: 52 });
  const lights = [
    { x: W * 0.4, y: stageY - 70, r: 320, core: 0.8 },
    { x: W * 0.62, y: stageY - 70, r: 300, core: 0.8 },
    { x: W * 0.5, y: H - 8, r: 260, core: 0.62 },
  ];
  art.darkness(g, W, H, lights, 0.4);
  for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.5, 0.6, 0.15, t);
  art.vignette(g, W, H, 0.8);
  art.grain(g, W, H, t, 3);
});

// -------------------------------------------------------------- 3 · the watch
shot('watch.png', (g) => {
  const t = 1.9;
  art.backdrop(g, W, H, 'tower', t, { lampX: 0.5, lampY: 0.6, lampOn: 1 });
  const lamps = [
    { x: W * 0.5, y: H * 0.6, big: true },
    { x: W * 0.14, y: H * 0.36 }, { x: W * 0.24, y: H * 0.52 },
    { x: W * 0.86, y: H * 0.36 }, { x: W * 0.76, y: H * 0.52 },
  ];
  for (const L of lamps) art.lampObject(g, L.x, L.y, L.big ? 3.2 : 1.15, 1, L.big ? 'sunkey' : 'hall', t);
  art.figure(g, 640, H * 0.87, 1.05, { who: 'vera', pose: 'point', phase: 2, rim: 'rgba(200,215,250,0.55)' });
  art.figure(g, 490, H * 0.9, 0.95, { who: 'dill', pose: 'sing', phase: 3, rim: 'rgba(150,180,235,0.4)' });
  art.figure(g, 790, H * 0.9, 1.05, { who: 'bram', pose: 'carry', phase: 2, dir: -1, rim: 'rgba(150,180,235,0.35)' });
  // the Sunkey beam toward a lunging moth
  const sy = H * 0.87 - 40;
  const ang = Math.atan2(260 - sy, 300 - 640);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,178,96,0.10)';
  g.beginPath();
  g.moveTo(640, sy);
  g.lineTo(640 + Math.cos(ang - 0.2) * 480, sy + Math.sin(ang - 0.2) * 480);
  g.lineTo(640 + Math.cos(ang + 0.2) * 480, sy + Math.sin(ang + 0.2) * 480);
  g.closePath(); g.fill();
  g.restore();
  for (let i = 0; i < 5; i++) {
    art.mothling(g, 190 + i * 130 + Math.sin(t + i) * 30, 160 + ((i * 97) % 220), t * 1.3 + i, { s: 0.9, aggro: i % 2 ? 0.8 : 0.3, seed: i * 13 + 4 });
  }
  const lights = [
    { x: 640, y: sy, r: 200, core: 0.95 },
    ...lamps.map((L) => ({ x: L.x, y: L.y - 14, r: L.big ? 300 : 120, core: 0.85 })),
  ];
  art.darkness(g, W, H, lights, 0.76);
  for (const L of lights) art.lampGlow(g, L.x, L.y, L.r * 0.5, 0.55, 0.2, t);
  art.ash(g, W, H, t, 15, { a: 0.7 });
  art.vignette(g, W, H, 1.05);
  art.grain(g, W, H, t, 2);
});

// -------------------------------------------------------------- 4 · campfire
shot('campfire.png', (g) => {
  const t = 3.4;
  art.backdrop(g, W, H, 'camp', t, {});
  const gy = H * 0.86;
  art.figure(g, W * 0.42, gy + 10, 1.0, { who: 'vera', pose: 'sit', phase: 2, dir: 1, rim: 'rgba(255,190,110,0.4)' });
  art.figure(g, W * 0.565, gy + 10, 0.94, { who: 'dill', pose: 'sit', phase: 1, dir: -1, rim: 'rgba(255,190,110,0.35)' });
  art.figure(g, W * 0.63, gy + 8, 1.18, { who: 'bram', pose: 'sit', phase: 3, dir: -1, rim: 'rgba(255,190,110,0.4)' });
  art.figure(g, W * 0.455, gy + 16, 0.74, { who: 'fenn', pose: 'kneel', phase: 2.5, dir: 1, rim: 'rgba(255,190,110,0.35)' });
  art.cinderMoth(g, W * 0.4, gy - 96, t, 1.2, 1);
  const lights = [{ x: W * 0.5, y: gy + 30, r: 240, core: 0.95 }, { x: W * 0.82, y: gy - 60, r: 130, core: 0.5 }];
  art.darkness(g, W, H, lights, 0.6);
  art.lampGlow(g, lights[0].x, lights[0].y - 6, 210, 0.42, 0.3, t);
  art.lampGlow(g, lights[1].x, lights[1].y - 8, 90, 0.3, 0.25, t);
  art.ash(g, W, H, t, 42, { a: 0.9, col: '255,190,120' });
  art.vignette(g, W, H, 1);
  art.grain(g, W, H, t, 5);
});

// -------------------------------------------------------------- 5 · the cape
shot('lighthouse.png', (g) => {
  const t = 5.2;
  art.backdrop(g, W, H, 'cliff', t, { lit: true });
  const lampY = H * 0.52 - 124 - 16 - 190 * 0.72 - 16;
  art.lampGlow(g, W * 0.775, lampY, 190, 0.55, 0.22, t);
  art.fogBands(g, W * 0.5, H * 0.52 + 30, 40, t, 4, 1.2);
  art.vignette(g, W, H, 0.8);
  art.grain(g, W, H, t, 11);
});

console.log('emberfall: frames rendered to', OUT);
