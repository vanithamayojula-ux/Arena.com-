// Procedural low-poly ships (nose points down -Z, up is +Y).
import { LIVERIES } from './sim.js';
import { GLOW_TEX } from './world.js';

const THREE = window.THREE;

/** Loft a closed hull through cross-section stations: [z, halfWidth, top, bottom, shoulder?]. */
function loft(stations) {
  const ring = (w, top, bot, sh = 0.72) => [
    [0, top], [w * sh, top * 0.78 + bot * 0.22], [w, (top + bot) * 0.5], [w * 0.62, bot], [0, bot * 1.08],
    [-w * 0.62, bot], [-w, (top + bot) * 0.5], [-w * sh, top * 0.78 + bot * 0.22],
  ];
  const rings = stations.map(([z, w, t, b, sh]) => ring(w, t, b, sh).map(([x, y]) => [x, y, z]));
  const verts = [];
  const push = (a, b, c) => verts.push(...a, ...b, ...c);
  const n = rings[0].length;
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = rings[r][i], b = rings[r][j], c = rings[r + 1][i], d = rings[r + 1][j];
      push(a, c, b); push(b, c, d);
    }
  }
  // caps
  const cap = (rg, flip) => {
    const cx = rg.reduce((s, p) => s + p[0], 0) / n, cy = rg.reduce((s, p) => s + p[1], 0) / n, cz = rg[0][2];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      flip ? push([cx, cy, cz], rg[j], rg[i]) : push([cx, cy, cz], rg[i], rg[j]);
    }
  };
  cap(rings[0], false); cap(rings[rings.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return g;
}

/** Flat plate from an XZ outline, extruded in Y. */
function plate(points, thick = 0.14) {
  const sh = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
  g.rotateX(Math.PI / 2); // shape XY -> XZ (z flipped), extrude along -Y
  g.translate(0, thick / 2, 0);
  g.computeVertexNormals();
  return g;
}

function fin(points, thick = 0.1) {
  // outline in (z, y), extruded along x
  const sh = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(thick / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

const DESIGNS = {
  viper: {
    body: [[-3.5, 0.06, 0.1, -0.05], [-2.3, 0.4, 0.46, -0.24], [-0.7, 0.72, 0.62, -0.34], [1.0, 0.78, 0.56, -0.34], [2.3, 0.6, 0.42, -0.3]],
    wing: [[0.5, -0.6], [3.2, 1.3], [3.3, 1.9], [0.9, 1.5]],
    wingY: -0.05,
    fins: [[1.0, 1.9, 0.0], [1.7, 2.4, 0.0]],
    finShape: [[1.2, 0.3], [2.4, 1.5], [2.7, 1.5], [2.7, 0.3]],
    engines: [[-0.85, 0.0, 2.35], [0.85, 0.0, 2.35]],
    engR: 0.38,
    canopy: [0, 0.5, -1.2, 0.55, 0.38, 1.3],
  },
  razor: {
    body: [[-3.9, 0.04, 0.08, -0.04], [-2.5, 0.28, 0.34, -0.2], [-0.8, 0.5, 0.5, -0.3], [1.0, 0.62, 0.46, -0.3], [2.5, 0.5, 0.36, -0.26]],
    wing: [[0.2, -0.5], [3.6, -0.5], [3.7, 0.2], [1.4, 1.9], [0.7, 1.9]],
    wingY: 0.1,
    fins: [[0.0, 0.0, 0.0]],
    finShape: [[1.4, 0.2], [2.8, 1.2], [3.0, 1.2], [3.0, 0.2]],
    engines: [[-0.0, 0.0, 2.55]],
    engR: 0.5,
    canopy: [0, 0.42, -1.5, 0.4, 0.3, 1.1],
    twin: [[-1.9, 0.0, 1.6], [1.9, 0.0, 1.6]],
  },
  bulwark: {
    body: [[-3.0, 0.2, 0.3, -0.2], [-1.9, 0.7, 0.62, -0.42], [-0.2, 1.05, 0.78, -0.5], [1.3, 1.1, 0.72, -0.5], [2.4, 0.95, 0.6, -0.45]],
    wing: [[0.2, -1.0], [2.3, -0.4], [2.5, 1.9], [0.4, 1.9]],
    wingY: -0.2,
    fins: [[0.0, 0.0, 0.0]],
    finShape: [[1.4, 0.4], [2.4, 1.9], [2.8, 1.9], [2.8, 0.4]],
    engines: [[-0.9, 0.0, 2.45], [0.9, 0.0, 2.45], [0.0, 0.1, 2.5]],
    engR: 0.42,
    canopy: [0, 0.72, -1.0, 0.7, 0.45, 1.5],
    pods: [[-2.5, -0.1, 0.4], [2.5, -0.1, 0.4]],
  },
  wraith: {
    body: [[-3.6, 0.05, 0.08, -0.05], [-2.4, 0.32, 0.4, -0.22], [-0.6, 0.6, 0.55, -0.32], [1.2, 0.65, 0.5, -0.32], [2.4, 0.5, 0.36, -0.28]],
    wing: [[0.2, -0.3], [2.4, 0.8], [3.4, 2.6], [2.4, 2.5], [1.0, 1.4], [0.6, 1.9]],
    wingY: 0.0,
    fins: [[0.0, 0.0, 0.0]],
    finShape: [[1.2, 0.2], [2.6, 1.6], [3.0, 1.5], [2.8, 0.2]],
    engines: [[-0.7, 0.0, 2.4], [0.7, 0.0, 2.4]],
    engR: 0.34,
    canopy: [0, 0.48, -1.4, 0.45, 0.32, 1.2],
  },
};

const flameGeo = (() => {
  const g = new THREE.ConeGeometry(1, 1, 12, 1, true);
  g.rotateX(-Math.PI / 2); // tip towards -z
  g.rotateY(Math.PI);      // tip towards +z (backwards)
  g.translate(0, 0, 0.5);
  return g;
})();

const flameMat = (color) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color('#ffffff') } },
  vertexShader: 'varying float vT; void main(){ vT = position.z; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying float vT; uniform vec3 uColor; uniform vec3 uCore; void main(){ float t = clamp(vT,0.0,1.0); vec3 c = mix(uCore, uColor, smoothstep(0.0,0.7,t)); gl_FragColor = vec4(c*1.6, (1.0-t)*0.9); }',
});

export function buildShip(typeId, liveryIdx) {
  const d = DESIGNS[typeId] || DESIGNS.viper;
  const lv = LIVERIES[liveryIdx % LIVERIES.length];
  const root = new THREE.Group();
  const model = new THREE.Group();
  model.scale.setScalar(1.15);
  root.add(model);

  const body = new THREE.MeshPhongMaterial({ color: lv.a, shininess: 90, specular: 0x99aabb, flatShading: true });
  const trim = new THREE.MeshPhongMaterial({ color: lv.b, shininess: 40, specular: 0x445566, flatShading: true });
  const metal = new THREE.MeshPhongMaterial({ color: 0x20252e, shininess: 100, specular: 0x8899aa, flatShading: true });
  const neon = new THREE.MeshBasicMaterial({ color: lv.glow });
  const glass = new THREE.MeshPhongMaterial({ color: 0x0a1a2a, shininess: 200, specular: 0xffffff, emissive: new THREE.Color(lv.glow).multiplyScalar(0.12), flatShading: false });
  const flashable = [body, trim];

  model.add(new THREE.Mesh(loft(d.body), body));

  // wings
  for (const side of [-1, 1]) {
    const pts = d.wing.map(([x, z]) => [side * x, z]);
    if (side < 0) pts.reverse();
    const wg = plate(pts, 0.16);
    const w = new THREE.Mesh(wg, trim);
    w.position.y = d.wingY;
    model.add(w);
    // top coat plate (livery) slightly inset
    const coat = new THREE.Mesh(wg, body);
    coat.scale.set(0.82, 1, 0.82);
    coat.position.set(side * 0.25, d.wingY + 0.1, 0.1);
    model.add(coat);
    // neon edge
    const ex = d.wing[2];
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), neon);
    strip.position.set(side * (ex[0] - 0.05), d.wingY + 0.1, ex[1] - 0.45);
    model.add(strip);
    // tail fins
    const fs = new THREE.Mesh(fin(d.finShape, 0.1), body);
    fs.position.set(side * (d.fins.length > 1 ? 1.0 : 0.9), 0.15, 0);
    fs.rotation.z = side * 0.14;
    if (d.fins.length > 0) model.add(fs);
  }

  // canopy
  const [cx, cy, cz, sx, sy, sz] = d.canopy;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.position.set(cx, cy - 0.05, cz);
  canopy.scale.set(sx, sy, sz);
  model.add(canopy);

  // pods (bulwark)
  if (d.pods) for (const [x, y, z] of d.pods) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 3.2, 8), metal);
    p.rotation.x = Math.PI / 2; p.position.set(x, y, z);
    model.add(p);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 8), neon);
    nose.rotation.x = -Math.PI / 2; nose.position.set(x, y, z - 2.0);
    model.add(nose);
  }

  // engines & flames
  const nozzles = [];
  const flames = [];
  const glows = [];
  const addEngine = (x, y, z, r) => {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 1.3, 10), metal);
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(x, y, z - 0.25);
    model.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.07, 6, 16), neon);
    ring.position.set(x, y, z + 0.35);
    model.add(ring);
    const fl = new THREE.Mesh(flameGeo, flameMat(lv.glow));
    fl.position.set(x, y, z + 0.38);
    fl.scale.set(r * 1.6, r * 1.6, 1.4);
    model.add(fl);
    flames.push(fl);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX(), color: lv.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(x, y, z + 0.5);
    sp.scale.setScalar(r * 6);
    model.add(sp);
    glows.push(sp);
    nozzles.push(new THREE.Vector3(x, y, z + 0.5));
  };
  for (const [x, y, z] of d.engines) addEngine(x, y, z, d.engR);
  if (d.twin) for (const [x, y, z] of d.twin) addEngine(x, y, z, d.engR * 0.55);

  // neon belly lines
  for (const side of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 2.4), neon);
    l.position.set(side * (d.body[2][1] * 0.98), (d.body[2][2] + d.body[2][3]) * 0.5, 0.2);
    model.add(l);
  }

  // shield bubble
  const shield = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 14), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color('#5ae6ff') }, uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform vec3 uColor; uniform float uA; uniform float uTime; void main(){ float f = pow(1.0-abs(dot(vN,vV)),2.5); float hex = 0.6+0.4*sin(vP.x*5.0+uTime*3.0)*sin(vP.y*5.0)*sin(vP.z*5.0+uTime*2.0); gl_FragColor = vec4(uColor*(0.6+hex), (f*0.8+0.06)*uA); }',
  }));
  shield.visible = false;
  root.add(shield);

  // hover glow under the ship
  const under = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX(), color: lv.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  under.scale.setScalar(7);
  under.position.set(0, -0.9, 0.4);
  model.add(under);

  root.userData = {
    model, nozzles, flames, glows, shield, body, trim, flashable, livery: lv, under,
    setLook(state, time) {
      // thrust → flame length
      const th = state.boosting ? 3.4 : 1 + state.speedFrac * 0.5;
      const flick = 1 + Math.sin(time * 60 + state.idx) * 0.08;
      for (const f of flames) { f.scale.z = th * flick * 1.4; }
      for (const g of glows) g.material.opacity = state.boosting ? 1 : 0.65;
      const hf = state.hitFlash > 0 ? Math.min(1, state.hitFlash * 5) : 0;
      for (const m of flashable) m.emissive.setScalar(hf * 0.9);
      const sh = state.shield > 0 || (state.invuln > 0 && state.alive);
      shield.visible = sh;
      if (sh) { shield.material.uniforms.uA.value = state.shield > 0 ? 1 : 0.5 + 0.3 * Math.sin(time * 20); shield.material.uniforms.uTime.value = time; }
      under.material.opacity = 0.75 / (1 + Math.max(0, state.h - 2.4) * 0.12);
    },
  };
  return root;
}
