// ─────────────────────────────────────────────────────────────────────────────
//  Vaelune, built from nothing but arithmetic. Six districts, one drowned plaza,
//  and a ground-height field the player walks on.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRNG } from './rng.js';
import {
  plasterMaps, stoneMaps, darkStoneMaps, woodMaps, sandMaps,
  windowEmissive, veinEmissive, runeEmissive,
} from './textures.js';
import { DISTRICTS } from './content.js';
import { buildEffects, FURNITURE } from './effects.js';

/* ────────────────────────────── geometry helpers ────────────────────────────── */

/** Scale a primitive's UVs so textures tile at a constant world size. */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
  return geo;
}

function boxGeo(w, h, d, tile = 3.4) {
  const g = new THREE.BoxGeometry(w, h, d);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const uv = g.attributes.uv;
  const set = (face, su, sv) => {
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  };
  set(0, d / tile, h / tile); set(1, d / tile, h / tile);
  set(2, w / tile, d / tile); set(3, w / tile, d / tile);
  set(4, w / tile, h / tile); set(5, w / tile, h / tile);
  uv.needsUpdate = true;
  return g;
}

class Batch {
  constructor(material, tile = 3.4) { this.geos = []; this.material = material; this.tile = tile; }
  add(geo, x = 0, y = 0, z = 0, rotY = 0, rotX = 0, rotZ = 0) {
    // polyhedra come back non-indexed; mergeGeometries() wants them all the same
    if (!geo.index) {
      const n = geo.attributes.position.count;
      const arr = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
      for (let i = 0; i < n; i++) arr[i] = i;
      geo.setIndex(new THREE.BufferAttribute(arr, 1));
    }
    if (rotY) geo.rotateY(rotY);
    if (rotX) geo.rotateX(rotX);
    if (rotZ) geo.rotateZ(rotZ);
    geo.translate(x, y, z);
    this.geos.push(geo);
    return this;
  }
  box(w, h, d, x, y, z, rotY = 0, tile = this.tile) {
    return this.add(boxGeo(w, h, d, tile), x, y + h / 2, z, rotY);
  }
  build(parent, name = 'batch') {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    this.geos.length = 0;
    const mesh = new THREE.Mesh(merged, this.material);
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}

/* ────────────────────────────── main builder ────────────────────────────── */

export function createCity(scene, { seed = 20240410 } = {}) {
  const rng = makeRNG(seed);
  const group = new THREE.Group();
  group.name = 'Vaelune';
  scene.add(group);

  const plates = [];
  const DEEP = -9.5;                                    // off-plate water is this deep
  const plateRect = (x, z, w, d, y, rot = 0) => plates.push({ t: 0, x, z, w, d, y, rot });
  const plateCircle = (x, z, r, y) => plates.push({ t: 1, x, z, r, y });
  const plateRing = (x, z, r0, r1, y) => plates.push({ t: 2, x, z, r0, r1, y });
  const plateRamp = (x, z, w, d, y0, y1, rot = 0, axis = 'x') =>
    plates.push({ t: 3, x, z, w, d, y0, y1, rot, axis });

  /* ── materials ── */
  const M = {};
  const std = (name, opts, maps) => {
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.94, metalness: 0.0,
      color: 0xffffff,
      ...maps, ...opts,
    });
    M[name] = m;
    return m;
  };
  const plasterA = plasterMaps(11, { base: '#7c7367' });
  const plasterB = plasterMaps(12, { base: '#6e6a63', stains: 22 });
  const stoneA = stoneMaps(21, { base: '#4b514e' });
  const stoneB = stoneMaps(22, { base: '#5a5a4f', courses: 6 });
  const darkStone = darkStoneMaps(31, {});
  const wood = woodMaps(41, {});
  const sand = sandMaps(51, {});

  const winTexA = windowEmissive(101, { cols: 4, rows: 4, warmth: 0.4 });
  const winTexB = windowEmissive(102, { cols: 3, rows: 4, warmth: 0.25 });
  const winTexC = windowEmissive(103, { cols: 4, rows: 5, warmth: 0.6 });

  std('plasterA', { map: plasterA.map, normalMap: plasterA.normalMap, roughnessMap: plasterA.roughnessMap, emissiveMap: winTexA, emissive: 0x9ffbe0, emissiveIntensity: 0.0 }, {});
  std('plasterB', { map: plasterB.map, normalMap: plasterB.normalMap, roughnessMap: plasterB.roughnessMap, emissiveMap: winTexB, emissive: 0x8ff0e0, emissiveIntensity: 0.0 }, {});
  std('plasterC', { map: plasterB.map, normalMap: plasterB.normalMap, roughnessMap: plasterB.roughnessMap, emissiveMap: winTexC, emissive: 0xbcae8a, emissiveIntensity: 0.0 }, {});
  std('stone', { map: stoneA.map, normalMap: stoneA.normalMap, roughnessMap: stoneA.roughnessMap }, {});
  std('stoneB', { map: stoneB.map, normalMap: stoneB.normalMap, roughnessMap: stoneB.roughnessMap }, {});
  std('darkStone', { map: darkStone.map, normalMap: darkStone.normalMap, roughnessMap: darkStone.roughnessMap, color: 0x9aa4a2 }, {});
  std('wood', { map: wood.map, normalMap: wood.normalMap, roughness: 0.82 }, {});
  std('sand', { map: sand.map, normalMap: sand.normalMap }, {});
  std('wetStone', { map: darkStone.map, normalMap: darkStone.normalMap, color: 0xb9c6c2, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }, {});
  std('bronze', { color: 0x8a6a3a, roughness: 0.42, metalness: 0.85, emissive: 0x2b1a06 }, {});
  std('bronzeLit', { color: 0xb98b46, roughness: 0.38, metalness: 0.8, emissive: 0x6a4410, emissiveIntensity: 0.6 }, {});

  const veinTex = veinEmissive(61, { hue: 168, sat: 92, light: 60, dens: 14 });
  std('veined', {
    map: stoneA.map, normalMap: stoneA.normalMap, roughnessMap: stoneA.roughnessMap,
    emissiveMap: veinTex, emissive: 0x6dffe0, emissiveIntensity: 0.55,
  }, {});
  const veinDarkTex = veinEmissive(62, { hue: 345, sat: 82, light: 46, dens: 12 });
  std('veinedDark', {
    map: darkStone.map, normalMap: darkStone.normalMap,
    emissiveMap: veinDarkTex, emissive: 0xff4f78, emissiveIntensity: 0.0,
  }, {});
  const runeTex = runeEmissive(63, { hue: 42, count: 110 });
  std('runed', {
    map: stoneB.map, normalMap: stoneB.normalMap,
    emissiveMap: runeTex, emissive: 0xffc27a, emissiveIntensity: 0.35,
  }, {});

  /* ── batches (one merged mesh per material keeps draw calls tiny) ── */
  const B = {
    plasterA: new Batch(M.plasterA), plasterB: new Batch(M.plasterB), plasterC: new Batch(M.plasterC),
    stone: new Batch(M.stone), stoneB: new Batch(M.stoneB), darkStone: new Batch(M.darkStone),
    wood: new Batch(M.wood), sand: new Batch(M.sand), wet: new Batch(M.wetStone, 5),
    bronze: new Batch(M.bronze, 2), runed: new Batch(M.runed, 6), veined: new Batch(M.veined, 5),
    veinedDark: new Batch(M.veinedDark, 5),
  };

  /* ══════════════════════════ generic structures ══════════════════════════ */

  const buildingColliders = [];

  /* The six avenues run from the plaza ring out to each district, and the city is
     entered along them. A procedurally placed house that straddles an avenue walls
     the district off — which is exactly what happened to the market — so every
     building has to prove it is not standing in one. */
  const AVENUE_CLEAR = 5.6;
  function onAvenue(x, z, pad = 0) {
    for (const d of Object.values(DISTRICTS)) {
      const [ax, az] = d.at;
      const len = Math.hypot(ax, az);
      if (!len) continue;
      const ux = ax / len, uz = az / len;
      const along = x * ux + z * uz;
      if (along < 18) continue;                       // still inside the plaza
      const lat = Math.abs(-x * uz + z * ux);
      if (lat < AVENUE_CLEAR + pad && along < len + 8) return true;
    }
    return false;
  }

  function building(x, z, w, h, d, { rot = 0, style = 'stone', broken = 0, roof = 'flat', floors = true } = {}) {
    if (onAvenue(x, z, Math.min(w, d) * 0.5)) return false;
    const base = groundHeight(x, z);
    const y = Math.min(base, 0.6) - 6;              // sink foundations well below the water
    const H = h + (y < 0 ? -y : 0);
    const b = style === 'plaster' ? (rng.chance(0.5) ? B.plasterA : B.plasterB)
      : style === 'plasterC' ? B.plasterC
        : style === 'veined' ? B.veined : B.stone;
    b.box(w, H, d, x, y, z, rot);
    if (roof === 'cornice' || roof === 'flat') {
      B.stone.box(w + 0.7, 0.45, d + 0.7, x, y + H, z, rot, 2.2);
    }
    if (roof === 'hipped') {
      const r = new THREE.CylinderGeometry(0.4, Math.max(w, d) * 0.72, Math.max(3.2, Math.min(w, d) * 0.55), 4, 1);
      r.rotateY(Math.PI / 4 + rot);
      B.stoneB.add(r, x, y + H + r.parameters.height / 2, z);
    }
    if (roof === 'dome') {
      const rad = Math.min(w, d) * 0.55;
      const dome = new THREE.SphereGeometry(rad, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      scaleUV(dome, rad / 3, rad / 3);
      B.stoneB.add(dome, x, y + H, z);
    }
    buildingColliders.push({ x, z, w, d, rot, baseY: y, topY: y + H });
    if (broken > 0) {
      // a bite taken out of the roofline, plus the rubble that fell from it
      const bits = 3 + Math.floor(rng.f() * 4);
      for (let i = 0; i < bits; i++) {
        const r = new THREE.DodecahedronGeometry(rng.range(0.4, 1.4), 0);
        scaleUV(r, 1.4, 1.4);
        B.stone.add(r, x + rng.range(-w, w) * 0.7, Math.min(0.4, groundHeight(x, z)) + rng.range(0, 0.6), z + rng.range(-d, d) * 0.7);
      }
    }
    return { x, z, w, h, d, y, top: y + H };
  }

  function column(x, y, z, h = 6, r = 0.62, { rot = 0, broken = false, cap = true } = {}) {
    const shaft = new THREE.CylinderGeometry(r * 0.86, r, h, 12, 1);
    scaleUV(shaft, 2, h / 3);
    B.stone.add(shaft, x, y + h / 2, z, rot);
    const base = new THREE.CylinderGeometry(r * 1.3, r * 1.4, 0.5, 12);
    scaleUV(base, 2, 1);
    B.stoneB.add(base, x, y + 0.25, z, rot);
    if (cap && !broken) {
      const capG = new THREE.CylinderGeometry(r * 1.35, r * 1.2, 0.6, 12);
      scaleUV(capG, 2, 1);
      B.stoneB.add(capG, x, y + h + 0.3, z, rot);
    }
    if (broken) {
      const rubble = new THREE.DodecahedronGeometry(r * 0.9, 0);
      scaleUV(rubble, 1.5, 1.5);
      B.stone.add(rubble, x + rng.range(-2, 2), y + 0.3, z + rng.range(-2, 2));
      const fallen = new THREE.CylinderGeometry(r * 0.85, r * 0.9, h * rng.range(0.35, 0.7), 10);
      scaleUV(fallen, 2, 2);
      fallen.rotateZ(Math.PI / 2);
      B.stone.add(fallen, x + rng.range(-4, 4), y + r * 0.9, z + rng.range(-4, 4), rng.range(0, 3.14));
    }
  }

  function arch(x, y, z, span = 6, h = 3, t = 0.7, rot = 0) {
    const p = span / 2 + t * 0.5;
    B.stone.box(t, h, t * 1.4, x + Math.cos(rot) * p, y, z - Math.sin(rot) * p, rot);
    B.stone.box(t, h, t * 1.4, x - Math.cos(rot) * p, y, z + Math.sin(rot) * p, rot);
    const arc = new THREE.TorusGeometry(p, t * 0.5, 6, 16, Math.PI);
    scaleUV(arc, 3, 3);
    arc.rotateZ(0);
    B.stoneB.add(arc, x, y + h, z, rot);
  }

  /**
   * Stairs. `yA` is the height at the local -run/2 end, `yB` at the +run/2 end.
   * Local +X maps to world (cos rot, -sin rot); local +Z maps to world (sin rot, cos rot).
   */
  function steps(x, z, w, d, yA, yB, rot = 0, axis = 'z') {
    const n = Math.max(2, Math.round(Math.abs(yB - yA) / 0.18));
    const run = axis === 'z' ? d : w;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const y = yA + (yB - yA) * t;
      const off = (t - 0.5) * run;
      const lx = axis === 'x' ? off : 0;
      const lz = axis === 'z' ? off : 0;
      const px = x + lx * Math.cos(rot) + lz * Math.sin(rot);
      const pz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
      const sw = axis === 'z' ? w : w / n + 0.02;
      const sd = axis === 'z' ? d / n + 0.02 : d;
      B.stoneB.box(sw, 0.26, sd, px, y - 0.22, pz, rot, 2.4);
    }
    plateRamp(x, z, w, d, yA, yB, rot, axis);
  }

  function lampPost(x, y, z, h = 4.2, hue = 168) {
    const post = new THREE.CylinderGeometry(0.09, 0.14, h, 8);
    B.bronze.add(post, x, y + h / 2, z);
    const arm = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6);
    arm.rotateZ(Math.PI / 2);
    B.bronze.add(arm, x, y + h, z);
    return { x, y: y + h - 0.1, z, hue, phase: rng.f() * 6.28 };
  }

  /* ══════════════════════════ 1 · the plaza ══════════════════════════ */
  const plazaGroup = new THREE.Group();
  group.add(plazaGroup);

  const BASIN_R = 9.2, RING_R = 16.5, PLAZA_Y = 0.15, BASIN_Y = -2.6;
  // plaza ring floor
  const ringFloor = new THREE.CylinderGeometry(RING_R, RING_R, 0.5, 48, 1, true);
  B.stoneB.add(ringFloor, 0, PLAZA_Y - 0.25, 0);
  const ringTop = new THREE.RingGeometry(BASIN_R, RING_R, 56, 1);
  ringTop.rotateX(-Math.PI / 2);
  scaleUV(ringTop, 3, 3);
  B.stone.add(ringTop, 0, PLAZA_Y + 0.001, 0);
  plateRing(0, 0, BASIN_R, 14.6, PLAZA_Y);

  // basin: the drowned middle, with a stair down into it
  const basinWall = new THREE.CylinderGeometry(BASIN_R, BASIN_R * 0.96, -BASIN_Y + 0.4, 44, 1, true);
  B.wet.add(basinWall, 0, BASIN_Y + (-BASIN_Y) / 2, 0);
  const basinFloor = new THREE.CircleGeometry(BASIN_R, 44);
  basinFloor.rotateX(-Math.PI / 2);
  scaleUV(basinFloor, 2.5, 2.5);
  B.wet.add(basinFloor, 0, BASIN_Y, 0);
  plateCircle(0, 0, BASIN_R + 0.2, BASIN_Y);
  steps(0, -11.6, 5.0, 4.8, BASIN_Y, PLAZA_Y, Math.PI, 'z'); // down from the ring
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    column(Math.cos(a) * 13.4, PLAZA_Y, Math.sin(a) * 13.4, rng.range(5, 8), 0.7, { broken: rng.chance(0.55) });
  }
  // the monument the plaza is named for: a broken ring of bronze fingers
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const h = rng.range(2.4, 4.4);
    B.bronze.add(
      scaleUV(new THREE.CylinderGeometry(0.16, 0.24, h, 6), 1, 2),
      Math.cos(a) * 3.4, PLAZA_Y + h / 2 - 0.2, Math.sin(a) * 3.4
    );
  }
  // four grand stairs out of the plaza
  for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const r = 17.2;
    steps(Math.cos(ang) * r, Math.sin(ang) * r, 5.5, 6.0, PLAZA_Y, -0.4, Math.PI / 2 - ang, 'z');
  }
  // statue of the Archivist, holding a lamp that never goes out
  const statueBase = B.darkStone.box(2.6, 1.2, 2.6, 0, PLAZA_Y, -12.6);
  const figure = new THREE.CapsuleGeometry(0.7, 2.4, 6, 12);
  scaleUV(figure, 2, 2);
  B.darkStone.add(figure, 0, PLAZA_Y + 1.2 + 2.1, -12.6);
  const head = new THREE.SphereGeometry(0.52, 14, 10);
  scaleUV(head, 2, 2);
  B.darkStone.add(head, 0, PLAZA_Y + 1.2 + 3.7, -12.6);
  const armL = new THREE.CylinderGeometry(0.17, 0.19, 1.9, 8);
  armL.rotateZ(1.1);
  B.darkStone.add(armL, -0.75, PLAZA_Y + 3.6, -12.6);
  void statueBase;

  /* ══════════════════════════ 2 · avenues ══════════════════════════ */
  const R0 = 13.0;   // the avenues start under the plaza rim so the two always meet
  const landings = [];
  function avenue(fromAng, len, { width = 11, y = -0.4 } = {}) {
    const dx = Math.cos(fromAng), dz = Math.sin(fromAng);
    const rot = Math.PI / 2 - fromAng;             // local +Z runs outward along the avenue
    const cx = dx * (R0 + len / 2), cz = dz * (R0 + len / 2);
    B.stoneB.box(width, 0.7, len, cx, y - 0.35, cz, rot, 3);
    plateRect(cx, cz, width, len, y, rot);
    landings.push({ ang: fromAng, endR: R0 + len, width, y });
    // perpendicular in world space = local +X of the rotated frame
    const px = Math.sin(fromAng), pz = -Math.cos(fromAng);
    // kerbs
    for (const s of [-1, 1]) {
      B.stone.box(0.7, 0.5, len, cx + px * (width / 2 + 0.35) * s, y - 0.02, cz + pz * (width / 2 + 0.35) * s, rot, 2);
    }
    // lamps along the kerbs, and ruins pressing in from both sides
    const lamps = [];
    const n = Math.max(2, Math.round(len / 16));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const ax = dx * (R0 + t * len), az = dz * (R0 + t * len);
      for (const s of [-1, 1]) {
        const lx = ax + px * (width / 2 + 1.1) * s;
        const lz = az + pz * (width / 2 + 1.1) * s;
        lamps.push(lampPost(lx, groundHeight(lx, lz), lz, 4.4));
        if (rng.chance(0.6)) {
          const rx = lx + px * rng.range(3, 8) * s + dx * rng.range(-5, 5);
          const rz = lz + pz * rng.range(3, 8) * s + dz * rng.range(-5, 5);
          arch(rx, groundHeight(rx, rz), rz, rng.range(5, 9), rng.range(2.5, 4.5), 0.6, fromAng + rng.range(-0.4, 0.4));
        }
      }
    }
    return lamps;
  }

  const avenueLamps = [];
  const dirTo = (name) => {
    const [x, z] = DISTRICTS[name].at;
    return Math.atan2(z, x);
  };
  avenueLamps.push(...avenue(dirTo('market'), 40, { y: -0.55 }));      // runs level with the market street
  avenueLamps.push(...avenue(dirTo('observatory'), 46));
  avenueLamps.push(...avenue(dirTo('amphitheatre'), 32));
  avenueLamps.push(...avenue(dirTo('temple'), 46));
  avenueLamps.push(...avenue(dirTo('floodgate'), 56));

  /* ══════════════════════════ 3 · market row ══════════════════════════ */
  const [MX, MZ] = DISTRICTS.market.at;
  const marketStalls = [];
  {
    const len = 48, wide = 15;
    B.sand.box(wide, 0.7, len, MX, -1.25, MZ, Math.PI / 2);
    plateRect(MX, MZ, wide, len, -0.55, Math.PI / 2);
    for (const s of [-1, 1]) {
      const rows = 8;
      for (let i = 0; i < rows; i++) {
        const z = MZ - len / 2 + 3 + i * (len - 6) / (rows - 1);
        const inset = wide / 2 + rng.range(3.4, 5.6);
        const x = MX + inset * s;
        const w = rng.range(7, 13), h = Math.min(16, rng.range(5.5, 13) - Math.abs(i - rows / 2) * 0.4), d = rng.range(7, 12);
        const style = rng.chance(0.55) ? 'plaster' : rng.chance(0.4) ? 'plasterC' : 'stone';
        const skip = s < 0 && Math.abs(z - MZ) < 10;      // the avenue enters the market here
        if (!skip && building(x, z, w, h, d, { rot: Math.PI / 2 + rng.range(-0.04, 0.04), style, roof: rng.chance(0.5) ? 'cornice' : 'hipped' }) === false) continue;
        if (rng.chance(0.5)) {
          // arcade in front of the bigger houses
          for (let k = -1; k <= 1; k++) {
            const px = MX + (wide / 2 + 1.2) * s;
            const pz = z + k * 3.6;
            column(px, groundHeight(px, pz), pz, 3.6, 0.42);
          }
          B.stone.box(2.4, 0.6, 12, MX + (wide / 2 + 1.2) * s, groundHeight(MX + (wide / 2 + 1.2) * s, z) + 3.8, z);
        }
      }
    }
    // the row's entry arch
    arch(MX - len / 2 + 2, -0.55, MZ, 13, 4.4, 1.1, Math.PI / 2);

    // stalls that only exist once the market is remembered
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const z = MZ - 17 + i * 4.2 + rng.range(-0.7, 0.7);
      const x = MX + (wide / 2 - 2.2) * side;
      marketStalls.push({ x, z, side, seed: 900 + i, y: groundHeight(x, z) });
    }
  }

  /* ══════════════════════════ 4 · observatory island ══════════════════════════ */
  const [OX, OZ] = DISTRICTS.observatory.at;
  const OBS_Y = 0.42;
  {
    const pond = new THREE.CylinderGeometry(23, 24, 1.2, 40);
    scaleUV(pond, 4, 2);
    B.stoneB.add(pond, OX, OBS_Y - 0.6, OZ);
    plateCircle(OX, OZ, 22, OBS_Y);          // the island floor replaces the ground plate
    plateRing(OX, OZ, 22, 24.4, OBS_Y - 0.15);
    // rock skirt down into the water
    const skirt = new THREE.CylinderGeometry(24, 20, 5.2, 36, 1, true);
    B.wet.add(skirt, OX, OBS_Y - 3.2, OZ);

    // main tower with a broken dome
    const tw = 13, th = 15;
    const tower = new THREE.CylinderGeometry(tw / 2, tw / 2 + 0.8, th, 24);
    scaleUV(tower, 3, th / 3.4);
    B.plasterA.add(tower, OX - 5, OBS_Y + th / 2, OZ - 3);
    const rim = new THREE.CylinderGeometry(tw / 2 + 0.6, tw / 2 + 0.6, 0.7, 24);
    scaleUV(rim, 3, 1);
    B.stoneB.add(rim, OX - 5, OBS_Y + th, OZ - 3);
    const dome = new THREE.SphereGeometry(tw / 2 + 0.2, 24, 14, 0, Math.PI * 1.45, 0, Math.PI * 0.52);
    scaleUV(dome, 3, 3);
    B.bronze.add(dome, OX - 5, OBS_Y + th + 0.35, OZ - 3, 1.1);
    // telescope through the gap
    const scope = new THREE.CylinderGeometry(1.5, 2.2, 11, 14);
    scaleUV(scope, 3, 3);
    scope.rotateZ(0.62); scope.rotateY(0.7);
    B.bronze.add(scope, OX - 3.5, OBS_Y + th + 3.4, OZ - 1.4);
    // two smaller domes
    for (const [dx, dz, r] of [[11, -6, 4.2], [-9, 7, 3.4]]) {
      const bx = OX + dx, bz = OZ + dz;
      const b = new THREE.CylinderGeometry(r, r + 0.4, 4.4, 20);
      scaleUV(b, 3, 1.6);
      B.plasterB.add(b, bx, OBS_Y + 2.2, bz);
      const d = new THREE.SphereGeometry(r + 0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      scaleUV(d, 3, 3);
      B.bronze.add(d, bx, OBS_Y + 4.4, bz);
    }
    // the moon-wall: a great stone circle framing the eclipse
    const wallX = OX + 15, wallZ = OZ + 9;
    B.stone.box(1.6, 11, 22, wallX, OBS_Y, wallZ, -0.5);
    const aperture = new THREE.TorusGeometry(4.4, 0.75, 10, 28);
    scaleUV(aperture, 4, 4);
    B.runed.add(aperture, wallX - 0.2, OBS_Y + 6.4, wallZ, -0.5 + Math.PI / 2, Math.PI / 2);
    steps(OX + 6, OZ + 6, 6, 5, OBS_Y, OBS_Y + 0.5, 0.7, 'z');
  }

  /* ══════════════════════════ 5 · amphitheatre ══════════════════════════ */
  const [AX, AZ] = DISTRICTS.amphitheatre.at;
  const STAGE_Y = -0.9;
  const tiers = [];
  {
    for (let i = 0; i < 6; i++) {
      const r0 = 13 + i * 3.6, r1 = r0 + 3.6;
      const y = STAGE_Y + 0.75 + i * 0.55;
      const ring = new THREE.CylinderGeometry(r1, r1, 0.6, 44, 1, true);
      B.stone.add(ring, AX, y - 0.3, AZ);
      const floor = new THREE.RingGeometry(r0, r1, 44, 1);
      floor.rotateX(-Math.PI / 2);
      scaleUV(floor, 3, 3);
      B.stone.add(floor, AX, y, AZ);
      plateRing(AX, AZ, r0, r1, y);
      tiers.push({ r0, r1, y });
    }
    // outer wall, broken
    const wallH = 13;
    const outer = new THREE.CylinderGeometry(35.6, 36.4, wallH, 48, 1, true, -0.4, Math.PI * 1.62);
    scaleUV(outer, 6, 4);
    B.plasterB.add(outer, AX, STAGE_Y + wallH / 2 + 0.4, AZ);
    // the top rim is a walkway, not a lid over the whole bowl
    plateRing(AX, AZ, 33.9, 36.2, STAGE_Y + 0.75 + 5 * 0.55);

    // stage + scaena (backdrop)
    const stage = new THREE.CylinderGeometry(13, 13.2, 1.2, 40, 1, false, Math.PI * 0.15, Math.PI * 1.2);
    scaleUV(stage, 4, 2);
    B.stoneB.add(stage, AX, STAGE_Y - 0.3, AZ);
    plateCircle(AX, AZ, 13, STAGE_Y);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 0.42 + i * 0.6;
      const px = AX + Math.cos(a + Math.PI) * 10.5, pz = AZ + Math.sin(a + Math.PI) * 10.5;
      const h = 7 + i % 2;
      B.plasterC.box(2.6, h, 2.6, px, STAGE_Y, pz, a);
      arch(px, STAGE_Y + h - 2.2, pz, 3.4, 1.1, 0.5, a);
    }
    const backdrop = new THREE.CylinderGeometry(11.5, 12, 9, 30, 1, true, Math.PI * 1.02, Math.PI * 0.96);
    scaleUV(backdrop, 5, 3);
    B.plasterC.add(backdrop, AX, STAGE_Y + 4.5, AZ);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 1.25 + i * 0.42;
      column(AX + Math.cos(a) * 9, STAGE_Y + 9, AZ + Math.sin(a) * 9, rng.range(2.5, 5), 0.55, { broken: rng.chance(0.6) });
    }
    // fallen seating stones in the flooded aisles
    for (let i = 0; i < 26; i++) {
      const a = rng.f() * Math.PI * 2, r = rng.range(13.5, 34);
      const d = new THREE.DodecahedronGeometry(rng.range(0.3, 1.1), 0);
      scaleUV(d, 1.4, 1.4);
      B.stone.add(d, AX + Math.cos(a) * r, STAGE_Y + 0.9 + rng.range(-0.4, 0.6), AZ + Math.sin(a) * r);
    }
  }

  /* ══════════════════════════ 6 · temple of tides ══════════════════════════ */
  const [TX, TZ] = DISTRICTS.temple.at;
  const templeTiers = [];
  {
    const T = [
      { w: 46, d: 40, y: 0.2 }, { w: 37, d: 32, y: 1.6 }, { w: 27, d: 23, y: 3.0 }, { w: 17, d: 15, y: 4.2 },
    ];
    T.forEach((t, i) => {
      B.darkStone.box(t.w, t.y + 7, t.d, TX, -7, TZ);
      plateRect(TX, TZ, t.w - 1.2, t.d - 1.2, t.y, 0);
      templeTiers.push(t);
      // balustrade
      const bh = 0.85;
      for (const s of [-1, 1]) {
        B.stone.box(t.w + 1.2, bh, 0.7, TX, t.y, TZ + (t.d / 2 + 0.6) * s, 0, 2);
        B.stone.box(0.7, bh, t.d + 1.2, TX + (t.w / 2 + 0.6) * s, t.y, TZ, 0, 2);
      }
      if (i < 3) {
        // The flights must start and finish exactly on the *walkable* plate edges
        // (the plates are inset by the balustrade), or the last step leaves an
        // unclimbable lip and the tier above is unreachable.
        // The flights are as wide as the tier you are climbing *from*, so the
        // whole face is stairs: there is no corner beside them where you can be
        // stopped by a wall you are not allowed to climb.
        const zA = TZ - (t.d - 1.2) / 2;              // this tier's plate edge
        const zB = TZ - (T[i + 1].d - 1.2) / 2;       // the next tier's plate edge
        steps(TX, (zA + zB) / 2, t.w - 1.2, Math.abs(zB - zA) + 0.5, t.y, T[i + 1].y, 0, 'z');
        // and a second flight facing the avenue, because that is the way the city
        // is entered and nobody wants to walk all the way round the temple
        const xA = TX + (t.w - 1.2) / 2;
        const xB = TX + (T[i + 1].w - 1.2) / 2;
        steps((xA + xB) / 2, TZ, xA - xB + 0.5, t.d - 1.2, T[i + 1].y, t.y, 0, 'x');
        for (const sz of [-1, 1]) {
          const lx = TX + (t.w - 1.2) / 2 - 1.5;
          const lz = TZ + sz * 6.2;
          avenueLamps.push(lampPost(lx, groundHeight(lx, lz), lz, 4.2));
        }
      }
    });
    // colonnade on the third tier
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const px = TX + Math.cos(a) * 12.4, pz = TZ + Math.sin(a) * 11.2;
      column(px, 3.0, pz, rng.range(4.5, 6.2), 0.72, { broken: rng.chance(0.35) });
    }
    // shrine with a hooded figure, and the drowned stair beyond it
    const shrine = B.veined;
    shrine.box(9, 6.4, 6, TX, 4.2, TZ);
    const opening = new THREE.TorusGeometry(2.1, 0.5, 8, 20);
    scaleUV(opening, 3, 3);
    B.runed.add(opening, TX, 4.2 + 2.6, TZ - 3.2, 0, Math.PI / 2);
    const hood = new THREE.ConeGeometry(1.5, 5.2, 12, 1, true);
    scaleUV(hood, 3, 3);
    B.darkStone.add(hood, TX, 4.2 + 2.6, TZ + 0.4);
    const body = new THREE.CylinderGeometry(1.1, 1.5, 3.4, 14);
    scaleUV(body, 3, 3);
    B.darkStone.add(body, TX, 4.2 + 1.7, TZ + 0.4);
    // the drowned stair: wide steps running down into the flood toward the city
    steps(TX + 12, TZ - 24, 12, 16, -3.2, 0.2, 0, 'z');
    for (let i = 0; i < 5; i++) {
      const px = TX + 6 + i * 5, pz = TZ - 30 - i * 4;
      column(px, -2.4, pz, rng.range(3, 6), 0.8, { broken: true });
    }
    // dark veins crawl the temple when the bargain is remembered
    const veinWall = new THREE.CylinderGeometry(30, 30, 5.6, 40, 1, true, 0, Math.PI * 0.7);
    B.veinedDark.add(veinWall, TX, 3.4, TZ, 1.9);
  }

  /* ══════════════════════════ 7 · the sea-gates ══════════════════════════ */
  const [GX, GZ] = DISTRICTS.floodgate.at;
  const GATE_Y = 0.6;
  const gateGroup = new THREE.Group();
  group.add(gateGroup);
  const gateLeaves = [];
  let gateWinch = null;
  {
    const PY = GATE_Y;
    B.darkStone.box(46, 8, 26, GX, PY - 8, GZ, 0);
    plateRect(GX, GZ, 45, 25, PY, 0);
    for (const s of [-1, 1]) {
      const tx = GX + 15.5 * s;
      B.veined.box(9, 17, 9, tx, PY, GZ);
      const cap = new THREE.CylinderGeometry(5.2, 5.2, 0.9, 20);
      B.stone.add(cap, tx, PY + 17.2, GZ);
      const cone = new THREE.ConeGeometry(5.4, 4.4, 20);
      scaleUV(cone, 3, 2);
      B.bronze.add(cone, tx, PY + 19.6, GZ);
    }
    // the sluice walls that march out into the sea
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const z = GZ + 13 + i * 8;
        const x = GX + 20 * s;
        B.stone.box(5, 9 - i * 0.6, 7.6, x, -4, z, 0, 3);
        plateRect(x, z, 5, 7.6, 0.4 - i * 0.1, 0);
      }
    }
    // gate leaves: two slabs hung between the towers, closed until the warden is heard
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const g = boxGeo(13.4, 12, 1.2, 3.0);
      const mesh = new THREE.Mesh(g, M.wood);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(6.7 * s, 0, 0);
      const plate = new THREE.Mesh(boxGeo(13.0, 11.2, 0.7, 3.0), M.bronze);
      plate.position.set(6.7 * s, -0.2, 0.75 * s);
      leaf.add(mesh, plate);
      leaf.position.set(GX + (s < 0 ? 0.4 : -0.4), PY + 0.2, GZ + 6 - 0.6);
      // bands
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(boxGeo(13.6, 0.5, 1.9, 2), M.bronze);
        band.position.set(6.7 * s, 4 - i * 2.6, 0);
        leaf.add(band);
      }
      gateGroup.add(leaf);
      gateLeaves.push({ group: leaf, side: s, closed: 0, target: 0 });
    }
    // the winch and its wheel
    const hub = new THREE.CylinderGeometry(2.6, 2.6, 0.9, 18);
    scaleUV(hub, 3, 1);
    B.bronze.add(hub, GX - 9.5, PY + 1.6, GZ - 9, 0, 0, Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.CylinderGeometry(0.14, 0.14, 4.4, 6);
      spoke.rotateZ(Math.PI / 2); spoke.rotateY(a);
      B.bronze.add(spoke, GX - 9.5, PY + 1.6 + Math.sin(a) * 0, GZ - 9 + Math.cos(a) * 0);
    }
    for (let i = 0; i < 3; i++) {
      const chain = new THREE.TorusGeometry(1.6 + i * 0.4, 0.16, 6, 14, Math.PI * 1.4);
      B.bronze.add(chain, GX - 6 + i * 2, PY + 4.6, GZ - 7, i * 0.5);
    }
    // the wheel the player turns
    gateWinch = new THREE.Vector3(GX - 9.5, PY + 1.6, GZ - 9);
  }

  /* ══════════════════════════ 8 · the drowned city around it ══════════════════════════ */
  const outerRooftops = [];
  let lighthouse = null;
  {
    for (let i = 0; i < 190; i++) {
      const a = rng.f() * Math.PI * 2;
      const r = 42 + Math.pow(rng.f(), 0.7) * 96;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // don't crowd the districts
      let skip = false;
      for (const k of Object.keys(DISTRICTS)) {
        const [dx, dz] = DISTRICTS[k].at;
        if (Math.hypot(x - dx, z - dz) < 34) { skip = true; break; }
      }
      if (Math.hypot(x, z) < 22) skip = true;
      if (skip) continue;
      const w = rng.range(6, 15), d = rng.range(6, 15);
      const h = rng.range(4, 15);
      const sub = rng.range(-3.2, 1.4);           // how far under the water it is
      const style = rng.chance(0.4) ? 'plaster' : 'stone';
      if (building(x, z, w, h, d, { rot: rng.f() * 3.14, style, roof: rng.chance(0.4) ? 'hipped' : 'cornice' }) === false) continue;
      if (sub < 0) {
        // an upper storey still above the waterline, so the skyline reads as half-sunk
        outerRooftops.push({ x, z, w, d, h, sub, rot: 0 });
      }
      void sub;
    }
    // sunken ships in the outer water
    for (let i = 0; i < 7; i++) {
      const a = rng.f() * Math.PI * 2, r = 70 + rng.f() * 70;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const hull = new THREE.CylinderGeometry(2.6, 1.4, 16, 10, 1, false, 0, Math.PI);
      scaleUV(hull, 3, 3);
      hull.rotateZ(Math.PI / 2);
      hull.rotateY(rng.f() * 6.28);
      B.wood.add(hull, x, 0.4 - rng.range(0.5, 2.4), z, 0, rng.range(-0.2, 0.2));
      for (let m = 0; m < 2; m++) {
        const mast = new THREE.CylinderGeometry(0.16, 0.24, rng.range(6, 14), 6);
        mast.rotateZ(rng.range(0.3, 1.1));
        B.wood.add(mast, x + rng.range(-4, 4), 1.6, z + rng.range(-4, 4));
      }
    }
    // the lighthouse — the only thing in Vaelune that is definitely not drowned
    const lx = -118, lz = -96;
    const rock = new THREE.DodecahedronGeometry(16, 1);
    scaleUV(rock, 6, 6);
    B.darkStone.add(rock, lx, -6, lz);
    const lt = new THREE.CylinderGeometry(3.6, 5.4, 26, 16);
    scaleUV(lt, 4, 5);
    B.plasterB.add(lt, lx, 9, lz);
    const lamp = new THREE.CylinderGeometry(3.9, 3.9, 3.2, 16);
    scaleUV(lamp, 3, 1);
    B.bronze.add(lamp, lx, 23.6, lz);
    lighthouse = new THREE.Vector3(lx, 23.6, lz);
  }

  /* ══════════════════════════ 9 · landings ══════════════════════════
     Every avenue has to actually arrive somewhere. Scan outward from the end of
     each avenue for the first place the district floor takes over, then build a
     flight of steps down to the road — this is what makes the city walkable. */
  for (const L of landings) {
    const dx = Math.cos(L.ang), dz = Math.sin(L.ang);
    let topR = null, topY = null;
    for (let r = L.endR; r < L.endR + 26; r += 0.25) {
      const h = groundHeight(dx * r, dz * r);
      if (h > L.y + 0.4) { topR = r; topY = h; break; }
    }
    if (topR === null) continue;
    const rise = topY - L.y;
    const run = Math.min(15, Math.max(4.6, rise * 2.8 + 1.6, topR - L.endR + 2.2));
    const centerR = topR - run / 2;
    steps(dx * centerR, dz * centerR, L.width * 0.94, run, L.y, topY, Math.PI / 2 - L.ang, 'z');
    // a lamp either side of the landing so it reads as an entrance
    for (const s of [-1, 1]) {
      const lx = dx * (centerR + 1) + Math.sin(L.ang) * (L.width / 2) * s;
      const lz = dz * (centerR + 1) - Math.cos(L.ang) * (L.width / 2) * s;
      avenueLamps.push(lampPost(lx, groundHeight(lx, lz), lz, 4.2));
    }
  }

  /* ══════════════════════════ build the merged meshes ══════════════════════════ */
  for (const k of Object.keys(B)) B[k].build(group, k);

  /* ══════════════════════════ ground height field ══════════════════════════ */
  function groundHeight(x, z) {
    let best = DEEP;
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i];
      let h = null;
      if (p.t === 0) {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const dx = x - p.x, dz = z - p.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= p.w / 2 && Math.abs(lz) <= p.d / 2) h = p.y;
      } else if (p.t === 1) {
        if ((x - p.x) ** 2 + (z - p.z) ** 2 <= p.r * p.r) h = p.y;
      } else if (p.t === 2) {
        const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d2 <= p.r1 * p.r1 && d2 >= p.r0 * p.r0) h = p.y;
      } else {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        const dx = x - p.x, dz = z - p.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= p.w / 2 && Math.abs(lz) <= p.d / 2) {
          const t = p.axis === 'x' ? (lx / p.w + 0.5) : (lz / p.d + 0.5);
          h = p.y0 + (p.y1 - p.y0) * Math.min(1, Math.max(0, t));
        }
      }
      if (h !== null && h > best) best = h;
    }
    return best;
  }

  /* ══════════════════════════ the spectral layer ══════════════════════════ */
  // Shard pedestals + the furniture that returns with each memory.
  // one anchor per memory, keyed by memory id (specters.js looks them up that way)
  const shardAt = {
    market: [MX + 3, MZ + 3],
    sky: [OX - 2, OZ + 12],
    song: [AX + 4, AZ + 2],
    bargain: [TX + 5.5, TZ + 4.5],
    sealing: [GX - 6, GZ + 6],
  };
  const shardAnchors = {};
  for (const [id, [x, z]] of Object.entries(shardAt)) {
    shardAnchors[id] = new THREE.Vector3(x, groundHeight(x, z) + 1.05, z);
  }
  shardAnchors.self = new THREE.Vector3(0, 2.6, 0);   // floating in the orrery, over the drowned plaza

  const effects = buildEffects(group, {
    rng, M, B, boxGeo, scaleUV, groundHeight, column, arch, lampPost,
    marketStalls, tiers, gateLeaves, avenueLamps,
    OBS_Y, AX, AZ, STAGE_Y, OX, OZ, GX, GZ, PY: GATE_Y, GATE_Y, BASIN_Y, PLAZA_Y, RING_R, TX, TZ,
    rng2: makeRNG(seed + 5),
  });

  /* ══════════════════════════ update ══════════════════════════ */
  const state = {
    gateOpen: 0,
    stallGlow: 0,
    lanternsOut: 0,
    memoryCount: 0,
    domeSpin: 0,
    orrerySpin: 0,
  };

  function setMemoryRestored(id, on) {
    const f = FURNITURE[id];
    if (f) f.setVisible(on, effects);
    state.memoryCount += on ? 1 : -1;
    if (id === 'sealing') state.gateOpen = on ? 1 : 0;
    if (id === 'market') state.stallGlow = on ? 1 : 0;
    if (id === 'song') state.lanternsOut = on ? 1 : 0;
    if (id === 'bargain') M.veinedDark.emissiveIntensity = on ? 0.85 : 0.0;
    if (id === 'self') M.orreryLitBoost = on;
  }

  function update(dt, t, playerPos) {
    // the observatory dome creeps around; the lamp sweeps once the sky is remembered
    state.domeSpin += dt * (effects.skyRestored ? 0.06 : 0.0);
    effects.sweepBeam.rotation.y = state.domeSpin + Math.sin(t * 0.07) * 0.2;
    effects.update(dt, t, playerPos, state);

    // windows warm up as the city remembers itself
    const target = 0.35 + state.memoryCount * 0.22;
    M.plasterA.emissiveIntensity += (target - M.plasterA.emissiveIntensity) * Math.min(1, dt * 0.6);
    M.plasterB.emissiveIntensity += (target * 0.8 - M.plasterB.emissiveIntensity) * Math.min(1, dt * 0.6);
    M.plasterC.emissiveIntensity += (target * 1.3 - M.plasterC.emissiveIntensity) * Math.min(1, dt * 0.6);
    M.veined.emissiveIntensity = 0.5 + state.memoryCount * 0.16 + Math.sin(t * 0.6) * 0.06;
    M.runed.emissiveIntensity = 0.3 + (effects.skyRestored ? 0.9 : 0) + Math.sin(t * 0.9) * 0.08;

    // gate leaves swing when the warden has been heard
    for (const leaf of gateLeaves) {
      const target = state.gateOpen ? 1.35 : 0;
      leaf.closed += (target - leaf.closed) * Math.min(1, dt * 0.35);
      leaf.group.rotation.y = leaf.closed * (leaf.side < 0 ? 1 : -1) * 0.95;
    }
  }

  // Two ruins can occupy the same footprint in the outer city. A box entirely
  // inside another one can never be touched by the player, and leaving it in the
  // collision list only makes the solver fight itself, so drop those.
  const colliders = buildingColliders.filter((a) => !buildingColliders.some((b) => {
    if (a === b) return false;
    if (Math.abs(a.rot - b.rot) > 0.02) return false;
    if (a.baseY < b.baseY - 0.5 || a.topY > b.topY + 0.5) return false;
    const pad = 0.25;
    return a.w <= b.w + pad && a.d <= b.d + pad
      && Math.hypot(a.x - b.x, a.z - b.z) + Math.hypot(a.w, a.d) * 0.5
         <= Math.hypot(b.w, b.d) * 0.5 - Math.hypot(a.w, a.d) * 0.5 + 1.4;
  }));

  return {
    group, plates, groundHeight, shardAnchors, effects, M, state,
    districts: DISTRICTS, DEEP,
    colliders,
    landmarks: {
      orrery: new THREE.Vector3(0, BASIN_Y, 0),
      observatory: new THREE.Vector3(OX, OBS_Y, OZ),
      amphitheatre: new THREE.Vector3(AX, STAGE_Y, AZ),
      temple: new THREE.Vector3(TX, 4.2, TZ),
      gates: new THREE.Vector3(GX, GATE_Y, GZ),
      winch: gateWinch,
      lighthouse,
      statue: new THREE.Vector3(0, PLAZA_Y, -12.6),
    },
    BASIN_Y, PLAZA_Y, OBS_Y, STAGE_Y, GATE_Y, RING_R, BASIN_R,
    update, setMemoryRestored,
    sunDir: new THREE.Vector3(-0.42, 0.2, -0.78).normalize(),
  };
}
