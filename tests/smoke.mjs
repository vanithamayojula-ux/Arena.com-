import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import './dom-stub.mjs';
const SRC = new URL('../src/', import.meta.url).href;

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
  check('every memory is reachable on foot or by swimming', () => {
    const STEP = 1.5, EXT = 112;
    const N = Math.ceil((EXT * 2) / STEP) + 1;
    const g = new Float32Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      g[i * N + j] = city.groundHeight(-EXT + i * STEP, -EXT + j * STEP);
    }
    // step up to 0.55 m, walk/fall into any water, and haul yourself out of water
    // onto anything within arm's reach of the surface (a mantle, see player.js)
    const canPass = (a, b) => (b - a) <= 0.55 || b < -1.4 || (a < -1.4 && b <= 1.1);
    const seen = new Uint8Array(N * N);
    const q = [];
    const start = [Math.round((0 + EXT) / STEP), Math.round((13 + EXT) / STEP)];
    const si = start[0] * N + start[1];
    seen[si] = 1; q.push(si);
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      const ci = Math.floor(cur / N), cj = cur % N;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = ni * N + nj;
        if (seen[nk]) continue;
        if (!canPass(g[cur], g[nk])) continue;
        seen[nk] = 1; q.push(nk);
      }
    }
    const unreachable = [];
    for (const m of contentMod.MEMORIES) {
      const a = city.shardAnchors[m.id];
      // look for any reachable cell within 8 m of the shard's footprint
      let found = false;
      for (let i = 0; i < N && !found; i++) for (let j = 0; j < N; j++) {
        if (!seen[i * N + j]) continue;
        const x = -EXT + i * STEP, z = -EXT + j * STEP;
        if (Math.hypot(x - a.x, z - a.z) < 8) { found = true; break; }
      }
      if (!found) unreachable.push(`${m.id} (${a.x.toFixed(0)}, ${a.z.toFixed(0)})`);
    }
    // and the districts themselves
    for (const [id, d] of Object.entries(city.districts)) {
      const [x, z] = d.at;
      const i = Math.round((x + EXT) / STEP), j = Math.round((z + EXT) / STEP);
      if (!seen[i * N + j]) unreachable.push(`district:${id}`);
    }
    if (unreachable.length) throw new Error('unreachable: ' + unreachable.join(', '));
    return `${q.length} reachable cells of ${N * N}`;
  });
}


/* ── end-to-end: drive the player from the plaza to a district with real input ── */
if (city && player) {
  const key = (code, down) => globalThis.__fire(down ? 'keydown' : 'keyup', { code, repeat: false, preventDefault() {} });

  function walkTo(tx, tz, limitSeconds, label, { tide = 0 } = {}) {
    const frames = Math.round(limitSeconds * 60);
    const t0 = process.hrtime.bigint();
    let reached = -1;
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
      player.update(1 / 60, { waterLevel: tide, time: i / 60 });
      if (!isFinite(player.position.x) || player.position.y < -20) throw new Error(label + ': player fell out of the world at frame ' + i);
    }
    key('KeyW', false); key('Space', false); key('ShiftLeft', false);
    void t0;
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
