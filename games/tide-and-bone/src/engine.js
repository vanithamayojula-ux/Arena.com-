/* TIDE & BONE — deterministic game core. No DOM, no canvas: the renderer and
   the UI read this state; the tests drive it directly. A run is fully defined
   by (seed, charms, startSalvage). One player action = one turn: enemies,
   the creature, and the dive clock all answer. */

/* ---------------------------------------------------------------- tiles ---- */
export const T = {
  ABYSS: 0,   // the void beside the shell — impassable
  ROCK: 1,    // shell floor
  WALL: 2,    // barnacle bumps / organ walls (impassable)
  FLESH: 3,   // harvestable flesh (shell growths · organ meat)
  VENT: 4,    // breathing hole — dive into organs / emerge back to shell
  EXTRACT: 5, // extraction ridge — end the run with your haul
  ORE: 6,     // loose marrow-glass nodule — harvest for salvage
  SPUR: 7,    // bone spur — impassable decor
  FLOOR: 8,   // wet organ floor (not harvestable)
  POOL: 9,    // marrow pool — harvest → flasks
};

export const WALK = { [T.ABYSS]: false, [T.ROCK]: true, [T.WALL]: false, [T.FLESH]: true, [T.VENT]: true, [T.EXTRACT]: true, [T.ORE]: true, [T.SPUR]: false, [T.FLOOR]: true, [T.POOL]: true };
export const HARVEST = { [T.FLESH]: true, [T.ORE]: true, [T.POOL]: true };

export const DIVE_TURNS = 15;   // turns before the Vastmother dives
export const FLUSH_GRACE = 10;  // shell turns granted after being spat out
const WRATH_FLESH_DMG = 2;

/* ----------------------------------------------------------------- rng ---- */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1)); // inclusive

/* ------------------------------------------------------- map primitives -- */
const inB = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
const tileAt = (m, x, y) => (inB(m, x, y) ? m.tiles[y * m.w + x] : T.ABYSS);
const put = (m, x, y, t) => { if (inB(m, x, y)) m.tiles[y * m.w + x] = t; };
const solidFor = (m, x, y) => {
  if (!inB(m, x, y)) return true;
  const i = y * m.w + x;
  return !WALK[m.tiles[i]] || (m.closed && m.closed.has(i));
};

export function bfs(map, sx, sy) {
  const n = map.w * map.h;
  const dist = new Int16Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  if (solidFor(map, sx, sy)) return { dist, prev, w: map.w };
  dist[sy * map.w + sx] = 0;
  const q = [sy * map.w + sx];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h], cx = cur % map.w, cy = (cur / map.w) | 0, d = dist[cur];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const ni = ny * map.w + nx;
      if (dist[ni] !== -1) continue;
      if (solidFor(map, nx, ny)) continue;
      dist[ni] = d + 1; prev[ni] = cur; q.push(ni);
    }
  }
  return { dist, prev, w: map.w };
}
export const pathFrom = (map, sx, sy, tx, ty) => {
  const { dist, prev, w } = bfs(map, sx, sy);
  if (!inB(map, tx, ty) || dist[ty * w + tx] === -1) return null;
  const out = [];
  let cur = ty * w + tx;
  while (cur !== -1 && !(cur % w === sx && (cur / w | 0) === sy)) {
    out.unshift({ x: cur % w, y: (cur / w) | 0 });
    cur = prev[cur];
  }
  return out;
};

/* ------------------------------------------------------------- statuses -- */
export function moodOf(state) {
  const c = state.creature;
  if (c.hp >= 70) return 'CALM';
  if (c.hp >= 30) return 'AGITATED';
  return 'WRATHFUL';
}

/* ------------------------------------------------------ procedural gen --- */
function blankMap(w, h, fill) {
  const tiles = new Uint8Array(w * h).fill(fill);
  const decor = new Uint8Array(w * h);
  for (let i = 0; i < decor.length; i++) decor[i] = (Math.imul(i + 1, 2654435761) >>> 13) & 7; // wet-speckle seeds
  return { w, h, tiles, decor, closed: new Set(), pulse: [] };
}

function genShell(rng, tries = 0) {
  const m = blankMap(12, 12, T.ROCK);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++)
    if (x === 0 || y === 0 || x === 11 || y === 11) put(m, x, y, T.ABYSS);
  const inner = [];
  for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) inner.push([x, y]);
  for (let i = 0; i < 9; i++) { const [x, y] = inner[ri(rng, 0, inner.length - 1)]; put(m, x, y, rng() < 0.4 ? T.SPUR : T.WALL); }
  for (let c = 0; c < 4; c++) { // flesh clumps
    const cx = ri(rng, 2, 9), cy = ri(rng, 2, 9);
    for (let i = 0; i < 4; i++) { const x = cx + ri(rng, -1, 1), y = cy + ri(rng, -1, 1); if (tileAt(m, x, y) === T.ROCK) put(m, x, y, T.FLESH); }
  }
  const specials = spreadPick(m, rng, 6, 2); // [x,y] mutually ≥2 apart
  const vents = [], ridges = [];
  specials.forEach((s, i) => {
    put(m, s[0], s[1], i < 3 ? T.VENT : T.EXTRACT);
    (i < 3 ? vents : ridges).push({ x: s[0], y: s[1] });
  });
  for (let i = 0; i < 4; i++) { const [x, y] = inner[ri(rng, 0, inner.length - 1)]; if (tileAt(m, x, y) === T.ROCK) put(m, x, y, T.ORE); }
  // spawn: walkable rock away from specials
  let spawn = null;
  for (let y = 2; y < 10 && !spawn; y++) for (let x = 2; x < 10 && !spawn; x++) {
    if (tileAt(m, x, y) !== T.ROCK) continue;
    if ([...vents, ...ridges].some(v => Math.abs(v.x - x) + Math.abs(v.y - y) < 2)) continue;
    spawn = { x, y };
  }
  if (!spawn) spawn = { x: 2, y: 2 };
  // connectivity: every vent + at least one ridge + most ore reachable from spawn
  const { dist, w } = bfs(m, spawn.x, spawn.y);
  const reach = (p) => dist[p.y * w + p.x] >= 0;
  const ok = vents.every(reach) && ridges.some(reach) && countReachable(m, dist, w, T.ORE) >= 2;
  if (!ok && tries < 6) return genShell(rng, tries + 1);
  if (!ok) { // last-resort fixup: flatten blockers around spawn cross
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) {
      const t = tileAt(m, x, y);
      if (t === T.WALL || t === T.SPUR) put(m, x, y, T.ROCK);
    }
  }
  m.vents = vents; m.ridges = ridges; m.spawn = spawn;
  return m;
}
function spreadPick(m, rng, n, minGap) {
  const out = [];
  for (let tries = 0; tries < 220 && out.length < n; tries++) {
    const x = ri(rng, 2, 9), y = ri(rng, 2, 9);
    if (tileAt(m, x, y) !== T.ROCK) continue;
    if (out.some(o => Math.max(Math.abs(o[0] - x), Math.abs(o[1] - y)) < minGap)) continue;
    out.push([x, y]);
  }
  while (out.length < n) { // deterministic pad: first free rock, ≥1 apart from all picks
    outer: for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) {
      if (tileAt(m, x, y) !== T.ROCK) continue;
      for (const o of out) if (Math.max(Math.abs(o[0] - x), Math.abs(o[1] - y)) < 1) continue outer;
      out.push([x, y]); break outer;
    }
  }
  return out;
}
function countReachable(m, dist, w, type) {
  let c = 0;
  for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === type && dist[i] >= 0) c++;
  return c;
}

function genOrgan(rng, kind, tries = 0) {
  const m = blankMap(10, 10, T.WALL);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) m.tiles[y * m.w + x] = rng() < 0.54 ? T.FLOOR : T.WALL;
  for (let pass = 0; pass < 3; pass++) {
    const cp = Uint8Array.from(m.tiles);
    for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!inB(m, x + dx, y + dy) || cp[(y + dy) * m.w + x + dx] === T.WALL) n++;
      }
      m.tiles[y * m.w + x] = (cp[y * m.w + x] === T.WALL ? n > 4 : n < 3) ? T.WALL : T.FLOOR;
    }
  }
  const openCells = () => { const o = []; for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) if (m.tiles[y * m.w + x] === T.FLOOR) o.push([x, y]); return o; };
  let open = openCells();
  if (open.length < 30) {
    for (let i = 2; i < 8; i++) { put(m, i, 4, T.FLOOR); put(m, i, 5, T.FLOOR); put(m, 4, i, T.FLOOR); put(m, 5, i, T.FLOOR); }
    open = openCells();
  }
  if (open.length < 30 && tries < 5) return genOrgan(rng, kind, tries + 1);
  // contents by organ
  const pick = () => open[ri(rng, 0, open.length - 1)];
  if (kind === 'heart') {
    const cx = 4 + ri(rng, -1, 1), cy = 4 + ri(rng, -1, 1);
    for (let y = 1; y < 9; y++) for (let x = 1; x < 9; x++) { /* ensure chamber */ }
    const core = nearFloor(m, cx, cy) || pick();
    put(m, core[0] ?? core.x, core[1] ?? core.y, T.FLESH);
    m.heartCore = { x: core[0] ?? core.x, y: core[1] ?? core.y };
    m.heartUses = 2;
    for (let i = 0; i < 2; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.ORE); }
    { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.POOL); }
  } else if (kind === 'gut') {
    for (let i = 0; i < 8; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.FLESH); }
    for (let i = 0; i < 3; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.ORE); }
    for (let i = 0; i < 2; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.POOL); }
  } else { // lung
    for (let i = 0; i < 3; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.POOL); }
    for (let i = 0; i < 3; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.ORE); }
    for (let i = 0; i < 3; i++) { const c = pick(); if (tileAt(m, c[0], c[1]) === T.FLOOR) put(m, c[0], c[1], T.FLESH); }
  }
  // entry vent: floor cell with a free neighbor and max edge-ness
  open = openCells();
  open.sort((a, b) => (Math.min(a[0], a[1], 9 - a[0], 9 - a[1]) + rng() * 0.9) - (Math.min(b[0], b[1], 9 - b[0], 9 - b[1]) + rng() * 0.9));
  const entry = open[0];
  put(m, entry[0], entry[1], T.VENT);
  // connectivity: ≥ 60% of floor + every harvestable reachable from vent
  const { dist, w } = bfs(m, entry[0], entry[1]);
  let reachH = 0, totH = 0;
  for (let i = 0; i < m.tiles.length; i++) if (HARVEST[m.tiles[i]]) { totH++; if (dist[i] >= 0) reachH++; }
  if (totH >= 3 && reachH < Math.max(3, Math.ceil(totH * 0.7)) && tries < 5) return genOrgan(rng, kind, tries + 1);
  m.exit = { x: entry[0], y: entry[1] };
  m.vents = [{ x: entry[0], y: entry[1] }];
  m.spawn = { x: entry[0], y: entry[1] };
  return m;
}
function nearFloor(m, x, y) {
  for (let r = 0; r <= 2; r++)
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (tileAt(m, nx, ny) === T.FLOOR) return [nx, ny];
    }
  for (let yy = 1; yy < 9; yy++) for (let xx = 1; xx < 9; xx++) if (tileAt(m, xx, yy) === T.FLOOR) return [xx, yy];
  return null;
}

/* ------------------------------------------------------------ spawning -- */
const ENEMY_DEF = {
  mite: { hp: 7, dmg: 6, name: 'Mite Parasite' },
  spitter: { hp: 10, dmg: 8, name: 'Spitter' },
  reaver: { hp: 16, dmg: 10, name: 'Rival Reaver' },
};
function makeEnemy(type, x, y) {
  const d = ENEMY_DEF[type];
  return { type, x, y, hp: d.hp, maxHp: d.hp, dmg: d.dmg, loot: 0, state: 'hunt', fleeT: 0 };
}
function spawnEnemiesFor(map, rng, kind) {
  const open = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (WALK[tileAt(map, x, y)] && !(map.spawn && x === map.spawn.x && y === map.spawn.y)) open.push([x, y]);
  const far = (c) => Math.abs(c[0] - map.spawn.x) + Math.abs(c[1] - map.spawn.y);
  open.sort((a, b) => far(b) - far(a));
  const out = [];
  let i = 0;
  const take = (type) => { const c = open[Math.min(i, open.length - 1)]; i += 2; out.push(makeEnemy(type, c[0], c[1])); };
  const plan = { shell: ['mite', 'mite', 'spitter', ...(rng() < 0.65 ? ['reaver'] : [])], heart: ['spitter', 'spitter', 'mite', 'reaver'], lung: ['spitter', 'mite', 'mite', 'mite'], gut: ['mite', 'mite', 'mite', 'spitter', 'reaver'] }[kind];
  for (const type of plan) take(type);
  return out;
}

/* ------------------------------------------------------------- run state */
export function createRun({ seed = 1, charms = [], startSalvage = 0, maxHpBonus = 0 } = {}) {
  const charmSet = new Set(charms);
  const rng = mulberry32(seed >>> 0);
  const shell = genShell(rng);
  const zoneData = { shell: { map: shell, enemies: spawnEnemiesFor(shell, rng, 'shell') } };
  const has = id => charmSet.has(id);
  const state = {
    seed: seed >>> 0, rng, charmSet,
    turn: 0, diveIn: DIVE_TURNS + (has('tidegift') ? 5 : 0), divesSeen: 0,
    zone: 'shell', zoneData, map: shell, enemies: zoneData.shell.enemies,
    ventReturn: {},          // shellVentPos per organ we dove into
    organsGen: false,
    player: {
      x: shell.spawn.x, y: shell.spawn.y, facing: { x: 1, y: 0 },
      maxHp: 50 + (has('chitin') ? 15 : 0) + maxHpBonus, hp: 0,
      brace: 0, salvage: startSalvage, items: { flask: 1 + (has('brewer') ? 1 : 0), bomb: 1 + (has('saltlord') ? 1 : 0) },
      blade: 8 + (has('boneblade') ? 3 : 0), alive: true,
    },
    creature: { hp: 100, mood: 'CALM', spawnBudget: 0, warned5: false },
    corpses: [], harvests: 0, kills: 0,
    events: [], over: null,
    stats: { harvests: 0, kills: 0, turns: 0, salvaged: 0, dives: 0, deepest: 'shell', depthScore: 0 },
  };
  state.player.hp = state.player.maxHp;
  return state;
}
export function ensureOrgans(state) {
  if (state.organsGen) return;
  for (const k of ['heart', 'lung', 'gut']) {
    const m = genOrgan(state.rng, k);
    state.zoneData[k] = { map: m, enemies: spawnEnemiesFor(m, state.rng, k) };
  }
  state.organsGen = true;
}

/* ---------------------------------------------------------------- events - */
const pushEv = (state, e) => { state.events.push(e); };
const popup = (state, text, cls = '') => pushEv(state, { t: 'popup', text, cls });
const shake = (state, mag) => pushEv(state, { t: 'shake', mag });
const glog = (state, text) => pushEv(state, { t: 'log', text });

/* --------------------------------------------------------------- actions - */
export function act(state, action) {
  state.events = [];
  if (state.over) return state;
  let spent = true;
  switch (action.t) {
    case 'move': doMove(state, action.dx, action.dy); break;
    case 'attack': doAttack(state); break;
    case 'brace': state.player.brace = 1; popup(state, 'BRACE — next blow misses', 'sys'); break;
    case 'wait': popup(state, 'YOU HOLD', 'dim'); break;
    case 'harvest': doHarvest(state, action.x, action.y); break;
    case 'feed': doFeed(state); spent = state.lastFeedOk !== false; break;
    case 'use': doUse(state, action.item); break;
    case 'interact': spent = doInteract(state); break;
    default: spent = false;
  }
  if (spent) endPlayerTurn(state);
  return state;
}

function doMove(state, dx, dy) {
  const p = state.player;
  if (dx || dy) p.facing = { x: Math.sign(dx), y: Math.sign(dy) };
  const nx = p.x + dx, ny = p.y + dy;
  const e = enemyAt(state, nx, ny);
  if (e) { hitEnemy(state, e, p.blade); return; } // bump = attack
  if (solidFor(state.map, nx, ny) || !walkFree(state, nx, ny)) { popup(state, 'THE SHELL SAYS NO', 'dim'); return; }
  p.x = nx; p.y = ny;
}
const walkFree = (state, x, y) => {
  const m = state.map;
  return inB(m, x, y) && WALK[m.tiles[y * m.w + x]] && !(m.closed && m.closed.has(y * m.w + x));
};
const hasEnemyAt = (state, x, y) => !!enemyAt(state, x, y);
function enemyAt(state, x, y) { return state.enemies.find(e => e.hp > 0 && e.x === x && e.y === y) || null; }

function doAttack(state) {
  const p = state.player;
  let hit = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const e = enemyAt(state, p.x + dx, p.y + dy);
    if (e) { hitEnemy(state, e, p.blade); hit++; }
  }
  if (!hit) popup(state, 'BLADE MEETS AIR', 'dim');
}

function hitEnemy(state, e, dmg) {
  e.hp -= dmg;
  pushEv(state, { t: 'hitfx', x: e.x, y: e.y, n: dmg });
  if (e.hp <= 0) {
    state.kills++; state.stats.kills++;
    if (e.type !== 'reaver' || e.loot === 0 || true) state.corpses.push({ x: e.x, y: e.y, ttl: 12, zone: state.zone });
    popup(state, `${e.type.toUpperCase()} SLAIN`, 'good');
    glog(state, `The ${e.type} folds in on itself.`);
  } else if (e.type === 'mite') { e.state = 'flee'; e.fleeT = 3; shake(state, 1.5); }
}

function doHarvest(state, fx, fy) {
  const p = state.player, m = state.map;
  const ci = state.corpses.findIndex(c => c.zone === state.zone && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1);
  if (ci !== -1) {
    const c = state.corpses.splice(ci, 1)[0];
    p.salvage += 3;
    popup(state, '+3 BONE', 'good'); pushEv(state, { t: 'float', x: c.x, y: c.y, text: '+3' });
    return;
  }
  const spots = fx != null ? [[fx, fy]] : [[p.x + p.facing.x, p.y + p.facing.y], [p.x, p.y], [p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]];
  for (const [x, y] of spots) {
    if (!inB(m, x, y)) continue;
    const i = y * m.w + x, t = m.tiles[i];
    if (!HARVEST[t]) continue;
    const mood = moodOf(state);
    let gain = 0, cost = 0, msg = '';
    const floorT = state.zone === 'shell' ? T.ROCK : T.FLOOR;
    if (t === T.ORE) { gain = 6 + ri(state.rng, 0, 4); cost = 2; msg = 'marrow-glass'; m.tiles[i] = floorT; }
    else if (t === T.FLESH) {
      const isHeart = state.zone === 'heart' && m.heartCore && x === m.heartCore.x && y === m.heartCore.y;
      gain = isHeart ? 22 : 4 + ri(state.rng, 0, 3);
      cost = isHeart ? 25 : 5;
      msg = isHeart ? 'HEART MEAT — she FEELS that' : 'flesh';
      if (isHeart) {
        m.heartUses = (m.heartUses ?? 2) - 1;
        if (m.heartUses <= 0) { m.tiles[i] = T.FLOOR; cost += 15; msg = 'THE CORE COMES OUT — RUN'; shake(state, 14); }
      } else m.tiles[i] = floorT;
    } else if (t === T.POOL) { p.items.flask++; cost = 1; gain = 0; msg = 'Marrow Flask drawn'; m.tiles[i] = floorT; }
    if (mood === 'CALM' && msg !== 'Marrow Flask drawn') gain = Math.round(gain * 1.3);
    if (state.charmSet.has('reaperfocus')) gain += 4;
    p.salvage += gain;
    state.creature.hp = Math.max(0, state.creature.hp - (mood === 'WRATHFUL' ? cost * 2 : cost));
    state.harvests++; state.stats.harvests++;
    popup(state, `+${gain}${gain ? ' SALVAGE' : ''} · ${msg}`, 'good');
    pushEv(state, { t: 'float', x, y, text: gain ? `+${gain}` : '+' });
    glog(state, mood === 'CALM' ? 'She gives even as you take. The cut weeps gold.' : 'You carve your pay off her body.');
    checkMood(state);
    return;
  }
  popup(state, 'NOTHING TO HARVEST HERE', 'dim');
}

function doFeed(state) {
  const p = state.player;
  if (p.salvage < 12) { popup(state, 'OFFERING NEEDS 12 SALVAGE', 'warn'); state.lastFeedOk = false; return; }
  state.lastFeedOk = true;
  p.salvage -= 12;
  state.creature.hp = Math.min(100, state.creature.hp + 22);
  state.diveIn += 3; // net +2 after this turn's cost
  popup(state, 'SHE ACCEPTS — +2 TURNS', 'sys');
  glog(state, 'You give flesh back to the Vastmother. Somewhere, a seam relaxes.');
  checkMood(state);
}

function doUse(state, item) {
  const p = state.player;
  if (item === 'flask') {
    if (!p.items.flask) { popup(state, 'NO FLASK', 'warn'); return; }
    const heal = Math.min(18 + (state.charmSet.has('brewer') ? 6 : 0), p.maxHp - p.hp);
    p.items.flask--; p.hp += heal;
    pushEv(state, { t: 'heal', x: p.x, y: p.y, n: heal });
    popup(state, `+${heal} HP`, 'good');
    return;
  }
  if (item === 'bomb') {
    if (!p.items.bomb) { popup(state, 'NO SALT BOMB', 'warn'); return; }
    p.items.bomb--;
    const fx = p.facing.x, fy = p.facing.y;
    let tx = p.x, ty = p.y;
    for (let i = 1; i <= 5; i++) {
      const nx = p.x + fx * i, ny = p.y + fy * i;
      if (!walkFree(state, nx, ny)) break;
      tx = nx; ty = ny;
      if (hasEnemyAt(state, nx, ny)) break;
    }
    pushEv(state, { t: 'blast', x: tx, y: ty });
    shake(state, 5);
    for (const e of state.enemies) if (e.hp > 0 && Math.abs(e.x - tx) <= 1 && Math.abs(e.y - ty) <= 1) hitEnemy(state, e, 12);
    state.creature.hp = Math.max(0, state.creature.hp - 4); // salt stings her too
    popup(state, 'SALT — it burns them both', 'warn');
    checkMood(state);
    return;
  }
}

/* context interact returns whether it spent the turn */
function doInteract(state) {
  const p = state.player, m = state.map;
  const t = tileAt(m, p.x, p.y);
  if (t === T.EXTRACT) { doExtract(state); return false; }
  if (t === T.VENT) {
    if (state.zone === 'shell') {
      if (p.pendingZone) { const z = p.pendingZone; p.pendingZone = null; doDive(state, z); return true; }
      pushEv(state, { t: 'askzone' }); // UI opens the organ chooser
      return false;            // choosing is free; diving costs the turn
    }
    doEmerge(state); return true;
  }
  doHarvest(state);
  return true;
}

function switchZone(state, zone) {
  state.zoneData[state.zone].map = state.map;
  state.zoneData[state.zone].enemies = state.enemies;
  state.zone = zone;
  state.map = state.zoneData[zone].map;
  state.enemies = state.zoneData[zone].enemies;
}
function doDive(state, zone) {
  if (state.zone !== 'shell') { popup(state, 'EMERGE FIRST', 'warn'); return; }
  ensureOrgans(state);
  if (!state.zoneData[zone]) zone = 'heart';
  const m = state.map;
  if (tileAt(m, state.player.x, state.player.y) !== T.VENT) { popup(state, 'STAND IN A VENT', 'warn'); return; }
  state.ventReturn[zone] = { x: state.player.x, y: state.player.y };
  switchZone(state, zone);
  const om = state.map;
  state.player.x = om.exit.x; state.player.y = om.exit.y;
  state.stats.deepest = zone;
  state.stats.depthScore = Math.max(state.stats.depthScore, zone === 'shell' ? 0 : 1);
  pushEv(state, { t: 'slide', kind: 'dive' });
  shake(state, 3);
  popup(state, `INSIDE THE ${zone.toUpperCase()}`, 'sys');
  glog(state, 'The vent swallows you whole. Somewhere below, something notices.');
}
function doEmerge(state) {
  if (state.zone === 'shell') return;
  const back = state.ventReturn[state.zone];
  const from = state.zone;
  switchZone(state, 'shell');
  const m = state.map;
  const v = back && walkFree(state, back.x, back.y) ? back : (m.vents[0] || m.spawn);
  state.player.x = v.x; state.player.y = v.y;
  delete state.ventReturn[from];
  pushEv(state, { t: 'slide', kind: 'emerge' });
  popup(state, 'BACK ON THE SHELL', 'sys');
}
function doExtract(state) {
  state.stats.salvaged = state.player.salvage;
  state.over = { type: 'extracted', stats: { ...state.stats }, haul: state.player.salvage };
  pushEv(state, { t: 'extract' });
  glog(state, `You ride the upwelling out with ${state.player.salvage} salvage. She does not follow. Today.`);
}

/* ------------------------------------------------------- turn machinery -- */
function endPlayerTurn(state) {
  state.turn++; state.stats.turns = state.turn;
  enemyTurn(state);
  if (state.over) return;
  creatureTick(state);
  checkMood(state);
  state.diveIn--;
  if (state.diveIn === 5 && !state.creature.warned5) { state.creature.warned5 = true; popup(state, '⚠ DIMENSION SHIFT IN 5', 'bad'); shake(state, 4); }
  if (state.diveIn <= 0) { theDive(state); return; }
  if (!state.over && moodOf(state) === 'WRATHFUL' && tileAt(state.map, state.player.x, state.player.y) === T.FLESH) {
    hurtPlayer(state, WRATH_FLESH_DMG, 'the flesh bites back');
  }
  // sync back zone arrays (enemyTurn may have filtered)
  state.zoneData[state.zone].enemies = state.enemies;
}

function enemyTurn(state) {
  const p = state.player, mood = moodOf(state);
  const wrath = mood === 'WRATHFUL';
  const alive = [];
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    alive.push(e);
    const dist = Math.abs(p.x - e.x) + Math.abs(p.y - e.y);
    if (e.type === 'mite') miteTurn(state, e, dist, wrath);
    else if (e.type === 'spitter') spitterTurn(state, e, dist, wrath);
    else if (e.type === 'reaver') reaverTurn(state, e, dist, wrath);
    if (state.over) break;
  }
  state.enemies = alive.filter(e => e.hp > 0); // escaped/killed culled
}
function stepToward(state, e, tx, ty) {
  const dx = Math.sign(tx - e.x), dy = Math.sign(ty - e.y);
  const cand = [[dx, 0], [0, dy], [dx, dy]].filter(([a, b]) => a || b);
  for (const [a, b] of cand) {
    const nx = e.x + a, ny = e.y + b;
    if (!walkFree(state, nx, ny) || hasEnemyAt(state, nx, ny)) continue;
    if (nx === state.player.x && ny === state.player.y) return false;
    e.x = nx; e.y = ny; return true;
  }
  return false;
}
function miteTurn(state, e, dist, wrath) {
  if (dist <= 1) { attackPlayer(state, e, e.dmg + (wrath ? 2 : 0)); return; }
  if (e.fleeT > 0) { e.fleeT--; stepToward(state, e, e.x * 2 - state.player.x, e.y * 2 - state.player.y); return; }
  stepToward(state, e, state.player.x, state.player.y);
}
function spitterTurn(state, e, dist, wrath) {
  if (dist <= 1) { stepToward(state, e, e.x * 2 - state.player.x, e.y * 2 - state.player.y); return; }
  if (dist >= 2 && dist <= 4 && hasLOS(state, e.x, e.y, state.player.x, state.player.y)) {
    pushEv(state, { t: 'tracer', x0: e.x, y0: e.y, x1: state.player.x, y1: state.player.y });
    if (state.rng() < 0.8) attackPlayer(state, e, e.dmg + (wrath ? 2 : 0), 'spit');
    else popup(state, 'SPIT SPLASHES PAST', 'dim');
  } else stepToward(state, e, state.player.x, state.player.y);
}
function reaverTurn(state, e, dist, wrath) {
  const p = state.player;
  if (e.hp <= Math.ceil(e.maxHp / 3) && e.state !== 'flee') e.state = 'flee';
  if (e.state === 'flee') {
    const v = nearestTile(state, e, T.VENT);
    if (v && Math.abs(v.x - e.x) + Math.abs(v.y - e.y) <= 1) {
      e.hp = 0;
      popup(state, `REAVER ESCAPED WITH ${e.loot} BONE`, 'warn');
      glog(state, 'The thief slips down a vent. Your salvage, gone with him.');
      return;
    }
    if (v) stepToward(state, e, v.x, v.y);
    return;
  }
  if (dist >= 3) {
    const loot = nearestHarvestable(state, e, 4);
    if (loot) {
      stepToward(state, e, loot.x, loot.y);
      if (loot.x === e.x && loot.y === e.y) grabLoot(state, e, loot);
      return;
    }
  }
  if (dist <= 1) {
    attackPlayer(state, e, e.dmg + (wrath ? 3 : 0));
    if (!state.over && state.rng() < 0.5 && p.salvage > 0) {
      const ste = Math.min(5, p.salvage); p.salvage -= ste; e.loot += ste;
      popup(state, `-${ste} STOLEN`, 'bad');
    }
    return;
  }
  stepToward(state, e, p.x, p.y);
}
function grabLoot(state, e, { x, y }) {
  const i = y * state.map.w + x;
  if (!HARVEST[state.map.tiles[i]]) return;
  e.loot += 6;
  state.map.tiles[i] = state.zone === 'shell' ? T.ROCK : T.FLOOR;
  popup(state, 'A REAVER STRIPS A NODULE', 'warn');
}
function nearestHarvestable(state, e, maxD) {
  const m = state.map; let best = null, bd = 1e9;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (!HARVEST[m.tiles[y * m.w + x]]) continue;
    if (state.enemies.some(o => o.hp > 0 && o.x === x && o.y === y)) continue;
    const d = Math.abs(x - e.x) + Math.abs(y - e.y);
    if (d <= maxD && d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function nearestTile(state, e, type) {
  const m = state.map; let best = null, bd = 1e9;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.tiles[y * m.w + x] !== type) continue;
    const d = Math.abs(x - e.x) + Math.abs(y - e.y);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
function hasLOS(state, x0, y0, x1, y1) {
  const m = state.map;
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  while (x !== x1 || y !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (!inB(m, x, y) || !WALK[m.tiles[y * m.w + x]]) return false;
  }
  return true;
}
function attackPlayer(state, e, dmg, how = 'melee') {
  const p = state.player;
  if (p.brace > 0) {
    p.brace = 0;
    pushEv(state, { t: 'dodge', x: p.x, y: p.y });
    const back = 6 + (state.charmSet.has('thorns') ? 6 : 0);
    popup(state, 'SLIP — COUNTER!', 'good');
    hitEnemy(state, e, back);
    return;
  }
  hurtPlayer(state, dmg, `${how === 'spit' ? 'spit from the ' : ''}${e.type}`);
}
function hurtPlayer(state, dmg, why) {
  const p = state.player;
  p.hp -= dmg;
  shake(state, 7 + dmg * 0.4);
  pushEv(state, { t: 'hurt', n: dmg });
  popup(state, `-${dmg} · ${why}`, 'bad');
  if (p.hp <= 0 && !state.over) playerDies(state);
}
function playerDies(state) {
  state.player.alive = false;
  state.player.hp = 0;
  state.over = { type: 'died', stats: { ...state.stats }, haul: 0 };
  pushEv(state, { t: 'slide', kind: 'death' });
  glog(state, 'The Vastmother keeps what she takes.');
}

/* ---------------------------------------------------------- the dive ---- */
function theDive(state) {
  state.divesSeen++; state.stats.dives++;
  if (state.zone !== 'shell') {
    hurtPlayer(state, 15, 'the flush');
    if (state.over) return;
    const drop = Math.floor(state.player.salvage / 2);
    state.player.salvage -= drop;
    const m = state.map;
    if (drop > 0) {
      for (let t = 0; t < 30; t++) {
        const x = ri(state.rng, 1, m.w - 2), y = ri(state.rng, 1, m.h - 2);
        const i = y * m.w + x;
        if ((m.tiles[i] === T.FLOOR || m.tiles[i] === T.ROCK) && !(x === state.player.x && y === state.player.y)) {
          m.tiles[i] = T.ORE; glog(state, `${drop} salvage spills into the dark — harvest the glint later, if you dare.`);
          break;
        }
      }
    }
    doEmerge(state);
    state.diveIn = FLUSH_GRACE + (state.charmSet.has('tidegift') ? 3 : 0);
    popup(state, 'SPAT ONTO THE SHELL', 'warn');
    shake(state, 12);
    pushEv(state, { t: 'slide', kind: 'flush' });
    state.zoneData[state.zone].enemies = state.enemies;
    return;
  }
  state.over = { type: 'dived', stats: { ...state.stats }, haul: 0 };
  glog(state, 'The dimension folds. The shell is simply… elsewhere. So are you.');
  pushEv(state, { t: 'slide', kind: 'gale' });
  shake(state, 16);
}

/* --------------------------------------------------- creature reactions -- */
function creatureTick(state) {
  const mood = moodOf(state);
  state.creature.mood = mood;
  const m = state.map;
  if (mood === 'WRATHFUL') {
    if (state.turn % 2 === 0) {
      const p = state.player;
      const ring = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1]];
      for (const [dx, dy] of ring) {
        const x = p.x + dx, y = p.y + dy;
        if (!inB(m, x, y)) continue;
        const i = y * m.w + x, t = m.tiles[i];
        if ((t === T.ROCK || t === T.FLOOR || t === T.FLESH) && state.rng() < 0.5) {
          m.closed.add(i);
          pushEv(state, { t: 'wallclose', x, y });
        }
      }
      m.pulse.push(state.turn + 5);
    }
    while (m.pulse.length && m.pulse[0] <= state.turn) {
      m.pulse.shift();
      if (m.closed.size) { for (const i of [...m.closed]) m.closed.delete(i); popup(state, 'THE WALLS RELAX — MOVE', 'sys'); }
    }
    if (state.turn % 3 === 0) state.creature.spawnBudget++;
  } else {
    if (m.pulse.length === 0 && m.closed.size) for (const i of [...m.closed]) m.closed.delete(i);
    state.creature.spawnBudget = 0;
  }
  if (state.creature.spawnBudget > 0 && state.enemies.length < 9) {
    state.creature.spawnBudget--;
    const far = farthestWalkable(state);
    if (far) {
      state.enemies.push(makeEnemy(state.rng() < 0.75 ? 'mite' : 'spitter', far.x, far.y));
      pushEv(state, { t: 'spawn', x: far.x, y: far.y });
      glog(state, 'Something hatches in the dark.');
    }
  }
  state.corpses = state.corpses.filter(c => {
    if (c.zone !== state.zone) return true;
    c.ttl--; return c.ttl > 0;
  });
  // Calm seams: shortcut vents appear toward more organs? keep simple: calm slowly heals her
  if (mood === 'CALM' && state.turn % 6 === 0) state.creature.hp = Math.min(100, state.creature.hp + 1);
}
function farthestWalkable(state) {
  const { dist, w } = bfs(state.map, state.player.x, state.player.y);
  let best = null, bd = -1;
  for (let i = 0; i < dist.length; i++) if (dist[i] > bd) { bd = dist[i]; best = { x: i % w, y: (i / w) | 0 }; }
  return bd >= 4 ? best : null;
}
function checkMood(state) {
  const mood = moodOf(state);
  if (mood !== state.creature.mood) {
    state.creature.mood = mood;
    pushEv(state, { t: 'mood', mood });
    if (mood === 'WRATHFUL') { glog(state, '[ SHE KNOWS WHERE YOU STAND ]'); popup(state, 'WRATHFUL — the shell becomes teeth', 'bad'); shake(state, 10); }
    else if (mood === 'CALM') { glog(state, 'The veins glow gold. New seams open for you.'); popup(state, 'CALM — richer harvest, softer wounds', 'good'); }
    else { glog(state, 'A low groan rolls through the bone. She is watching.'); popup(state, 'AGITATED', 'warn'); }
  }
}

/* ------------------------------------------------------ vent/zone query -- */
export function zonesFromVent(state) { // which organs are reachable from current vent (all; calm = "no struggle")
  return ['heart', 'lung', 'gut'].map(z => ({ zone: z, danger: { heart: 'HIGH', lung: 'MED', gut: 'MED' }[z], loot: { heart: 'MEAT+RICH', lung: 'FLASKS', gut: 'FLESH+CROWDED' }[z], mood: moodOf(state) }));
}
export function pendingZone(state, z) { state.player.pendingZone = z; }
export function diveReady(state) { return state.zone === 'shell' && tileAt(state.map, state.player.x, state.player.y) === T.VENT; }
export function extractReady(state) { return tileAt(state.map, state.player.x, state.player.y) === T.EXTRACT; }
export function harvestReady(state) {
  const p = state.player, m = state.map;
  if (state.corpses.some(c => c.zone === state.zone && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1)) return true;
  for (const [dx, dy] of [[p.facing.x, p.facing.y], [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
    if (inB(m, p.x + dx, p.y + dy) && HARVEST[tileAt(m, p.x + dx, p.y + dy)]) return true;
  return false;
}
