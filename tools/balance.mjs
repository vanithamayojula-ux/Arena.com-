// A simple autopilot that aims at the nearest prey, sprints, and bites when
// aligned. Used to sanity-check that the core chase is actually winnable and
// how quickly an average player should expect to catch dinner.

import { createGame } from '../src/game.js';
import { rasterCanvas } from './raster.mjs';
import { WORLD, PLAYER } from '../src/config.js';
import { dist, angleDiff, angleTo } from '../src/utils.js';

function run(label, seconds, difficulty = 1) {
  const noop = new Proxy({}, { get: () => () => {} });
  const canvas = rasterCanvas(1, 1);
  const api = createGame({
    canvas,
    minimap: rasterCanvas(1, 1),
    hud: { show() {}, score() {}, combo() {}, wave() {}, quota() {}, timer() {}, bars() {}, toast() {}, gameOver() {} },
    sfx: noop,
    makeCanvas: (w, h) => rasterCanvas(w, h),
  });
  api.setView({ w: 1150, h: 690, dpr: 1 });
  api.start();

  const pl = api.game.player;
  let bites = 0;
  const dt = 1 / 60;

  const events = [];
  for (let f = 0; f < seconds * 60; f++) {
    if (api.game.state !== 'playing') break;

    // aim at the nearest prey, sprint to close distance, bite when aligned
    let best = null;
    let bestD = Infinity;
    for (const p of api.game.prey) {
      const d = dist(pl.x, pl.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }

    let ix = 0;
    let iy = 0;
    let bite = false;
    if (best) {
      const a = angleTo(pl.x, pl.y, best.x, best.y);
      ix = Math.cos(a);
      iy = Math.sin(a);
      if (bestD < PLAYER.biteRange * 0.85 && Math.abs(angleDiff(pl.angle, a)) < 0.35) {
        bite = true;
        bites++;
      }
    }

    api.setInputStateRef({ x: ix, y: iy, sprint: bestD > 120, bite, aim: 0, aimActive: false });
    api.update(dt);
    api.updateCamera(dt);

    if (f % (5 * 60) === 0) {
      events.push(
        `t=${(f / 60).toFixed(0)}s wave=${api.game.wave} caught=${api.game.caught}/${api.game.quota} score=${api.game.score} prey=${api.game.prey.length} hp=${pl.hp.toFixed(0)} hunger=${pl.hunger.toFixed(0)} combo=x${api.game.combo}`
      );
    }
  }

  console.log(`\n=== ${label} (${seconds}s) — bites fired: ${bites} — end state: ${api.game.state}`);
  events.forEach((e) => console.log('  ' + e));
  console.log(`  END: wave=${api.game.wave} caught=${api.game.caught} score=${api.game.score} state=${api.game.state} hp=${pl.hp.toFixed(0)}`);
  return api;
}

run('typical run', 90);
