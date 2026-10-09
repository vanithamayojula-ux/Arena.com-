// Nova Circuit race simulation (no rendering, no DOM, deterministic given a seed).
//
// Everything lives in "track space": a ship is (dist, x, h) - distance travelled
// along the circuit, lateral offset from the centre line, and hover height above
// the surface. That keeps loops, corkscrews and wall collisions trivial and makes
// the sim cheap enough to run on a phone, in node tests, and for net ghosts.

import { clamp, lerp, rng } from './vec.js';

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------
export const C = {
  H0: 2.4, // hover height
  HMAX: 95,
  GRAVITY: 50,
  VGRIP: 0.6, // how strongly track curvature lifts / presses the ship
  LGRIP: 0.38, // lateral drift in corners
  BASE: 245,
  BOOST: 410,
  PAD: 470,
  ACCEL: 120,
  BOOST_ACCEL: 330,
  DRAG: 70,
  BRAKE: 340,
  MAX_LAT: 82,
  LAT_RESP: 6.5,
  BOOST_DRAIN: 30,
  ENERGY_REGEN: 5,
  LASER_CD: 0.1,
  LASER_DMG: 4.5,
  LASER_SPEED: 560,
  MISSILE_DMG: 40,
  MINE_DMG: 30,
  LOCK_TIME: 0.75,
  LOCK_RANGE: 560,
  COUNTDOWN: 3.0,
  RESPAWN: 2.2,
  PAD_RESPAWN: 8,
};

export const SHIPS = [
  { id: 'viper', name: 'VIPER-X', role: 'ALL-ROUNDER', speed: 1.0, handling: 1.0, armor: 1.0, boost: 1.0, blurb: 'Balanced and forgiving. A pilot’s first love.' },
  { id: 'razor', name: 'RAZOR', role: 'INTERCEPTOR', speed: 1.07, handling: 0.9, armor: 0.78, boost: 1.12, blurb: 'Blistering top speed, glass hull. Don’t get hit.' },
  { id: 'bulwark', name: 'BULWARK', role: 'HEAVY GUNSHIP', speed: 0.95, handling: 0.88, armor: 1.55, boost: 0.95, blurb: 'Armoured brute. Shrugs off missiles and rams rivals aside.' },
  { id: 'wraith', name: 'WRAITH', role: 'DRIFT SPECIALIST', speed: 0.97, handling: 1.22, armor: 0.9, boost: 1.05, blurb: 'Razor-sharp handling. Threads the tightest lines.' },
];

export const LIVERIES = [
  { name: 'ION BLUE', a: '#27c8ff', b: '#0b3a66', glow: '#7be9ff' },
  { name: 'SOLAR ORANGE', a: '#ff8a1c', b: '#5a1f05', glow: '#ffc36b' },
  { name: 'NOVA PINK', a: '#ff4fd0', b: '#4a0f55', glow: '#ffa6ec' },
  { name: 'TOXIC LIME', a: '#9bff3a', b: '#1f4a08', glow: '#d6ff8a' },
  { name: 'CRIMSON', a: '#ff3b4e', b: '#4d0a14', glow: '#ff9aa4' },
  { name: 'VOID WHITE', a: '#e8f2ff', b: '#3b4a66', glow: '#ffffff' },
  { name: 'GOLD', a: '#ffd23a', b: '#5a4205', glow: '#fff0a0' },
  { name: 'VIOLET', a: '#9a6bff', b: '#241055', glow: '#cdb6ff' },
];

export const ROSTER = [
  { name: 'KESTREL', ship: 'razor', livery: 1 },
  { name: 'VANTA', ship: 'wraith', livery: 7 },
  { name: 'ORION', ship: 'viper', livery: 5 },
  { name: 'NYX', ship: 'wraith', livery: 2 },
  { name: 'BASALT', ship: 'bulwark', livery: 4 },
  { name: 'HALCYON', ship: 'viper', livery: 3 },
  { name: 'JINX', ship: 'razor', livery: 6 },
  { name: 'TALON', ship: 'bulwark', livery: 0 },
];

export const DIFFICULTIES = [
  { id: 'rookie', name: 'ROOKIE', skill: 0.22, rubber: 0.07 },
  { id: 'pro', name: 'PRO', skill: 0.5, rubber: 0.05 },
  { id: 'ace', name: 'ACE', skill: 0.78, rubber: 0.035 },
  { id: 'legend', name: 'LEGEND', skill: 1.0, rubber: 0.02 },
];

export const POINTS = [12, 9, 7, 5, 3, 2, 1, 0];

export const ITEMS = {
  emp: { name: 'EMP PULSE', icon: '◎', color: '#6ee7ff', held: true, uses: 1 },
  mines: { name: 'MINE LAYER', icon: '✺', color: '#ff7a3a', held: true, uses: 3 },
  overdrive: { name: 'OVERDRIVE', icon: '⚡', color: '#ffe14d', held: true, uses: 1 },
};

const wrapD = (d, L) => {
  d %= L;
  if (d > L / 2) d -= L;
  else if (d < -L / 2) d += L;
  return d;
};

// ---------------------------------------------------------------------------
export function makeInput() {
  return { steer: 0, climb: false, brake: false, boost: false, fire: false, missile: false, item: false, dodge: 0 };
}

export class Race {
  /**
   * @param {object} o
   * @param {object} o.track  built track (track.js)
   * @param {Array} o.racers  [{name, ship, livery, human, slot, skill, remote, owner, grid}]
   * @param {number} o.laps
   * @param {string} o.mode   'race' | 'attract' | 'trial'
   * @param {boolean} o.combat
   */
  constructor({ track, racers, laps = 3, seed = 1, mode = 'race', combat = true, difficulty = 1, instantStart = false }) {
    this.track = track;
    this.laps = laps;
    this.mode = mode;
    this.combat = combat && mode !== 'trial';
    this.difficulty = DIFFICULTIES[difficulty] || DIFFICULTIES[1];
    this.rng = rng(seed);
    this.time = 0; // seconds since GO
    this.clock = 0;
    this.state = 'countdown';
    this.countdown = instantStart ? 0.001 : C.COUNTDOWN;
    this.events = [];
    this.bullets = [];
    this.missiles = [];
    this.mines = [];
    this.nextId = 1;
    this.finishedAt = null;
    this.results = null;
    this.ships = racers.map((r, i) => this.makeShip(r, i));
    this.humans = this.ships.filter((s) => s.human);
    // pads (per-ship cooldown for item pads)
    this.pads = track.pads.map((p, i) => ({ ...p, id: i, cd: this.ships.map(() => 0) }));
    // authored mines
    for (const m of track.mines) this.addMine(m.s, m.x * (track.sample(m.s).w / 2 - 4), -1, true);
    this.order = this.ships.slice();
    this.updateRanks();
  }

  // ----- construction ------------------------------------------------------
  makeShip(spec, i) {
    const type = SHIPS.find((s) => s.id === spec.ship) || SHIPS[0];
    const grid = spec.grid ?? i;
    const row = Math.floor(grid / 2);
    const side = grid % 2 === 0 ? -1 : 1;
    const hw = this.track.sample(0).w / 2;
    const s = {
      id: spec.id || 's' + i,
      idx: i,
      name: spec.name,
      type,
      typeId: type.id,
      livery: spec.livery ?? i,
      human: !!spec.human,
      slot: spec.slot ?? -1,
      local: !spec.remote,
      owner: spec.owner || 'local',
      skill: spec.skill ?? 0.5,
      dist: -(16 + row * 15 + (side > 0 ? 6 : 0)),
      x: side * hw * 0.38,
      h: C.H0,
      vs: 0, vx: 0, vh: 0,
      hpMax: Math.round(100 * type.armor),
      hp: Math.round(100 * type.armor),
      energy: 40,
      ammo: 2,
      heat: 0,
      overheated: false,
      shield: 0,
      stun: 0,
      invuln: 0,
      alive: true,
      respawnT: 0,
      item: null,
      itemUses: 0,
      overdrive: 0,
      padBoost: 0,
      launchHold: 0,
      stall: 0,
      fireCD: 0,
      missileCD: 0,
      hopCD: 0,
      wallCD: 0,
      dodgeT: 0,
      dodgeDir: 0,
      dodgeCD: 0,
      lockTarget: null,
      lockTime: 0,
      lockGrace: 0,
      locked: false,
      incoming: 0,
      draft: 0,
      boosting: false,
      grounded: true,
      lap: 0,
      lapIndex: -1,
      lapStart: 0,
      lapTimes: [],
      bestLap: Infinity,
      finished: false,
      finishTime: Infinity,
      place: 1,
      kills: 0,
      deaths: 0,
      score: 0,
      hitFlash: 0,
      bank: 0, pitchVis: 0, yawVis: 0, spin: 0,
      speedFrac: 0,
      input: makeInput(),
      ai: !spec.human,
      autopilot: false,
      aiState: { off: (this.rng() * 2 - 1) * 0.3, offT: 0, line: 0, wantBoost: false, react: 0, fireHold: 0 },
      net: null,
      lastHitBy: null,
      colorIdx: spec.livery ?? i,
    };
    return s;
  }

  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }

  addMine(dist, x, owner, authored = false) {
    const m = { id: this.nextId++, dist, x, h: C.H0 + 1.2, owner, arm: authored ? 0 : 1.0, life: authored ? 1e9 : 40, hp: 6 };
    this.mines.push(m);
    return m;
  }

  // ----- main step ---------------------------------------------------------
  step(dt) {
    this.clock += dt;
    if (this.state === 'countdown') {
      this.countdown -= dt;
      for (const s of this.ships) {
        if (!s.local) continue;
        s.input.boost ? (s.launchHold += dt) : (s.launchHold = 0);
        if (s.ai && this.rng() < 0.01 && s.launchHold === 0 && this.countdown < 0.5 + (1 - s.skill) * 0.2) s.launchHold = 0.2;
        if (s.ai && s.launchHold > 0) s.launchHold += dt;
        // clear edge flags pressed during countdown
        s.input.missile = false; s.input.item = false; s.input.dodge = 0;
      }
      if (this.countdown <= 0) this.go();
      this.updateVisuals(dt);
      return;
    }
    this.time += dt;
    if (this.mode !== 'attract' && this.state === 'racing') this.checkEnd();

    for (const s of this.ships) {
      if (!s.local) continue;
      if (s.ai || s.autopilot) this.think(s, dt);
    }
    for (const s of this.ships) {
      if (s.local) this.stepShip(s, dt);
      else this.stepGhost(s, dt);
    }
    if (this.combat) {
      for (const s of this.ships) if (s.local && s.alive) this.stepWeapons(s, dt);
      this.stepProjectiles(dt);
    }
    this.stepMines(dt);
    this.collide(dt);
    this.stepPads(dt);
    this.updateRanks();
    this.updateVisuals(dt);
  }

  go() {
    this.state = 'racing';
    this.countdown = 0;
    this.time = 0;
    for (const s of this.ships) {
      if (!s.local) continue;
      if (s.launchHold > 0 && s.launchHold <= 0.75) {
        s.padBoost = 1.8;
        s.vs = 120;
        s.energy = Math.min(100, s.energy + 25);
        this.emit({ type: 'launch', ship: s, perfect: true });
      } else if (s.launchHold > 1.4) {
        s.stall = 0.9;
        this.emit({ type: 'launch', ship: s, perfect: false });
      }
      s.lapStart = 0;
    }
    this.emit({ type: 'go' });
  }

  // ----- single ship -------------------------------------------------------
  stepShip(s, dt) {
    const tr = this.track;
    const inp = s.input;
    if (!s.alive) {
      s.respawnT -= dt;
      if (s.respawnT <= 0 && !s.finished) this.respawn(s);
      return;
    }
    // timers
    for (const k of ['stun', 'invuln', 'shield', 'overdrive', 'padBoost', 'stall', 'hopCD', 'wallCD', 'dodgeCD', 'hitFlash', 'fireCD', 'missileCD']) {
      if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
    }
    s.incoming = Math.max(0, s.incoming - dt);
    const f = tr.sample(s.dist);
    const hw = f.w / 2;
    const T = s.type;
    const stunned = s.stun > 0;

    // --- dodge (barrel roll) ---
    if (inp.dodge && s.dodgeCD <= 0 && !stunned) {
      s.dodgeT = 0.34;
      s.dodgeDir = inp.dodge > 0 ? 1 : -1;
      s.dodgeCD = 1.5;
      this.emit({ type: 'dodge', ship: s });
    }
    inp.dodge = 0;
    if (s.dodgeT > 0) s.dodgeT -= dt;

    // --- throttle / boost ---
    const wantBoost = inp.boost && !stunned && s.stall <= 0;
    const free = s.overdrive > 0 || s.padBoost > 0;
    const paid = wantBoost && s.energy > 1;
    s.boosting = (free || paid) && s.alive;
    if (paid && !free) s.energy = Math.max(0, s.energy - C.BOOST_DRAIN * dt);
    else if (!wantBoost && s.energy < 100) s.energy = Math.min(100, s.energy + C.ENERGY_REGEN * dt);

    let target = C.BASE * T.speed;
    if (s.boosting) target = C.BOOST * T.speed * (T.boost * 0.4 + 0.6);
    if (s.padBoost > 0) target = Math.max(target, C.PAD * (0.9 + 0.1 * T.boost));
    if (inp.brake && !s.boosting) target = Math.min(target, 120);
    if (stunned) target *= 0.5;
    if (s.stall > 0) target = 0;
    target *= 1 + s.draft * 0.045;
    if (s.rubber) target *= s.rubber;
    let a;
    if (s.vs < target) a = s.boosting ? C.BOOST_ACCEL : C.ACCEL * (s.vs < 60 ? 1.6 : 1);
    else a = inp.brake ? C.BRAKE : C.DRAG;
    s.vs += clamp(target - s.vs, -a * dt, a * dt);
    if (s.vs < 0) s.vs = 0;

    // --- lateral ---
    const maxLat = C.MAX_LAT * T.handling * (inp.brake ? 1.35 : 1) * (stunned ? 0.4 : 1);
    if (s.dodgeT > 0) {
      s.vx = s.dodgeDir * 175;
    } else {
      const desired = clamp(inp.steer, -1, 1) * maxLat;
      s.vx += (desired - s.vx) * Math.min(1, dt * C.LAT_RESP);
      s.vx += -f.kR * s.vs * s.vs * C.LGRIP * dt;
    }
    s.x += s.vx * dt;
    const lim = hw - 2.8;
    if (s.x > lim || s.x < -lim) {
      const sgn = Math.sign(s.x);
      s.x = sgn * lim;
      if (s.vx * sgn > 18 && s.wallCD <= 0) {
        s.wallCD = 0.3;
        s.vs *= 0.9;
        this.emit({ type: 'wall', ship: s, side: sgn, speed: Math.abs(s.vx) });
        this.damage(s, 0, null, 'wall');
      }
      if (s.vx * sgn > 0) s.vx = -s.vx * 0.35;
    }

    // --- vertical ---
    s.grounded = s.h <= C.H0 + 0.02;
    if (f.glue) {
      s.h = C.H0;
      s.vh = 0;
      s.grounded = true;
    } else {
      let ah = -f.kU * s.vs * s.vs * C.VGRIP - C.GRAVITY;
      if (!s.grounded) {
        if (inp.climb) ah += 62;
        if (inp.brake) ah -= 110;
      } else if (inp.climb && s.hopCD <= 0 && !stunned) {
        s.vh = 40;
        s.hopCD = 0.4;
        s.grounded = false;
      }
      if (s.grounded && ah < 0 && s.vh <= 0) s.vh = 0;
      else s.vh += ah * dt;
      s.h += s.vh * dt;
      if (s.h < C.H0) {
        if (s.vh < -28) this.emit({ type: 'land', ship: s, impact: -s.vh });
        s.h = C.H0;
        if (s.vh < 0) s.vh = 0;
      }
      if (s.h > C.HMAX) { s.h = C.HMAX; if (s.vh > 0) s.vh = 0; }
    }

    s.dist += s.vs * dt;

    // --- laps ---
    const li = Math.floor(s.dist / tr.length);
    if (li !== s.lapIndex) {
      if (s.lapIndex >= 0 && li > s.lapIndex) this.onLapComplete(s, li);
      s.lapIndex = li;
      s.lap = Math.max(1, li + 1);
    }
  }

  onLapComplete(s, li) {
    const t = this.time - s.lapStart;
    s.lapStart = this.time;
    s.lapTimes.push(t);
    if (t < s.bestLap) s.bestLap = t;
    if (li >= this.laps && !s.finished) {
      s.finished = true;
      s.finishTime = this.time - (s.dist - li * this.track.length) / Math.max(s.vs, 1);
      s.autopilot = true;
      this.emit({ type: 'finish', ship: s });
    } else if (!s.finished) {
      this.emit({ type: 'lap', ship: s, lap: li + 1, time: t, best: t <= s.bestLap });
    }
    s.lap = Math.min(li + 1, this.laps);
  }

  respawn(s) {
    s.alive = true;
    s.hp = s.hpMax;
    s.x = 0;
    s.h = C.H0 + 4;
    s.vh = 0; s.vx = 0;
    s.vs = 110;
    s.invuln = 2.6;
    s.shield = 0; s.stun = 0;
    s.heat = 0; s.overheated = false;
    s.energy = Math.max(s.energy, 25);
    s.ammo = Math.max(s.ammo, 1);
    s.lockTarget = null; s.locked = false;
    this.emit({ type: 'respawn', ship: s });
  }

  stepGhost(s, dt) {
    const n = s.net;
    if (!n) return;
    const age = Math.min(0.25, this.clock - n.at);
    const tDist = n.dist + n.vs * age;
    s.dist += s.vs * dt;
    s.dist += (tDist - s.dist) * Math.min(1, dt * 9);
    s.x += (n.x + n.vx * age - s.x) * Math.min(1, dt * 12);
    s.h += (n.h - s.h) * Math.min(1, dt * 12);
    s.vs += (n.vs - s.vs) * Math.min(1, dt * 10);
    s.vx = n.vx; s.vh = n.vh;
    s.boosting = !!n.boost;
    s.shield = n.shield ? 1 : 0;
    s.invuln = n.invuln ? 1 : 0;
    s.dodgeT = n.dodge ? 0.2 : 0;
    s.hp = n.hp;
    s.hpMax = n.hpMax || s.hpMax;
    if (s.alive && !n.alive) this.emit({ type: 'explode', ship: s });
    s.alive = !!n.alive;
    s.finished = !!n.finished;
    if (n.finished) s.finishTime = n.finishTime;
    s.lap = n.lap;
    s.kills = n.kills ?? s.kills;
    s.stun = n.stun ? 1 : 0;
    s.grounded = s.h <= C.H0 + 0.3;
    for (const k of ['hitFlash']) if (s[k] > 0) s[k] = Math.max(0, s[k] - dt);
    const f = this.track.sample(s.dist);
    void f;
  }

  updateVisuals(dt) {
    for (const s of this.ships) {
      const T = s.type;
      const maxLat = C.MAX_LAT * T.handling;
      const targetBank = clamp(-s.vx / maxLat, -1, 1) * 0.55;
      s.bank += (targetBank - s.bank) * Math.min(1, dt * 8);
      if (s.dodgeT > 0) s.spin += (Math.PI * 2 / 0.34) * dt * -s.dodgeDir;
      else s.spin += (Math.round(s.spin / (Math.PI * 2)) * Math.PI * 2 - s.spin) * Math.min(1, dt * 10);
      s.pitchVis += (clamp(s.vh / 90, -0.5, 0.5) - s.pitchVis) * Math.min(1, dt * 6);
      s.yawVis += (clamp(s.vx / Math.max(s.vs, 80), -0.4, 0.4) - s.yawVis) * Math.min(1, dt * 8);
      s.speedFrac = s.vs / (C.BASE * 1.0);
    }
  }

  // ----- damage ------------------------------------------------------------
  /** Apply (or, for remote ships, request) damage. */
  hit(target, { dmg = 0, stun = 0, slow = 1, by = null, kind = 'laser' }) {
    if (!target.alive) return;
    if (!target.local) {
      this.emit({ type: 'netHit', target, dmg, stun, slow, by, kind });
      this.emit({ type: 'impact', ship: target, kind });
      return;
    }
    this.applyHit(target, { dmg, stun, slow, by, kind });
  }

  applyHit(target, { dmg = 0, stun = 0, slow = 1, by = null, kind = 'laser' }) {
    if (!target.alive || target.invuln > 0 || target.finished && kind !== 'wall') return;
    if (kind === 'missile' && target.dodgeT > 0) {
      this.emit({ type: 'evade', ship: target });
      return;
    }
    if (stun > 0) target.stun = Math.max(target.stun, stun);
    if (slow < 1) target.vs *= slow;
    if (dmg > 0) {
      if (target.shield > 0) dmg *= 0.2;
      target.hp -= dmg;
      target.hitFlash = 0.25;
      if (by) target.lastHitBy = by;
      this.emit({ type: 'damage', ship: target, dmg, kind, by });
      if (target.hp <= 0) this.kill(target, by || target.lastHitBy, kind);
    }
  }

  damage(s, amt, by, kind) { this.applyHit(s, { dmg: amt, by, kind }); }

  kill(s, by, kind) {
    s.alive = false;
    s.hp = 0;
    s.deaths++;
    s.respawnT = C.RESPAWN;
    s.boosting = false;
    s.lockTarget = null;
    if (by && by !== s) {
      by.kills++;
      by.energy = Math.min(100, by.energy + 25);
    }
    this.emit({ type: 'kill', victim: s, killer: by && by !== s ? by : null, kind });
    this.emit({ type: 'explode', ship: s });
  }

  /** Apply a hit that arrived over the network for a ship we own. */
  applyRemoteHit(shipId, data) {
    const t = this.ships.find((s) => s.id === shipId);
    if (!t || !t.local) return;
    const by = this.ships.find((s) => s.id === data.by) || null;
    this.applyHit(t, { dmg: data.dmg, stun: data.stun, slow: data.slow, by, kind: data.kind });
  }

  // ----- weapons -----------------------------------------------------------
  findAimTarget(s, range = 450, cone = 16, conePerU = 0.07) {
    let best = null;
    let bestD = Infinity;
    const L = this.track.length;
    for (const t of this.ships) {
      if (t === s || !t.alive || t.invuln > 0) continue;
      const ds = wrapD(t.dist - s.dist, L);
      if (ds < 8 || ds > range) continue;
      if (Math.abs(t.x - s.x) > cone + ds * conePerU) continue;
      if (Math.abs(t.h - s.h) > 30 + ds * 0.1) continue;
      if (ds < bestD) { bestD = ds; best = t; }
    }
    return best;
  }

  stepWeapons(s, dt) {
    const inp = s.input;
    // heat
    s.heat = Math.max(0, s.heat - (s.overheated ? 34 : 24) * dt);
    if (s.overheated && s.heat <= 30) { s.overheated = false; this.emit({ type: 'cooled', ship: s }); }
    const stunned = s.stun > 0;
    const od = s.overdrive > 0;

    // lasers
    if (inp.fire && s.fireCD <= 0 && !s.overheated && !stunned && this.state === 'racing' && !s.finished) {
      s.fireCD = od ? C.LASER_CD * 0.7 : C.LASER_CD;
      s.heat += od ? 2.2 : 4.2;
      if (s.heat >= 100) { s.overheated = true; this.emit({ type: 'overheat', ship: s }); }
      s.side = -(s.side || 1);
      const bvs = Math.max(s.vs, 60) + C.LASER_SPEED;
      const b = { id: this.nextId++, owner: s, ownerId: s.id, dist: s.dist + 4, x: s.x + s.side * 1.7, h: s.h + 0.1, vs: bvs, vx: 0, vh: 0, life: 1.05, dmg: C.LASER_DMG * (od ? 1.8 : 1), local: true };
      const t = this.findAimTarget(s);
      if (t) {
        const ds = wrapD(t.dist - b.dist, this.track.length);
        const tt = Math.max(0.05, ds / Math.max(bvs - t.vs, 100));
        b.vx = clamp((t.x + t.vx * tt - b.x) / tt, -130, 130) * 0.9;
        b.vh = clamp((t.h - b.h) / tt, -40, 40) * 0.9;
      }
      this.bullets.push(b);
      this.emit({ type: 'laser', bullet: b, ship: s });
    }

    // lock-on
    if (s.ammo > 0) {
      const cand = this.findAimTarget(s, C.LOCK_RANGE, 20, 0.2);
      if (cand && cand === s.lockTarget) {
        s.lockTime += dt;
        s.lockGrace = 0.35;
      } else if (cand) {
        if (s.lockGrace > 0 && s.lockTarget && s.lockTarget.alive) {
          s.lockGrace -= dt;
        } else {
          s.lockTarget = cand;
          s.lockTime = 0;
          s.lockGrace = 0.35;
        }
      } else {
        s.lockGrace -= dt;
        if (s.lockGrace <= 0) { s.lockTarget = null; s.lockTime = 0; }
      }
      const was = s.locked;
      s.locked = !!s.lockTarget && s.lockTime >= (s.human ? C.LOCK_TIME : C.LOCK_TIME + 0.5 * (1 - s.skill));
      if (s.locked && !was) this.emit({ type: 'locked', ship: s, target: s.lockTarget });
      if (s.lockTarget && s.lockTarget.alive && s.lockTime === dt) this.emit({ type: 'locking', ship: s, target: s.lockTarget });
    } else {
      s.lockTarget = null; s.locked = false; s.lockTime = 0;
    }
    if (s.lockTarget && !s.lockTarget.alive) { s.lockTarget = null; s.locked = false; s.lockTime = 0; }

    // missile
    if (inp.missile) {
      inp.missile = false;
      if (s.ammo > 0 && s.missileCD <= 0 && !stunned && this.state === 'racing' && !s.finished) {
        s.ammo--;
        s.missileCD = 0.55;
        const tgt = s.locked ? s.lockTarget : this.findAimTarget(s, 400, 14, 0.12);
        this.spawnMissile(s, tgt, true);
        this.emit({ type: 'missile', ship: s, target: tgt });
      }
    }
    // items
    if (inp.item) {
      inp.item = false;
      if (s.item && !stunned && this.state === 'racing') this.useItem(s);
    }
  }

  spawnMissile(s, target, local) {
    const m = {
      id: this.nextId++, owner: s, ownerId: s.id, target, dist: s.dist + 5, x: s.x, h: s.h + 0.2,
      vs: Math.max(s.vs, 80) + 120, vx: 0, vh: 0, life: 4.6, age: 0, local, evaded: false,
    };
    this.missiles.push(m);
    if (target) target.incoming = 0.6;
    return m;
  }

  /** Visual-only projectiles replicated from other players. */
  spawnRemoteBullet(d) {
    const owner = this.ships.find((s) => s.id === d.owner);
    this.bullets.push({ id: this.nextId++, owner, ownerId: d.owner, dist: d.dist, x: d.x, h: d.h, vs: d.vs, vx: d.vx, vh: d.vh, life: 1.0, dmg: 0, local: false });
  }
  spawnRemoteMissile(d) {
    const owner = this.ships.find((s) => s.id === d.owner);
    const target = this.ships.find((s) => s.id === d.target) || null;
    const m = this.spawnMissile(owner, target, false);
    m.dist = d.dist; m.x = d.x; m.h = d.h; m.vs = d.vs;
  }

  useItem(s) {
    const k = s.item;
    if (k === 'emp') {
      this.emit({ type: 'emp', ship: s });
      const L = this.track.length;
      for (const t of this.ships) {
        if (t === s || !t.alive) continue;
        if (Math.abs(wrapD(t.dist - s.dist, L)) < 180 && Math.abs(t.h - s.h) < 60) this.hit(t, { stun: 1.7, slow: 0.7, by: s, kind: 'emp' });
      }
      for (const m of this.missiles) {
        if (m.owner !== s && Math.abs(wrapD(m.dist - s.dist, L)) < 200) { m.life = 0; m.shot = true; }
      }
    } else if (k === 'mines') {
      this.addMine(s.dist - 9, s.x, s.id);
      this.emit({ type: 'mineDrop', ship: s, mine: this.mines[this.mines.length - 1] });
    } else if (k === 'overdrive') {
      s.overdrive = 6.5;
      this.emit({ type: 'overdrive', ship: s });
    }
    s.itemUses--;
    if (s.itemUses <= 0) { s.item = null; s.itemUses = 0; }
  }

  stepProjectiles(dt) {
    const L = this.track.length;
    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let dead = false;
      if (b.local) {
        for (const t of this.ships) {
          if (t === b.owner || !t.alive || t.invuln > 0) continue;
          const ds = wrapD(t.dist - b.dist, L);
          const closing = (b.vs - t.vs) * dt;
          if (ds > -3 && ds < closing + 3 && Math.abs(b.x - t.x) < 3.6 && Math.abs(b.h - t.h) < 3.4) {
            this.hit(t, { dmg: b.dmg, by: b.owner, kind: 'laser' });
            this.emit({ type: 'spark', ship: t, dist: b.dist, x: b.x, h: b.h });
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (let k = this.mines.length - 1; k >= 0; k--) {
            const m = this.mines[k];
            const ds = wrapD(m.dist - b.dist, L);
            if (ds > -3 && ds < b.vs * dt + 3 && Math.abs(b.x - m.x) < 3.4 && Math.abs(b.h - m.h) < 3.4) {
              this.explodeMine(m, k, b.owner);
              dead = true;
              break;
            }
          }
        }
      }
      b.dist += b.vs * dt;
      b.x += b.vx * dt;
      b.h += b.vh * dt;
      b.life -= dt;
      if (dead || b.life <= 0) this.bullets.splice(i, 1);
    }
    // missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.age += dt;
      m.life -= dt;
      const t = m.target && m.target.alive ? m.target : null;
      let remove = false;
      if (t) {
        const ds = wrapD(t.dist - m.dist, L);
        const lead = clamp(ds / 400, 0, 0.5);
        const wantVx = clamp((t.x + t.vx * lead - m.x) * 3.5, -190, 190);
        const wantVh = clamp((t.h + 0.4 - m.h) * 3, -90, 90);
        m.vx += clamp(wantVx - m.vx, -820 * dt, 820 * dt);
        m.vh += clamp(wantVh - m.vh, -500 * dt, 500 * dt);
        const wantVs = Math.max(t.vs + 200, 460);
        m.vs += clamp(wantVs - m.vs, -200 * dt, 520 * dt);
        const closing = (m.vs - t.vs) * dt;
        if (m.local && m.age > 0.2 && ds > -4 && ds < closing + 4 && Math.abs(m.x - t.x) < 4.4 && Math.abs(m.h - t.h) < 4.8) {
          if (t.dodgeT > 0) {
            if (!m.evaded) { m.evaded = true; this.emit({ type: 'evade', ship: t }); }
          } else {
            this.hit(t, { dmg: C.MISSILE_DMG, stun: 0.5, by: m.owner, kind: 'missile' });
            this.emit({ type: 'blast', dist: m.dist, x: m.x, h: m.h, big: true });
            remove = true;
          }
        }
        if (ds < -30) { m.target = null; }
      } else {
        m.vx *= 1 - Math.min(1, dt * 1.5);
        m.vh *= 1 - Math.min(1, dt * 1.5);
        m.vs += 120 * dt;
      }
      m.dist += m.vs * dt;
      m.x += m.vx * dt;
      m.h = Math.max(C.H0, m.h + m.vh * dt);
      if (!remove && (m.life <= 0)) {
        this.emit({ type: 'blast', dist: m.dist, x: m.x, h: m.h, big: false });
        remove = true;
      }
      if (remove) this.missiles.splice(i, 1);
    }
    // incoming-missile warning
    for (const m of this.missiles) {
      const t = m.target;
      if (t && t.alive) {
        const ds = wrapD(m.dist - t.dist, L);
        if (ds < 0 && ds > -420) t.incoming = Math.max(t.incoming, 0.25);
      }
    }
  }

  explodeMine(m, idx, by) {
    this.mines.splice(idx, 1);
    this.emit({ type: 'blast', dist: m.dist, x: m.x, h: m.h, big: true, mine: m });
    const L = this.track.length;
    for (const t of this.ships) {
      if (!t.alive) continue;
      if (Math.abs(wrapD(t.dist - m.dist, L)) < 12 && Math.abs(t.x - m.x) < 12 && Math.abs(t.h - m.h) < 10) {
        this.hit(t, { dmg: C.MINE_DMG, stun: 0.6, slow: 0.65, by: typeof by === 'object' ? by : null, kind: 'mine' });
      }
    }
  }

  stepMines(dt) {
    const L = this.track.length;
    for (let k = this.mines.length - 1; k >= 0; k--) {
      const m = this.mines[k];
      m.life -= dt;
      if (m.arm > 0) m.arm -= dt;
      if (m.life <= 0) { this.mines.splice(k, 1); continue; }
      if (m.arm > 0) continue;
      for (const t of this.ships) {
        if (!t.local || !t.alive || t.invuln > 0) continue;
        if (Math.abs(wrapD(t.dist - m.dist, L)) < 4.2 && Math.abs(t.x - m.x) < 4.2 && Math.abs(t.h - m.h) < 5) {
          const owner = this.ships.find((s) => s.id === m.owner) || null;
          this.emit({ type: 'mineHit', mine: m });
          this.explodeMine(m, k, owner);
          break;
        }
      }
    }
  }

  // ----- ship vs ship ------------------------------------------------------
  collide(dt) {
    const L = this.track.length;
    const S = this.ships;
    for (const s of S) s.draft = 0;
    for (let i = 0; i < S.length; i++) {
      const a = S[i];
      if (!a.alive) continue;
      for (let j = 0; j < S.length; j++) {
        if (i === j) continue;
        const b = S[j];
        if (!b.alive) continue;
        const ds = wrapD(b.dist - a.dist, L);
        // a is behind b by ds>0 : drafting
        if (a.local && ds > 7 && ds < 48 && Math.abs(b.x - a.x) < 6 && Math.abs(b.h - a.h) < 8) {
          a.draft = Math.max(a.draft, 1 - ds / 60);
        }
        if (j < i) continue;
        if (Math.abs(ds) < 5.8 && Math.abs(b.x - a.x) < 3.8 && Math.abs(b.h - a.h) < 3.2) {
          this.bump(a, b, ds);
        }
      }
      if (a.draft > 0) {
        a.energy = Math.min(100, a.energy + 12 * a.draft * dt);
      }
    }
  }

  bump(a, b, ds) {
    let dir = Math.sign(b.x - a.x) || (this.rng() < 0.5 ? -1 : 1);
    const hw = this.track.sample(a.dist).w / 2 - 3;
    const push = (3.9 - Math.abs(b.x - a.x)) * 0.5 + 0.2;
    const front = ds > 0 ? b : a;
    const rear = ds > 0 ? a : b;
    const mA = a.type.armor;
    const mB = b.type.armor;
    if (a.local) { a.x = clamp(a.x - dir * push * (mB / (mA + mB)) * 2, -hw, hw); a.vx = -dir * 38; }
    if (b.local) { b.x = clamp(b.x + dir * push * (mA / (mA + mB)) * 2, -hw, hw); b.vx = dir * 38; }
    if (rear.local && Math.abs(ds) > 1.5) rear.vs = Math.min(rear.vs, front.vs * 0.96);
    if (this.clock - (a.bumpAt || 0) > 0.25 || this.clock - (b.bumpAt || 0) > 0.25) {
      a.bumpAt = b.bumpAt = this.clock;
      this.emit({ type: 'bump', a, b, dist: (a.dist + b.dist) / 2 });
      // shoulder-charge: boosting ship into a slower one hurts
      for (const [x, y] of [[a, b], [b, a]]) {
        if (x.boosting && x.vs > y.vs + 60) this.hit(y, { dmg: 8 * x.type.armor, stun: 0.35, by: x, kind: 'ram' });
        else this.hit(y, { dmg: 1.5, by: x, kind: 'ram' });
      }
    }
  }

  // ----- pads --------------------------------------------------------------
  stepPads(dt) {
    const L = this.track.length;
    for (const p of this.pads) {
      for (let i = 0; i < p.cd.length; i++) if (p.cd[i] > 0) p.cd[i] -= dt;
    }
    for (const s of this.ships) {
      if (!s.local || !s.alive) continue;
      for (const p of this.pads) {
        const ds = wrapD(p.s - s.dist, L);
        if (Math.abs(ds) > p.len / 2 + 4) continue;
        const f = this.track.sample(p.s);
        const px = p.x * (f.w / 2 - 6);
        if (Math.abs(s.x - px) > (p.type === 'item' ? 5.5 : 11)) continue;
        if (p.type === 'item') {
          if (p.cd[s.idx] > 0 || Math.abs(ds) > 5 || s.h > 14) continue;
          p.cd[s.idx] = C.PAD_RESPAWN;
          this.grantItem(s, p);
        } else if (p.type === 'boost') {
          if (s.h > 10) continue;
          if (s.padBoost < 0.9) {
            s.padBoost = 1.5;
            s.vs = Math.max(s.vs, 260);
            this.emit({ type: 'boostPad', ship: s });
          }
        } else if (p.type === 'jump') {
          if (s.h < 8 && (p.cd[s.idx] || 0) <= 0) {
            p.cd[s.idx] = 0.6;
            s.vh = 95 + s.vs * 0.05;
            s.h += 0.5;
            s.padBoost = Math.max(s.padBoost, 0.6);
            this.emit({ type: 'jumpPad', ship: s });
          }
        }
      }
    }
  }

  grantItem(s, pad) {
    const r = this.rng;
    const lowHp = s.hp < s.hpMax * 0.55;
    const rank = s.place;
    const behind = rank >= Math.ceil(this.ships.length / 2);
    const table = [
      ['ammo', 30],
      ['energy', 22],
      ['repair', lowHp ? 30 : 8],
      ['shield', 12],
      ['mines', 9],
      ['emp', behind ? 12 : 6],
      ['overdrive', behind ? 12 : 5],
    ];
    if (!this.combat) { table.length = 0; table.push(['energy', 1]); }
    const total = table.reduce((a, b) => a + b[1], 0);
    let x = r() * total;
    let kind = table[0][0];
    for (const [k, w] of table) { if ((x -= w) <= 0) { kind = k; break; } }
    if (ITEMS[kind] && s.item) kind = 'energy';
    switch (kind) {
      case 'ammo': s.ammo = Math.min(9, s.ammo + 3); break;
      case 'energy': s.energy = Math.min(100, s.energy + 55); break;
      case 'repair': s.hp = Math.min(s.hpMax, s.hp + s.hpMax * 0.5); break;
      case 'shield': s.shield = 9; break;
      default:
        s.item = kind;
        s.itemUses = ITEMS[kind].uses;
    }
    this.emit({ type: 'pickup', ship: s, kind, pad });
  }

  // ----- ranking / race end -------------------------------------------------
  updateRanks() {
    const o = this.ships.slice();
    o.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.dist - a.dist;
    });
    o.forEach((s, i) => (s.place = i + 1));
    this.order = o;
  }

  checkEnd() {
    if (this.state !== 'racing' || !this.humans.length) {
      if (this.mode === 'trial') return;
      if (this.state === 'racing' && !this.humans.length && this.ships.every((s) => s.finished)) this.finishRace();
      return;
    }
    if (this.humans.every((s) => s.finished)) {
      if (this.finishedAt === null) this.finishedAt = this.time;
      if (this.time - this.finishedAt > 0.01) this.finishRace();
    }
  }

  finishRace() {
    this.state = 'finished';
    this.results = this.buildResults();
    this.emit({ type: 'raceEnd', results: this.results });
  }

  buildResults() {
    const L = this.track.length;
    const total = this.laps * L;
    const rows = this.ships.map((s) => {
      let t = s.finishTime;
      if (!s.finished) {
        const avg = Math.max(60, s.dist > 0 ? s.dist / Math.max(this.time, 1) : 200);
        t = this.time + (total - s.dist) / avg;
      }
      return { ship: s, time: t, finished: s.finished, bestLap: s.bestLap, kills: s.kills };
    });
    rows.sort((a, b) => (a.finished === b.finished ? a.time - b.time : a.finished ? -1 : 1));
    rows.forEach((r, i) => {
      r.place = i + 1;
      r.points = this.combat ? POINTS[i] ?? 0 : 0;
    });
    return rows;
  }

  // ----- AI ----------------------------------------------------------------
  think(s, dt) {
    const tr = this.track;
    const L = tr.length;
    const inp = s.input;
    const ai = s.aiState;
    const skill = s.skill;
    const f = tr.sample(s.dist);
    const hw = f.w / 2;
    const kNow = f.kR;
    const look = 70 + s.vs * 0.18;
    const fa = tr.sample(s.dist + look);
    const kAhead = fa.kR;
    const maxLat = C.MAX_LAT * s.type.handling;

    if (!s.alive) return;
    // wander personality
    ai.offT -= dt;
    if (ai.offT <= 0) {
      ai.offT = 2 + this.rng() * 4;
      ai.off = (this.rng() * 2 - 1) * 0.35;
    }
    let tx = clamp(kAhead * 3800, -hw * 0.55, hw * 0.55) + ai.off * hw * (s.autopilot ? 0.3 : 1);

    const racing = this.state === 'racing';
    const combat = this.combat && racing && !s.autopilot;

    // pads: grab nearby items / boost pads
    let padPrio = 0;
    for (const p of this.pads) {
      const ds = wrapD(p.s - s.dist, L);
      if (ds < 10 || ds > 260) continue;
      if (p.type === 'item' && (p.cd[s.idx] > 0 || !combat)) continue;
      if (p.type === 'jump') continue;
      const fp = tr.sample(p.s);
      const px = p.x * (fp.w / 2 - 6);
      const want = p.type === 'boost' ? 1.5 : 1;
      const score = want * (1 - ds / 300);
      if (score > padPrio && this.rng() < 0.35 + skill * 0.65 + 0.2) {
        padPrio = score;
        tx = px;
      }
    }
    // avoid mines
    for (const m of this.mines) {
      const ds = wrapD(m.dist - s.dist, L);
      if (ds > 0 && ds < 140 && Math.abs(m.x - tx) < 9 && skill > 0.15) tx = m.x + (m.x > 0 ? -12 : 12);
    }
    // ships ahead: avoid or attack
    let attack = null;
    let blockAhead = null;
    for (const t of this.ships) {
      if (t === s || !t.alive) continue;
      const ds = wrapD(t.dist - s.dist, L);
      if (ds > 4 && ds < 55 && Math.abs(t.x - s.x) < 8) {
        if (!blockAhead || ds < wrapD(blockAhead.dist - s.dist, L)) blockAhead = t;
      }
      if (combat && ds > 20 && ds < 420 && Math.abs(t.x - s.x) < 30 + ds * 0.15 && (!attack || ds < wrapD(attack.dist - s.dist, L))) attack = t;
    }
    if (attack && skill > 0.3) {
      const ds = wrapD(attack.dist - s.dist, L);
      if (ds > 60) tx = tx * 0.4 + attack.x * 0.6;
    }
    if (blockAhead && !(attack === blockAhead && skill > 0.5 && wrapD(blockAhead.dist - s.dist, L) > 25)) {
      tx = s.x + (s.x - blockAhead.x >= 0 ? 12 : -12);
    }
    tx = clamp(tx, -hw + 9, hw - 9);

    // steering: PD to the target offset + feed-forward for corner drift
    const desiredVx = clamp((tx - s.x) * 1.7, -maxLat * 0.85, maxLat * 0.85);
    const ff = (kNow * s.vs * s.vs * C.LGRIP) / (C.LAT_RESP * maxLat);
    const noise = (1 - skill) * Math.sin(this.clock * 1.7 + s.idx * 3.1) * 0.25;
    inp.steer = clamp((desiredVx - s.vx) / maxLat * 1.2 + ff + noise, -1, 1);

    // hop over hazards / airtime control
    inp.climb = false;
    inp.brake = false;
    if (Math.abs(kAhead) > 0.006 && s.vs > 330 && skill < 0.9 && !s.boosting) inp.brake = this.rng() < 0.05;

    // boost: use it on straights when there is enough energy
    const straight = Math.abs(kAhead) < 0.0035 && Math.abs(kNow) < 0.004;
    const thresh = 60 - skill * 38;
    if (!racing) inp.boost = false;
    else if (inp.boost) inp.boost = s.energy > 4 && straight;
    else inp.boost = s.energy > thresh && straight && this.rng() < 0.02 + skill * 0.06;
    if (s.autopilot) inp.boost = false;

    // combat
    inp.fire = false;
    if (combat && attack) {
      const ds = wrapD(attack.dist - s.dist, L);
      const aligned = Math.abs(attack.x - s.x) < 5 + ds * 0.03;
      if (aligned && ds < 340) {
        ai.fireHold -= dt;
        inp.fire = this.rng() < 0.55 + skill * 0.4;
      }
      if (s.locked && s.lockTarget === attack && s.ammo > 0 && this.rng() < 0.03 + skill * 0.03) inp.missile = true;
    }
    // use items
    if (combat && s.item) {
      if (s.item === 'overdrive' && straight && this.rng() < 0.03) inp.item = true;
      if (s.item === 'emp') {
        const near = this.ships.some((t) => t !== s && t.alive && Math.abs(wrapD(t.dist - s.dist, L)) < 120);
        if (near && this.rng() < 0.03) inp.item = true;
      }
      if (s.item === 'mines') {
        const chaser = this.ships.some((t) => t !== s && t.alive && wrapD(s.dist - t.dist, L) > 8 && wrapD(s.dist - t.dist, L) < 90 && Math.abs(t.x - s.x) < 18);
        if (chaser && this.rng() < 0.06) inp.item = true;
      }
    }
    // dodge incoming missile
    if (combat && s.incoming > 0 && s.dodgeCD <= 0) {
      const m = this.missiles.find((q) => q.target === s);
      if (m && wrapD(s.dist - m.dist, L) < 40 + skill * 40 && this.rng() < 0.05 + skill * 0.2) inp.dodge = s.x > 0 ? -1 : 1;
    }

    // rubber banding relative to the humans
    s.rubber = 1;
    if (!s.autopilot) {
      const base = 0.93 + skill * 0.07;
      s.rubber = base;
      if (this.humans.length && !s.human) {
        let ref = -Infinity;
        for (const h of this.humans) ref = Math.max(ref, h.dist);
        const gap = ref - s.dist;
        const R = this.difficulty.rubber;
        if (gap > 250) s.rubber *= 1 + Math.min(R * 1.6, (gap - 250) / 8000);
        else if (gap < -350) s.rubber *= 1 - Math.min(R, (-gap - 350) / 9000);
      }
    }
    if (s.autopilot) s.rubber = 0.8;
  }

  // ----- helpers for the UI ------------------------------------------------
  relative(from, to) {
    return wrapD(to.dist - from.dist, this.track.length);
  }
}

export { wrapD };
