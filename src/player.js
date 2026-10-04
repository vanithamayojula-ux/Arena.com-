// First person in a flooded city: wading, swimming, stair-climbing, and a lantern
// that most things in Vaelune would rather you didn't light.
import * as THREE from 'three';

const EYE = 1.68;
const RADIUS = 0.42;
// The tallest lip you can walk straight up. This is a knee-high step, and it is
// deliberately generous: at 0.55 m, 791 cells of the city — the whole amphitheatre
// floor among them — were bowls you could fall into and never climb out of.
const STEP_UP = 0.8;
const FLOOR_SNAP = 0.6;        // small drops take the floor with them, instead of becoming air
const MANTLE_REACH = 2.6;      // how far above the waterline you can haul yourself out
const SWIM_WALL = 2.4;         // terrain this far above the waterline is a wall, even swimming

export function createPlayer(camera, dom, { city, audio, onFootstep, onSwim } = {}) {
  const state = {
    pos: new THREE.Vector3(0, city.PLAZA_Y + EYE, -26),
    // (safePos is set to the spawn below, so the wedge net always has somewhere to go)
    vel: new THREE.Vector3(),
    yaw: Math.PI, pitch: -0.05,
    onGround: false,
    groundY: 0,
    depth: 0,
    swimming: false,
    submerged: false,
    speed: 0,
    bob: 0,
    stepAccum: 0,
    lanternOn: false,
    oil: 100,
    shake: 0,
    shakeV: new THREE.Vector3(),
    enabled: false,
    frozen: false,
    lastY: 0,
    fallTime: 0,
    breath: 0,
    rippleTimer: 0,
    blocked: false,
    safePos: new THREE.Vector3(0, 0, 0),
    safeTimer: 0,
    stuckFor: 0,
    mantleT: 0,
    mantleDur: 0.45,
    mantleCooldown: 0,
    mantleFrom: new THREE.Vector3(),
    mantleTo: new THREE.Vector3(),
    diving: false,
  };

  const keys = new Set();
  const mouse = { dx: 0, dy: 0, locked: false, dragging: false };

  state.safePos.copy(state.pos);

  /* ── lantern ── */
  const lantern = new THREE.SpotLight(0xffd7a0, 0, 34, 0.62, 0.45, 1.6);
  lantern.position.set(0.42, -0.28, -0.2);
  lantern.target.position.set(0, -0.5, -6);
  camera.add(lantern, lantern.target);
  const lanternGlow = new THREE.PointLight(0xffc98a, 0, 9, 2);
  lanternGlow.position.set(0.42, -0.3, -0.2);
  camera.add(lanternGlow);

  /* ── colliders: oriented boxes for the buildings the player can't walk through ── */
  const colliders = [];
  function addCollider(x, z, w, d, rot, baseY, topY) {
    colliders.push({ x, z, hw: w / 2, hd: d / 2, rot, baseY, topY, c: Math.cos(rot), s: Math.sin(rot) });
  }

  /** Is the floor at (x, z) more than `limit` above the player's feet? */
  function blockedAt(x, z, feetY, limit = STEP_UP) {
    const g = city.groundHeight(x, z);
    return g > city.DEEP + 0.01 && g - feetY > limit;
  }

  /**
   * Push out of any building box we are inside of. The push is applied in small
   * clamped steps over several iterations: the city's buildings overlap each
   * other, so jumping straight to the nearest face just lands you inside the
   * next one and two boxes can bat the player back and forth forever.
   */
  function resolveCollisions(p, vel) {
    let hits = 0;
    let deepest = 0;
    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (p.y > c.topY + 0.1) continue;                 // above the roofline
        if (p.y < c.baseY - 0.5) continue;                // underneath the foundations
        const dx = p.x - c.x, dz = p.z - c.z;
        const r = c.hw + c.hd + 2;
        if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
        const lx = dx * c.c - dz * c.s;
        const lz = dx * c.s + dz * c.c;
        const ox = c.hw + RADIUS - Math.abs(lx);
        const oz = c.hd + RADIUS - Math.abs(lz);
        if (ox <= 0 || oz <= 0) continue;
        if (pass === 0) deepest = Math.max(deepest, Math.min(ox, oz));
        // leave by the nearest face, a clamped step at a time
        const push = Math.min(Math.min(ox, oz), 0.3);
        let nlx = lx, nlz = lz;
        const alongX = ox < oz;
        if (alongX) nlx = Math.sign(lx || 1) * (Math.abs(lx) + push);
        else nlz = Math.sign(lz || 1) * (Math.abs(lz) + push);
        p.x = c.x + nlx * c.c + nlz * c.s;
        p.z = c.z - nlx * c.s + nlz * c.c;
        moved = true; hits++;
        if (vel) {
          // world-space normal of the face we were pushed out of
          const nx = alongX ? Math.sign(nlx) * c.c : Math.sign(nlz) * c.s;
          const nz = alongX ? -Math.sign(nlx) * c.s : Math.sign(nlz) * c.c;
          const into = vel.x * nx + vel.z * nz;
          if (into < 0) { vel.x -= into * nx; vel.z -= into * nz; }
        }
      }
      if (!moved) break;
    }
    resolveCollisions.depth = deepest;
    return hits;
  }

  /* ── input ── */
  function onKey(e, down) {
    if (e.repeat) return;
    const k = e.code;
    if (down) keys.add(k); else keys.delete(k);
    if (k === 'KeyF' && down && state.enabled && !state.frozen) toggleLantern();
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(k)) e.preventDefault?.();
  }
  const keyDown = (e) => onKey(e, true);
  const keyUp = (e) => onKey(e, false);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  function onMouseMove(e) {
    if (!state.enabled || state.frozen) return;
    // pointer lock is the good case; click-and-drag is the fallback for when the
    // page is embedded somewhere that refuses to give it to us
    const locked = document.pointerLockElement === dom || mouse.locked;
    if (!locked && !mouse.dragging) return;
    const s = 0.0022;
    state.yaw -= e.movementX * s;
    state.pitch -= e.movementY * s;
    state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
  }
  window.addEventListener('mousemove', onMouseMove);
  const onMouseDown = () => { if (document.pointerLockElement !== dom) mouse.dragging = true; };
  const onMouseUp = () => { mouse.dragging = false; };
  dom.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function toggleLantern(on = !state.lanternOn) {
    if (on && state.oil <= 0.5) { audio?.chime(180, 0.05); return; }
    state.lanternOn = on;
    audio?.lantern(on);
  }

  /* ── per-frame ── */
  const fwd = new THREE.Vector3();
  const tmpSafe = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const probe = new THREE.Vector3();

  function update(dt, ctx = {}) {
    const { waterLevel = 0, time = 0, danger = 0, allowLook = true } = ctx;
    const frozen = state.frozen || !state.enabled;

    // ── look ──
    if (allowLook) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y = state.yaw;
      camera.rotation.x = state.pitch;
    }

    // ── desired horizontal motion ──
    fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    desired.set(0, 0, 0);
    if (!frozen) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) desired.add(fwd);
      if (keys.has('KeyS') || keys.has('ArrowDown')) desired.sub(fwd);
      if (keys.has('KeyD')) desired.add(right);
      if (keys.has('KeyA')) desired.sub(right);
      // arrows steer too, so the game is playable without a mouse at all
      const turn = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      if (turn) state.yaw += turn * 1.9 * dt;
    }
    const wantSpeed = desired.lengthSq() > 0;
    if (wantSpeed) desired.normalize();

    const groundY = city.groundHeight(state.pos.x, state.pos.z);
    const depth = Math.max(0, waterLevel - groundY);           // how deep the water is over the floor
    const swimming = depth > 1.35 && state.pos.y - waterLevel < 1.0;
    const wading = depth > 0.12 && !swimming;
    state.groundY = groundY;
    state.depth = Math.max(0, waterLevel - (state.pos.y - EYE));  // how deep it is at your feet
    state.diving = !!keys.has('KeyC') && swimming;
    state.swimming = swimming;

    const running = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !swimming && depth < 0.5;
    let base = running ? 5.0 : swimming ? 2.1 : 3.05;
    if (wading) base *= 1 - Math.min(0.62, depth * 0.42);
    if (frozen) base = 0;

    // ── accelerate ──
    const accel = swimming ? 6 : state.onGround ? 22 : 8;
    const target = desired.clone().multiplyScalar(base);
    state.vel.x += (target.x - state.vel.x) * Math.min(1, accel * dt);
    state.vel.z += (target.z - state.vel.z) * Math.min(1, accel * dt);
    if (!wantSpeed) {
      const drag = state.onGround ? 12 : 1.6;
      state.vel.x -= state.vel.x * Math.min(1, drag * dt);
      state.vel.z -= state.vel.z * Math.min(1, drag * dt);
    }

    // ── mantling: hauling yourself out of the water onto a ledge ──
    if (state.mantleT > 0) {
      state.mantleT -= dt;
      const k = 1 - Math.max(0, state.mantleT) / state.mantleDur;
      const e = k * k * (3 - 2 * k);
      state.pos.lerpVectors(state.mantleFrom, state.mantleTo, e);
      state.pos.y += Math.sin(e * Math.PI) * 0.22;
      state.vel.set(0, 0, 0);
      if (state.mantleT <= 0) state.pos.copy(state.mantleTo);
      camera.position.copy(state.pos);
      camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
      return;
    }
    if (swimming && !frozen && keys.has('Space') && state.mantleCooldown <= 0) {
      const probeX = state.pos.x + fwd.x * 1.05;
      const probeZ = state.pos.z + fwd.z * 1.05;
      const ledge = city.groundHeight(probeX, probeZ);
      const above = ledge - waterLevel;
      if (ledge > city.DEEP + 0.01 && above > 0.15 && above < MANTLE_REACH) {
        state.mantleDur = 0.45;
        state.mantleT = state.mantleDur;
        state.mantleFrom = state.pos.clone();
        state.mantleTo = new THREE.Vector3(probeX, ledge + EYE, probeZ);
        state.mantleCooldown = 0.8;
        audio?.footstep(false, 0.5);
        audio?.splash(0.35);
      }
    }
    state.mantleCooldown = Math.max(0, (state.mantleCooldown || 0) - dt);

    // ── vertical ──
    if (swimming) {
      const dive = keys.has('KeyC') && !frozen;
      const float = waterLevel + (dive ? -1.45 : 0.12);
      state.vel.y += ((float - state.pos.y) * 5.5 - state.vel.y * 3.2) * dt;
      if (keys.has('Space') && !frozen && !dive) state.vel.y += 3.6 * dt;
    } else {
      state.vel.y -= 19 * dt;
    }

    // ── integrate: the height field and the buildings are both walls ──
    // Terrain has no side faces, so a plate that steps up more than the player can
    // climb has to block horizontal movement — otherwise you walk inside the city.
    const feetY = state.pos.y - EYE;
    // swimming, "too high to reach" has to be measured from the waterline, not
    // from the bottom you are floating over
    const stepLimit = (swimming || state.mantleT > 0) ? (waterLevel + SWIM_WALL - feetY) : STEP_UP;
    const wantedX = state.pos.x + state.vel.x * dt;
    const wantedZ = state.pos.z + state.vel.z * dt;
    let nx = state.pos.x, nz = state.pos.z;
    if (!blockedAt(wantedX, wantedZ, feetY, stepLimit)) {
      nx = wantedX; nz = wantedZ;
    } else if (!blockedAt(wantedX, state.pos.z, feetY, stepLimit)) {
      nx = wantedX; state.vel.z = 0;                     // slide along the wall
    } else if (!blockedAt(state.pos.x, wantedZ, feetY, stepLimit)) {
      nz = wantedZ; state.vel.x = 0;
    } else {
      state.vel.x = 0; state.vel.z = 0;
    }
    probe.set(nx, state.pos.y + state.vel.y * dt, nz);
    const hits = resolveCollisions(probe, state.vel);
    state.pos.copy(probe);
    state.blocked = hits > 0;

    // Wedge net. Touching a wall is normal (the solver leaves us just outside it),
    // but being *inside* geometry for a couple of seconds means the city's
    // overlapping boxes are fighting over us — go back to the last clean spot.
    if (resolveCollisions.depth > 1.0) {
      state.stuckFor += dt;
      if (state.stuckFor > 2.0) {
        state.pos.copy(state.safePos);
        state.vel.set(0, 0, 0);
        state.stuckFor = 0;
        audio?.splash?.(0.3);
      }
    } else {
      state.stuckFor = 0;
      state.safeTimer -= dt;
      if (state.safeTimer <= 0) {
        state.safeTimer = 0.4;
        if (resolveCollisions(tmpSafe.copy(state.pos), null) === 0) state.safePos.copy(state.pos);
      }
    }

    // ground / step-up
    const gNow = city.groundHeight(state.pos.x, state.pos.z);
    state.onGround = false;
    const feet = state.pos.y - EYE;
    const rise = gNow - feet;
    if (gNow > city.DEEP + 0.01 && swimming) {
      // floating: the bottom can shove you up out of it, but it must never drag
      // you back down — that is how you end up standing on a drowned city floor
      if (gNow > feet) {
        state.pos.y = gNow + EYE;
        state.vel.y = Math.max(0, state.vel.y);
      }
      state.onGround = false;
    } else if (gNow > city.DEEP + 0.01) {
      if (rise <= FLOOR_SNAP) {
        // walked into the floor
        state.pos.y = gNow + EYE;
        if (state.vel.y < 0) state.vel.y = 0;
        state.onGround = true;
      } else if (rise <= STEP_UP && state.vel.y <= 0.6) {
        // a step, a kerb, a stair — climb it smoothly
        state.pos.y += Math.min(rise, dt * 6.2);
        state.vel.y = Math.max(0, state.vel.y);
        state.onGround = true;
      }
    }
    if (!frozen && state.onGround && keys.has('Space') && !swimming) {
      state.vel.y = 5.4;
      state.onGround = false;
      audio?.footstep(false, 0.3);
    }

    // never leave the fog
    const r = Math.hypot(state.pos.x, state.pos.z);
    if (r > 178) {
      const k = (r - 178) / 12;
      state.pos.x -= (state.pos.x / r) * k * 26 * dt;
      state.pos.z -= (state.pos.z / r) * k * 26 * dt;
      ctx.onBoundary?.(k);
    }
    if (state.pos.y < -8) { state.pos.y = -8; state.vel.y = 0; }

    // ── water feel ──
    state.submerged = state.pos.y < waterLevel - 0.12;
    const entering = swimming !== state._wasSwimming;
    if (entering && swimming) { audio?.splash(0.8); onSwim?.(state.pos); }
    state._wasSwimming = swimming;

    // ── footsteps, ripples, wake ──
    const speed = Math.hypot(state.vel.x, state.vel.z);
    state.speed = speed;
    const subDepth = Math.max(0, waterLevel - (state.pos.y - EYE));
    if (state.onGround && speed > 0.6 && !frozen) {
      state.stepAccum += speed * dt;
      const stride = running ? 2.5 : 1.95;
      if (state.stepAccum > stride) {
        state.stepAccum = 0;
        const inWater = subDepth > 0.12;
        audio?.footstep(inWater, Math.min(1, speed / 4));
        onFootstep?.(state.pos, inWater, speed);
      }
    }
    // a wake while swimming / wading fast
    state.rippleTimer -= dt;
    if (waterLevel - state.pos.y > -1.2 && state.rippleTimer <= 0) {
      state.rippleTimer = swimming ? 0.42 : 0.75;
      const strength = 0.35 + Math.min(0.72, speed * 0.16);
      onFootstep?.(state.pos, true, speed, strength);
    }
    if (speed > 0.4 && Math.sin(time * 3.1) * speed > 0.2) state.bob += dt * speed * 2.2;

    // ── camera place ──
    const bobY = Math.sin(state.bob * 2.4) * (state.onGround ? Math.min(0.055, speed * 0.015) : 0);
    const bobX = Math.cos(state.bob * 1.2) * (state.onGround ? Math.min(0.035, speed * 0.01) : 0);
    const swimBob = state.swimming ? Math.sin(time * 1.4) * 0.055 : 0;
    camera.position.set(
      state.pos.x,
      state.pos.y + bobY + swimBob,
      state.pos.z
    );
    camera.position.x += right.x * bobX;
    camera.position.z += right.z * bobX;
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 1.4);
      state.shakeV.set(
        (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)
      ).multiplyScalar(state.shake * 0.28);
      camera.position.add(state.shakeV);
    }
    camera.rotation.z = state.swimming ? Math.sin(time * 0.9) * 0.014 : 0;

    // ── lantern ──
    if (state.lanternOn) {
      state.oil -= dt * 3.4;
      if (state.oil <= 0) { state.oil = 0; toggleLantern(false); }
    }
    const flicker = 0.86 + Math.sin(time * 9.1) * 0.06 + Math.sin(time * 21.7) * 0.04;
    const lTarget = state.lanternOn ? 26 * flicker : 0;
    lantern.intensity += (lTarget - lantern.intensity) * Math.min(1, dt * 6);
    lanternGlow.intensity = lantern.intensity * 0.16;
    state.breath = 0.5 + 0.5 * Math.sin(time * 0.7 + Math.sin(time * 0.23) * 2);
    void danger;
  }

  return {
    state, lantern, addCollider, colliders, update, toggleLantern,
    get position() { return state.pos; },
    get oil() { return state.oil; },
    setOil(v) { state.oil = Math.max(0, Math.min(100, v)); },
    addShake(a) { state.shake = Math.min(1.6, state.shake + a); },
    setEnabled(on) { state.enabled = on; if (!on) { keys.clear(); } },
    freeze(on) { state.frozen = on; if (on) keys.clear(); },
    dispose() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mousedown', onMouseDown);
    },
  };
}
