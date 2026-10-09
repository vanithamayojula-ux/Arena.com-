// Glue between a Race and the relay: sends our ship state at ~15Hz plus discrete
// combat events, and applies what other pilots send. Each client simulates its own
// ship; everyone else is a smoothed "ghost" (see Race.stepGhost).

const r1 = (v) => Math.round(v * 10) / 10;

export class NetSession {
  constructor(race, net, myId) {
    this.race = race;
    this.net = net;
    this.me = race.ships.find((s) => s.id === myId);
    this.timer = 0;
    this.firstFinish = null;
    for (const m of race.mines) m.rid = 'a' + m.id;
  }

  byId(id) { return this.race.ships.find((s) => s.id === id); }

  pack(s) {
    const flags = (s.boosting ? 1 : 0) | (s.shield > 0 ? 2 : 0) | (s.invuln > 0 ? 4 : 0) | (s.dodgeT > 0 ? 8 : 0) | (s.alive ? 16 : 0) | (s.finished ? 32 : 0) | (s.stun > 0 ? 64 : 0);
    return [r1(s.dist), r1(s.x), r1(s.h), r1(s.vs), r1(s.vx), r1(s.vh), flags, Math.round(s.hp), s.hpMax, s.lap, s.kills, isFinite(s.finishTime) ? Math.round(s.finishTime * 100) / 100 : -1];
  }

  tick(dt) {
    const race = this.race;
    this.timer += dt;
    if (this.timer >= 0.066 && race.state !== 'countdown') {
      this.timer = 0;
      this.net.send({ t: 's', p: this.pack(this.me) });
    }
    // force the race to end a while after the first pilot finishes
    if (race.state === 'racing') {
      if (this.firstFinish === null && race.ships.some((s) => s.finished)) this.firstFinish = race.time;
      if (this.firstFinish !== null && race.time - this.firstFinish > 45) race.finishRace();
    }
  }

  /** Forward local events to the other pilots. */
  outgoing(events) {
    const race = this.race, me = this.me, net = this.net;
    for (const e of events) {
      if (e.remote) continue;
      switch (e.type) {
        case 'laser':
          if (e.ship === me) { const b = e.bullet; net.send({ t: 'l', d: { owner: me.id, dist: r1(b.dist), x: r1(b.x), h: r1(b.h), vs: r1(b.vs), vx: r1(b.vx), vh: r1(b.vh) } }); }
          break;
        case 'missile':
          if (e.ship === me) {
            let m = null;
            for (let i = race.missiles.length - 1; i >= 0; i--) if (race.missiles[i].ownerId === me.id && race.missiles[i].local) { m = race.missiles[i]; break; }
            if (m) net.send({ t: 'm', d: { owner: me.id, target: e.target ? e.target.id : null, dist: r1(m.dist), x: r1(m.x), h: r1(m.h), vs: r1(m.vs) } });
          }
          break;
        case 'netHit':
          net.send({ t: 'h', d: { ship: e.target.id, dmg: e.dmg, stun: e.stun, slow: e.slow, by: e.by ? e.by.id : null, kind: e.kind } }, e.target.id);
          break;
        case 'kill':
          if (e.victim === me) {
            net.send({ t: 'k', v: me.id, k: e.killer ? e.killer.id : null, kind: e.kind });
          }
          break;
        case 'mineDrop':
          if (e.ship === me && e.mine) { e.mine.rid = me.id + ':' + e.mine.id; net.send({ t: 'md', rid: e.mine.rid, dist: r1(e.mine.dist), x: r1(e.mine.x) }); }
          break;
        case 'blast':
          if (e.mine && e.mine.rid) net.send({ t: 'mg', rid: e.mine.rid });
          break;
        case 'emp':
          if (e.ship === me) net.send({ t: 'emp' });
          break;
        default: break;
      }
    }
  }

  onMsg(from, m) {
    const race = this.race;
    const ship = this.byId(from);
    switch (m.t) {
      case 's': {
        if (!ship || ship.local || ship.left) break;
        const p = m.p, f = p[6];
        const first = !ship.net;
        ship.net = {
          dist: p[0], x: p[1], h: p[2], vs: p[3], vx: p[4], vh: p[5],
          boost: f & 1, shield: f & 2, invuln: f & 4, dodge: f & 8, alive: !!(f & 16), finished: !!(f & 32), stun: f & 64,
          hp: p[7], hpMax: p[8], lap: p[9], kills: p[10], finishTime: p[11] < 0 ? Infinity : p[11], at: race.clock,
        };
        if (first) { ship.dist = p[0]; ship.x = p[1]; ship.h = p[2]; ship.vs = p[3]; }
        break;
      }
      case 'l': if (ship) { race.spawnRemoteBullet(m.d); race.emit({ type: 'laser', bullet: race.bullets[race.bullets.length - 1], ship, remote: true }); } break;
      case 'm': if (ship) { race.spawnRemoteMissile(m.d); race.emit({ type: 'missile', ship, target: this.byId(m.d.target), remote: true }); } break;
      case 'h': race.applyRemoteHit(m.d.ship, m.d); break;
      case 'k': {
        const v = this.byId(m.v), k = m.k ? this.byId(m.k) : null;
        if (!v) break;
        if (k && k.local) { k.kills++; k.energy = Math.min(100, k.energy + 25); }
        race.emit({ type: 'kill', victim: v, killer: k, kind: m.kind, remote: true });
        break;
      }
      case 'md': race.mines.push({ id: race.nextId++, dist: m.dist, x: m.x, h: 3.6, owner: from, arm: 1, life: 40, hp: 6, rid: m.rid }); break;
      case 'mg': {
        const i = race.mines.findIndex((q) => q.rid === m.rid);
        if (i >= 0) { const q = race.mines[i]; race.mines.splice(i, 1); race.emit({ type: 'blast', dist: q.dist, x: q.x, h: q.h, big: true, remote: true }); }
        break;
      }
      case 'emp': if (ship) race.emit({ type: 'emp', ship, remote: true }); break;
      default: break;
    }
  }

  playerLeft(pid) {
    const s = this.byId(pid);
    if (!s || s.local) return;
    s.left = true; s.alive = false; s.net = null; s.human = false;
    this.race.humans = this.race.humans.filter((h) => h !== s);
    this.race.emit({ type: 'left', ship: s });
  }
}
