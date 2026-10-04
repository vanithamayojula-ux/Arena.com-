// Everything that moves: the player T-rex, the herds, the rival raptor pack,
// plus the particle and floating-score systems.

import { PLAYER, PREY, RAPTOR, HERD, WORLD } from './config.js';
import { clamp, lerp, dist, dist2, angleTo, angleDiff, approachAngle, TAU } from './utils.js';

class Steerable {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.angle = 0;
    this.alive = true;
    this.speed = 0;
    this.phase = Math.random() * TAU; // limb animation phase
    this.flash = 0;
  }

  get moving() {
    return this.speed > 12;
  }

  integrate(dt, maxSpeed, turnRate) {
    const sx = this.vx * this.vx + this.vy * this.vy;
    if (sx > 0.0001) {
      const target = Math.atan2(this.vy, this.vx);
      this.angle = approachAngle(this.angle, target, turnRate * dt);
    }
    this.speed = Math.sqrt(sx);
    const over = this.speed - maxSpeed;
    if (over > 0 && this.speed > 0) {
      const k = maxSpeed / this.speed;
      this.vx *= k;
      this.vy *= k;
      this.speed = maxSpeed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.phase += dt * (2.5 + this.speed * 0.045);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.2);
  }
}

// --------------------------------------------------------------------- player

export class Player extends Steerable {
  constructor(x, y) {
    super(x, y, PLAYER.radius);
    this.cfg = PLAYER;
    this.kind = 'trex';
    this.aim = 0;
    this.hp = PLAYER.hpMax;
    this.stamina = PLAYER.staminaMax;
    this.hunger = PLAYER.hungerMax;
    this.regenTimer = 0;
    this.sprinting = false;
    this.biteTimer = 0; // counts down the whole bite animation
    this.biteCooldown = 0;
    this.biteDidHit = false;
    this.biting = false;
    this.iFrames = 0;
    this.scale = 1.55;
    this.lunge = 0;
  }

  /** True during the strike frames of a bite (after the short windup). */
  get isStriking() {
    return this.biting && this.biteTimer <= PLAYER.biteStrike;
  }

  /** True only on the first frame of the strike, so one bite lands once. */
  consumeStrike() {
    if (!this.isStriking || this.biteDidHit) return false;
    this.biteDidHit = true;
    return true;
  }

  startBite() {
    if (this.biteCooldown > 0 || this.biting) return false;
    this.biting = true;
    this.biteTimer = PLAYER.biteWindup + PLAYER.biteStrike;
    this.biteDidHit = false;
    this.biteCooldown = PLAYER.biteCooldown;
    this.lunge = 1;
    return true;
  }

  update(dt, input, world) {
    // --- facing: mouse aim wins while the pointer is in play
    let desired = this.angle;
    if (input.aimActive) desired = input.aim;
    else if (input.x !== 0 || input.y !== 0) desired = Math.atan2(input.y, input.x);
    this.angle = approachAngle(this.angle, desired, PLAYER.turnRate * dt);

    const ix = input.x;
    const iy = input.y;
    const mag = Math.hypot(ix, iy);

    // sprint needs stamina and forward intent
    this.sprinting = input.sprint && this.stamina > 1 && mag > 0.1;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
      this.regenTimer = PLAYER.regenDelay;
    } else {
      this.regenTimer = Math.max(0, this.regenTimer - dt);
      if (this.regenTimer <= 0) {
        this.stamina = Math.min(PLAYER.staminaMax, this.stamina + PLAYER.staminaRegen * dt);
      }
    }

    // --- thrust: acceleration is derived from the current speed cap so the cap
    //     is actually reachable. A flat accel/drag pair would top out at
    //     accel/drag and make sprinting pointless.
    let maxSpeed = (this.sprinting ? PLAYER.sprintMax : PLAYER.maxSpeed) *
      world.terrainSpeed(this.x, this.y);

    let ax = 0;
    let ay = 0;
    if (mag > 0.01) {
      const nx = ix / mag;
      const ny = iy / mag;
      const power = Math.min(1, mag);
      const accel = PLAYER.drag * maxSpeed * PLAYER.accelResponse;
      ax = nx * accel * power;
      ay = ny * accel * power;
    }

    this.vx += ax * dt;
    this.vy += ay * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    this.vx *= drag;
    this.vy *= drag;

    this.integrate(dt, maxSpeed, 999);

    world.resolveSolids(this);
    world.clampToWalls(this);

    // --- bite animation
    if (this.biting) {
      this.biteTimer -= dt;
      if (this.biteTimer <= 0) this.biting = false;
    }
    this.biteCooldown = Math.max(0, this.biteCooldown - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.lunge = Math.max(0, this.lunge - dt * 5);

    // --- hunger ticks away constantly
    this.hunger = Math.max(0, this.hunger - PLAYER.hungerDrain * dt);
  }

  /** Cone in front of the jaws; returns true when (px,py) is inside it. */
  inBiteCone(px, py, pad = 0) {
    const dx = px - this.x;
    const dy = py - this.y;
    const d = Math.hypot(dx, dy);
    if (d > PLAYER.biteRange + pad) return false;
    const a = Math.abs(angleDiff(this.angle, Math.atan2(dy, dx)));
    return a <= PLAYER.biteArc * 0.5;
  }

  heal(amount) {
    this.hp = clamp(this.hp + amount, 0, PLAYER.hpMax);
  }

  damage(amount) {
    if (this.iFrames > 0) return false;
    this.hp = clamp(this.hp - amount, 0, PLAYER.hpMax);
    this.iFrames = PLAYER.iFrames;
    this.flash = 1;
    return true;
  }

  get starving() {
    return this.hunger <= 0;
  }
  get dead() {
    return this.hp <= 0;
  }
}

// ----------------------------------------------------------------------- prey

export class Prey extends Steerable {
  constructor(x, y, type, herdId, rand) {
    const cfg = PREY[type];
    super(x, y, cfg.radius);
    this.type = type;
    this.kind = type;
    this.cfg = cfg;
    this.scale = cfg.scale;
    this.hp = cfg.hp;
    this.herdId = herdId;
    this.rand = rand;
    this.state = 'graze';
    this.target = null;
    this.stamina = cfg.stamina;
    this.blown = false;
    this.blowTimer = 0;
    this.nibble = 0;
    this.alert = 0;
    this.jitter = rand.range(0, TAU);
    this.repick = rand.range(0, 3);
    this.mul = 1; // per-wave speed multiplier
    this.sightMul = 1; // per-wave alertness multiplier
  }

  damage(amount) {
    this.hp -= amount;
    this.flash = 1;
    return this.hp <= 0;
  }

  update(dt, world, threats, herd) {
    const cfg = this.cfg;
    this.alert = Math.max(0, this.alert - dt * 1.6);

    // --- find the nearest threat
    let threat = null;
    let threatD = Infinity;
    for (const t of threats) {
      const d2 = dist2(this.x, this.y, t.x, t.y);
      if (d2 < threatD) {
        threatD = d2;
        threat = t;
      }
    }
    const threatDist = Math.sqrt(threatD);
    const sees = threat && threatDist < cfg.sight * this.sightMul * (this.blown ? 1.25 : 1);

    if (sees) {
      this.alert = 1;
      this.state = threatDist < cfg.sight * 0.45 ? 'panic' : 'flee';
    } else if (this.state !== 'graze') {
      // keep running for a moment after losing sight
      this.alert -= dt * 0.4;
      if (this.alert <= 0) this.state = 'graze';
    }

    // --- stamina: herds blow after a hard sprint, which is how you catch them
    const sprinting = this.state !== 'graze';
    if (sprinting && !this.blown) {
      this.stamina -= dt * (this.state === 'panic' ? 1.15 : 0.8);
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.blown = true;
        this.blowTimer = cfg.recover;
      }
    } else if (this.blown) {
      this.blowTimer -= dt;
      this.stamina = Math.min(cfg.stamina, this.stamina + dt * 0.25);
      if (this.blowTimer <= 0) {
        this.blown = false;
        this.stamina = cfg.stamina * 0.55;
      }
    } else {
      this.stamina = Math.min(cfg.stamina, this.stamina + dt * 0.5);
    }

    // --- desired velocity
    let dx = 0;
    let dy = 0;

    if (this.state === 'graze') {
      if (!this.target || dist2(this.x, this.y, this.target.x, this.target.y) < 26 * 26) {
        this.repick -= dt;
        if (this.repick <= 0) {
          this.target = world.nearestGrass(
            this.x + this.rand.range(-260, 260),
            this.y + this.rand.range(-260, 260)
          );
          this.repick = this.rand.range(2.5, 6);
          this.nibble = this.rand.range(0.6, 2.2);
        }
      }
      if (this.nibble > 0) {
        this.nibble -= dt;
        this.jitter += dt * 3;
      } else if (this.target) {
        const a = angleTo(this.x, this.y, this.target.x, this.target.y);
        dx += Math.cos(a) * cfg.grazeSpeed * this.mul;
        dy += Math.sin(a) * cfg.grazeSpeed * this.mul;
      }
    } else {
      // flee directly away, biased sideways so herds fan out
      let a = angleTo(threat.x, threat.y, this.x, this.y);
      if (!isFinite(a)) a = this.angle;
      const side = this.herdId % 2 === 0 ? 1 : -1;
      a += cfg.fleeAngle * side * (0.6 + 0.4 * Math.sin(this.jitter * 0.7));
      this.jitter += dt * 2.2;
      const spd =
        (this.blown
          ? cfg.grazeSpeed * 1.5
          : this.state === 'panic'
          ? cfg.panicSpeed
          : cfg.fleeSpeed) * this.mul;
      dx += Math.cos(a) * spd;
      dy += Math.sin(a) * spd;

      // herd cohesion: run with your neighbours
      if (herd) {
        dx += herd.ax * HERD.cohesionWeight;
        dy += herd.ay * HERD.cohesionWeight;
      }
    }

    // --- separation from the rest of the herd (kept cheap: caller supplies
    //     a neighbour sample via `neighbours`)
    if (this._neighbours) {
      let sx = 0;
      let sy = 0;
      for (const o of this._neighbours) {
        const d = dist(this.x, this.y, o.x, o.y);
        if (d > 0.001 && d < HERD.separation * 1.8) {
          sx += (this.x - o.x) / d;
          sy += (this.y - o.y) / d;
        }
      }
      dx += sx * HERD.separationWeight * 26;
      dy += sy * HERD.separationWeight * 26;
    }

    // --- steer away from walls before hitting them
    const margin = 130;
    if (this.x < margin) dx += (margin - this.x) * 2.4;
    if (this.x > WORLD.w - margin) dx -= (this.x - (WORLD.w - margin)) * 2.4;
    if (this.y < margin) dy += (margin - this.y) * 2.4;
    if (this.y > WORLD.h - margin) dy -= (this.y - (WORLD.h - margin)) * 2.4;

    // --- look ahead for boulders and dodge
    const look = 46;
    const hx = this.x + Math.cos(this.angle) * look;
    const hy = this.y + Math.sin(this.angle) * look;
    if (world.solidAt(hx, hy, this.radius + 6)) {
      const perp = this.angle + Math.PI / 2 * (this.rand.chance(0.5) ? 1 : -1);
      dx += Math.cos(perp) * 190;
      dy += Math.sin(perp) * 190;
    }

    // Blown animals wobble and can't hold a line.
    if (this.blown) {
      const w = Math.sin(this.jitter * 6) * 40;
      dx += Math.cos(this.angle + Math.PI / 2) * w;
      dy += Math.sin(this.angle + Math.PI / 2) * w;
    }

    const maxSpeed =
      (this.state === 'graze'
        ? cfg.grazeSpeed
        : this.blown
        ? cfg.grazeSpeed * 1.5
        : this.state === 'panic'
        ? cfg.panicSpeed
        : cfg.fleeSpeed) *
      this.mul *
      world.terrainSpeed(this.x, this.y);

    // ease toward the desired velocity rather than snapping
    const ease = this.state === 'graze' ? 3.2 : 6.5;
    this.vx = lerp(this.vx, dx, clamp(ease * dt, 0, 1));
    this.vy = lerp(this.vy, dy, clamp(ease * dt, 0, 1));

    this.integrate(dt, maxSpeed, cfg.turnRate);
    world.resolveSolids(this);
    world.clampToWalls(this);
  }
}

// --------------------------------------------------------------------- raptor

export class Raptor extends Steerable {
  constructor(x, y, rand) {
    super(x, y, RAPTOR.radius);
    this.cfg = RAPTOR;
    this.kind = 'raptor';
    this.rand = rand;
    this.scale = RAPTOR.scale;
    this.hp = RAPTOR.hp;
    this.hitCooldown = 0;
    this.target = null;
    this.retreat = 0;
    this.mul = 1;
  }

  damage(amount) {
    this.hp -= amount;
    this.flash = 1;
    return this.hp <= 0;
  }

  update(dt, world, prey, player) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.retreat = Math.max(0, this.retreat - dt);

    const dPlayer = dist(this.x, this.y, player.x, player.y);
    let dx = 0;
    let dy = 0;

    // Back off briefly after the big rex bites us.
    if (this.retreat > 0) {
      const a = angleTo(player.x, player.y, this.x, this.y);
      dx += Math.cos(a) * RAPTOR.sprint;
      dy += Math.sin(a) * RAPTOR.sprint;
    } else {
      // pick the closest prey to steal
      let best = null;
      let bestD = Infinity;
      for (const p of prey) {
        const d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < bestD) {
          bestD = d2;
          best = p;
        }
      }
      this.target = best;
      if (best) {
        // lead the target slightly
        const a = angleTo(this.x, this.y, best.x + best.vx * 0.35, best.y + best.vy * 0.35);
        dx += Math.cos(a) * RAPTOR.speed;
        dy += Math.sin(a) * RAPTOR.speed;
      } else {
        // patrol toward the player so they stay a nuisance
        const a = angleTo(this.x, this.y, player.x, player.y);
        dx += Math.cos(a) * RAPTOR.speed * 0.5;
        dy += Math.sin(a) * RAPTOR.speed * 0.5;
      }

      // harry the player on the way past
      if (dPlayer < 220 && player.speed < 150) {
        const a = angleTo(this.x, this.y, player.x, player.y);
        dx += Math.cos(a) * RAPTOR.speed * 0.7;
        dy += Math.sin(a) * RAPTOR.speed * 0.7;
      } else if (dPlayer < 90) {
        // give the apex a little room
        const a = angleTo(player.x, player.y, this.x, this.y);
        dx += Math.cos(a) * RAPTOR.speed * 0.5;
        dy += Math.sin(a) * RAPTOR.speed * 0.5;
      }

      // spread out from pack-mates
      if (this._neighbours) {
        let sx = 0;
        let sy = 0;
        for (const o of this._neighbours) {
          const d = dist(this.x, this.y, o.x, o.y);
          if (d > 0.001 && d < 80) {
            sx += (this.x - o.x) / d;
            sy += (this.y - o.y) / d;
          }
        }
        dx += sx * 60;
        dy += sy * 60;
      }
    }

    const margin = 120;
    if (this.x < margin) dx += (margin - this.x) * 2.5;
    if (this.x > WORLD.w - margin) dx -= (this.x - (WORLD.w - margin)) * 2.5;
    if (this.y < margin) dy += (margin - this.y) * 2.5;
    if (this.y > WORLD.h - margin) dy -= (this.y - (WORLD.h - margin)) * 2.5;

    const maxSpeed = RAPTOR.sprint * this.mul * world.terrainSpeed(this.x, this.y);
    this.vx = lerp(this.vx, dx, clamp(5.5 * dt, 0, 1));
    this.vy = lerp(this.vy, dy, clamp(5.5 * dt, 0, 1));
    this.integrate(dt, maxSpeed, RAPTOR.turnRate);
    world.resolveSolids(this);
    world.clampToWalls(this);
  }

  /** Contact damage against the player; returns damage dealt or 0. */
  tryContact(player) {
    if (this.hitCooldown > 0) return 0;
    if (dist(this.x, this.y, player.x, player.y) > this.radius + player.radius + 4) return 0;
    this.hitCooldown = RAPTOR.contactCooldown;
    return RAPTOR.contactDamage;
  }
}

// ------------------------------------------------------------------ particles

const MAX_PARTICLES = 420;

export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(p) {
    if (this.list.length >= MAX_PARTICLES) this.list.shift();
    this.list.push({ life: 1, maxLife: 1, size: 4, color: '#fff', spin: 0, rot: 0, grav: 0, ...p });
  }

  dust(x, y, vx, vy, rand, amount = 1) {
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x: x + rand.range(-6, 6),
        y: y + rand.range(-6, 6),
        vx: -vx * 0.22 + rand.range(-26, 26),
        vy: -vy * 0.22 + rand.range(-26, 26),
        size: rand.range(3, 8),
        color: 'rgba(178,160,116,0.5)',
        life: rand.range(0.35, 0.8),
        maxLife: 0.8,
        grow: rand.range(8, 20),
      });
    }
  }

  burst(x, y, color, count, rand, power = 150) {
    for (let i = 0; i < count; i++) {
      const a = rand.range(0, TAU);
      const s = rand.range(power * 0.25, power);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: rand.range(2.5, 6),
        color,
        life: rand.range(0.3, 0.7),
        maxLife: 0.7,
        grav: 60,
      });
    }
  }

  leaves(x, y, rand) {
    for (let i = 0; i < 10; i++) {
      const a = rand.range(0, TAU);
      const s = rand.range(30, 130);
      this.spawn({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: rand.range(3, 6),
        color: rand.chance(0.5) ? '#6f9a45' : '#476b32',
        life: rand.range(0.4, 0.9),
        maxLife: 0.9,
        spin: rand.range(-8, 8),
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-3 * dt);
      p.vy *= Math.exp(-3 * dt);
      if (p.grav) p.vy += p.grav * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.spin) p.rot += p.spin * dt;
    }
  }

  draw(g) {
    for (const p of this.list) {
      g.globalAlpha = clamp(p.life, 0, 1) * 0.9;
      g.fillStyle = p.color;
      if (p.spin) {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        g.restore();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.4, p.size), 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}

export class FloatText {
  constructor() {
    this.list = [];
  }
  add(x, y, text, color = '#e0b64a', size = 22) {
    this.list.push({ x, y, text, color, size, life: 1, vy: -42 });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt * 0.85;
      f.y += f.vy * dt;
      f.vy *= Math.exp(-1.5 * dt);
      if (f.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(g) {
    g.textAlign = 'center';
    for (const f of this.list) {
      g.globalAlpha = clamp(f.life, 0, 1);
      g.font = `bold ${f.size}px Impact, "Arial Narrow Bold", sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,0.65)';
      g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}
