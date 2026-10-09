// Builds the 3D world for a track: procedural sky, track ribbon (surface, hull,
// rails, energy walls), neon gates, pads, planets / suns, scenery and the
// start gantry. All GPU-friendly: a few dozen draw calls for a whole circuit.

import { rng, norm, cross } from './vec.js';
import { SAMPLE_SPACING } from './track.js';

const THREE = window.THREE;

const col = (hex) => new THREE.Color(hex);
const vec3c = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };

// ---------------------------------------------------------------------------
// Shared GLSL
// ---------------------------------------------------------------------------
const FOG_PARS = `
  uniform vec3 uFogColor; uniform float uFogDensity;
  vec3 applyFog(vec3 c, vec3 wp){ float d = length(wp - cameraPosition); float f = 1.0 - exp(-d*d*uFogDensity*uFogDensity); return mix(c, uFogColor, clamp(f,0.0,1.0)); }
`;
const HASH = `
  float hash11(float p){ p = fract(p*.1031); p *= p+33.33; p *= p+p; return fract(p); }
  float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float hash31(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
`;

const surfaceVS = `
  varying vec2 vUv; varying vec3 vWorld;
  void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }
`;

const surfaceFS = `
  varying vec2 vUv; varying vec3 vWorld;
  uniform float uTime; uniform vec3 uBase; uniform vec3 uGrid; uniform vec3 uAccent; uniform float uLen;
  ${FOG_PARS}
  ${HASH}
  float aaLine(float x, float w){ float fw = fwidth(x)+1e-5; return 1.0 - smoothstep(w, w+fw*1.5, abs(x)); }
  void main(){
    float u = vUv.x; float v = vUv.y;
    float c = abs(u*2.0-1.0);
    vec3 col = uBase*(0.7 + 0.9*(1.0-c));
    // panel tiles
    vec2 tile = vec2(floor(u*8.0), floor(v/16.0));
    col *= 0.88 + 0.24*hash21(tile);
    // grid
    float gx = aaLine(fract(v/16.0+0.5)-0.5, 0.012);
    float gy = aaLine(fract(u*8.0+0.5)-0.5, 0.02);
    float pulse = 0.35 + 0.65*smoothstep(0.82,1.0,fract(v/220.0 - uTime*0.55));
    col += uGrid*(gx*0.22 + gy*0.12)*(0.5+pulse*1.4);
    // lane lines + dashed centre
    float lane = aaLine(u-0.25,0.004)+aaLine(u-0.75,0.004);
    col += uGrid*lane*0.35;
    float dash = step(0.5, fract(v/24.0));
    col += uAccent*aaLine(u-0.5,0.005)*dash*0.9;
    // glowing edge strips
    float edge = smoothstep(0.045,0.0,min(u,1.0-u));
    float edgeCore = smoothstep(0.012,0.0,min(u,1.0-u));
    col += uGrid*edge*0.55 + uAccent*edgeCore*1.2;
    // start / finish line
    float sl = step(v,14.0) + step(uLen-8.0,v);
    if (sl > 0.5) { float ch = mod(floor(u*14.0)+floor(v/3.5), 2.0); col = mix(col, vec3(ch*0.92+0.04), 0.92); }
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

const hullFS = `
  varying vec2 vUv; varying vec3 vWorld;
  uniform float uTime; uniform vec3 uBase; uniform vec3 uGrid;
  ${FOG_PARS}
  ${HASH}
  float aaLine(float x, float w){ float fw = fwidth(x)+1e-5; return 1.0 - smoothstep(w, w+fw*1.5, abs(x)); }
  void main(){
    float v = vUv.y;
    vec3 col = uBase*0.9*(0.6+0.8*hash21(vec2(floor(v/30.0), floor(vUv.x*3.0))));
    float stripe = aaLine(fract(v/30.0+0.5)-0.5, 0.03);
    col += uGrid*stripe*0.5*(0.6+0.4*sin(uTime*2.0+floor(v/30.0)));
    col += uGrid*aaLine(vUv.x-0.5,0.01)*0.3;
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

const railFS = `
  varying vec2 vUv; varying vec3 vWorld;
  uniform float uTime; uniform vec3 uColor;
  ${FOG_PARS}
  void main(){
    float v = vUv.y;
    float chase = 0.5 + 0.5*sin(v*0.18 - uTime*14.0);
    float sec = smoothstep(0.55,1.0,chase);
    vec3 col = uColor*(0.55 + 1.35*sec);
    gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
  }
`;

const wallFS = `
  varying vec2 vUv; varying vec3 vWorld;
  uniform float uTime; uniform vec3 uColor; uniform float uAlpha;
  ${FOG_PARS}
  void main(){
    float h = vUv.x; float v = vUv.y;
    float a = pow(1.0-h, 1.6)*0.5;
    float hexRow = abs(fract(h*5.0)-0.5);
    float hexCol = abs(fract(v/9.0 + floor(h*5.0)*0.5)-0.5);
    float grid = smoothstep(0.46,0.5,max(hexRow*1.2, hexCol));
    a += grid*(1.0-h)*0.35;
    a += smoothstep(0.85,1.0,fract(v/300.0 - uTime*0.7))*0.15*(1.0-h);
    vec3 col = applyFog(uColor*(0.8+grid*1.4), vWorld);
    gl_FragColor = vec4(col, a*uAlpha);
  }
`;

const padFS = `
  varying vec2 vUv; varying vec3 vWorld;
  uniform float uTime; uniform vec3 uColor; uniform float uMode;
  ${FOG_PARS}
  void main(){
    float u = vUv.x; float v = vUv.y;
    float edge = smoothstep(0.0,0.12,min(u,1.0-u));
    float a;
    if (uMode < 0.5) {
      // chevrons marching forward
      float cx = abs(u*2.0-1.0);
      float ph = fract(v*0.09 - uTime*2.4 - cx*0.55);
      a = smoothstep(0.0,0.1,ph)*(1.0-smoothstep(0.35,0.5,ph));
      a = a*0.9 + 0.18;
    } else {
      float ph = fract(v*0.22 - uTime*3.0);
      a = 0.25 + 0.75*smoothstep(0.6,1.0,ph);
    }
    a *= edge;
    gl_FragColor = vec4(applyFog(uColor*(0.9+a), vWorld), a);
  }
`;

const gateVS = `
  attribute vec3 iColor; attribute float iPhase;
  varying vec3 vCol; varying vec3 vWorld; varying float vP;
  void main(){
    vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.0);
    vWorld = wp.xyz; vCol = iColor; vP = iPhase;
    gl_Position = projectionMatrix*viewMatrix*wp;
  }
`;
const gateFS = `
  varying vec3 vCol; varying vec3 vWorld; varying float vP;
  uniform float uTime; uniform float uLen;
  ${FOG_PARS}
  void main(){
    float w = 0.5+0.5*sin(vP*uLen/70.0 - uTime*7.0);
    float b = 0.28 + 0.85*pow(w,3.0);
    gl_FragColor = vec4(applyFog(vCol*b, vWorld), 1.0);
  }
`;

const towerFS = `
  varying vec3 vWorld; varying vec3 vN; varying vec3 vObj;
  uniform vec3 uBase; uniform vec3 uLight; uniform float uTime;
  ${FOG_PARS}
  ${HASH}
  void main(){
    vec3 n = normalize(vN);
    float side = 1.0 - step(0.6, abs(n.y));
    vec2 cell = vec2(vWorld.x+vWorld.z, vWorld.y)*vec2(0.22,0.14);
    vec2 id = floor(cell); vec2 fr = fract(cell);
    float lit = step(0.72, hash21(id+floor(n.x*3.0+n.z*5.0)));
    float win = step(0.15,fr.x)*step(fr.x,0.8)*step(0.2,fr.y)*step(fr.y,0.75);
    vec3 c = uBase*(0.6+0.8*hash21(id*0.1)) + uBase*0.4*abs(n.x);
    c += uLight*lit*win*side*(0.8+0.4*sin(uTime*2.0+hash21(id)*30.0));
    // horizontal trim lights
    c += uLight*0.6*step(0.92, fract(vWorld.y*0.02))*side;
    gl_FragColor = vec4(applyFog(c, vWorld), 1.0);
  }
`;
const towerVS = `
  varying vec3 vWorld; varying vec3 vN; varying vec3 vObj;
  void main(){
    vec4 wp = modelMatrix*instanceMatrix*vec4(position,1.0);
    vWorld = wp.xyz; vObj = position;
    vN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
    gl_Position = projectionMatrix*viewMatrix*wp;
  }
`;

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------
const skyVS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*mat4(mat3(modelViewMatrix))*vec4(position,1.0); gl_Position = p.xyww; }`;
const skyFS = `
  varying vec3 vDir;
  uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uSunDir; uniform vec3 uSunCol;
  uniform float uSunSize; uniform float uNeb; uniform float uAurora; uniform float uSeed;
  ${HASH}
  float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(7.1,3.3,1.7); a*=0.5; } return s; }
  float stars(vec3 d, float scale, float thr){
    vec3 p = d*scale; vec3 i = floor(p); vec3 f = fract(p)-0.5;
    float h = hash31(i+uSeed);
    vec3 o = vec3(hash31(i+1.7), hash31(i+4.1), hash31(i+9.3))-0.5;
    float dd = length(f-o*0.6);
    float m = step(thr, h) * smoothstep(0.22, 0.0, dd);
    return m*(0.6+0.4*sin(uTime*(1.5+h*3.0)+h*40.0));
  }
  void main(){
    vec3 d = normalize(vDir);
    float n1 = fbm(d*uNeb*2.2 + uSeed);
    float n2 = fbm(d*uNeb*4.5 - uSeed*1.3 + 11.0);
    vec3 col = uA;
    col = mix(col, uB, smoothstep(0.35,0.8,n1));
    col = mix(col, uC, smoothstep(0.55,1.0,n2*n1*1.7)*0.85);
    col *= 0.55 + 0.9*smoothstep(0.2,0.9,n1);
    // dust lane
    col *= 1.0 - 0.45*smoothstep(0.4,0.7,fbm(d*uNeb*1.3+3.0))*(1.0-abs(d.y));
    // stars
    float st = stars(d,160.0,0.93)*1.0 + stars(d,340.0,0.95)*0.8 + stars(d,70.0,0.97)*1.6;
    col += vec3(0.85,0.92,1.0)*st*(1.0-0.6*smoothstep(0.4,0.9,n1));
    // sun
    float sd = dot(d, normalize(uSunDir));
    float disc = smoothstep(1.0-uSunSize, 1.0-uSunSize*0.82, sd);
    float glow = pow(max(sd,0.0), 24.0)*0.9 + pow(max(sd,0.0), 380.0)*1.4;
    col += uSunCol*(disc*2.0 + glow*0.7);
    // aurora curtains
    if (uAurora > 0.01) {
      float ang = atan(d.z, d.x);
      float bands = fbm(vec3(ang*2.2, d.y*1.2, uTime*0.05));
      float curtain = smoothstep(0.35,0.75,bands) * smoothstep(0.05,0.3,d.y) * (1.0-smoothstep(0.4,0.95,d.y));
      curtain *= 0.55+0.45*sin(ang*14.0 + bands*9.0 + uTime*0.4);
      vec3 ac = mix(vec3(0.1,1.0,0.6), vec3(0.5,0.3,1.0), smoothstep(0.2,0.8,d.y));
      col += ac*curtain*uAurora*1.3;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const planetVS = `varying vec3 vN; varying vec3 vObj; varying vec3 vWorld; void main(){ vN = normalize(mat3(modelMatrix)*normal); vObj = normalize(position); vWorld = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vWorld,1.0); }`;
const planetFS = `
  varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
  uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uSun; uniform float uTime; uniform float uEmissive;
  ${HASH}
  float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.1+3.7; a*=0.5;} return s; }
  void main(){
    vec3 n = normalize(vN);
    float bands = fbm(vec3(vObj.x*1.5, vObj.y*7.0 + fbm(vObj*3.0)*1.4, vObj.z*1.5) + uTime*0.01);
    vec3 base = mix(uC1, uC2, smoothstep(0.25,0.75,bands));
    float diff = max(dot(n, normalize(uSun)), 0.0);
    vec3 col = base*(0.06 + 1.0*diff);
    vec3 V = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(dot(n,V),0.0), 3.0);
    col += uC2*rim*(0.25 + 0.9*diff);
    col = mix(col, base*(1.6 + bands*1.4), uEmissive);
    col += uC2*rim*uEmissive*1.2;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const boltVS = `
  attribute vec3 iStart; attribute vec3 iDir; attribute vec3 iSeed;
  varying float vA; varying vec3 vCol;
  uniform float uTime; uniform vec3 uColA; uniform vec3 uColB;
  void main(){
    float T = 2.2 + iSeed.x*3.0;
    float t = mod(uTime*0.6 + iSeed.y*T, T)/T;
    vec3 p = iStart + iDir*t*1800.0;
    vec3 view = normalize(p - cameraPosition);
    vec3 right = normalize(cross(iDir, view));
    vec3 wp = p + iDir*position.y*(160.0+iSeed.z*140.0) + right*position.x*(5.0+iSeed.z*5.0);
    vA = smoothstep(0.0,0.1,t)*(1.0-smoothstep(0.85,1.0,t))*(1.0-abs(position.y)*0.8);
    vCol = mix(uColA, uColB, iSeed.z);
    gl_Position = projectionMatrix*viewMatrix*vec4(wp,1.0);
  }
`;
const boltFS = `varying float vA; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol*1.6, vA); }`;

const flashVS = `
  attribute float aSeed; varying float vA; uniform float uTime; uniform float uScale;
  void main(){
    float T = 1.6 + fract(aSeed*7.0)*3.0;
    float t = mod(uTime + aSeed*30.0, T)/T;
    float p = pow(smoothstep(0.0,0.06,t)*(1.0-smoothstep(0.06,0.4,t)),1.5);
    vA = p;
    vec4 mv = viewMatrix*vec4(position,1.0);
    gl_PointSize = (40.0 + 260.0*p) * uScale / -mv.z;
    gl_Position = projectionMatrix*mv;
  }
`;
const flashFS = `varying float vA; uniform vec3 uCol; void main(){ vec2 c = gl_PointCoord-0.5; float r = length(c)*2.0; float a = pow(max(1.0-r,0.0),2.0)*vA; gl_FragColor = vec4(uCol*(1.0+a), a); }`;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function ribbon(track, i0, i1, cols, opts = {}) {
  const { N, ds, P, U, R } = track;
  const rows = i1 - i0 + 1;
  const nc = cols.length;
  const pos = new Float32Array(rows * nc * 3);
  const uv = new Float32Array(rows * nc * 2);
  for (let r = 0; r < rows; r++) {
    const i = (i0 + r) % N;
    const hw = track.W[i] / 2;
    const vDist = (i0 + r) * ds;
    for (let c = 0; c < nc; c++) {
      const cc = cols[c];
      const x = (cc.k || 0) * hw + (cc.a || 0);
      const h = typeof cc.h === 'function' ? cc.h(hw) : cc.h || 0;
      const o = (r * nc + c) * 3;
      pos[o] = P[i * 3] + R[i * 3] * x + U[i * 3] * h;
      pos[o + 1] = P[i * 3 + 1] + R[i * 3 + 1] * x + U[i * 3 + 1] * h;
      pos[o + 2] = P[i * 3 + 2] + R[i * 3 + 2] * x + U[i * 3 + 2] * h;
      uv[(r * nc + c) * 2] = cc.u ?? c / (nc - 1);
      uv[(r * nc + c) * 2 + 1] = vDist;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      if (opts.skip && opts.skip.includes(c)) continue;
      const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function hashGrid(track, cell = 140) {
  const map = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const { N, P, ds } = track;
  const stride = Math.max(1, Math.round(12 / ds));
  for (let i = 0; i < N; i += stride) {
    const k = key(Math.floor(P[i * 3] / cell), Math.floor(P[i * 3 + 1] / cell), Math.floor(P[i * 3 + 2] / cell));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(i);
  }
  return {
    clear(p, minD, selfIdx = -1, selfArc = 0) {
      const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
      const rng = Math.ceil(minD / cell);
      for (let x = cx - rng; x <= cx + rng; x++) for (let y = cy - rng; y <= cy + rng; y++) for (let z = cz - rng; z <= cz + rng; z++) {
        const l = map.get(key(x, y, z));
        if (!l) continue;
        for (const i of l) {
          if (selfIdx >= 0) {
            const arc = Math.min(Math.abs(i - selfIdx), N - Math.abs(i - selfIdx)) * ds;
            if (arc < selfArc) continue;
          }
          const dx = P[i * 3] - p[0], dy = P[i * 3 + 1] - p[1], dz = P[i * 3 + 2] - p[2];
          if (dx * dx + dy * dy + dz * dz < minD * minD) return false;
        }
      }
      return true;
    },
  };
}

function frameMatrix(track, s, x, h, scale, out) {
  const f = track.sample(s);
  const m = out || new THREE.Matrix4();
  m.makeBasis(new THREE.Vector3(...f.R), new THREE.Vector3(...f.U), new THREE.Vector3(-f.T[0], -f.T[1], -f.T[2]));
  m.setPosition(f.P[0] + f.R[0] * x + f.U[0] * h, f.P[1] + f.R[1] * x + f.U[1] * h, f.P[2] + f.R[2] * x + f.U[2] * h);
  if (scale) m.scale(new THREE.Vector3(scale, scale, scale));
  return m;
}

function noisyIcosa(detail, seed, amp = 0.28) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = rng(seed);
  const pos = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, 1 - amp + r() * amp * 1.6);
    const s = map.get(k);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  const ng = g.index ? g.toNonIndexed() : g;
  ng.computeVertexNormals();
  return ng;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}
export const GLOW_TEX = (() => { let t; return () => (t ||= glowTexture()); })();

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export function buildWorld(track, quality = 1) {
  const art = track.def.art;
  const pal = art.palette;
  const scene = new THREE.Scene();
  const R = rng(art.seed);
  const group = new THREE.Group();
  scene.add(group);
  const uniformsShared = {
    uTime: { value: 0 },
    uFogColor: { value: col(art.fog.color) },
    uFogDensity: { value: art.fog.density },
  };
  const animated = [];
  const mk = (frag, uniforms, extra = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: extra.vs || surfaceVS,
      fragmentShader: frag,
      uniforms: { ...uniformsShared, ...uniforms },
      extensions: { derivatives: true },
      ...extra.mat,
    });
    return m;
  };

  scene.fog = new THREE.FogExp2(art.fog.color, art.fog.density);

  // lights
  const sunDir = new THREE.Vector3(...art.sky.sun).normalize();
  const sunLight = new THREE.DirectionalLight(art.light.sun, 0.85);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(art.light.ambient, 0x0a0a14, 0.75));
  const fillLight = new THREE.DirectionalLight(pal.grid, 0.45);
  fillLight.position.set(-0.4, -0.8, 0.5);
  scene.add(fillLight);

  // --- sky ---
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVS,
    fragmentShader: skyFS,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uTime: uniformsShared.uTime,
      uA: { value: col(art.sky.a) },
      uB: { value: col(art.sky.b) },
      uC: { value: col(art.sky.c) },
      uSunDir: { value: sunDir.clone() },
      uSunCol: { value: col(art.sky.sunColor) },
      uSunSize: { value: art.sky.sunSize },
      uNeb: { value: art.sky.nebula },
      uAurora: { value: art.sky.aurora },
      uSeed: { value: art.seed * 1.37 },
    },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);

  // --- track centroid & bounds ---
  const centroid = new THREE.Vector3();
  const { N, P } = track;
  for (let i = 0; i < N; i++) centroid.add(new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  centroid.multiplyScalar(1 / N);

  // --- planets / sun ---
  if (art.planet) {
    const pl = art.planet;
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVS, fragmentShader: planetFS, fog: false,
      uniforms: { uC1: { value: col(pl.color2) }, uC2: { value: col(pl.color) }, uSun: { value: sunDir.clone() }, uTime: uniformsShared.uTime, uEmissive: { value: 0 } },
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(pl.radius, 48, 32), mat);
    m.position.copy(centroid).add(new THREE.Vector3(...pl.pos));
    scene.add(m);
    if (pl.ring) {
      const rg = new THREE.RingGeometry(pl.radius * 1.35, pl.radius * 2.3, 96, 1);
      const rm = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
        uniforms: { uCol: { value: col(pl.color2) }, uIn: { value: 1.35 / 2.3 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec2 vP; uniform vec3 uCol; uniform float uIn; void main(){ float r = length(vP)/' + (pl.radius * 2.3).toFixed(1) + '; float t = (r-uIn)/(1.0-uIn); float band = 0.5+0.5*sin(t*60.0)*sin(t*17.0); float a = smoothstep(0.0,0.08,t)*(1.0-smoothstep(0.85,1.0,t))*(0.25+0.5*band); gl_FragColor = vec4(uCol*(0.6+0.6*band), a); }',
      });
      const ring = new THREE.Mesh(rg, rm);
      ring.position.copy(m.position);
      ring.rotation.set(-1.15, 0.2, 0.35);
      scene.add(ring);
    }
  }
  if (art.sun) {
    const su = art.sun;
    const mat = new THREE.ShaderMaterial({
      vertexShader: planetVS, fragmentShader: planetFS, fog: false,
      uniforms: { uC1: { value: col('#ffdf8a') }, uC2: { value: col(su.color) }, uSun: { value: new THREE.Vector3(0, 0, 1) }, uTime: { value: 0 }, uEmissive: { value: 1 } },
    });
    uniformsShared.uTime && (mat.uniforms.uTime = uniformsShared.uTime);
    const m = new THREE.Mesh(new THREE.SphereGeometry(su.radius, 64, 40), mat);
    m.position.copy(centroid).add(new THREE.Vector3(...su.pos));
    scene.add(m);
    const sm = new THREE.SpriteMaterial({ map: GLOW_TEX(), color: col(su.color), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true });
    for (const k of [3.4, 6.5]) {
      const sp = new THREE.Sprite(sm.clone());
      sp.material.opacity = k < 4 ? 0.9 : 0.45;
      sp.scale.setScalar(su.radius * k);
      sp.position.copy(m.position);
      scene.add(sp);
    }
  }

  // --- track meshes ---
  const wallH = art.wallH ?? 6;
  const trackU = {
    uBase: { value: col(pal.base) }, uGrid: { value: col(pal.grid) }, uAccent: { value: col(pal.accent) }, uLen: { value: track.length },
  };
  const surfMat = mk(surfaceFS, trackU);
  const hullMat = mk(hullFS, { uBase: { value: col(pal.base).multiplyScalar(1.4) }, uGrid: { value: col(pal.grid) } }, { mat: { side: THREE.DoubleSide } });
  const railMat = mk(railFS, { uColor: { value: col(pal.rail) } }, { mat: { side: THREE.DoubleSide } });
  const wallMat = mk(wallFS, { uColor: { value: col(pal.rail) }, uAlpha: { value: art.wallAlpha ?? 1 } }, { mat: { transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending } });
  const CH = 64;
  const trackGroup = new THREE.Group();
  for (let i0 = 0; i0 < N; i0 += CH) {
    const i1 = Math.min(i0 + CH, i0 + (N - i0));
    const end = i0 + CH >= N ? N : i0 + CH; // last chunk wraps to sample 0 via modulo in ribbon()
    void i1;
    const surf = ribbon(track, i0, end, [{ k: -1, h: 0, u: 0 }, { k: 1, h: 0, u: 1 }]);
    trackGroup.add(new THREE.Mesh(surf, surfMat));
    const hull = ribbon(track, i0, end, [
      { k: -1, h: 0, u: 0 }, { k: -0.72, h: -3.4, u: 0.33 }, { k: 0.72, h: -3.4, u: 0.66 }, { k: 1, h: 0, u: 1 },
    ]);
    trackGroup.add(new THREE.Mesh(hull, hullMat));
    for (const side of [-1, 1]) {
      const rail = ribbon(track, i0, end, [
        { k: side, a: -side * 2.6, h: 0.1, u: 0 }, { k: side, a: -side * 2.6, h: 1.5, u: 0.3 }, { k: side, a: side * 0.6, h: 1.5, u: 0.6 }, { k: side, a: side * 0.6, h: 0, u: 1 },
      ]);
      trackGroup.add(new THREE.Mesh(rail, railMat));
      const wall = ribbon(track, i0, end, [
        { k: side, a: side * 0.6, h: 1.5, u: 0 }, { k: side, a: side * 0.6, h: wallH + 1.5, u: 1 },
      ]);
      const wm = new THREE.Mesh(wall, wallMat);
      wm.renderOrder = 5;
      trackGroup.add(wm);
    }
  }
  group.add(trackGroup);

  // --- pads ---
  const padMats = {
    boost: mk(padFS, { uColor: { value: col(pal.accent) }, uMode: { value: 0 } }, { mat: { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 } }),
    jump: mk(padFS, { uColor: { value: col('#ffffff') }, uMode: { value: 1 } }, { mat: { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 } }),
  };
  const padGroup = new THREE.Group();
  group.add(padGroup);
  const itemPads = track.pads.filter((p) => p.type === 'item');
  for (const p of track.pads) {
    if (p.type === 'item') continue;
    const wid = p.type === 'boost' ? 22 : 30;
    const rows = Math.ceil(p.len / 3) + 1;
    const pos = [], uvs = [], idx = [];
    for (let r = 0; r < rows; r++) {
      const s = p.s - p.len / 2 + (r * p.len) / (rows - 1);
      const f = track.sample(s);
      const cx = p.x * (f.w / 2 - 6);
      for (const side of [-1, 1]) {
        const x = cx + side * wid / 2;
        pos.push(f.P[0] + f.R[0] * x + f.U[0] * 0.14, f.P[1] + f.R[1] * x + f.U[1] * 0.14, f.P[2] + f.R[2] * x + f.U[2] * 0.14);
        uvs.push(side < 0 ? 0 : 1, (r * p.len) / (rows - 1));
      }
      if (r < rows - 1) { const a = r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, padMats[p.type]);
    mesh.renderOrder = 4;
    padGroup.add(mesh);
    if (p.type === 'jump') {
      // glowing ramp lip posts
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 6), new THREE.MeshBasicMaterial({ color: col(pal.accent) }));
        const f = track.sample(p.s + p.len / 2);
        const cx = p.x * (f.w / 2 - 6) + side * wid / 2;
        post.position.set(f.P[0] + f.R[0] * cx + f.U[0] * 4.5, f.P[1] + f.R[1] * cx + f.U[1] * 4.5, f.P[2] + f.R[2] * cx + f.U[2] * 4.5);
        post.quaternion.setFromRotationMatrix(frameMatrix(track, p.s, 0, 0));
        padGroup.add(post);
      }
    }
  }
  // item pads: floating crystals + floor rings, per-viewer visibility
  const itemGeo = new THREE.OctahedronGeometry(1.7, 0);
  const itemMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const itemMesh = new THREE.InstancedMesh(itemGeo, itemMat, Math.max(1, itemPads.length));
  const itemCore = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.0, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, itemPads.length));
  const itemRing = new THREE.InstancedMesh(new THREE.RingGeometry(2.4, 3.2, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }), Math.max(1, itemPads.length));
  itemMesh.count = itemCore.count = itemRing.count = itemPads.length;
  itemMesh.frustumCulled = itemCore.frustumCulled = itemRing.frustumCulled = false;
  const hue = new THREE.Color();
  itemPads.forEach((p, i) => {
    hue.setHSL((i * 0.137) % 1, 0.9, 0.62);
    itemMesh.setColorAt(i, hue);
    itemRing.setColorAt(i, hue);
    itemCore.setColorAt(i, new THREE.Color(1, 1, 1));
  });
  group.add(itemMesh, itemCore, itemRing);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const padPos = itemPads.map((p) => {
    const f = track.sample(p.s);
    const x = p.x * (f.w / 2 - 6);
    return { p, base: new THREE.Vector3(f.P[0] + f.R[0] * x, f.P[1] + f.R[1] * x, f.P[2] + f.R[2] * x), up: new THREE.Vector3(...f.U), fm: frameMatrix(track, p.s, x, 0) };
  });

  // --- gates ---
  const gateEvery = art.gateEvery || 64;
  const gateCount = Math.floor(track.length / gateEvery);
  const squareGates = art.battle;
  const gateGeo = squareGates ? new THREE.TorusGeometry(1, 0.035, 4, 4) : new THREE.TorusGeometry(1, 0.028, 5, 40);
  if (squareGates) gateGeo.rotateZ(Math.PI / 4);
  const iCol = new Float32Array(gateCount * 3);
  const iPh = new Float32Array(gateCount);
  const gateMesh = new THREE.InstancedMesh(gateGeo, mk(gateFS, { uLen: { value: track.length } }, { vs: gateVS }), gateCount);
  const c1 = col(pal.gate), c2 = col(pal.grid), c3 = col(pal.accent);
  for (let g = 0; g < gateCount; g++) {
    const s = g * gateEvery + 20;
    const f = track.sample(s);
    const radius = f.w / 2 * (squareGates ? 0.92 : 1.0) + 6;
    const m = new THREE.Matrix4();
    frameMatrix(track, s, 0, squareGates ? radius * 0.42 : 0, radius, m);
    gateMesh.setMatrixAt(g, m);
    const c = g % 4 === 0 ? c3 : g % 2 === 0 ? c1 : c2;
    iCol.set([c.r, c.g, c.b], g * 3);
    iPh[g] = s / track.length;
  }
  gateGeo.setAttribute('iColor', new THREE.InstancedBufferAttribute(iCol, 3));
  gateGeo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(iPh, 1));
  gateMesh.frustumCulled = false;
  gateMesh.material.side = THREE.DoubleSide;
  group.add(gateMesh);

  // --- start gantry ---
  {
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#05070c'; g.fillRect(0, 0, 1024, 128);
    for (let i = 0; i < 64; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2 === 0) { g.fillStyle = '#e9f6ff'; g.fillRect(i * 16, j * 16, 16, 16); }
    g.fillStyle = 'rgba(5,7,12,0.82)'; g.fillRect(180, 14, 664, 100);
    g.font = '900 78px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = pal.accent; g.fillText('NOVA CIRCUIT', 512, 66);
    const tex = new THREE.CanvasTexture(cv);
    const f0 = track.sample(0);
    const hw = f0.w / 2;
    const gm = new THREE.Group();
    const dark = new THREE.MeshPhongMaterial({ color: 0x1a2330, shininess: 60, flatShading: true });
    const neon = new THREE.MeshBasicMaterial({ color: col(pal.gate) });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), dark);
      pillar.position.set(side * (hw + 5), 18, 0);
      gm.add(pillar);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 38, 0.5), neon);
      strip.position.set(side * (hw + 2.9), 18, 0);
      gm.add(strip);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 10, 14), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.set(0, 34, 0);
    gm.add(banner);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 14, 2.5, 4), dark);
    beam.position.set(0, 41.5, 0);
    gm.add(beam);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 14, 1, 4.2), neon);
    beam2.position.set(0, 26.5, 0);
    gm.add(beam2);
    const fm = frameMatrix(track, 0, 0, 0);
    gm.applyMatrix4(fm);
    group.add(gm);
  }

  // --- scenery ---
  const grid = hashGrid(track);
  const rockGeos = [1, 2, 3].map((k) => noisyIcosa(1, art.seed * 10 + k));
  const sceneryMeshes = [];
  const tmpM = new THREE.Matrix4();
  const tmpC = new THREE.Color();
  const randDir = () => {
    const z = R() * 2 - 1;
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), z * 0.8, r * Math.sin(a)];
  };
  const scale = quality >= 1 ? 1 : 0.55;
  for (const sc of art.scatter) {
    const count = Math.floor(sc.count * scale);
    if (sc.type === 'rock' || sc.type === 'crystal' || sc.type === 'spire' || sc.type === 'ring') {
      let geo, mat;
      if (sc.type === 'rock') {
        geo = rockGeos[Math.floor(R() * 3)];
        mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 14, emissive: col(sc.emissive || '#000000'), emissiveIntensity: sc.emissiveAmt ?? 0.6 });
      } else if (sc.type === 'crystal') {
        geo = new THREE.OctahedronGeometry(1, 0); geo.scale(0.38, 1.7, 0.38);
        mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 120, specular: 0xffffff, emissive: col(sc.color), emissiveIntensity: 0.55, transparent: true, opacity: 0.92 });
      } else if (sc.type === 'spire') {
        geo = new THREE.ConeGeometry(0.5, 2.6, 5); 
        mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, emissive: col(sc.color), emissiveIntensity: 0.9 });
      } else {
        geo = new THREE.TorusGeometry(1, 0.025, 6, 64);
        mat = new THREE.MeshBasicMaterial({ color: col(sc.color), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      }
      const im = new THREE.InstancedMesh(geo, mat, count);
      let placed = 0;
      for (let tries = 0; tries < count * 6 && placed < count; tries++) {
        const si = Math.floor(R() * N);
        const f = track.sample(si * track.ds);
        const d = randDir();
        const r = sc.near + (sc.far - sc.near) * Math.pow(R(), 1.5);
        const size = Math.min(r < sc.near + 160 ? 34 : sc.max, sc.min + (sc.max - sc.min) * Math.pow(R(), 2.2));
        const rad = sc.type === 'ring' ? size : size * (sc.type === 'rock' ? 1 : 1.3);
        const p = [f.P[0] + d[0] * r, f.P[1] + d[1] * r, f.P[2] + d[2] * r];
        if (!grid.clear(p, sc.near * 0.7 + rad, -1, 0)) continue;
        tmpM.makeRotationFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
        if (sc.type === 'crystal' || sc.type === 'spire') {
          // point away from the track
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0], Math.abs(d[1]) * 0.4 + 0.3, d[2]).normalize());
          tmpM.makeRotationFromQuaternion(q);
        } else if (sc.type === 'ring') {
          const q = new THREE.Quaternion().setFromRotationMatrix(frameMatrix(track, si * track.ds, 0, 0));
          tmpM.makeRotationFromQuaternion(q);
        }
        const sx = sc.type === 'rock' ? size * (0.7 + R() * 0.6) : size * (sc.type === 'crystal' ? 0.5 : 0.7);
        const sy = sc.type === 'rock' ? size * (0.7 + R() * 0.6) : size;
        const sz = sc.type === 'rock' ? size * (0.7 + R() * 0.6) : sx;
        tmpM.scale(new THREE.Vector3(sc.type === 'ring' ? size : sx, sc.type === 'ring' ? size : sy, sc.type === 'ring' ? size : sz));
        tmpM.setPosition(p[0], p[1], p[2]);
        im.setMatrixAt(placed, tmpM);
        tmpC.set(sc.color);
        if (sc.type === 'rock') tmpC.offsetHSL((R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.18);
        else if (sc.type !== 'ring') tmpC.offsetHSL((R() - 0.5) * 0.08, 0, (R() - 0.5) * 0.1);
        im.setColorAt(placed, tmpC);
        placed++;
      }
      im.count = placed;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false;
      group.add(im);
      sceneryMeshes.push(im);
    } else if (sc.type === 'tower') {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = mk(towerFS, { uBase: { value: col(sc.color) }, uLight: { value: col(sc.emissive || pal.grid) } }, { vs: towerVS });
      const im = new THREE.InstancedMesh(geo, mat, count);
      let placed = 0;
      const step = Math.max(1, Math.floor(track.N / (count / 2)));
      for (let tries = 0; placed < count && tries < count * 4; tries++) {
        const i = (tries * Math.max(1, Math.floor(step * 0.5)) + Math.floor(R() * 4)) % N;
        const side = tries % 2 ? 1 : -1;
        const f = track.sample(i * track.ds);
        const width = 14 + R() * 38;
        const height = sc.min + (sc.max - sc.min) * Math.pow(R(), 1.7);
        const lat = f.w / 2 + sc.near - 38 + 16 + R() * 90 + width / 2;
        const depth = 14 + R() * 40;
        const cy = height / 2 - 70 + R() * 26;
        const c = [
          f.P[0] + f.R[0] * lat * side + f.U[0] * cy,
          f.P[1] + f.R[1] * lat * side + f.U[1] * cy,
          f.P[2] + f.R[2] * lat * side + f.U[2] * cy,
        ];
        const top = [c[0] + f.U[0] * height / 2, c[1] + f.U[1] * height / 2, c[2] + f.U[2] * height / 2];
        if (!grid.clear(c, 70 + width, i, 260) || !grid.clear(top, 60 + width, i, 260)) continue;
        const m = frameMatrix(track, i * track.ds, lat * side, cy, 1);
        m.scale(new THREE.Vector3(width, height, depth));
        // frameMatrix basis puts local Y along track-up; tower height along up
        im.setMatrixAt(placed, m);
        placed++;
      }
      im.count = placed;
      im.frustumCulled = false;
      group.add(im);
      sceneryMeshes.push(im);
    }
  }

  // --- distant fleet battle ---
  let bolts = null, flashes = null;
  if (art.battle) {
    const n = 90;
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 2);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    const iStart = new Float32Array(n * 3), iDir = new Float32Array(n * 3), iSeed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, el = 0.12 + R() * 0.55, rr = 1800 + R() * 1400;
      const start = [centroid.x + Math.cos(a) * Math.cos(el) * rr, centroid.y + Math.sin(el) * rr, centroid.z + Math.sin(a) * Math.cos(el) * rr];
      const tgt = [centroid.x + (R() - 0.5) * 3000, centroid.y + 200 + R() * 800, centroid.z + (R() - 0.5) * 3000];
      const d = norm([tgt[0] - start[0], tgt[1] - start[1], tgt[2] - start[2]]);
      iStart.set(start, i * 3); iDir.set(d, i * 3); iSeed.set([R(), R(), R()], i * 3);
    }
    geo.setAttribute('iStart', new THREE.InstancedBufferAttribute(iStart, 3));
    geo.setAttribute('iDir', new THREE.InstancedBufferAttribute(iDir, 3));
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(iSeed, 3));
    geo.instanceCount = n;
    bolts = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: boltVS, fragmentShader: boltFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: uniformsShared.uTime, uColA: { value: col('#ff4a52') }, uColB: { value: col('#4adcff') } },
    }));
    bolts.frustumCulled = false;
    scene.add(bolts);
    const fn = 30;
    const fp = new Float32Array(fn * 3), fs = new Float32Array(fn);
    for (let i = 0; i < fn; i++) {
      const a = R() * 6.28, el = 0.1 + R() * 0.5, rr = 2200 + R() * 1500;
      fp.set([centroid.x + Math.cos(a) * Math.cos(el) * rr, centroid.y + Math.sin(el) * rr, centroid.z + Math.sin(a) * Math.cos(el) * rr], i * 3);
      fs[i] = R();
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
    flashes = new THREE.Points(fg, new THREE.ShaderMaterial({
      vertexShader: flashVS, fragmentShader: flashFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: uniformsShared.uTime, uScale: { value: 800 }, uCol: { value: col('#ffd9a0') } },
    }));
    flashes.frustumCulled = false;
    scene.add(flashes);
  }

  // --- API ---
  const dustPos = new THREE.Vector3();
  return {
    scene,
    track,
    art,
    sky,
    centroid,
    surfMat,
    update(time, camera, pixelScale) {
      uniformsShared.uTime.value = time;
      sky.position.copy(camera.position);
      sky.scale.setScalar(camera.far * 0.45 / 1000);
      if (flashes) flashes.material.uniforms.uScale.value = pixelScale;
      void dustPos;
    },
    /** Update item-pad visuals for one viewer (hides pads that viewer has already taken). */
    updatePads(race, shipIdx, time) {
      const items = race.pads.filter((q) => q.type === 'item');
      itemPads.forEach((tp, i) => {
        const rp = items[i];
        const taken = rp && shipIdx >= 0 ? rp.cd[shipIdx] > 0 : false;
        const pp = padPos[i];
        const bob = Math.sin(time * 2.2 + i) * 0.6;
        const sc = taken ? 0.0001 : 1;
        _p.copy(pp.base).addScaledVector(pp.up, 5.2 + bob);
        _e.set(time * 1.1 + i, time * 1.7, 0);
        _q.setFromEuler(_e);
        _s.set(sc, sc, sc);
        _m.compose(_p, _q, _s);
        itemMesh.setMatrixAt(i, _m);
        _s.setScalar(sc * 0.8);
        _m.compose(_p, _q, _s);
        itemCore.setMatrixAt(i, _m);
        // ring lies on the track
        const q2 = new THREE.Quaternion().setFromRotationMatrix(pp.fm);
        _p.copy(pp.base).addScaledVector(pp.up, 0.25);
        _s.setScalar(sc * (1 + 0.08 * Math.sin(time * 4 + i)));
        const qq = q2.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
        _m.compose(_p, qq, _s);
        itemRing.setMatrixAt(i, _m);
      });
      itemMesh.instanceMatrix.needsUpdate = true;
      itemCore.instanceMatrix.needsUpdate = true;
      itemRing.instanceMatrix.needsUpdate = true;
    },
    setQualityLights() {},
    dispose() {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
  };
}

export { SAMPLE_SPACING, cross };
