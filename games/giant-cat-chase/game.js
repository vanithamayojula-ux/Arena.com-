/* Giant Cat Chase — Highway Escape
 * A dependency-free (Three.js vendored) 3D chase game.
 * Car drives forward (-Z). The giant cat chases from behind (+Z).
 */
(function () {
  'use strict';

  // ---------- Constants ----------
  const LANES = [-3.4, 0, 3.4];
  const CAR_HW = 0.95, CAR_HL = 2.2;
  const GRAVITY = 34;
  const JUMP_VY = 12.5;
  const RAMP_H = 2.0, RAMP_HL = 4.5;
  const PIT_HL = 4.6;
  const HP_MAX = 3;
  const GAP_START = 42, GAP_MAX = 85;
  const BEST_KEY = 'giantcat_best_v1';

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const hud = $('hud'), mirrorEl = $('mirror');
  const elScore = $('score'), elSpeed = $('speed'), elCoins = $('coins');
  const elHearts = $('hearts'), gapFill = $('gapFill'), nitroFill = $('nitroFill');
  const elWarn = $('warn'), elToast = $('toast'), elFlash = $('flash');
  const startEl = $('start'), pausedEl = $('paused'), endEl = $('end');

  // ---------- Renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a1838, 70, 300);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  const rearCam = new THREE.PerspectiveCamera(48, 300 / 130, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0xffd3a0, 0x2a2040, 0.85));
  const sun = new THREE.DirectionalLight(0xffb070, 0.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  // Sky gradient as scene background
  function makeSkyTexture() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#120a2a');
    grd.addColorStop(0.45, '#4a1e4e');
    grd.addColorStop(0.7, '#c4505a');
    grd.addColorStop(0.82, '#ff8a4c');
    grd.addColorStop(1, '#ffc078');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  scene.background = makeSkyTexture();

  // Road texture: asphalt + lane markings (64x256 = 40 world units of length)
  function makeRoadTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2735'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#3a3446' : '#211d2b';
      g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
    }
    // shoulder lines (x = ±5.1 in a 12-unit wide plane)
    g.fillStyle = '#f4e6c8';
    g.fillRect(8, 0, 3, 256); g.fillRect(117, 0, 3, 256);
    // lane dashes (x = ±1.7)
    g.fillStyle = '#ffd166';
    for (const u of [45, 82]) {
      for (let y = 0; y < 256; y += 128) g.fillRect(u, y + 8, 3, 70);
    }
    // Rumble strips
    g.fillStyle = '#ff6b3d';
    g.fillRect(0, 0, 4, 256); g.fillRect(124, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    return t;
  }
  const roadTex = makeRoadTexture();
  const ROAD_LEN = 800;
  roadTex.repeat.set(1, ROAD_LEN / 40);
  const roadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12, ROAD_LEN),
    new THREE.MeshLambertMaterial({ map: roadTex })
  );
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  const grassMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(600, ROAD_LEN),
    new THREE.MeshLambertMaterial({ color: 0x2d4a2c })
  );
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.y = -0.05;
  scene.add(grassMesh);

  // Shared geometries / materials
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
  const SPH = new THREE.SphereGeometry(1, 14, 10);
  const CONE = new THREE.ConeGeometry(1, 1, 8);
  const ICO = new THREE.IcosahedronGeometry(1, 0);
  const TORUS = new THREE.TorusGeometry(1, 0.3, 6, 14);
  const CIRC = new THREE.CircleGeometry(1, 22);
  const M = {};
  const matCache = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) {
      matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
    }
    return matCache[key];
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mesh(geo, material, x, y, z, sx, sy, sz, parent, shadow) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    m.castShadow = !!shadow;
    m.receiveShadow = false;
    if (parent) parent.add(m);
    return m;
  }

  // ---------- Car model (faces -Z) ----------
  function buildCar(color, isPlayer) {
    const g = new THREE.Group();
    const body = mat(color);
    const dark = mat(0x1b1b24);
    const glass = mat(0x1d3550, { emissive: 0x06101c });
    mesh(BOX, body, 0, 0.62, 0, 1.9, 0.72, 4.4, g, true);
    mesh(BOX, body, 0, 1.25, 0.15, 1.62, 0.62, 2.2, g, true);
    mesh(BOX, glass, 0, 1.28, 0.15, 1.66, 0.42, 1.9, g);
    mesh(BOX, body, 0, 1.6, 0.15, 1.5, 0.08, 1.9, g);
    // wheels: spinnable groups with axis along X
    g.userData.wheels = [];
    for (const [wx, wz] of [[-0.98, -1.4], [0.98, -1.4], [-0.98, 1.4], [0.98, 1.4]]) {
      const wg = new THREE.Group();
      wg.position.set(wx, 0.42, wz);
      const tire = mesh(CYL, dark, 0, 0, 0, 0.42, 0.34, 0.42, wg, true);
      tire.rotation.z = Math.PI / 2;
      const hub = mesh(CYL, mat(0xb8c2cc), wx > 0 ? 0.18 : -0.18, 0, 0, 0.2, 0.06, 0.2, wg);
      hub.rotation.z = Math.PI / 2;
      g.add(wg);
      g.userData.wheels.push(wg);
    }
    // lights
    const headC = isPlayer ? 0xfff3b0 : 0xffe9a0;
    mesh(BOX, mat(headC, { emissive: 0xfff0a0, emissiveIntensity: 0.9 }), -0.6, 0.7, -2.22, 0.45, 0.2, 0.05, g);
    mesh(BOX, mat(headC, { emissive: 0xfff0a0, emissiveIntensity: 0.9 }), 0.6, 0.7, -2.22, 0.45, 0.2, 0.05, g);
    const tailMat = mat(0xff2236, { emissive: 0xff0820, emissiveIntensity: 0.9 });
    g.userData.tail = [
      mesh(BOX, tailMat, -0.65, 0.78, 2.22, 0.4, 0.22, 0.05, g),
      mesh(BOX, tailMat, 0.65, 0.78, 2.22, 0.4, 0.22, 0.05, g),
    ];
    if (isPlayer) {
      // spoiler + neon side strips
      mesh(BOX, dark, -0.8, 1.6, 1.95, 0.08, 0.5, 0.08, g);
      mesh(BOX, dark, 0.8, 1.6, 1.95, 0.08, 0.5, 0.08, g);
      mesh(BOX, dark, 0, 1.9, 1.95, 2.0, 0.08, 0.5, g);
      const neon = mat(0x3ddcff, { emissive: 0x3ddcff, emissiveIntensity: 0.9 });
      mesh(BOX, neon, -0.97, 0.7, 0, 0.05, 0.1, 3.8, g);
      mesh(BOX, neon, 0.97, 0.7, 0, 0.05, 0.1, 3.8, g);
    }
    return g;
  }

  // ---------- Giant cat (faces -Z; origin at its belly center) ----------
  const CAT_ORANGE = 0xe8892b, CAT_STRIPE = 0x6e3510, CAT_CREAM = 0xffe2b8;
  function buildCat() {
    const root = new THREE.Group();
    const o = mat(CAT_ORANGE), s = mat(CAT_STRIPE), c = mat(CAT_CREAM);
    const body = mesh(SPH, o, 0, 6.0, 0, 4.2, 3.9, 6.6, root, true);
    mesh(SPH, c, 0, 4.4, -0.2, 3.4, 2.2, 5.8, root, true);
    // stripes on back
    for (let i = -2; i <= 2; i++) {
      mesh(BOX, s, 0, 8.8, i * 1.7 + 0.3, 1.8, 0.9, 0.4, root, true);
    }
    // head
    const head = new THREE.Group();
    head.position.set(0, 10.2, -7.0);
    root.add(head);
    mesh(SPH, o, 0, 0, 0, 3.4, 3.1, 3.0, head, true);
    for (const sx of [-1, 1]) {
      const ear = mesh(CONE, o, sx * 2.0, 3.1, 0.2, 1.1, 2.6, 1.0, head, true);
      ear.rotation.z = -sx * 0.25;
      mesh(CONE, mat(0xffa0a0), sx * 2.0, 3.0, 0.6, 0.55, 1.6, 0.4, head);
    }
    mesh(SPH, c, 0, -1.2, -2.9, 1.9, 1.3, 1.5, head, true); // muzzle
    mesh(SPH, mat(0xff6b8a), 0, -0.9, -4.4, 0.42, 0.34, 0.35, head);
    mesh(BOX, mat(0x2a0f0a), 0, -1.9, -4.2, 0.9, 0.08, 0.1, head);
    const eyeMat = mat(0xc8ff3d, { emissive: 0xa6ff00, emissiveIntensity: 1.2 });
    for (const sx of [-1, 1]) {
      mesh(SPH, eyeMat, sx * 1.45, 0.6, -2.5, 0.8, 0.62, 0.45, head);
      mesh(SPH, mat(0x000000), sx * 1.45, 0.6, -2.85, 0.28, 0.6, 0.22, head);
      // forehead stripes
      mesh(BOX, s, sx * 0.9, 2.2, -2.0, 0.22, 0.9, 0.2, head);
      mesh(BOX, s, sx * 0.0, 2.5, -2.0, 0.22, 0.9, 0.2, head);
      // whiskers
      for (const wy of [-0.9, -1.4]) {
        const wh = mesh(BOX, mat(0xffffff), sx * 2.6, wy, -4.0, 4.2, 0.05, 0.05, head);
        wh.rotation.y = sx * 0.15;
      }
    }
    root.userData.head = head;

    // legs (pivot at hip, swing around X)
    root.userData.legs = [];
    for (const [lx, lz] of [[-2.4, -3.8], [2.4, -3.8], [-2.4, 3.6], [2.4, 3.6]]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, 5.2, lz);
      root.add(pivot);
      mesh(BOX, o, 0, -2.4, 0, 1.6, 4.8, 1.6, pivot, true);
      mesh(BOX, c, 0, -4.9, -0.35, 1.7, 0.9, 2.2, pivot, true);
      root.userData.legs.push(pivot);
    }
    // tail: nested chain
    const tailRoot = new THREE.Group();
    tailRoot.position.set(0, 7.0, 6.2);
    root.add(tailRoot);
    let parent = tailRoot;
    root.userData.tail = [];
    for (let i = 0; i < 7; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0.2, i === 0 ? 0 : 1.6);
      parent.add(seg);
      const r = 1.1 - i * 0.1;
      mesh(SPH, i % 2 ? s : o, 0, 0, 0.6, r, r, 1.4, seg, true);
      root.userData.tail.push(seg);
      parent = seg;
    }
    // paws: bigger swipe paw (separate, world-space)
    const swipe = new THREE.Group();
    const palm = mesh(BOX, o, 0, 0, 0, 3.8, 1.4, 3.6, swipe, true);
    mesh(SPH, c, 0, -0.2, -2.0, 3.8, 1.6, 1.6, swipe, true);
    for (const tx of [-1.2, 0, 1.2]) mesh(SPH, c, tx, 0.2, -2.1, 0.55, 0.5, 0.5, swipe);
    mesh(SPH, c, 0, 0.3, 0, 1.0, 1.0, 1.0, swipe);
    root.userData.swipe = swipe;
    return root;
  }

  // ---------- Decor ----------
  const BUILD_COLS = [0x2a2a48, 0x3d2c4f, 0x23324a, 0x4a2f3d, 0x2e3b3a, 0x505070];
  const WIN_MAT = mat(0xffd27a, { emissive: 0xffb050, emissiveIntensity: 0.8 });
  const TRUNK_MAT = mat(0x4a2d1a);
  const LEAF_MATS = [mat(0x2f6b33), mat(0x3f7c3a), mat(0x7a4a22)];
  const LAMP_MAT = mat(0xffd590, { emissive: 0xffc070, emissiveIntensity: 1.0 });
  const POLE_MAT = mat(0x3a3a48);

  // ---------- Obstacles ----------
  const obs = [];          // gameplay objects (solids, ramps, pits, decals, coins, balls, traffic)
  const decor = [];        // purely visual
  const debris = [];       // particle boxes
  let world = null;        // scene group holding gameplay visuals

  function addObs(o) { obs.push(o); scene.add(o.group); return o; }

  function makeSolid(opts) {
    // opts: x,z, w,h,d(half sizes via hw,hl,h), group, destroy, light, f, gap, hp, tag
    const o = Object.assign({
      kind: 'solid', x: 0, z: 0, hw: 0.8, hl: 0.8, h: 1, destroy: false, light: false,
      f: 0.5, gapLoss: 5, hp: 1, cool: 0, v: 0, vx: 0, dead: false, checked: false, minE: 99, tag: 'box',
    }, opts);
    o.group = o.group || new THREE.Group();
    o.group.position.set(o.x, 0, o.z);
    return o;
  }

  const obsBuilders = {
    cone(x, z) {
      const g = new THREE.Group();
      mesh(CONE, mat(0xff7a1a), 0, 0.48, 0, 0.32, 0.95, 0.32, g, true);
      mesh(CYL, mat(0xffffff), 0, 0.6, 0, 0.24, 0.12, 0.24, g);
      mesh(BOX, mat(0x222222), 0, 0.1, 0, 0.7, 0.18, 0.7, g);
      return makeSolid({ x, z, group: g, hw: 0.4, hl: 0.4, h: 0.95, destroy: true, light: true, f: 0.85, gapLoss: 1.5, hp: 0, tag: 'cone' });
    },
    barrel(x, z) {
      const g = new THREE.Group();
      const n = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        mesh(CYL, mat(0xd7352f), 0, 0.6 + i * 1.2, 0, 0.6, 1.2, 0.6, g, true);
        mesh(CYL, mat(0x222222), 0, 0.2 + i * 1.2, 0, 0.62, 0.08, 0.62, g);
      }
      return makeSolid({ x, z, group: g, hw: 0.6, hl: 0.6, h: 1.2 * n, destroy: true, f: 0.7, gapLoss: 4, hp: 1, tag: 'barrel' });
    },
    crate(x, z) {
      const g = new THREE.Group();
      const n = Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        mesh(BOX, mat(0xb07a3f), 0, 0.8 + i * 1.6, 0, 1.6, 1.6, 1.6, g, true);
        mesh(BOX, mat(0x6b4520), 0, 0.8 + i * 1.6, 0, 1.66, 0.14, 1.66, g);
      }
      return makeSolid({ x, z, group: g, hw: 0.82, hl: 0.82, h: 1.6 * n, destroy: true, f: 0.7, gapLoss: 4, hp: 1, tag: 'crate' });
    },
    tires(x, z) {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const t = mesh(TORUS, mat(0x151515), 0, 0.3 + i * 0.4, 0, 0.6, 0.6, 0.6, g, true);
        t.rotation.x = Math.PI / 2;
      }
      return makeSolid({ x, z, group: g, hw: 0.7, hl: 0.7, h: 1.2, destroy: true, light: true, f: 0.8, gapLoss: 2.5, hp: 0, tag: 'tires' });
    },
    barrier(x, z) {
      const g = new THREE.Group();
      mesh(BOX, mat(0xb9b5c4), 0, 0.55, 0, 3.2, 1.1, 0.9, g, true);
      mesh(BOX, mat(0xff5a36), 0, 0.85, 0, 3.22, 0.18, 0.92, g);
      return makeSolid({ x, z, group: g, hw: 1.6, hl: 0.45, h: 1.1, f: 0.5, gapLoss: 6, hp: 1, tag: 'barrier' });
    },
    log(x, z) {
      const g = new THREE.Group();
      const l = mesh(CYL, mat(0x6b4226), 0, 0.6, 0, 0.6, 3.4, 0.6, g, true);
      l.rotation.z = Math.PI / 2;
      mesh(CYL, mat(0xc89a5c), 1.7, 0.6, 0, 0.45, 0.04, 0.45, g);
      return makeSolid({ x, z, group: g, hw: 1.7, hl: 0.6, h: 1.2, f: 0.5, gapLoss: 6, hp: 1, tag: 'log' });
    },
    fence(x, z) {
      const g = new THREE.Group();
      mesh(BOX, mat(0xc49a5a), 0, 0.9, 0, 3.3, 1.6, 0.25, g, true);
      for (let i = -1; i <= 1; i++) mesh(BOX, mat(0x8a6236), i * 1.4, 0.8, 0, 0.35, 1.8, 0.35, g);
      mesh(BOX, mat(0xffd166, { emissive: 0x663300 }), 0, 1.5, 0, 3.35, 0.14, 0.28, g);
      return makeSolid({ x, z, group: g, hw: 1.65, hl: 0.2, h: 1.6, f: 0.5, gapLoss: 6, hp: 1, tag: 'fence' });
    },
    boulder(x, z) {
      const g = new THREE.Group();
      const s = rand(1.2, 1.6);
      const b = mesh(ICO, mat(0x7a7480), 0, s * 1.0, 0, s * 1.1, s * 1.0, s * 1.05, g, true);
      b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      mesh(ICO, mat(0x5a5560), 0.8, 0.5, 0.6, 0.6, 0.6, 0.6, g);
      return makeSolid({ x, z, group: g, hw: 1.35, hl: 1.35, h: s * 2.0, f: 0.4, gapLoss: 8, hp: 1, tag: 'boulder' });
    },
    truck(x, z) {
      const g = new THREE.Group();
      const col = pick([0x2e8bd6, 0xe0b23a, 0x3fb06b, 0xd0503a]);
      mesh(BOX, mat(col), 0, 2.0, 1.2, 3.1, 3.4, 7.0, g, true);
      mesh(BOX, mat(0xdde6ef), 0, 1.6, 4.72, 2.9, 1.2, 0.04, g);
      mesh(BOX, mat(0x253040), 0, 2.2, -3.4, 2.9, 1.6, 2.6, g, true); // cab
      mesh(BOX, mat(0x1d3550, { emissive: 0x08162a }), 0, 2.6, -4.72, 2.7, 1.0, 0.1, g);
      mesh(BOX, mat(0x111111), -1.1, 0.4, -3.4, 0.3, 0.9, 0.9, g);
      for (const wz of [-2.4, 3.6, 5.0]) {
        for (const wx of [-1.25, 1.25]) {
          const w = mesh(CYL, mat(0x101010), wx, 0.6, wz, 0.6, 0.4, 0.6, g);
          w.rotation.z = Math.PI / 2;
        }
      }
      // headlights
      mesh(BOX, mat(0xfff0a0, { emissive: 0xfff0a0, emissiveIntensity: 1 }), -1.0, 1.0, -5.0, 0.4, 0.3, 0.05, g);
      mesh(BOX, mat(0xfff0a0, { emissive: 0xfff0a0, emissiveIntensity: 1 }), 1.0, 1.0, -5.0, 0.4, 0.3, 0.05, g);
      return makeSolid({ x, z, group: g, hw: 1.6, hl: 4.8, h: 3.9, f: 0.4, gapLoss: 8, hp: 1, tag: 'truck' });
    },
    traffic(x, z) {
      const col = pick([0x3a7bd5, 0xeeeeee, 0x44aa55, 0xdd3344, 0x8844cc, 0xffaa22, 0x222230]);
      const g = buildCar(col, false);
      g.position.set(0, 0, 0);
      const o = makeSolid({ x, z, group: g, hw: CAR_HW, hl: CAR_HL, h: 1.8, f: 0.6, gapLoss: 5, hp: 1, tag: 'traffic' });
      o.v = rand(28, 46);
      o.kind = 'traffic';
      return o;
    },
    yarn(x, z) {
      const g = new THREE.Group();
      mesh(SPH, mat(0xff6fb5, { emissive: 0x330011 }), 0, 1.4, 0, 1.4, 1.4, 1.4, g, true);
      const r1 = mesh(TORUS, mat(0xffd1e8), 0, 1.4, 0, 1.4, 1.4, 1.4, g);
      r1.rotation.x = Math.PI / 2;
      const r2 = mesh(TORUS, mat(0xffe9f4), 0, 1.4, 0, 1.4, 1.4, 1.4, g);
      r2.rotation.y = Math.PI / 2;
      const o = makeSolid({ x, z, group: g, hw: 1.2, hl: 1.2, h: 2.8, f: 0.45, gapLoss: 7, hp: 1, tag: 'yarn' });
      o.kind = 'ball';
      o.vx = (Math.random() < 0.5 ? -1 : 1) * rand(5, 9);
      o.group.position.x = o.vx > 0 ? -6 : 6;
      o.x = o.group.position.x;
      return o;
    },
    oil(x, z) {
      const g = new THREE.Group();
      const d = mesh(CIRC, mat(0x0c0a16, { transparent: true, opacity: 0.9 }), 0, 0.03, 0, 2.2, 2.2, 1, g);
      d.rotation.x = -Math.PI / 2; d.scale.set(2.2, 3.1, 1);
      const r = mesh(CIRC, mat(0x7a5cff, { transparent: true, opacity: 0.35 }), 0, 0.04, 0, 1.2, 1.7, 1, g);
      r.rotation.x = -Math.PI / 2;
      return makeSolid({ x, z, group: g, kind: 'decal', hw: 1.6, hl: 2.2, h: 0, f: 0.75, gapLoss: 2, hp: 0, tag: 'oil' });
    },
    pothole(x, z) {
      const g = new THREE.Group();
      const d = mesh(CIRC, mat(0x050505), 0, 0.03, 0, 1.3, 1.3, 1, g);
      d.rotation.x = -Math.PI / 2; d.scale.set(1.3, 1.1, 1);
      const r = mesh(TORUS, mat(0x333333), 0, 0.04, 0, 1.25, 1.25, 1.25, g);
      r.rotation.x = Math.PI / 2;
      return makeSolid({ x, z, group: g, kind: 'decal', hw: 1.1, hl: 1.2, h: 0, f: 0.85, gapLoss: 1, hp: 0, tag: 'pothole' });
    },
    coin(x, z) {
      const g = new THREE.Group();
      const c = mesh(CYL, mat(0xffd166, { emissive: 0x553300 }), 0, 1.2, 0, 0.6, 0.12, 0.6, g);
      c.rotation.z = Math.PI / 2;
      return makeSolid({ x, z, group: g, kind: 'coin', hw: 0.6, hl: 0.6, h: 2.5 });
    },
  };

  function makeRampMesh(x, z) {
    const g = new THREE.Group();
    const w = 1.6, H = RAMP_H, L = RAMP_HL;
    const A = [-w, 0, L], B = [w, 0, L], C = [-w, H, -L], D = [w, H, -L], E = [-w, 0, -L], F = [w, 0, -L];
    const tris = [A, B, D, A, D, C, A, C, E, B, F, D, C, F, D, C, E, F, A, E, F, A, F, B];
    const pos = [];
    tris.forEach((p) => pos.push(p[0], p[1], p[2]));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat(0xffb020, { side: THREE.DoubleSide }));
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    // chevrons
    for (let i = 0; i < 3; i++) {
      const s = mesh(BOX, mat(0x202020), 0, H * (0.25 + i * 0.25) + 0.05, -L + 1 + i * 2.8, w * 1.9, 0.12, 0.4, g);
      s.rotation.x = -Math.atan2(H, 2 * L);
    }
    g.position.set(x, 0, z);
    return g;
  }

  // ---------- Patterns (spawn rows) ----------
  // Each returns the length used so the spawn frontier can advance.
  let spawnZ = -70;
  let spawnCount = 0;
  const pats = {};
  const freeLanes = () => { const a = [0, 1, 2]; a.sort(() => Math.random() - 0.5); return a; };

  pats.coins = (z) => {
    const l = Math.floor(Math.random() * 3);
    for (let i = 0; i < 10; i++) addObs(obsBuilders.coin(LANES[l], z - i * 3));
    if (Math.random() < 0.4) {
      const l2 = (l + 1 + Math.floor(Math.random() * 2)) % 3;
      for (let i = 0; i < 6; i++) addObs(obsBuilders.coin(LANES[l2], z - 6 - i * 3));
    }
    return 32;
  };
  pats.cones = (z) => {
    const l = Math.floor(Math.random() * 3);
    const n = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) addObs(obsBuilders.cone(LANES[l], z - i * 2.6));
    if (Math.random() < 0.5) {
      const l2 = (l + 1) % 3;
      for (let i = 0; i < 4; i++) addObs(obsBuilders.cone(LANES[l2], z - 4 - i * 2.6));
    }
    return 22;
  };
  pats.slalom = (z) => {
    let l = Math.floor(Math.random() * 3);
    for (let i = 0; i < 7; i++) {
      addObs(obsBuilders.cone(LANES[l], z - i * 3.8));
      l = clamp(l + (Math.random() < 0.5 ? -1 : 1), 0, 2);
    }
    return 28;
  };
  pats.barrels = (z) => {
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) {
      if (l === open) continue;
      if (Math.random() < 0.85) addObs(obsBuilders.barrel(LANES[l], z));
      if (Math.random() < 0.5) addObs(obsBuilders.barrel(LANES[l], z - 5));
    }
    return 12;
  };
  pats.crates = (z) => {
    const open = Math.floor(Math.random() * 3);
    const cnt = 1 + Math.floor(Math.random() * 2);
    for (let l = 0; l < 3; l++) {
      if (l === open && cnt === 1) continue;
      addObs(obsBuilders.crate(LANES[l], z - Math.random() * 3));
    }
    return 10;
  };
  pats.tires = (z) => {
    const l = Math.floor(Math.random() * 3);
    addObs(obsBuilders.tires(LANES[l], z));
    addObs(obsBuilders.tires(LANES[(l + 1) % 3], z - 8));
    return 14;
  };
  pats.barrier = (z) => {
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) if (l !== open) addObs(obsBuilders.barrier(LANES[l], z));
    return 10;
  };
  pats.fence = (z) => {
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) if (l !== open) addObs(obsBuilders.fence(LANES[l], z));
    addObs(obsBuilders.coin(LANES[open], z - 6));
    return 10;
  };
  pats.logs = (z) => {
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) if (l !== open && Math.random() < 0.8) addObs(obsBuilders.log(LANES[l], z));
    return 8;
  };
  pats.boulders = (z) => {
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) if (l !== open && Math.random() < 0.8) addObs(obsBuilders.boulder(LANES[l], z));
    return 10;
  };
  pats.trucks = (z) => {
    const open = Math.floor(Math.random() * 3);
    addObs(obsBuilders.truck(LANES[(open + 1) % 3], z));
    if (Math.random() < 0.6) addObs(obsBuilders.truck(LANES[(open + 2) % 3], z - 34));
    if (Math.random() < 0.5) addObs(obsBuilders.coin(LANES[open], z - 4));
    return 18;
  };
  pats.traffic = (z) => {
    const ls = freeLanes();
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) addObs(obsBuilders.traffic(LANES[ls[i]], z - i * 14 - Math.random() * 4));
    return 16 + n * 14;
  };
  pats.oil = (z) => {
    const ls = freeLanes();
    addObs(obsBuilders.oil(LANES[ls[0]], z));
    if (Math.random() < 0.6) addObs(obsBuilders.oil(LANES[ls[1]], z - 14));
    return 18;
  };
  pats.potholes = (z) => {
    const ls = freeLanes();
    for (let i = 0; i < 2; i++) addObs(obsBuilders.pothole(LANES[ls[i]], z - i * 9));
    return 16;
  };
  pats.yarn = (z) => {
    addObs(obsBuilders.yarn(0, z));
    return 14;
  };
  // Ramp, then a pit the ramp can carry you over (or a truck to fly over, depending on jump)
  pats.ramp = (z) => {
    const l = Math.floor(Math.random() * 3);
    const ramp = { kind: 'ramp', x: LANES[l], z, hl: RAMP_HL, H: RAMP_H, group: makeRampMesh(LANES[l], z), dead: false, tag: 'ramp' };
    addObs(ramp);
    for (let i = 0; i < 6; i++) addObs(obsBuilders.coin(LANES[l], z - RAMP_HL * 2 - 4 - i * 3));
    return 30;
  };
  pats.pit = (z) => {
    const l = Math.floor(Math.random() * 3);
    const pit = makePit(LANES[l], z);
    addObs(pit);
    // a ramp just before the pit in the same lane, sometimes
    if (Math.random() < 0.5) {
      addObs({ kind: 'ramp', x: LANES[l], z: z + PIT_HL + 14, hl: RAMP_HL, H: RAMP_H, group: makeRampMesh(LANES[l], z + PIT_HL + 14), dead: false, tag: 'ramp' });
      return 34;
    }
    // coins on either side as hint
    addObs(obsBuilders.coin(LANES[l], z + 6));
    return 26;
  };
  pats.jumpy = (z) => {
    // fence + barrier mix: jump required
    const open = Math.floor(Math.random() * 3);
    for (let l = 0; l < 3; l++) {
      if (l === open) continue;
      addObs(obsBuilders.barrier(LANES[l], z));
      if (Math.random() < 0.5) addObs(obsBuilders.log(LANES[l], z - 8));
    }
    return 20;
  };
  pats.mixed = (z) => {
    const ls = freeLanes();
    addObs(obsBuilders.barrel(LANES[ls[0]], z));
    addObs(obsBuilders.boulder(LANES[ls[1]], z - 12));
    addObs(obsBuilders.cone(LANES[ls[2]], z - 6));
    addObs(obsBuilders.cone(LANES[ls[2]], z - 9));
    return 20;
  };

  function makePit(x, z) {
    const g = new THREE.Group();
    mesh(BOX, mat(0x050308), 0, 0.02, 0, 3.4, 0.05, PIT_HL * 2, g);
    mesh(BOX, mat(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1 }), -1.7, 0.1, 0, 0.15, 0.15, PIT_HL * 2, g);
    mesh(BOX, mat(0xff2a1a, { emissive: 0xff2a1a, emissiveIntensity: 1 }), 1.7, 0.1, 0, 0.15, 0.15, PIT_HL * 2, g);
    for (let i = -2; i <= 2; i++) mesh(BOX, mat(0x3a1a10), 0, -0.6, i * 1.4, 3.0, 0.15, 0.2, g);
    g.position.set(x, 0, z);
    return { kind: 'pit', x, z, hl: PIT_HL, hw: 1.7, group: g, dead: false, tag: 'pit' };
  }

  const PATTERNS = [
    { f: 'coins', w: 4 }, { f: 'cones', w: 4 }, { f: 'slalom', w: 2 }, { f: 'barrels', w: 3 },
    { f: 'crates', w: 3 }, { f: 'tires', w: 2 }, { f: 'barrier', w: 3 }, { f: 'fence', w: 2 },
    { f: 'logs', w: 2 }, { f: 'boulders', w: 2 }, { f: 'trucks', w: 2 }, { f: 'traffic', w: 4 },
    { f: 'oil', w: 2 }, { f: 'potholes', w: 2 }, { f: 'yarn', w: 1 }, { f: 'ramp', w: 2 },
    { f: 'pit', w: 2 }, { f: 'jumpy', w: 2 }, { f: 'mixed', w: 3 },
  ];
  function pickPattern(d) {
    // More dangerous patterns unlock with distance
    const pool = PATTERNS.filter((p) => {
      if (['trucks', 'boulders', 'yarn', 'pit'].includes(p.f)) return d > 0.12;
      if (['ramp', 'jumpy', 'logs', 'fence'].includes(p.f)) return d > 0.05;
      return true;
    });
    const total = pool.reduce((s, p) => s + p.w * (['trucks', 'traffic', 'boulders', 'pit', 'mixed', 'jumpy', 'fence'].includes(p.f) ? 1 + d : 1), 0);
    let r = Math.random() * total;
    for (const p of pool) {
      const w = p.w * (['trucks', 'traffic', 'boulders', 'pit', 'mixed', 'jumpy', 'fence'].includes(p.f) ? 1 + d : 1);
      if ((r -= w) <= 0) return p.f;
    }
    return 'coins';
  }

  // ---------- Decor spawning ----------
  let decorZ = -40;
  function spawnDecorRow(z) {
    for (const side of [-1, 1]) {
      if (Math.random() < 0.85) {
        const w = rand(6, 10), d = rand(6, 11), h = rand(8, 42);
        const x = side * rand(15, 24);
        const g = new THREE.Group();
        const b = mesh(BOX, mat(pick(BUILD_COLS)), 0, h / 2, 0, w, h, d, g, false);
        for (let i = 0; i < 3; i++) {
          mesh(BOX, WIN_MAT, side * -0.1 * 0, 3 + i * 4.2, 0, w + 0.02, 0.8, d * 0.8 + 0.02, g);
        }
        g.position.set(x, 0, z);
        scene.add(g); decor.push({ z, group: g });
      }
      if (Math.random() < 0.6) {
        const g = new THREE.Group();
        const x = side * rand(6.9, 9.0);
        mesh(CYL, mat(0x4a2d1a), 0, 1.6, 0, 0.35, 3.2, 0.35, g, true);
        const crown = mesh(ICO, pick(LEAF_MATS), 0, 4.2, 0, rand(1.6, 2.4), rand(2.0, 3.0), rand(1.6, 2.4), g, true);
        crown.rotation.y = rand(0, 3);
        g.position.set(x, 0, z);
        scene.add(g); decor.push({ z, group: g });
      }
      if (Math.random() < 0.8) {
        const g = new THREE.Group();
        const x = side * 6.2;
        mesh(CYL, POLE_MAT, 0, 3.4, 0, 0.18, 6.8, 0.18, g);
        mesh(BOX, POLE_MAT, side * -0.8, 6.8, 0, 1.8, 0.2, 0.2, g);
        mesh(BOX, LAMP_MAT, side * -1.6, 6.6, 0, 0.7, 0.3, 0.4, g);
        g.position.set(x, 0, z);
        scene.add(g); decor.push({ z, group: g });
      }
    }
  }

  // ---------- Player & cat state ----------
  const carGroup = new THREE.Group();   // visual root (position = car pos)
  const carBody = buildCar(0xff5a2a, true);
  carGroup.add(carBody);
  scene.add(carGroup);

  const cat = buildCat();
  scene.add(cat);
  const swipeMarker = (() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    return m;
  })();
  const swipePaw = cat.userData.swipe;
  swipePaw.visible = false;
  scene.add(swipePaw);

  // ---------- Game state ----------
  let state = 'menu';
  let S = null;
  function freshState() {
    return {
      t: 0, carX: 0, carZ: 0, carY: 0, carVY: 0, grounded: true, lastSlope: 0,
      lane: 1, speed: 45, brake: false, boostT: 0, nitro: 30, spinT: 0, spinRot: 0, spinDir: 1,
      carRotY: 0, bounce: 0, hp: HP_MAX, coins: 0, close: 0, points: 0, gap: GAP_START,
      swipeCD: 4, swipe: { phase: 'idle', t: 0, lane: 1, hit: false }, shake: 0, flashT: 0,
      catPhase: 0, stompT: 0, heartT: 0, lastToast: 0, jumpBuf: 0, fallen: false, reason: '', over: false,
      wheelRot: 0, tailT: 0, catHeadTurn: 0, catPosZ: 0, lastDist: 0,
    };
  }

  // Remove all gameplay/decor objects and reset spawn frontier.
  function clearWorld() {
    for (const o of obs) scene.remove(o.group);
    obs.length = 0;
    for (const d of decor) scene.remove(d.group);
    decor.length = 0;
    for (const p of debris) scene.remove(p.m);
    debris.length = 0;
    spawnZ = -70;
    decorZ = -40;
  }

  function spawnAhead() {
    const d = Math.min(1, (-S.carZ) / 2600);
    while (spawnZ > S.carZ - 300) {
      const f = pickPattern(d);
      const len = pats[f](spawnZ);
      spawnZ -= len + rand(8, 22) - d * 6;
      spawnCount++;
    }
    while (decorZ > S.carZ - 300) {
      spawnDecorRow(decorZ);
      decorZ -= rand(14, 22);
    }
  }

  function cullBehind() {
    const limit = S.carZ + 30;
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      if (o.z > limit || o.dead) {
        scene.remove(o.group);
        obs.splice(i, 1);
      }
    }
    for (let i = decor.length - 1; i >= 0; i--) {
      if (decor[i].z > S.carZ + 40) {
        scene.remove(decor[i].group);
        decor.splice(i, 1);
      }
    }
  }

  // ---------- Effects ----------
  function spawnDebris(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(BOX, mat(color));
      const s = rand(0.15, 0.4);
      m.scale.set(s, s, s);
      m.position.set(x + rand(-0.5, 0.5), y + rand(0.2, 1.2), z + rand(-0.5, 0.5));
      scene.add(m);
      debris.push({ m, vx: rand(-6, 6), vy: rand(4, 10), vz: rand(-4, 4), life: rand(0.8, 1.2) });
    }
  }
  function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const p = debris[i];
      p.life -= dt;
      p.vy -= 22 * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y = Math.max(0.05, p.m.position.y + p.vy * dt);
      p.m.position.z += p.vz * dt;
      p.m.rotation.x += dt * 8;
      if (p.life <= 0) {
        scene.remove(p.m);
        debris.splice(i, 1);
      }
    }
  }

  // ---------- Audio ----------
  let actx = null, master = null, engOsc = null, engGain = null, noiseBuf = null;
  let muted = false;
  function ensureAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(actx.destination);
    engOsc = actx.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.value = 50;
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engGain = actx.createGain();
    engGain.gain.value = 0;
    engOsc.connect(lp); lp.connect(engGain); engGain.connect(master);
    engOsc.start();
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  function tone(f, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, actx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, actx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(actx.currentTime + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    if (!actx || muted) return;
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    const f = actx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = actx.createGain();
    g.gain.setValueAtTime(vol || 0.4, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(); src.stop(actx.currentTime + dur + 0.02);
  }
  const sfx = {
    crash() { noise(0.5, 0.7, 900); tone(90, 0.4, 'sawtooth', 0.3, 40); },
    light() { noise(0.2, 0.35, 2000); tone(200, 0.12, 'triangle', 0.2, 120); },
    coin() { tone(880, 0.08, 'square', 0.12); setTimeout(() => tone(1320, 0.12, 'square', 0.12), 60); },
    roar() { noise(1.6, 0.9, 500); tone(70, 1.4, 'sawtooth', 0.25, 40); },
    ramp() { tone(300, 0.3, 'triangle', 0.2, 900); },
    spin() { tone(600, 0.6, 'sine', 0.2, 150); },
    heart() { tone(70, 0.12, 'sine', 0.35, 55); setTimeout(() => tone(60, 0.12, 'sine', 0.3, 50), 180); },
    close() { tone(1000, 0.1, 'triangle', 0.15); setTimeout(() => tone(1500, 0.14, 'triangle', 0.15), 80); },
    nitro() { tone(200, 0.6, 'sawtooth', 0.15, 800); },
  };

  // ---------- Toast / warn UI ----------
  let toastTimer = 0;
  function toast(msg, color) {
    elToast.textContent = msg;
    elToast.style.color = color || '#ffd166';
    elToast.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { elToast.style.opacity = 0; }, 1100);
  }
  function flash(strength) {
    elFlash.style.transition = 'none';
    elFlash.style.opacity = String(strength);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        elFlash.style.transition = 'opacity .45s';
        elFlash.style.opacity = '0';
      });
    });
  }

  // ---------- Ground query ----------
  // returns {y, slope, pit}
  function groundInfo(x, z) {
    for (const r of obs) {
      if (r.kind === 'ramp' && Math.abs(x - r.x) < 1.8 && z <= r.z + r.hl && z >= r.z - r.hl) {
        return { y: r.H * (r.z + r.hl - z) / (2 * r.hl), slope: r.H / (2 * r.hl), pit: false };
      }
    }
    for (const p of obs) {
      if (p.kind === 'pit' && Math.abs(x - p.x) < p.hw && z <= p.z + p.hl && z >= p.z - p.hl) {
        return { y: -Infinity, slope: 0, pit: true };
      }
    }
    return { y: 0, slope: 0, pit: false };
  }

  // ---------- Game events ----------
  function hitPlayer(o) {
    o.dead = o.destroy ? true : o.dead;
    if (o.cool > 0) return;
    o.cool = 1.0;
    if (o.destroy) {
      spawnDebris(o.x, 0.5, o.z, o.tag === 'cone' ? 0xff7a1a : 0xc9a050, 9);
      scene.remove(o.group);
      o.dead = true;
    } else {
      spawnDebris(S.carX, 0.8, S.carZ - CAR_HL, 0xffffff, 6);
    }
    S.speed *= o.f;
    S.gap -= o.gapLoss;
    S.bounce = 1;
    S.shake = Math.max(S.shake, o.hp > 0 ? 1.0 : 0.5);
    if (o.hp > 0) {
      S.hp -= o.hp;
      flash(0.45);
      sfx.crash();
      toast(o.hp > 1 ? 'SMASHED!' : 'CRASH!', '#ff6b6b');
    } else {
      sfx.light();
    }
    if (o.kind === 'decal') return;
    if (S.hp <= 0) endGame('WRECKED', 'Your car gave up. The cat didn\'t even need to lift a paw.');
  }

  function collectCoin(o) {
    o.dead = true;
    scene.remove(o.group);
    S.coins++;
    S.nitro = Math.min(100, S.nitro + 9);
    sfx.coin();
  }

  function endGame(title, reason) {
    if (state === 'over') return;
    state = 'over';
    S.over = true;
    const pts = Math.floor(-S.carZ) + S.coins * 10 + S.close * 25;
    const best = Math.max(pts, Number(localStorage.getItem(BEST_KEY) || 0));
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    $('endTitle').innerHTML = title.replace('.', '') + '<span>.</span>';
    $('reason').textContent = reason;
    $('finalScore').textContent = Math.floor(-S.carZ) + ' m';
    $('finalCoins').textContent = S.coins;
    $('finalClose').textContent = S.close;
    $('best').textContent = best;
    $('endEyebrow').textContent = 'ONE MORE RUN?';
    endEl.classList.remove('hidden');
    hud.style.display = 'none';
    mirrorEl.style.display = 'none';
    elWarn.style.opacity = 0;
    if (engGain) engGain.gain.value = 0;
    setTimeout(() => {}, 0);
    if (title === 'CAUGHT') sfx.roar();
  }

  // ---------- Update ----------
  function updateWorld(dt) {
    // Traffic & balls move
    for (const o of obs) {
      if (o.dead) continue;
      if (o.kind === 'traffic') {
        o.z -= o.v * dt;
        o.group.position.z = o.z;
      } else if (o.kind === 'ball') {
        o.x += o.vx * dt;
        o.group.position.x = o.x;
        o.group.rotation.z -= o.vx * dt * 0.8;
        if (Math.abs(o.x) > 7) { o.dead = true; scene.remove(o.group); }
      } else if (o.kind === 'coin') {
        o.group.rotation.y += dt * 3;
      }
      if (o.cool > 0) o.cool -= dt;
    }
  }

  function update(dt) {
    S.t += dt;

    // --- Input-driven targets ---
    const boost = S.boostT > 0;
    let target = 45 + Math.min(S.t * 0.6, 40);
    if (S.brake) target = 24;
    if (boost) target += 45;
    if (S.spinT > 0) target = Math.min(target, 22);
    S.speed = approach(S.speed, target, dt * (target > S.speed ? 16 : 24));
    if (S.boostT > 0) S.boostT -= dt;
    S.wheelRot += S.speed * dt * 0.4;

    // lateral
    const tx = LANES[S.lane];
    S.carX += (tx - S.carX) * Math.min(1, dt * 11);

    // forward
    S.carZ -= S.speed * dt;

    // spin
    if (S.spinT > 0) {
      S.spinT -= dt;
      S.carRotY += S.spinDir * dt * 9;
      if (S.spinT <= 0) S.carRotY = Math.round(S.carRotY / (Math.PI * 2)) * Math.PI * 2;
    } else {
      S.carRotY *= Math.max(0, 1 - dt * 6);
    }

    // jump buffer
    if (S.jumpBuf > 0) S.jumpBuf -= dt;
    // vertical
    const gi = groundInfo(S.carX, S.carZ);
    if (S.grounded) {
      if (gi.pit) {
        S.grounded = false; S.carVY = 0;
      } else if (gi.y >= S.carY - 0.6) {
        S.carY = gi.y; S.carVY = 0;
        if (gi.slope) S.lastSlope = gi.slope;
        if (gi.slope === 0) S.lastSlope = 0;
        if (S.jumpBuf > 0) {
          S.carVY = JUMP_VY; S.grounded = false; S.jumpBuf = 0;
          sfx.ramp();
        }
      } else {
        // ramp top: launch
        S.grounded = false;
        S.carVY = S.lastSlope * S.speed * 0.95;
        if (S.lastSlope > 0) { toast('AIRBORNE!', '#8bf0ff'); sfx.ramp(); }
        S.lastSlope = 0;
      }
    }
    if (!S.grounded) {
      S.carVY -= GRAVITY * dt;
      S.carY += S.carVY * dt;
      if (!gi.pit && S.carY <= gi.y && S.carVY <= 0) {
        S.carY = gi.y; S.carVY = 0; S.grounded = true;
        if (S.jumpBuf > 0) { S.jumpBuf = 0; }
      }
      if (S.carY < -3.0) {
        endGame('SWALLOWED', 'You drove into a pit. Nothing but a tail and a very concerned meow.');
        return;
      }
    }

    // --- Collisions ---
    for (const o of obs) {
      if (o.dead) continue;
      if (o.kind === 'coin') {
        if (Math.abs(S.carX - o.x) < 1.7 && Math.abs(S.carZ - o.z) < CAR_HL + 0.8 && S.carY < 2.2) collectCoin(o);
        continue;
      }
      if (o.kind === 'decal') {
        if (Math.abs(S.carX - o.x) < o.hw + CAR_HW * 0.5 && Math.abs(S.carZ - o.z) < o.hl + CAR_HL * 0.5 && S.carY < 0.25 && o.cool <= 0) {
          if (o.tag === 'oil') {
            if (S.spinT <= 0) { S.spinT = 1.2; S.spinDir = Math.random() < 0.5 ? -1 : 1; sfx.spin(); toast('SPIN OUT!', '#ff6b6b'); }
            S.speed *= o.f;
          } else {
            S.speed *= o.f; S.carVY = Math.max(S.carVY, 4); S.grounded = false;
            sfx.light();
          }
          o.cool = 1.5;
        }
        continue;
      }
      if (o.kind === 'ramp' || o.kind === 'pit') continue;
      // solid-like (solid, traffic, ball)
      const dx = Math.abs(S.carX - o.x) - (CAR_HW + o.hw);
      const dz = Math.abs(S.carZ - o.z) - (CAR_HL + o.hl);
      if (dx < 0 && dz < 0) {
        if (S.carY < o.h - 0.3) {
          if (o.cool <= 0) {
            hitPlayer(o);
            if (S.over) return;
          }
        }
      }
      // track near-miss clearance
      if (Math.abs(S.carZ - o.z) < CAR_HL + o.hl + 3) {
        o.minE = Math.min(o.minE, dx);
      }
      if (!o.checked && S.carZ < o.z - o.hl - CAR_HL - 0.5) {
        o.checked = true;
        if (o.minE > 0 && o.minE < 0.6 && o.kind !== 'decal') {
          S.close++;
          S.points += 25;
          toast('CLOSE CALL +25', '#8bf0ff');
          sfx.close();
        }
      }
    }

    // Shake timer / stomp dust
    S.shake = Math.max(0, S.shake - dt * 2.4);

    // --- Nitro ---
    if (S.nitro > 0 && S.boostT <= 0) { /* nitro refills by coins only */ }

    // --- Cat logic ---
    const catV = 40 + Math.min(S.t * 0.45, 34) + (S.gap > 60 ? (S.gap - 60) * 0.5 : 0);
    S.gap += (S.speed - catV) * dt;
    S.gap = Math.min(GAP_MAX, S.gap);
    if (S.gap < 0.5 && S.grounded) {
      endGame('CAUGHT', 'The giant cat pinned you under a single paw. Don\'t look back next time.');
      return;
    }
    if (S.gap <= 1.6) {
      endGame('CAUGHT', 'The giant cat caught up with you. Keep your distance next time.');
      return;
    }
    S.catPhase += dt * catV * 0.12;
    S.tailT += dt;
    S.stompT += dt;
    if (S.gap < 14 && S.heartT <= 0) { sfx.heart(); S.heartT = clamp(S.gap / 14, 0.25, 1) * 0.9; }
    if (S.heartT > 0) S.heartT -= dt;
    if (S.gap < 12 && S.t - S.lastToast > 6) { S.lastToast = S.t; toast('IT\'S RIGHT BEHIND YOU!', '#ff6b6b'); }

    // Swipe attack state machine
    S.swipeCD -= dt;
    const sw = S.swipe;
    if (sw.phase === 'idle' && S.swipeCD <= 0 && S.gap < 30) {
      // aim at the car's current lane 40% of the time
      sw.lane = Math.random() < 0.4 ? S.lane : Math.floor(Math.random() * 3);
      sw.phase = 'warn'; sw.t = 0; sw.hit = false;
      elWarn.style.opacity = 1;
      sfx.close();
    }
    if (sw.phase === 'warn') {
      sw.t += dt;
      swipeMarker.material.opacity = 0.3 + 0.3 * Math.sin(S.t * 30);
      if (sw.t > 1.1) {
        sw.phase = 'strike'; sw.t = 0;
        sfx.roar();
        S.shake = Math.max(S.shake, 0.8);
        elWarn.style.opacity = 0;
        // Check hit at strike start
        const zMin = S.catPosZ - 22, zMax = S.catPosZ - 4;
        const inZ = S.carZ > zMin && S.carZ < zMax + CAR_HL;
        const inX = Math.abs(S.carX - LANES[sw.lane]) < 1.9;
        if (inZ && inX && S.carY < 2.4) {
          S.hp -= 1; sw.hit = true;
          S.gap -= 8; S.speed *= 0.5;
          flash(0.6); sfx.crash();
          S.bounce = 1.2;
          spawnDebris(S.carX, 1.2, S.carZ, 0xff9b2f, 12);
          toast('CLAWED!', '#ff6b6b');
          if (S.hp <= 0) { endGame('WRECKED', 'The cat swatted your car straight off the road.'); return; }
        }
      }
    } else if (sw.phase === 'strike') {
      sw.t += dt;
      if (sw.t > 0.55) {
        sw.phase = 'idle';
        S.swipeCD = clamp(4.5 - (-S.carZ) / 1200, 1.8, 4.5) + rand(0, 1.5);
      }
    }
    if (sw.phase === 'idle') {
      if (S.swipeCD < 0) S.swipeCD = 0;
    }

    // Car bounce
    S.bounce = Math.max(0, S.bounce - dt * 3);

    // --- Points ---
    S.points = Math.max(S.points, Math.floor(-S.carZ) + S.coins * 10 + S.close * 25);
    S.lastDist = -S.carZ;
  }

  // ---------- Sync visuals ----------
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const rearPos = new THREE.Vector3();
  let camInit = false;

  function syncVisuals(dt) {
    S.catPosZ = S.carZ + S.gap;
    // Car
    carGroup.position.set(S.carX, S.carY + Math.abs(S.bounce) * 0.1, S.carZ);
    carBody.rotation.y = S.carRotY;
    carBody.rotation.x = -(S.carVY * 0.01) + Math.sin(S.t * 30) * 0.004 * S.speed / 60 * 0;
    carBody.position.y = S.bounce > 0 ? Math.sin(S.bounce * 9) * 0.2 * S.bounce : 0;
    for (const wg of carBody.userData.wheels) wg.rotation.x = S.wheelRot;
    for (const t of carBody.userData.tail) t.material.emissiveIntensity = S.brake ? 1.5 : 0.8;

    // Cat
    cat.position.set(0, 0, S.catPosZ);
    const ph = S.catPhase;
    const legs = cat.userData.legs;
    legs[0].rotation.x = Math.sin(ph) * 0.45;
    legs[1].rotation.x = Math.sin(ph + Math.PI) * 0.45;
    legs[2].rotation.x = Math.sin(ph + Math.PI) * 0.45;
    legs[3].rotation.x = Math.sin(ph) * 0.45;
    cat.position.y = Math.abs(Math.sin(ph)) * 0.25;
    const head = cat.userData.head;
    head.rotation.y = Math.sin(S.t * 0.7) * 0.12 + (S.carX - 0) * -0.02;
    head.rotation.x = -0.06 * Math.sin(S.t * 1.3);
    head.position.y = 10.2 + Math.sin(ph * 2) * 0.12;
    const tails = cat.userData.tail;
    for (let i = 0; i < tails.length; i++) {
      tails[i].rotation.y = Math.sin(S.tailT * 2.2 - i * 0.5) * 0.25;
      tails[i].rotation.x = -0.08 - i * 0.02;
    }

    // Swipe paw & marker
    const sw = S.swipe;
    const laneX = LANES[sw.lane];
    swipeMarker.position.set(laneX, 0.07, S.catPosZ - 13);
    if (sw.phase === 'warn') {
      swipeMarker.material.opacity = 0.25 + 0.3 * Math.sin(S.t * 30);
      swipePaw.visible = true;
      swipePaw.position.set(laneX, 9 + Math.sin(S.t * 12) * 0.4, S.catPosZ - 6);
      swipePaw.rotation.x = 0.3;
    } else if (sw.phase === 'strike') {
      swipeMarker.material.opacity = 0.0;
      const p = clamp(sw.t / 0.25, 0, 1);
      swipePaw.visible = true;
      swipePaw.position.set(laneX, 9 - p * 7.2, S.catPosZ - 6 - p * 10);
      swipePaw.rotation.x = 0.3 + p * 0.8;
    } else {
      swipeMarker.material.opacity = 0.0;
      swipePaw.visible = false;
    }

    // Camera (follow)
    const shk = S.shake * 0.4 + Math.max(0, 1 - S.gap / 25) * 0.25;
    const nx = (Math.random() - 0.5) * shk, ny = (Math.random() - 0.5) * shk;
    camTarget.set(S.carX * 0.55 + nx, 1.9 + S.carY * 0.5 + ny, S.carZ - 12);
    camPos.set(S.carX * 0.55 + nx * 0.5, 5.9 + S.carY * 0.4 + ny * 0.5, S.carZ + 11.5);
    if (!camInit) {
      camera.position.copy(camPos);
      camInit = true;
    }
    camera.position.lerp(camPos, Math.min(1, dt * 10));
    camera.lookAt(camTarget);

    // Rear cam: inside the car, looking back at the cat
    rearPos.set(S.carX, 2.8 + S.carY, S.carZ + 2.6);
    rearCam.position.copy(rearPos);
    rearCam.lookAt(S.carX * 0.5, 3.6 + S.carY, S.carZ + 80);

    // Sun follows car
    sun.position.set(S.carX + 25, 45, S.carZ + 20);
    sun.target.position.set(S.carX, 0, S.carZ);
    sun.target.updateMatrixWorld();
    sc.updateProjectionMatrix();

    // Road & grass follow
    roadMesh.position.set(0, 0, S.carZ);
    grassMesh.position.set(0, -0.05, S.carZ);
    roadTex.offset.y = ((-S.carZ - ROAD_LEN / 2) / 40) % 1;
    // Pit/ramp visuals are placed in world coords already
    // Fog & sky: fog tracks distance nicely
    // Car is slightly tilted when braking
    carGroup.rotation.x = S.brake ? -0.02 : 0;
    // Engine audio
    if (actx && engOsc && state === 'playing') {
      engOsc.frequency.setTargetAtTime(48 + S.speed * 1.4, actx.currentTime, 0.05);
      engGain.gain.setTargetAtTime(muted ? 0 : (0.035 + S.speed / 1200), actx.currentTime, 0.1);
    }
    // Cat stomp sound / shake
    if (S.stompT > 0.6 && sfxOkStomp()) {
      S.stompT = 0;
      if (S.gap < 22) { S.shake = Math.max(S.shake, 0.4); tone(55, 0.25, 'sine', 0.22, 30); }
    }
  }
  function sfxOkStomp() { return !!actx && !muted; }

  // ---------- HUD ----------
  let hudTimer = 0;
  function updateHUD(dt) {
    hudTimer -= dt;
    if (hudTimer > 0) return;
    hudTimer = 0.05;
    elScore.textContent = String(S.points).padStart(4, '0');
    elSpeed.textContent = Math.round(S.speed * 3.2);
    elCoins.textContent = S.coins;
    elHearts.textContent = '♥'.repeat(Math.max(0, S.hp)) + '♡'.repeat(Math.max(0, HP_MAX - S.hp));
    gapFill.style.width = clamp((S.gap / 60) * 100, 0, 100) + '%';
    gapFill.style.background = S.gap < 14 ? 'linear-gradient(90deg,#ff1a1a,#ff6b6b)' : '';
    nitroFill.style.width = clamp(S.nitro, 0, 100) + '%';
  }

  // ---------- Render ----------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rearCam.aspect = mirrorRectAspect();
    rearCam.updateProjectionMatrix();
  }
  function mirrorRectAspect() {
    const r = mirrorEl.getBoundingClientRect();
    return (r.width || 300) / (r.height || 130);
  }
  window.addEventListener('resize', resize);

  function renderScene() {
    const pr = renderer.getPixelRatio();
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    // Rear mirror
    if (state === 'playing' || state === 'paused') {
      const r = mirrorEl.getBoundingClientRect();
      if (r.width > 0) {
        const x = r.left * pr, y = (H - r.bottom) * pr;
        const w = r.width * pr, h = r.height * pr;
        renderer.setScissorTest(true);
        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);
        renderer.clear(true, true, true);
        rearCam.aspect = r.width / r.height;
        rearCam.updateProjectionMatrix();
        renderer.render(scene, rearCam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, W, H);
      }
    }
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state === 'playing') {
      update(dt);
      if (state === 'playing') {
        updateWorld(dt);
        updateDebris(dt);
        spawnAhead();
        cullBehind();
        syncVisuals(dt);
        updateHUD(dt);
      }
    } else if (S) {
      // menu / paused / game over: keep the scene alive visually
      updateDebris(dt * 0.5);
      syncVisuals(0);
    }
    renderScene();
    requestAnimationFrame(frame);
  }

  // ---------- Controls ----------
  function changeLane(dir) {
    if (state !== 'playing') return;
    S.lane = clamp(S.lane + dir, 0, 2);
  }
  function doJump() {
    if (state !== 'playing') return;
    S.jumpBuf = 0.18;
    if (S.grounded) {
      S.carVY = JUMP_VY; S.grounded = false; S.jumpBuf = 0;
      tone(380, 0.15, 'triangle', 0.15, 620);
    }
  }
  function doNitro() {
    if (state !== 'playing') return;
    if (S.nitro >= 25 && S.boostT <= 0) {
      S.nitro -= 25;
      S.boostT = 2.5;
      sfx.nitro();
    }
  }
  const held = { brake: false };
  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (e.repeat && k !== 'ArrowDown' && k !== 'KeyS') return;
    if (k === 'ArrowLeft' || k === 'KeyA') changeLane(-1);
    else if (k === 'ArrowRight' || k === 'KeyD') changeLane(1);
    else if (k === 'ArrowUp' || k === 'KeyW' || k === 'Space') doJump();
    else if (k === 'ArrowDown' || k === 'KeyS') { if (S) S.brake = true; }
    else if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyX') doNitro();
    else if (k === 'Escape' || k === 'KeyP') togglePause();
    else if (k === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; }
    else if (k === 'Enter' && state === 'menu') startGame();
    else if (k === 'Enter' && state === 'over') startGame();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { if (S) S.brake = false; }
  });

  // Touch: swipe for lanes/jump/brake, tap for nitro
  let tStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    tStart = { x: t.clientX, y: t.clientY, time: performance.now() };
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!tStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tStart.x, dy = t.clientY - tStart.y;
    const dur = performance.now() - tStart.time;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) changeLane(dx > 0 ? 1 : -1);
    else if (dy < -40) doJump();
    else if (dy > 40 && S) { S.brake = true; setTimeout(() => { if (S) S.brake = false; }, 500); }
    else if (dur < 300) doNitro();
    tStart = null;
    e.preventDefault();
  }, { passive: false });

  // ---------- Buttons ----------
  function show(el, on) { el.classList.toggle('hidden', !on); }
  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      show(pausedEl, true);
      if (S) S.brake = false;
    } else if (state === 'paused') {
      state = 'playing';
      show(pausedEl, false);
    }
  }
  function startGame() {
    ensureAudio();
    S = freshState();
    S.gap = GAP_START;
    S.catPosZ = 0;
    clearWorld();
    S.swipe.phase = 'idle';
    spawnAhead();
    // Spawn the cat behind
    S.catPosZ = S.carZ + S.gap;
    cat.position.z = S.catPosZ;
    camInit = false;
    state = 'playing';
    show(startEl, false); show(endEl, false); show(pausedEl, false);
    hud.style.display = 'flex';
    mirrorEl.style.display = 'block';
    sfx.roar();
    toast('RUN!', '#ff9b2f');
    if (engGain) engGain.gain.value = 0.05;
    resize();
  }
  $('play').addEventListener('click', startGame);
  $('again').addEventListener('click', startGame);
  $('home').addEventListener('click', () => { window.location.href = '../../index.html'; });
  $('resume').addEventListener('click', togglePause);
  $('pause').addEventListener('click', togglePause);

  // Best score display
  $('best').textContent = localStorage.getItem(BEST_KEY) || '0';
  resize();
  requestAnimationFrame(frame);
  // Initial preview state: show the cat idle behind a parked car
  S = freshState();
  S.catPosZ = S.carZ + S.gap;
  spawnAhead();
  window.__giantCat = { get state() { return state; }, get S() { return S; } };
})();
