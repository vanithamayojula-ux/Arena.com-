import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { FakeCanvas } from './dom-stub.mjs';
const SRC = new URL('../src/', import.meta.url).href;

const fails = [];
const ok = (label) => console.log(`  ok  ${label}`);
function check(label, fn) {
  try { const v = fn(); ok(label + (v !== undefined ? ` → ${v}` : '')); return v; }
  catch (e) { fails.push([label, e]); console.log(`  FAIL ${label}: ${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n       ') : e}`); return null; }
}

const t0 = Date.now();
const cityMod = await check('import city.js', () => import(SRC + 'city.js'));
const skyMod = await check('import sky.js', () => import(SRC + 'sky.js'));
const waterMod = await check('import water.js', () => import(SRC + 'water.js'));
const specMod = await check('import specters.js', () => import(SRC + 'specters.js'));
const shadMod = await check('import shadows.js', () => import(SRC + 'shadows.js'));
const playerMod = await check('import player.js', () => import(SRC + 'player.js'));
const contentMod = await check('import content.js', () => import(SRC + 'content.js'));
console.log(`  ·  modules imported in ${Date.now() - t0} ms`);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.06, 900);
scene.add(camera);

const sky = check('createSky', () => skyMod.createSky(scene, { seed: 4 }));
const water = check('createWater', () => waterMod.createWater(scene, { level: 0 }));
const city = check('createCity (full procedural build)', () => cityMod.createCity(scene, { seed: 20240410 }));
const specters = check('createSpecters', () => specMod.createSpecters(scene, { city, memories: contentMod.MEMORIES, onRestore: () => {} }));
const shadows = check('createShadows', () => shadMod.createShadows(scene, { city }));
const player = check('createPlayer', () => playerMod.createPlayer(camera, new FakeCanvas(), { city }));
// The walk tests below drive the real player, so they need the real walls: without
// these the autopilot strolls straight through the city's buildings.
if (player && city) for (const c of city.colliders) player.addCollider(c.x, c.z, c.w, c.d, c.rot, c.baseY, c.topY);

/* ── sanity checks on the generated world ── */
if (city) {
  check('ground at plaza start is walkable', () => { const g = city.groundHeight(0, 13); if (g < -8) throw new Error('start is deep water: ' + g); return g.toFixed(2); });
  check('ground in the market is walkable', () => { const g = city.groundHeight(58, 0); if (g < -8) throw new Error('deep: ' + g); return g.toFixed(2); });
  check('ground at every shard anchor is walkable-ish', () => {
    const out = [];
    for (const m of contentMod.MEMORIES) {
      const a = city.shardAnchors[m.id];
      const g = city.groundHeight(a.x, a.z);
      out.push(`${m.id}=${g.toFixed(1)}`);
      if (!isFinite(g)) throw new Error('NaN ground under ' + m.id);
    }
    return out.join(' ');
  });
  check('shard anchors sit above their local floor', () => {
    const bad = [];
    for (const m of contentMod.MEMORIES) {
      const a = city.shardAnchors[m.id];
      const g = city.groundHeight(a.x, a.z);
      if (a.y - g < 0.5) bad.push(`${m.id} (${(a.y - g).toFixed(2)}m)`);
    }
    if (bad.length) throw new Error('shards floating too low: ' + bad.join(', '));
    return 'all ≥ 0.5 m';
  });
  check('no NaN plates', () => {
    for (const p of city.plates) for (const k of Object.keys(p)) if (typeof p[k] === 'number' && !isFinite(p[k])) throw new Error('NaN in plate ' + JSON.stringify(p));
    return city.plates.length + ' plates';
  });
  check('merged meshes exist and have geometry', () => {
    let n = 0;
    city.group.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position.count > 0) n++; });
    return n + ' meshes';
  });
}

/* ── simulate a minute of the game ── */
if (city && sky && water && specters && shadows && player) {
  player.state.pos.set(0, city.PLAZA_Y + 1.68, 13);
  player.setEnabled(true);
  const dt = 1 / 60;
  let t = 0;
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.join(' ')); origError(...a); };
  check('simulate 3600 frames of the whole world', () => {
    for (let i = 0; i < 3600; i++) {
      t += dt;
      city.update(dt, t, player.position);
      water.update(dt, camera.position);
      sky.update(dt, camera);
      specters.update(dt, t, camera.position, camera.position);
      shadows.update(dt, t, player.position, { lanternOn: i % 600 < 300, lanternPos: camera.position, sanity: 1 });
      player.update(dt, { waterLevel: 0.2, time: t, danger: 0.3 });
      if (i === 300) shadows.spawnAt(new THREE.Vector3(10, 0, 10), 'temple');
      if (i === 900) { city.setMemoryRestored('market', true); water.setMemories(1); }
      if (i === 1200) { city.setMemoryRestored('bargain', true); city.setMemoryRestored('sealing', true); city.setMemoryRestored('sky', true); city.setMemoryRestored('song', true); city.setMemoryRestored('self', true); }
      if (i === 1500) { for (const s of specters.shards) specters.restore(s); }
      if (!isFinite(player.state.pos.x) || !isFinite(player.state.pos.y) || !isFinite(player.state.pos.z)) throw new Error('player position went non-finite at frame ' + i);
      if (player.position.y < -30) throw new Error('player fell through the world at frame ' + i + ' y=' + player.position.y);
    }
    return `t=${t.toFixed(0)}s player=(${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)})`;
  });
  console.error = origError;
  if (errors.length) console.log('  ·  console.error output during sim:', errors.slice(0, 6));
  check('nearest() returns a shard when standing on one', () => {
    const s = specters.shards[0];
    player.state.pos.copy(s.position.clone().add(new THREE.Vector3(1, -1, 1)));
    const hit = specters.nearest(player.position, { maxDist: 7, requireUnrestored: false });
    if (!hit) throw new Error('no shard found 1.7 m away');
    return hit.shard.id + ' at ' + hit.dist.toFixed(2) + ' m';
  });
}

/* ── gameplay-critical numeric checks ── */
if (city && player) {
  check('walking forward from the plaza start stays on solid ground', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13);
    player.state.vel.set(0, 0, 0);
    player.state.yaw = 0;
    const start = player.position.clone();
    for (let i = 0; i < 600; i++) player.update(1 / 60, { waterLevel: 0, time: i / 60 });
    // with no keys held the player should simply stand still
    if (player.position.distanceTo(start) > 0.3) throw new Error('player drifted ' + player.position.distanceTo(start).toFixed(2) + ' m with no input');
    return 'stable';
  });
  check('avenue heights are continuous from the plaza to the market', () => {
    const jumps = [];
    let prev = city.groundHeight(14, 0);
    for (let d = 14; d < 92; d += 0.5) {
      const g = city.groundHeight(d, 0);
      if (isFinite(g) && isFinite(prev) && g > prev + 0.62) jumps.push(`${d.toFixed(0)}m: ${prev.toFixed(2)}→${g.toFixed(2)}`);
      prev = g;
    }
    if (jumps.length) throw new Error('unclimbable steps along +x: ' + jumps.join(', '));
    return 'no step > 0.62 m';
  });
}


/* ── reachability: can the player actually walk/swim to every fragment? ── */
if (city) {
  check('every memory is reachable on foot or by swimming, with the buildings solid', () => {
    const STEP = 1.5, EXT = 112;
    const N = Math.ceil((EXT * 2) / STEP) + 1;
    const g = new Float32Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      g[i * N + j] = city.groundHeight(-EXT + i * STEP, -EXT + j * STEP);
    }
    // the buildings are solid here too: this used to flood over the height field
    // alone, which means it cheerfully reported the player could reach a district
    // that a house had been built across the road to.
    const solid = (x, z, gy) => {
      const y = gy + 1.68;
      for (const c of city.colliders) {
        if (y > c.topY + 0.1 || y < c.baseY - 0.5) continue;
        const dx = x - c.x, dz = z - c.z;
        const lx = dx * Math.cos(c.rot) - dz * Math.sin(c.rot);
        const lz = dx * Math.sin(c.rot) + dz * Math.cos(c.rot);
        if (Math.abs(lx) <= c.w / 2 + 0.42 && Math.abs(lz) <= c.d / 2 + 0.42) return true;
      }
      return false;
    };
    const blocked = new Uint8Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const gv = g[i * N + j];
      if (gv > city.DEEP + 0.01 && solid(-EXT + i * STEP, -EXT + j * STEP, gv)) blocked[i * N + j] = 1;
    }
    // step up to 0.55 m, walk/fall into any water, and haul yourself out of water
    // onto anything within arm's reach of the surface (a mantle, see player.js)
    const canPass = (a, b) => (b - a) <= 0.8 || b < -1.4 || (a < -1.4 && b <= 1.1);
    // Two floods, not one. A single flood from the plaza says "you can get there",
    // which is not the same as "you can get back" — the amphitheatre floor was a
    // 0.75 m bowl you could fall into and never climb out of, and the one-way flood
    // happily reported it as reachable.
    const flood = (reverse) => {
      const seen2 = new Uint8Array(N * N);
      const start = [Math.round((0 + EXT) / STEP), Math.round((13 + EXT) / STEP)];
      const q = [start[0] * N + start[1]];
      seen2[q[0]] = 1;
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        const ci = Math.floor(cur / N), cj = cur % N;
        for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const nk = ni * N + nj;
          if (seen2[nk] || blocked[nk]) continue;
          if (!(reverse ? canPass(g[nk], g[cur]) : canPass(g[cur], g[nk]))) continue;
          seen2[nk] = 1; q.push(nk);
        }
      }
      return seen2;
    };
    const seen = flood(false);
    const back = flood(true);
    const unreachable = [];
    for (const m of contentMod.MEMORIES) {
      const a = city.shardAnchors[m.id];
      // the exact cell the player stands on to reach this fragment must be
      // reachable — "somewhere in the district" is not good enough
      const i0 = Math.round((a.x + EXT) / STEP), j0 = Math.round((a.z + EXT) / STEP);
      let found = false;
      for (let di = -1; di <= 1 && !found; di++) for (let dj = -1; dj <= 1; dj++) {
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        // standing beside the shard is fine as long as the eye can see it
        if (seen[i * N + j] && Math.abs(city.groundHeight(-EXT + i * STEP, -EXT + j * STEP) - city.groundHeight(a.x, a.z)) < 3.5) { found = true; break; }
      }
      if (!found) unreachable.push(`${m.id} (${a.x.toFixed(0)}, ${a.z.toFixed(0)}, ground ${city.groundHeight(a.x, a.z).toFixed(2)})`);
    }
    // and the districts themselves
    for (const [id, d] of Object.entries(city.districts)) {
      const [x, z] = d.at;
      const i = Math.round((x + EXT) / STEP), j = Math.round((z + EXT) / STEP);
      if (!seen[i * N + j]) unreachable.push(`district:${id}`);
    }

    // nothing may be a one-way trip: everywhere you can get to, you can get back from
    const traps = [];
    let trapped = 0;
    for (let k = 0; k < N * N; k++) {
      if (!seen[k] || back[k] || blocked[k]) continue;
      trapped++;
      if (traps.length < 5) traps.push(`(${(-EXT + Math.floor(k / N) * STEP).toFixed(0)}, ${(-EXT + (k % N) * STEP).toFixed(0)}) at ${g[k].toFixed(2)} m`);
    }
    if (unreachable.length) throw new Error('unreachable: ' + unreachable.join(', '));
    if (trapped > 2) throw new Error(`${trapped} cells are one-way traps — you can get in but not out: ${traps.join(', ')}`);

    let count = 0;
    for (let k = 0; k < N * N; k++) if (seen[k]) count++;
    return `${count} cells you can reach, ${count - trapped} you can also get back from`;
  });
}


/* ── end-to-end: drive the player from the plaza to a district with real input ── */
if (city && player) {
  const key = (code, down) => globalThis.__fire(down ? 'keydown' : 'keyup', { code, repeat: false, preventDefault() {} });

  function walkTo(tx, tz, limitSeconds, label, { tide = 0 } = {}) {
    const frames = Math.round(limitSeconds * 60);
    let reached = -1;
    let stuck = 0, wiggle = 0, detour = 1, aim = 0;
    for (let i = 0; i < frames; i++) {
      const dx = tx - player.position.x, dz = tz - player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7) { reached = i / 60; break; }
      player.state.yaw = Math.atan2(-dx, -dz);
      // hold W, tap space when stuck against a ledge, sprint on the flat
      if (i === 0) key('KeyW', true);
      const swimming = player.state.swimming;
      key('ShiftLeft', !swimming && dist > 12);
      key('Space', swimming || (player.state.speed < 0.4 && i % 30 === 0));
      // A person who walks into a wall turns and looks for a way round, then walks
      // it. (The old wiggle just jittered on the spot, which is why a walled-off
      // market went unnoticed.)
      if (player.state.speed < 0.35) stuck++; else stuck = 0;
      if (stuck > 60 && wiggle <= 0) { wiggle = 150; detour = (i % 2 ? 1 : -1); stuck = 0; }
      if (wiggle > 0) {
        wiggle--;
        if (wiggle > 60) player.state.yaw = aim + detour * 1.5;          // turn hard
        else player.state.yaw = aim + detour * 1.5 * ((wiggle - 20) / 40); // and back
        if (wiggle < 20) wiggle = 0;
        player.update(1 / 60, { waterLevel: tide, time: i / 60 });
        continue;
      }
      aim = player.state.yaw;
      player.update(1 / 60, { waterLevel: tide, time: i / 60 });
      if (!isFinite(player.position.x) || player.position.y < -20) throw new Error(label + ': player fell out of the world at frame ' + i);
    }
    key('KeyW', false); key('Space', false); key('ShiftLeft', false);
    if (reached < 0) throw new Error(`${label}: could not reach (${tx}, ${tz}) — stuck at (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}), ${Math.hypot(tx - player.position.x, tz - player.position.z).toFixed(1)} m short`);
    return `${label}: ${reached.toFixed(1)} s`;
  }

  const results = [];
  results.push(check('walk: plaza → market street', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    return walkTo(58, 0, 70, 'market');
  }));
  results.push(check('walk: plaza → observatory', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    return walkTo(-66, -56, 110, 'observatory');
  }));
  results.push(check('walk: plaza → amphitheatre stage', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    return walkTo(66, -58, 110, 'amphitheatre');
  }));
  results.push(check('walk: plaza → temple shrine', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    return walkTo(-68, 58, 140, 'temple');
  }));
  results.push(check('walk: plaza → sea-gates', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    return walkTo(66, 62, 110, 'floodgate');
  }));
  results.push(check('walk: plaza → drowned plaza basin (swim + mantle back out)', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13); player.state.vel.set(0, 0, 0);
    const into = walkTo(0, 0, 40, 'basin');
    const out = walkTo(0, 13, 45, 'back to the ring', { tide: 0 });
    return into + ' | ' + out;
  }));
  results.push(check('walk: under a risen tide (worst case, 1.2 m)', () => {
    player.state.pos.set(0, city.PLAZA_Y + 1.68 + 1.2, 13); player.state.vel.set(0, 0, 0);
    return walkTo(58, 0, 90, 'market in flood', { tide: 1.2 });
  }));
  console.log('  ·  ' + results.filter(Boolean).join('\n  ·  '));
}

console.log(fails.length ? `\n${fails.length} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
