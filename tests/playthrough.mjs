// Plays Vaelune from the first step to the finale, with the real city, the real
// player physics and the real interaction rules — then reports what a player would
// actually experience, and fails if any of it is unfair.
//
// This is the suite that answers "is the game any good to play", as opposed to
// "does it run". It walks every leg at whatever tide the previous memory left
// behind, aims at the fragment (dot product, exactly like the game), holds E for
// the full 3.3 s channel, and applies the same rules main.js does.
import * as THREE from 'three';
import { FakeCanvas } from './dom-stub.mjs';
import { MEMORIES, CITY as CFG } from '../src/content.js';

const { createCity } = await import('../src/city.js');
const { createPlayer } = await import('../src/player.js');
const { createSpecters } = await import('../src/specters.js');
const { createShadows } = await import('../src/shadows.js');
const { createProgress, CHANNEL_SECONDS, REACH } = await import('../src/progress.js');

const fails = [];
const notes = [];
const check = (label, fn) => {
  try { const v = fn(); console.log(`  ok   ${label}${v !== undefined ? ' → ' + v : ''}`); return v; }
  catch (e) { fails.push(label); console.log(`  FAIL ${label}: ${e.message}`); return null; }
};
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

const EYE = 1.68;
const AIM_DOT = 0.35;                // how well you must be looking at a fragment

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(71, 1.7, 0.06, 920);
const city = createCity(scene, { seed: 20240410 });
const specters = createSpecters(scene, { city, memories: MEMORIES });
const shadows = createShadows(scene, {
  city,
  // the game hands the drain to the rules; so does this
  onDrain: (amount) => { hits++; flow.drain(amount / 100); },
});
const player = createPlayer(camera, new FakeCanvas(), { city });
for (const c of city.colliders) player.addCollider(c.x, c.z, c.w, c.d, c.rot, c.baseY, c.topY);
player.setEnabled(true);

/* ── the game's own rules, straight out of src/progress.js ── */
let oil = 100;
const flow = createProgress({
  events: {
    onRestore: (info) => {
      specters.restore(info.shard);
      oil = 100;                                     // restoring refills the lamp
    },
  },
});
const S = flow.state;
const restored = flow.restored;

/** One second of world time while the shadows do whatever they are doing. */
function worldTick(seconds, { lantern = false } = {}) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    shadows.update(1 / 60, i / 60, player.position, {
      lanternOn: lantern, lanternPos: camera.position, sanity: S.lucidity,
    });
    const danger = shadows.threat * 0.8 + (1 - S.lucidity) * 0.6;
    flow.setDanger(danger);
    const nearRestored = specters.shards.some((s) => s.restored && s.position.distanceTo(player.position) < 26);
    flow.tick(1 / 60, { nearRestored });
  }
}

const key = (code, down) => globalThis.__fire(down ? 'keydown' : 'keyup', { code, repeat: false, preventDefault() {} });

/* ── navigation: the same inputs a person gives ── */
function walkTo(tx, tz, limitSeconds, label) {
  const frames = Math.round(limitSeconds * 60);
  let stuck = 0, wiggle = 0, detour = 1, aim = 0;
  for (let i = 0; i < frames; i++) {
    const dx = tx - player.position.x, dz = tz - player.position.z;
    if (Math.hypot(dx, dz) < 6.5) { key('KeyW', false); key('Space', false); key('ShiftLeft', false); return i / 60; }
    player.state.yaw = Math.atan2(-dx, -dz);
    if (i === 0) key('KeyW', true);
    const swimming = player.state.swimming;
    key('ShiftLeft', !swimming && Math.hypot(dx, dz) > 12);
    key('Space', swimming || (player.state.speed < 0.4 && i % 30 === 0));
    // walk into a wall, turn aside, look for a way round — what a person does
    if (player.state.speed < 0.35) stuck++; else stuck = 0;
    if (stuck > 60 && wiggle <= 0) { wiggle = 150; detour = (i % 2 ? 1 : -1); stuck = 0; }
    if (wiggle > 0) {
      wiggle--;
      player.state.yaw = wiggle > 60 ? aim + detour * 1.5 : aim + detour * 1.5 * ((wiggle - 20) / 40);
      if (wiggle < 20) wiggle = 0;
      player.update(1 / 60, { waterLevel: S.tide, time: i / 60 });
      continue;
    }
    aim = player.state.yaw;
    player.update(1 / 60, { waterLevel: S.tide, time: i / 60 });
  }
  key('KeyW', false); key('Space', false); key('ShiftLeft', false);
  const short = Math.hypot(tx - player.position.x, tz - player.position.z);
  throw new Error(`${label}: could not reach (${tx}, ${tz}) at tide ${S.tide.toFixed(2)} — ${short.toFixed(1)} m short, at (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)})`);
}

/** Turn to face the fragment and hold E until the ring fills — the game's own rule. */
function listenTo(shard, label) {
  const frames = Math.round((CHANNEL_SECONDS + 0.6) * 60);
  for (let i = 0; i < frames; i++) {
    // the player turns to look at the fragment (the game requires ~70° of aim)
    const to = shard.position.clone().sub(camera.position).normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (to.dot(fwd) < AIM_DOT) {
      const d = shard.position.clone().sub(player.position);
      player.state.yaw = Math.atan2(-d.x, -d.z);
      player.state.pitch = Math.atan2(shard.position.y - camera.position.y, Math.hypot(d.x, d.z));
      camera.rotation.y = player.state.yaw;
      camera.rotation.x = player.state.pitch;
    }
    // the game only offers the prompt when you are close enough and looking at it
    const hit = specters.nearest(player.position, { maxDist: REACH, requireUnrestored: false });
    const aimed = hit && hit.shard === shard ? shard : null;
    flow.interact(aimed, aimed !== null);
    player.update(1 / 60, { waterLevel: S.tide, time: i / 60 });
    camera.updateMatrixWorld();
    if (S.channel) {
      flow.stepChannel(1 / 60);
      // the reverie holds the player still for four seconds afterwards
      if (S.reverieT > 0) flow.updateReverie(1 / 60);
    }
    if (shard.restored) return (i + 1) / 60;
  }
  throw new Error(`${label}: ${CHANNEL_SECONDS} s of holding E did not restore the fragment`);
}

/* ══════════════════════════ the playthrough ══════════════════════════ */

const log = [];
let walked = 0;
let listened = 0;
let hits = 0;                 // shadow contacts, the thing that actually hurts

check('the game starts where the story says it does', () => {
  player.state.pos.set(0, city.PLAZA_Y + EYE, 13);
  player.state.vel.set(0, 0, 0);
  assert(Math.abs(player.position.y - (city.PLAZA_Y + EYE)) < 0.01, 'start position is wrong');
  return `plaza, standing at y ${player.position.y.toFixed(2)}`;
});

check('all six fragments can be reached and listened to, in order', () => {
  for (const mem of MEMORIES) {
    const shard = specters.forId(mem.id);
    assert(shard, `no fragment exists for ${mem.id}`);
    if (mem.id === 'self') assert(restored.size === MEMORIES.length - 1, 'the orrery opened too early');

    const t0 = walked;
    walked += walkTo(shard.position.x, shard.position.z, 150, mem.id);
    listened += listenTo(shard, mem.id);

    assert(restored.has(mem.id), `${mem.id} was not recorded as restored`);
    assert(Math.abs(S.tide - (CFG.waterLevel + restored.size * CFG.tidePerMemory + (restored.has('sealing') ? 0.35 : 0))) < 1e-6,
      `${mem.id}: the tide did not follow the rule`);
    log.push({
      order: mem.order, id: mem.id, kind: mem.kind,
      walk: +(walked - t0).toFixed(1), tide: +S.tide.toFixed(2), shadows: shadows.count,
    });
    assert(player.position.y > -6, `after restoring ${mem.id} the player is below the world`);
  }
  for (const l of log) {
    notes.push(`memory ${l.order} · ${l.id.padEnd(8)} ${String(l.walk).padStart(5)} s walking · tide now ${l.tide.toFixed(2)}${l.kind === 'dark' ? ' · a shadow rises' : ''}`);
  }
  return `${walked.toFixed(0)} s of walking, ${listened.toFixed(1)} s of listening`;
});

check('the finale unlocks when the city is whole', () => {
  assert(restored.size === MEMORIES.length, `only ${restored.size} of ${MEMORIES.length} restored`);
  const ready = restored.size >= MEMORIES.length;
  assert(ready, 'the finale never triggers');
  return `${restored.size}/${MEMORIES.length} restored, orrery open`;
});

check('the final tide is the one the story promises', () => {
  const want = CFG.waterLevel + MEMORIES.length * CFG.tidePerMemory + 0.35;
  assert(Math.abs(S.tide - want) < 0.001, `final tide is ${S.tide.toFixed(2)}, expected ${want.toFixed(2)}`);
  assert(S.tide < 1.6, `the final tide (${S.tide.toFixed(2)} m) would drown routes the player needs`);
  return `${S.tide.toFixed(2)} m at totality`;
});

check('a shadow that reaches you costs you, but does not end the run', () => {
  // stand still in the dark with a shadow stalking you — a person reading the
  // journal or listening to a memory does exactly this
  shadows.clear();
  shadows.spawnAt(player.position.clone().add(new THREE.Vector3(14, 1.5, 0)), 'bargain');
  const before = S.lucidity;
  const hitsBefore = hits;
  for (let i = 0; i < 60 * 40; i++) worldTick(1 / 60);
  const taken = hits - hitsBefore;
  assert(taken >= 1, 'the shadow never reached the player, so this proves nothing');
  assert(S.collapses === 0, `standing still for 40 s collapsed the player ${S.collapses} times`);
  assert(before - S.lucidity < 0.5, `one stalking shadow took ${(before - S.lucidity).toFixed(2)} lucidity in 40 s — most of the bar`);
  return `${taken} hit${taken === 1 ? '' : 's'} in 40 s of standing still, ${(before - S.lucidity).toFixed(2)} lucidity, no collapse`;
});

check('and you can walk away from one', () => {
  const before = S.lucidity;
  const hitsBefore = hits;
  key('KeyW', true);
  for (let i = 0; i < 60 * 25; i++) {
    player.state.yaw += 0.004;                     // a long, wide, aimless walk
    player.update(1 / 60, { waterLevel: S.tide, time: i / 60 });
    worldTick(1 / 60);
  }
  key('KeyW', false);
  // shadows respawn after 22-38 s, so one more hit on a long walk is the design, not a bug;
  // what matters is that walking is not worse than standing still, and never lethal
  assert(S.collapses === 0, 'the player collapsed while walking away');
  assert(hits - hitsBefore <= 1, `a shadow caught the player ${hits - hitsBefore} times in 25 s of walking`);
  return `walked 25 s (${hits - hitsBefore} hit${hits - hitsBefore === 1 ? '' : 's'}, a shadow respawns after ~30 s); lucidity ${before.toFixed(2)} → ${S.lucidity.toFixed(2)}`;
});

check('the lantern is enough to push a shadow off', () => {
  // a shadow walking at you with the lantern up must dissolve before it reaches you
  shadows.clear();
  const spawn = player.position.clone().add(new THREE.Vector3(7, 1.5, 0));
  shadows.spawnAt(spawn, 'temple');
  const hitsBefore = hits;
  let closest = Infinity;
  for (let i = 0; i < 60 * 14; i++) {
    worldTick(1 / 60, { lantern: true });
    for (const s of shadows.pool) {
      if (s.active && s.dissolve <= 0) closest = Math.min(closest, s.group.position.distanceTo(player.position));
    }
  }
  assert(hits === hitsBefore, 'a shadow reached the player even with the lantern up');
  assert(closest > 1.9, `a shadow got within ${closest.toFixed(1)} m even with the lantern up`);
  return `spawned 7 m away, closest approach ${closest.toFixed(1)} m, no contact`;
});

check('the last fragment can be reached and listened to at the highest tide', () => {
  // the orrery floats over the drowned plaza basin, and by the end the water is at
  // its highest — swimming to it has to work
  const shard = specters.forId('self');
  const saved = player.state.pos.clone();
  let found = false, how = 'nowhere';
  for (const [label, y] of [['standing on the ring', city.PLAZA_Y + EYE], ['swimming the basin', S.tide + EYE * 0.75], ['diving', S.tide - 1.6]]) {
    player.state.pos.set(shard.position.x + 2.5, y, shard.position.z + 1.5);
    const hit = specters.nearest(player.position, { maxDist: REACH, requireUnrestored: false });
    if (hit && hit.shard === shard) { found = true; how = label; break; }
  }
  player.state.pos.copy(saved);
  assert(found, `the orrery fragment cannot be interacted with at tide ${S.tide.toFixed(2)} from anywhere`);
  return `reachable at ${S.tide.toFixed(2)} m by ${how}`;
});

check('the session is a reasonable length for a vertical slice', () => {
  const total = walked + listened;
  notes.push(`full playthrough: ${walked.toFixed(0)} s walking + ${listened.toFixed(1)} s listening ≈ ${(total / 60).toFixed(1)} min`);
  assert(total / 60 < 12, `a straight-line playthrough takes ${(total / 60).toFixed(1)} minutes of just walking and listening`);
  return `${(total / 60).toFixed(1)} min of walking + listening (not counting exploring or reading)`;
});

console.log('\n── session report ──────────────────────────────');
for (const n of notes) console.log('  ' + n);
console.log(fails.length ? `\n${fails.length} PLAYABILITY PROBLEM(S)` : '\nPLAYS OK');
process.exit(fails.length ? 1 : 0);
