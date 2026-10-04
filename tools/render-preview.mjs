// Renders the procedural art to SVG so it can be rasterised and inspected.
// Usage: node tools/render-preview.mjs

import { writeFileSync } from 'node:fs';
import { rasterCanvas } from './raster.mjs';
import { Player, Prey, Raptor } from '../src/entities.js';
import { drawCreature, drawShadow } from '../src/render.js';
import { createGame } from '../src/game.js';
import { World } from '../src/world.js';
import { WORLD } from '../src/config.js';
import { makeRandom } from '../src/utils.js';

const noopHud = {
  show() {},
  score() {},
  combo() {},
  wave() {},
  quota() {},
  timer() {},
  bars() {},
  toast() {},
  gameOver() {},
};
const noopSfx = new Proxy({}, { get: () => () => {} });

// --------------------------------------------------------------- bestiary sheet
{
  const W = 1520;
  const H = 470;
  const c = rasterCanvas(W, H);
  const g = c.getContext('2d');

  g.fillStyle = '#2b4026';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#3a5530';
  g.fillRect(0, H * 0.55, W, H * 0.45);

  const rand = makeRandom(5);
  const trex = new Player(0, 0);
  const raptor = new Raptor(0, 0, rand);
  const gazelle = new Prey(0, 0, 'gazelle', 0, rand);
  const parasaur = new Prey(0, 0, 'parasaurolophus', 1, rand);
  const trike = new Prey(0, 0, 'triceratops', 2, rand);
  const blown = new Prey(0, 0, 'gazelle', 3, rand);
  blown.blown = true;
  blown.alert = 1;

  const cast = [
    { e: trex, x: 210, y: 300, label: 'YOU — Tyrannosaurus', phase: 1.1 },
    { e: raptor, x: 470, y: 300, label: 'Rival raptor', phase: 2.0 },
    { e: gazelle, x: 660, y: 300, label: 'Gazelle', phase: 0.6 },
    { e: parasaur, x: 880, y: 300, label: 'Parasaur', phase: 2.6 },
    { e: trike, x: 1180, y: 300, label: 'Triceratops (3 bites)', phase: 1.7 },
    { e: blown, x: 1400, y: 300, label: 'Blown / alert tell', phase: 0.3 },
  ];

  for (const c2 of cast) {
    c2.e.x = c2.x;
    c2.e.y = c2.y;
    c2.e.angle = 0;
    c2.e.phase = c2.phase;
    c2.e.speed = 220;
  }
  blown.speed = 40;

  // biting pose
  trex.biting = true;
  trex.biteTimer = 0.16;

  for (const c2 of cast) {
    drawShadow(g, c2.e);
  }
  for (const c2 of cast) {
    drawCreature(g, c2.e, 1.5);
  }

  g.fillStyle = '#efe3c8';
  g.textAlign = 'center';
  for (const c2 of cast) {
    g.font = '15px sans-serif';
    g.fillText(c2.label, c2.x, 420);
  }
  g.font = 'bold 30px sans-serif';
  g.fillText('APEX — bestiary', W / 2, 60);

  writeFileSync('art/bestiary.png', c.png());
  console.log('wrote art/bestiary.png');
}

// ---------------------------------------------------------------- gameplay frame
{
  const W = 1150;
  const H = 690;
  const canvas = rasterCanvas(W, H);
  const minimap = rasterCanvas(150, 112);
  const api = createGame({
    canvas,
    minimap,
    hud: noopHud,
    sfx: noopSfx,
    makeCanvas: (w, h) => rasterCanvas(w, h),
  });
  api.setView({ w: W, h: H, dpr: 1 });
  api.start();

  // run ~9 seconds of real simulation, hunting to the right
  for (let i = 0; i < 540; i++) {
    api.setInputStateRef({
      x: 0.85,
      y: 0.25,
      sprint: i % 3 !== 0,
      bite: i % 70 === 0,
      aim: 0,
      aimActive: false,
    });
    api.update(1 / 60);
    api.updateCamera(1 / 60);
    if (api.game.state !== 'playing') break;
  }
  api.draw(9.4);

  // label what happened
  const g = canvas.getContext('2d');
  g.fillStyle = '#efe3c8';
  g.textAlign = 'start';
  g.font = 'bold 16px sans-serif';
  g.fillText(
    `simulated 9s · wave ${api.game.wave} · score ${api.game.score} · caught ${api.game.caught} · prey ${api.game.prey.length} · raptors ${api.game.raptors.length}`,
    16,
    28
  );
  writeFileSync('art/frame.png', canvas.png());
  console.log('wrote art/frame.png', { score: api.game.score, caught: api.game.caught, wave: api.game.wave });
}

// ---------------------------------------------------------------- terrain sample
{
  const scale = 0.42;
  const world = new World(20260604);
  const c = rasterCanvas(Math.round(WORLD.w * scale), Math.round(WORLD.h * scale));
  const g = c.getContext('2d');
  g.scale(scale, scale);
  world.paintGround(g, WORLD.w, WORLD.h);
  writeFileSync('art/terrain.png', c.png());
  console.log('wrote art/terrain.png');
}
