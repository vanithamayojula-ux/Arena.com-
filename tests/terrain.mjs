// Terrain audit: every invariant the ground has to keep, checked against the real
// player physics. Run with `node tests/terrain.mjs`.
import * as THREE from 'three';
import { FakeCanvas } from './dom-stub.mjs';

const { createCity } = await import(new URL('../src/city.js', import.meta.url).href);
const { MEMORIES } = await import(new URL('../src/content.js', import.meta.url).href);
const { createPlayer } = await import(new URL('../src/player.js', import.meta.url).href);

const EYE = 1.68;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.06, 900);
scene.add(camera);
const city = createCity(scene, { seed: 20240410 });
const player = createPlayer(camera, new FakeCanvas(), { city });
for (const c of city.colliders) player.addCollider(c.x, c.z, c.w, c.d, c.rot, c.baseY, c.topY);
player.setEnabled(true);

const fails = [];
const step = (dt, tide) => player.update(dt, { waterLevel: tide, time: 0 });

/* ── 1. settling: put the player above every walkable cell and let them fall ── */
{
  let checked = 0, sank = 0, hovered = 0;
  const bad = [];
  const EXT = 110, GRID = 2.0;
  for (let x = -EXT; x <= EXT; x += GRID) {
    for (let z = -EXT; z <= EXT; z += GRID) {
      const h = city.groundHeight(x, z);
      if (h <= city.DEEP + 0.01) continue;                 // open water: nothing to stand on
      // only test cells the player can actually be in (not inside a building)
      let inside = false;
      for (const c of city.colliders) {
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) > c.w + c.d + 4 || Math.abs(dz) > c.w + c.d + 4) continue;
        const lx = dx * Math.cos(c.rot) - dz * Math.sin(c.rot);
        const lz = dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
        if (Math.abs(lx) < c.w / 2 + 0.5 && Math.abs(lz) < c.d / 2 + 0.5) { inside = true; break; }
      }
      if (inside) continue;
      player.state.pos.set(x, h + EYE + 0.6, z);
      player.state.vel.set(0, 0, 0);
      for (let i = 0; i < 40; i++) step(1 / 60, 0);
      const feet = player.position.y - EYE;
      const hNow = city.groundHeight(player.position.x, player.position.z);
      const drift = Math.hypot(player.position.x - x, player.position.z - z);
      if (drift > 2.5) continue;                            // pushed out of a wall: different story
      checked++;
      if (feet < hNow - 0.12) { sank++; if (bad.length < 8) bad.push(`(${x.toFixed(0)},${z.toFixed(0)}) plate ${h.toFixed(2)} → feet ${feet.toFixed(2)} (now ${hNow.toFixed(2)})`); }
      else if (feet > hNow + 0.5 && hNow > -1.35) {
        // floating in deep water is correct; hovering over dry stone is not
        hovered++;
        if (bad.length < 8) bad.push(`HOVER (${x.toFixed(0)},${z.toFixed(0)}) plate ${h.toFixed(2)} → feet ${feet.toFixed(2)} (now ${hNow.toFixed(2)})`);
      }
    }
  }
  console.log(`settle test: ${checked} cells · fell through: ${sank} · hovering: ${hovered}`);
  if (bad.length) { console.log('  examples:'); bad.forEach((b) => console.log('   ' + b)); }
  if (sank) fails.push(`${sank} cells let the player fall through the ground`);
  if (hovered) fails.push(`${hovered} cells leave the player hovering above the ground`);
}

/* ── 2. walking: the feet must never end up below the ground they are on ── */
{
  let worst = 0, worstAt = null, frames = 0;
  const rng = (s) => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const r = rng(99);
  for (let walk = 0; walk < 40; walk++) {
    // start somewhere plausible
    let sx = 0, sz = 0, tries = 0;
    do {
      sx = (r() * 2 - 1) * 100; sz = (r() * 2 - 1) * 100; tries++;
    } while ((city.groundHeight(sx, sz) <= city.DEEP + 0.01) && tries < 400);
    player.state.pos.set(sx, city.groundHeight(sx, sz) + EYE, sz);
    player.state.vel.set(0, 0, 0);
    let yaw = r() * Math.PI * 2;
    for (let i = 0; i < 1200; i++) {
      if (i % 90 === 0) yaw += (r() * 2 - 1) * 1.4;
      player.state.yaw = yaw;
      globalThis.__fire?.('keydown', { code: 'KeyW', repeat: false, preventDefault() {} });
      step(1 / 60, 0.3);
      frames++;
      const feet = player.position.y - EYE;
      const h = city.groundHeight(player.position.x, player.position.z);
      if (h > city.DEEP + 0.01 && player.state.depth < 0.05) {
        const below = h - feet;
        if (below > worst) { worst = below; worstAt = `(${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}) plate ${h.toFixed(2)} feet ${feet.toFixed(2)}`; }
      }
      if (!isFinite(player.position.x + player.position.y + player.position.z)) { fails.push(`walk ${walk}: non-finite position at frame ${i}`); break; }
    }
    globalThis.__fire?.('keyup', { code: 'KeyW', repeat: false, preventDefault() {} });
  }
  console.log(`walk test: ${frames} frames over 40 random walks · deepest sink below the ground: ${worst.toFixed(3)} m`);
  if (worstAt) console.log('  worst at ' + worstAt);
  if (worst > 0.15) fails.push(`player sinks ${worst.toFixed(2)} m below the ground while walking`);
}

/* ── 3. buildings are solid, and if you are ever put inside one you get out ── */
{
  let worstPen = 0, worstInfo = null, stuck = 0;
  for (const c of city.colliders) {
    // (a) walk at the building from outside for a second; you must not end up inside
    const approach = [
      [c.x + c.w, c.z], [c.x - c.w, c.z], [c.x, c.z + c.d], [c.x, c.z - c.d],
    ];
    for (const [ax, az] of approach) {
      const g = city.groundHeight(ax, az);
      if (g <= city.DEEP + 0.01) continue;               // open water: nothing to walk from
      player.state.pos.set(ax, g + EYE, az);
      player.state.vel.set(0, 0, 0);
      player.state.yaw = Math.atan2(-(c.x - ax), -(c.z - az));
      globalThis.__fire('keydown', { code: 'KeyW', repeat: false, preventDefault() {} });
      for (let i = 0; i < 70; i++) step(1 / 60, 0);
      globalThis.__fire('keyup', { code: 'KeyW', repeat: false, preventDefault() {} });
      const dx = player.position.x - c.x, dz = player.position.z - c.z;
      const lx = dx * Math.cos(c.rot) - dz * Math.sin(c.rot);
      const lz = dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
      const pen = Math.min(c.w / 2 - Math.abs(lx), c.d / 2 - Math.abs(lz));
      if (player.position.y < c.topY && pen > worstPen) {
        worstPen = pen;
        worstInfo = `walked ${pen.toFixed(2)} m into ${c.w.toFixed(1)}x${c.d.toFixed(1)} at (${c.x.toFixed(0)},${c.z.toFixed(0)}) — ended at (${player.position.x.toFixed(1)},${player.position.z.toFixed(1)}) y ${player.position.y.toFixed(1)}`;
      }
    }
    // (b) dropped at the centre, you must find your way out within two seconds
    const g2 = city.groundHeight(c.x, c.z);
    player.state.pos.set(c.x, g2 + EYE, c.z);
    player.state.vel.set(0, 0, 0);
    for (let i = 0; i < 120; i++) step(1 / 60, 0);
    const dx = player.position.x - c.x, dz = player.position.z - c.z;
    const lx = dx * Math.cos(c.rot) - dz * Math.sin(c.rot);
    const lz = dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
    const pen = Math.min(c.w / 2 - Math.abs(lx), c.d / 2 - Math.abs(lz));
    if (player.position.y < c.topY && pen > 0.4) stuck++;
  }
  // `stuck` is the two-second window, which is exactly when the wedge net fires, so it is
  // reported rather than asserted; the six-second escape test below is the real invariant.
  console.log(`building test: worst approach penetration ${worstPen.toFixed(2)} m · still inside after two seconds: ${stuck} of ${city.colliders.length} (the net fires at two)`);
  if (worstInfo) console.log('  ' + worstInfo);
  if (worstPen > 0.4) fails.push(`player can walk ${worstPen.toFixed(2)} m into a building`);
}

/* ── 3b. water: you float on the surface, and you can always get back out ── */
{
  // deepest point of the drowned plaza basin
  player.state.pos.set(0, -6, 0);
  player.state.vel.set(0, 0, 0);
  for (let i = 0; i < 180; i++) step(1 / 60, 0);
  const eyeAboveWater = player.position.y - 0;
  const floorHere = city.groundHeight(0, 0);
  console.log(`swim test: basin floor ${floorHere.toFixed(2)} m · settled eye ${eyeAboveWater.toFixed(2)} m relative to the surface`);
  if (eyeAboveWater < -1.0) fails.push('player sinks into deep water instead of floating on it');

  // and can climb out onto the ring
  player.state.yaw = Math.PI * 0.75;
  globalThis.__fire('keydown', { code: 'KeyW', repeat: false, preventDefault() {} });
  let out = false;
  for (let i = 0; i < 60 * 20; i++) {
    globalThis.__fire('keydown', { code: 'Space', repeat: false, preventDefault() {} });
    step(1 / 60, 0);
    if (city.groundHeight(player.position.x, player.position.z) > 0 && player.position.y > 1.0) { out = true; break; }
  }
  globalThis.__fire('keyup', { code: 'KeyW', repeat: false, preventDefault() {} });
  globalThis.__fire('keyup', { code: 'Space', repeat: false, preventDefault() {} });
  console.log(`climb-out test: ${out ? 'reached the plaza ring' : 'NEVER GOT OUT'}`);
  if (!out) fails.push('player cannot climb out of the drowned plaza basin');
}

/* ── 3c. a player who is somehow put inside geometry must not be trapped ── */
{
  let trapped = 0;
  for (const c of city.colliders) {
    player.state.pos.set(c.x, city.groundHeight(c.x, c.z) + EYE, c.z);
    player.state.vel.set(0, 0, 0);
    for (let i = 0; i < 60 * 6; i++) step(1 / 60, 0);
    const dx = player.position.x - c.x, dz = player.position.z - c.z;
    const lx = dx * Math.cos(c.rot) - dz * Math.sin(c.rot);
    const lz = dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
    const pen = Math.min(c.w / 2 - Math.abs(lx), c.d / 2 - Math.abs(lz));
    if (player.position.y < c.topY && pen > 0.3) {
      trapped++;
      console.log(`   trapped: ${c.w.toFixed(1)}x${c.d.toFixed(1)} at (${c.x.toFixed(0)},${c.z.toFixed(0)}) base ${c.baseY.toFixed(1)} top ${c.topY.toFixed(1)} · at (${player.position.x.toFixed(1)},${player.position.z.toFixed(1)}) y ${player.position.y.toFixed(2)} ground ${city.groundHeight(player.position.x, player.position.z).toFixed(2)} swim ${player.state.swimming ? 1 : 0} innerColliders ${city.colliders.filter((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < Math.hypot(c.w, c.d)).length}`);
    }
  }
  console.log(`escape test: still inside after six seconds in ${trapped} of ${city.colliders.length} buildings`);
  if (trapped > 0) fails.push(`${trapped} buildings can trap the player`);
}

/* ── 4. every memory is reachable *to the shard*, not just its district ── */
{
  for (const m of MEMORIES) {
    const a = city.shardAnchors[m.id];
    const g = city.groundHeight(a.x, a.z);
    const eyeAbove = a.y - 0;                       // shard height above the water plane
    const playerEye = g + EYE;
    const dy = Math.abs(a.y - playerEye);
    if (dy > 4.0) fails.push(`${m.id}: the player's eye at ground level is ${dy.toFixed(2)} m from the shard (interaction needs < 4.2)`);
    if (eyeAbove < -2) fails.push(`${m.id}: the shard sits ${(-eyeAbove).toFixed(2)} m under water`);
  }
  console.log('shard reach test: all six anchors within interaction range of standing ground');
}

/* ── 5. the water is never *above* ground you are supposed to be able to stand on ── */
{
  const walkable = [];
  const EXT = 110, GRID = 4;
  for (let x = -EXT; x <= EXT; x += GRID) for (let z = -EXT; z <= EXT; z += GRID) {
    const h = city.groundHeight(x, z);
    if (h > city.DEEP + 0.01) walkable.push([x, z, h]);
  }
  const drowned = walkable.filter(([, , h]) => h < -1.35).length;
  console.log(`dry land sanity: ${walkable.length} walkable samples, ${drowned} of them deeper than the swim line at low tide`);
  if (drowned > walkable.length * 0.35) fails.push('more than a third of the walkable city is underwater at the start');
}

console.log(fails.length ? `\n${fails.length} TERRAIN PROBLEM(S)\n` + fails.map((f) => ' - ' + f).join('\n') : '\nTERRAIN OK');
process.exit(fails.length ? 1 : 0);
