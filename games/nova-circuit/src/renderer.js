// WebGL renderer: owns the three.js context, builds a world per track, places
// ships, drives chase cameras (one per viewport) and turns sim events into spectacle.
import { buildWorld } from './world.js';
import { buildShip } from './shipmodel.js';
import { Particles, Rings, Projectiles, SpeedDust, Post } from './fx.js';
import { LIVERIES, C } from './sim.js';

const THREE = window.THREE;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

const col3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

class CamRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.6, 9000);
    this.pos = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.look = new THREE.Vector3();
    this.x = 0; this.h = 6; this.fov = 72; this.shake = 0; this.roll = 0;
    this.init = false;
    this.mode = 'chase';
    this.modeT = 0;
    this.dust = new SpeedDust();
    this.camera.add(this.dust.mesh);
    this.flash = [0, 0, 0, 0];
    this.radial = 0;
    this.lastDist = 0;
    this.killcam = 0;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
    this.gl.autoClear = false;
    this.gl.setClearColor(0x000000, 1);
    this.quality = 2;
    this.pixelRatio = 1;
    this.post = new Post(this.gl);
    this.rigs = [];
    this.world = null;
    this.race = null;
    this.shipMeshes = [];
    this.time = 0;
    this._v = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this.size = { w: 1, h: 1 };
    this.particles = null;
  }

  setQuality(q) {
    this.quality = q;
    this.applySize();
  }

  resize(w, h) {
    this.size = { w, h };
    this.applySize();
  }

  applySize() {
    const dpr = window.devicePixelRatio || 1;
    this.pixelRatio = [0.6, 0.85, Math.min(dpr, 1.6)][this.quality] ?? 1;
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(this.size.w, this.size.h, false);
    this.canvas.style.width = this.size.w + 'px';
    this.canvas.style.height = this.size.h + 'px';
  }

  /** Build the world for a track (cached by id + quality). */
  loadTrack(track) {
    if (this.world && this.world.track.id === track.id && this.worldQuality === this.quality) return;
    if (this.world) this.world.dispose();
    this.world = buildWorld(track, this.quality >= 1 ? 1 : 0.55);
    this.worldQuality = this.quality;
    const scene = this.world.scene;
    this.particles = new Particles(5500);
    scene.add(this.particles.points);
    this.rings = new Rings(scene);
    this.projectiles = new Projectiles(scene);
    this.shipMeshes = [];
    this.race = null;
  }

  attachRace(race) {
    this.loadTrack(race.track);
    const scene = this.world.scene;
    for (const m of this.shipMeshes) scene.remove(m.root);
    this.shipMeshes = race.ships.map((s) => {
      const root = buildShip(s.typeId, s.livery);
      scene.add(root);
      const under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: root.userData.under.material.map, color: root.userData.livery.glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
      under.renderOrder = 6;
      scene.add(under);
      return { root, under, prevNozzle: null, ship: s };
    });
    this.race = race;
    this.rigs.forEach((r) => (r.init = false));
    this.eventsPending = [];
  }

  worldPos(dist, x, h, out = new THREE.Vector3()) {
    const f = this.race.track.sample(dist);
    return out.set(f.P[0] + f.R[0] * x + f.U[0] * h, f.P[1] + f.R[1] * x + f.U[1] * h, f.P[2] + f.R[2] * x + f.U[2] * h);
  }

  rigFor(i) {
    while (this.rigs.length <= i) this.rigs.push(new CamRig());
    return this.rigs[i];
  }

  // ----- camera --------------------------------------------------------------
  updateCamera(rig, view, dt) {
    const race = this.race;
    const tr = race.track;
    const ship = view.ship;
    const sp = ship.vs;
    const boost = ship.boosting ? 1 : 0;
    rig.boostSmooth = (rig.boostSmooth || 0) + (boost - (rig.boostSmooth || 0)) * Math.min(1, dt * 4);
    rig.spd = (rig.spd || 0) + (sp - (rig.spd || 0)) * Math.min(1, dt * 5);
    const k = (v) => 1 - Math.exp(-dt * v);
    let camDist, camX, camH, lookDist, lookX, lookH;
    const sf = clamp((rig.spd - 150) / 320, 0, 1);
    const mode = view.cam || 'chase';
    const f = tr.sample(ship.dist);
    if (mode === 'chase') {
      const back = 15.5 + sf * 4 + rig.boostSmooth * 6;
      camDist = ship.dist - back;
      camX = ship.x * 0.82;
      camH = 5.3 + ship.h * 0.55 + rig.boostSmooth * 0.5;
      lookDist = ship.dist + 26;
      lookX = ship.x * 0.9;
      lookH = 2.2 + ship.h * 0.5;
    } else if (mode === 'nose') {
      camDist = ship.dist + 34 + sf * 10;
      camX = ship.x * 0.4 + Math.sin(this.time * 0.4) * 8;
      camH = 6 + ship.h * 0.6;
      lookDist = ship.dist; lookX = ship.x; lookH = ship.h + 1.5;
    } else if (mode === 'side') {
      camDist = ship.dist + 14 + Math.sin(this.time * 0.3) * 20;
      camX = (f.w * 0.5 + 16) * (Math.sin(this.time * 0.07) > 0 ? 1 : -1);
      camH = 8 + ship.h * 0.6;
      lookDist = ship.dist; lookX = ship.x; lookH = ship.h + 1;
    } else { // heli
      camDist = ship.dist - 60;
      camX = ship.x * 0.5 + 40;
      camH = 40 + sf * 20;
      lookDist = ship.dist + 25; lookX = ship.x; lookH = ship.h;
    }
    if (!rig.init) { rig.x = camX; rig.h = camH; rig.init = true; rig.up.set(...f.U); rig.look.set(0, 0, 0); rig.lookInit = false; }
    const lagX = mode === 'chase' ? 9 : 30;
    rig.x += (camX - rig.x) * k(lagX);
    rig.h += (camH - rig.h) * k(mode === 'chase' ? 8 : 30);
    const cp = this.worldPos(camDist, rig.x, rig.h);
    const fc = tr.sample(camDist);
    rig.up.lerp(this._v.set(...fc.U), k(mode === 'chase' ? 5 : 20)).normalize();
    const target = this.worldPos(lookDist, lookX, lookH, new THREE.Vector3());
    // shake
    rig.shake = Math.max(0, rig.shake - dt * 2.4);
    const sh = rig.shake + rig.boostSmooth * 0.08 + sf * 0.04;
    const sx = (Math.random() - 0.5) * sh * 1.1, sy = (Math.random() - 0.5) * sh * 1.1;
    rig.pos.copy(cp);
    const cam = rig.camera;
    cam.position.copy(cp);
    cam.up.copy(rig.up);
    cam.lookAt(target);
    cam.translateX(sx); cam.translateY(sy);
    // roll with the ship
    rig.roll += ((mode === 'chase' ? ship.bank * -0.35 : 0) - rig.roll) * k(6);
    cam.rotateZ(rig.roll + (Math.random() - 0.5) * sh * 0.02);
    const wantFov = (view.fovBase || 70) + sf * 13 + rig.boostSmooth * 16 + (ship.padBoost > 0 ? 6 : 0);
    rig.fov += (wantFov - rig.fov) * k(6);
    cam.fov = rig.fov;
    cam.updateProjectionMatrix();
    rig.dust.update(dt, rig.spd, rig.boostSmooth, view.dustColor);
    rig.radial = rig.boostSmooth * 0.9 + sf * 0.18;
    // flash decay
    rig.flash[3] = Math.max(0, rig.flash[3] - dt * 2.2);
  }

  addShake(ship, amt) {
    this.views?.forEach((v, i) => {
      const r = this.rigs[i];
      if (!r) return;
      if (v.ship === ship) r.shake = Math.min(1.8, r.shake + amt);
    });
  }
  addFlash(ship, r, g, b, a) {
    this.views?.forEach((v, i) => {
      const rig = this.rigs[i];
      if (rig && v.ship === ship) { rig.flash[0] = r; rig.flash[1] = g; rig.flash[2] = b; rig.flash[3] = Math.max(rig.flash[3], a); }
    });
  }
  shakeNear(dist, amt, range = 260) {
    this.views?.forEach((v, i) => {
      const rig = this.rigs[i];
      if (!rig) return;
      const d = Math.abs(((dist - v.ship.dist + this.race.track.length * 1.5) % this.race.track.length) - this.race.track.length / 2);
      const fall = clamp(1 - d / range, 0, 1);
      rig.shake = Math.min(1.8, rig.shake + amt * fall);
    });
  }

  // ----- event-driven effects ------------------------------------------------
  burst(pos, n, speed, life, s0, s1, color, a = 1, drag = 1.5, dirBias = null) {
    const p = this.particles;
    const [r, g, b] = Array.isArray(color) ? color : col3(color);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.283, rr = Math.sqrt(1 - u * u);
      const sp = speed * (0.25 + Math.random() * 0.75);
      let vx = rr * Math.cos(th) * sp, vy = u * sp, vz = rr * Math.sin(th) * sp;
      if (dirBias) { vx += dirBias.x; vy += dirBias.y; vz += dirBias.z; }
      p.emit(pos.x, pos.y, pos.z, vx, vy, vz, life * (0.5 + Math.random() * 0.7), s0, s1, r, g, b, a, drag);
    }
  }

  explosion(pos, normal, big, bias) {
    this.burst(pos, big ? 90 : 36, big ? 120 : 70, big ? 1.1 : 0.7, big ? 5 : 3, 0.5, [1, 0.85, 0.45], 1, 1.8, bias);
    this.burst(pos, big ? 60 : 22, big ? 70 : 40, big ? 1.5 : 0.9, big ? 9 : 5, 14, [1, 0.38, 0.1], 0.8, 2.2, bias);
    this.burst(pos, big ? 40 : 10, big ? 160 : 90, 0.6, 1.2, 0.2, [1, 1, 1], 1, 0.6, bias);
    this.rings.spawn(pos, normal, '#ffd9a0', big ? 55 : 24, big ? 0.55 : 0.35);
    if (big) this.rings.spawn(pos, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), '#ff7a3a', 40, 0.7);
  }

  handleEvents(events) {
    const race = this.race;
    if (!race || !this.world) return;
    const tr = race.track;
    for (const e of events) {
      switch (e.type) {
        case 'laser': {
          const s = e.ship;
          const p = this.worldPos(e.bullet.dist, e.bullet.x, e.bullet.h);
          this.burst(p, 2, 8, 0.12, 1.2, 0.2, LIVERIES[s.livery % LIVERIES.length].glow, 1, 4);
          break;
        }
        case 'spark': {
          const p = this.worldPos(e.dist, e.x, e.h);
          this.burst(p, 8, 40, 0.3, 1.2, 0.1, [1, 0.9, 0.6], 1, 3);
          break;
        }
        case 'impact': break;
        case 'damage': {
          const s = e.ship;
          if (e.kind === 'wall') break;
          this.addShake(s, e.dmg > 20 ? 1.0 : 0.25);
          if (e.dmg > 20) this.addFlash(s, 1, 0.25, 0.1, 0.45);
          break;
        }
        case 'wall': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x + e.side * 2.4, s.h);
          this.burst(p, 18, 60, 0.45, 1.4, 0.1, [1, 0.7, 0.3], 1, 2.5);
          this.burst(p, 6, 30, 0.6, 2.4, 0.5, [1, 0.4, 0.15], 0.8, 2);
          this.addShake(s, 0.35);
          break;
        }
        case 'land': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, 0.5);
          this.burst(p, 14, 40, 0.5, 2.5, 6, col3(this.world.art.palette.glow), 0.6, 2.5);
          this.rings.spawn(p, new THREE.Vector3(...tr.sample(s.dist).U), this.world.art.palette.glow, 12, 0.35);
          this.addShake(s, clamp(e.impact / 120, 0.1, 0.8));
          break;
        }
        case 'explode': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, s.h);
          const f = tr.sample(s.dist);
          const T = new THREE.Vector3(...f.T);
          this.explosion(p, T, true, T.clone().multiplyScalar(Math.max(s.vs, 50) * 0.6));
          this.shakeNear(s.dist, 1.0, 300);
          this.addFlash(s, 1, 0.9, 0.6, 0.85);
          break;
        }
        case 'blast': {
          const p = this.worldPos(e.dist, e.x, e.h);
          this.explosion(p, new THREE.Vector3(...tr.sample(e.dist).T), e.big, null);
          this.shakeNear(e.dist, e.big ? 0.5 : 0.2, 150);
          break;
        }
        case 'pickup': {
          const s = e.ship;
          const f = tr.sample(e.pad.s);
          const x = e.pad.x * (f.w / 2 - 6);
          const p = this.worldPos(e.pad.s, x, 5);
          this.burst(p, 26, 45, 0.7, 2.2, 0.2, [0.8, 1, 1], 1, 2);
          this.rings.spawn(p, new THREE.Vector3(...f.T), '#ffffff', 16, 0.45);
          break;
        }
        case 'boostPad': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, 2);
          this.rings.spawn(p, new THREE.Vector3(...tr.sample(s.dist).T), this.world.art.palette.accent, 26, 0.5);
          this.addShake(s, 0.35);
          this.addFlash(s, 0.5, 0.8, 1, 0.25);
          break;
        }
        case 'jumpPad': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, 2);
          this.rings.spawn(p, new THREE.Vector3(...tr.sample(s.dist).U), '#ffffff', 30, 0.5);
          this.burst(p, 24, 70, 0.6, 2.5, 0.3, [1, 1, 1], 1, 2);
          this.addShake(s, 0.5);
          break;
        }
        case 'emp': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, s.h);
          const f = tr.sample(s.dist);
          this.rings.spawn(p, new THREE.Vector3(...f.T), '#6ee7ff', 190, 0.7);
          this.rings.spawn(p, new THREE.Vector3(...f.U), '#6ee7ff', 190, 0.8);
          this.rings.spawn(p, new THREE.Vector3(...f.R), '#b8f4ff', 150, 0.6);
          this.addFlash(s, 0.4, 0.9, 1, 0.5);
          this.shakeNear(s.dist, 0.8, 250);
          break;
        }
        case 'respawn': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, s.h);
          this.rings.spawn(p, new THREE.Vector3(...tr.sample(s.dist).T), '#9fe8ff', 20, 0.6);
          break;
        }
        case 'bump': {
          const p = this.worldPos(e.dist, (e.a.x + e.b.x) / 2, (e.a.h + e.b.h) / 2);
          this.burst(p, 14, 50, 0.4, 1.5, 0.1, [1, 0.8, 0.5], 1, 2);
          this.addShake(e.a, 0.35); this.addShake(e.b, 0.35);
          break;
        }
        case 'dodge': {
          const s = e.ship;
          const p = this.worldPos(s.dist, s.x, s.h);
          this.burst(p, 18, 50, 0.35, 1.5, 0.2, col3(LIVERIES[s.livery % LIVERIES.length].glow), 1, 3);
          break;
        }
        case 'overdrive': {
          const s = e.ship;
          this.addFlash(s, 1, 0.9, 0.3, 0.4);
          break;
        }
        case 'launch': {
          if (e.perfect) {
            const s = e.ship;
            const p = this.worldPos(s.dist - 4, s.x, s.h);
            this.rings.spawn(p, new THREE.Vector3(...tr.sample(s.dist).T), '#ffe28a', 30, 0.6);
            this.addShake(s, 0.8);
          }
          break;
        }
        default: break;
      }
    }
  }

  // ----- frame ---------------------------------------------------------------
  /**
   * @param {number} dt
   * @param {Race} race
   * @param {Array} views [{ship, rect:{x,y,w,h}, cam?, fovBase?}] rect in CSS px (y from top)
   */
  render(dt, race, views, opts = {}) {
    if (!this.world || this.race !== race) this.attachRace(race);
    this.time += dt;
    this.views = views;
    const world = this.world;
    const tr = race.track;
    const time = this.time;

    // ships
    for (let i = 0; i < this.shipMeshes.length; i++) {
      const sm = this.shipMeshes[i];
      const s = sm.ship;
      const f = tr.sample(s.dist);
      const bob = s.grounded ? Math.sin(time * 3 + i * 1.7) * 0.18 : 0;
      this._m.makeBasis(this._v.set(...f.R), new THREE.Vector3(...f.U), new THREE.Vector3(-f.T[0], -f.T[1], -f.T[2]));
      sm.root.quaternion.setFromRotationMatrix(this._m);
      sm.root.position.set(f.P[0] + f.R[0] * s.x + f.U[0] * (s.h + bob), f.P[1] + f.R[1] * s.x + f.U[1] * (s.h + bob), f.P[2] + f.R[2] * s.x + f.U[2] * (s.h + bob));
      sm.root.userData.model.rotation.set(s.pitchVis, -s.yawVis, s.bank + s.spin, 'YXZ');
      sm.root.userData.model.updateMatrixWorld(true);
      sm.root.updateMatrixWorld(true);
      const blink = s.invuln > 0 && s.alive && Math.floor(time * 14) % 2 === 0 && s.invuln < 2.6 && !s.shield;
      sm.root.visible = s.alive && !blink;
      sm.under.visible = s.alive;
      sm.root.userData.setLook(s, time);
      // glow decal on the track surface
      const hh = Math.max(0, s.h - C.H0);
      sm.under.position.set(f.P[0] + f.R[0] * s.x + f.U[0] * 0.18, f.P[1] + f.R[1] * s.x + f.U[1] * 0.18, f.P[2] + f.R[2] * s.x + f.U[2] * 0.18);
      this._m.makeBasis(new THREE.Vector3(...f.R), new THREE.Vector3(...f.T), new THREE.Vector3(...f.U));
      sm.under.quaternion.setFromRotationMatrix(this._m);
      const gs = 9 + hh * 0.12;
      sm.under.scale.set(gs, gs * 1.6, 1);
      sm.under.material.opacity = 0.65 / (1 + hh * 0.07);

      // engine trails
      if (s.alive && race.state !== 'countdown' || (s.alive && race.state === 'countdown')) {
        const th = race.state === 'countdown' ? 0.4 : 1;
        const lv = LIVERIES[s.livery % LIVERIES.length];
        const [cr, cg, cb] = col3(s.boosting ? '#9fd8ff' : lv.glow);
        const nz = sm.root.userData.nozzles;
        const cur = nz.map((n) => sm.root.userData.model.localToWorld(n.clone()));
        const prev = sm.prevNozzle;
        const reps = s.boosting ? 3 : 1;
        for (let k = 0; k < cur.length; k++) {
          for (let r = 0; r < reps; r++) {
            const t = prev ? (r + Math.random()) / reps : 1;
            const p = prev ? prev[k].clone().lerp(cur[k], t) : cur[k];
            const sz = (s.boosting ? 1.5 : 0.9) * (s.type.id === 'bulwark' ? 1.1 : 1);
            this.particles.emit(p.x + (Math.random() - 0.5) * 0.3, p.y + (Math.random() - 0.5) * 0.3, p.z + (Math.random() - 0.5) * 0.3, 0, 0, 0, s.boosting ? 0.55 : 0.32, sz, 0.1, cr, cg, cb, 0.5 * th, 1);
          }
        }
        if (s.boosting && Math.random() < 0.6) {
          const p = cur[0].clone().lerp(cur[cur.length - 1], Math.random());
          this.particles.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0.35, 0.5, 0.05, 1, 1, 1, 0.9, 2);
        }
        if (s.hp < s.hpMax * 0.4 && Math.random() < 0.7) {
          const p = cur[0];
          this.particles.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6, 0.9, 1.2, 3.2, 1, 0.5, 0.15, 0.6, 1.5);
        }
        sm.prevNozzle = cur;
      } else sm.prevNozzle = null;
    }

    // missiles: trails
    for (const m of race.missiles) {
      const p = this.worldPos(m.dist, m.x, m.h);
      this.particles.emit(p.x, p.y, p.z, 0, 0, 0, 0.5, 1.4, 3.2, 1, 0.62, 0.2, 0.9, 2);
      this.particles.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0.9, 1.5, 4.5, 0.75, 0.8, 0.9, 0.4, 1);
    }

    this.particles.update(dt);
    this.rings.update(dt);
    world.update(time, this.rigs[0]?.camera || { position: new THREE.Vector3(), far: 9000 }, 700);

    // viewports
    const gl = this.gl;
    const pr = this.pixelRatio;
    gl.setScissorTest(true);
    const H = this.size.h;
    views.forEach((v, i) => {
      const rig = this.rigFor(i);
      rig.camera.aspect = v.rect.w / v.rect.h;
      if (v.cam === 'free') { /* handled by caller */ } else this.updateCamera(rig, v, dt);
      const cam = rig.camera;
      const rect = v.rect;
      const gy = H - rect.y - rect.h;
      gl.setViewport(rect.x, gy, rect.w, rect.h);
      gl.setScissor(rect.x, gy, rect.w, rect.h);
      world.update(time, cam, rect.h * 0.5 / Math.tan((cam.fov * Math.PI) / 360));
      this.particles.mat.uniforms.uScale.value = (rect.h * pr) / (2 * Math.tan((cam.fov * Math.PI) / 360)) * 0.5;
      // ship hidden if it's the camera's own ship and dead? keep.
      world.updatePads(race, v.ship ? v.ship.idx : -1, time);
      this.projectiles.update(race, world, time, cam.quaternion);
      cam.updateMatrixWorld(true);
      const lowFx = this.quality === 0;
      const fx = {
        radial: lowFx ? 0 : rig.radial * (v.ship.alive ? 1 : 0.2),
        aberr: 0.0012 + rig.boostSmooth * 0.0016,
        flash: rig.flash,
        time,
        bloom: opts.bloom ?? (lowFx ? 0.5 : 0.7),
        msaa: this.quality >= 2,
        vignette: 0.5 + (v.ship.hp < v.ship.hpMax * 0.3 && v.ship.alive ? 0.35 : 0),
      };
      this.post.render(world.scene, cam, fx, { w: rect.w * pr, h: rect.h * pr });
    });
    gl.setScissorTest(false);
  }

  /** Project a world position to CSS pixels for a given view index. Returns null if behind the camera. */
  project(viewIdx, world) {
    const v = this.views?.[viewIdx];
    const rig = this.rigs[viewIdx];
    if (!v || !rig) return null;
    const p = world.clone().project(rig.camera);
    if (p.z > 1 || p.z < -1) return null;
    return { x: v.rect.x + (p.x * 0.5 + 0.5) * v.rect.w, y: v.rect.y + (1 - (p.y * 0.5 + 0.5)) * v.rect.h, z: p.z, lx: (p.x * 0.5 + 0.5) * v.rect.w, ly: (1 - (p.y * 0.5 + 0.5)) * v.rect.h };
  }
}
