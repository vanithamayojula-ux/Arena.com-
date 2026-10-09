// Visual effects: additive particles, shockwave rings, projectile meshes,
// speed-dust streaks and the bloom / radial-blur post pipeline.
import { GLOW_TEX } from './world.js';

const THREE = window.THREE;

// ---------------------------------------------------------------------------
// Particles (CPU simulated, drawn as one Points object)
// ---------------------------------------------------------------------------
export class Particles {
  constructor(max = 5000) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.drag = new Float32Array(max);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 700 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; varying vec4 vC; uniform float uScale;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = clamp(aSize*uScale/max(-mv.z,0.1), 0.0, 220.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 c = gl_PointCoord-0.5; float r = length(c)*2.0; float a = pow(max(1.0-r,0.0),1.6)*vC.a; gl_FragColor = vec4(vC.rgb*a*1.2, a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -1e6;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a = 1, drag = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i * 4] = r; this.c0[i * 4 + 1] = g; this.c0[i * 4 + 2] = b; this.c0[i * 4 + 3] = a;
    this.drag[i] = drag;
  }
  update(dt) {
    const { pos, vel, life, maxLife, s0, s1, c0, col, size, drag, max } = this;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; } continue; }
      life[i] -= dt;
      const t = 1 - Math.max(life[i], 0) / maxLife[i];
      const dr = 1 - Math.min(1, drag[i] * dt);
      vel[i * 3] *= dr; vel[i * 3 + 1] *= dr; vel[i * 3 + 2] *= dr;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      size[i] = s0[i] + (s1[i] - s0[i]) * t;
      const f = (1 - t) * (1 - t);
      col[i * 4] = c0[i * 4]; col[i * 4 + 1] = c0[i * 4 + 1]; col[i * 4 + 2] = c0[i * 4 + 2];
      col[i * 4 + 3] = c0[i * 4 + 3] * f;
      if (life[i] <= 0) pos[i * 3 + 1] = -1e6;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Rings (shockwaves, EMP, boost bursts)
// ---------------------------------------------------------------------------
export class Rings {
  constructor(scene, n = 24) {
    this.items = [];
    const geo = new THREE.RingGeometry(0.86, 1, 56);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 11;
      scene.add(m);
      this.items.push({ m, t: 0, life: 0, r: 1, grow: 1 });
    }
    this.i = 0;
  }
  spawn(pos, normal, color, radius, life, thick = 1) {
    const it = this.items[this.i];
    this.i = (this.i + 1) % this.items.length;
    it.m.position.copy(pos);
    it.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    it.m.material.color.set(color);
    it.m.visible = true;
    it.t = 0; it.life = life; it.r = radius; it.thick = thick;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) { it.m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3);
      it.m.scale.setScalar(Math.max(0.01, it.r * e));
      it.m.material.opacity = (1 - k) * 0.9;
    }
  }
}

// ---------------------------------------------------------------------------
// Projectile meshes (bullets, missiles, mines) as instanced meshes
// ---------------------------------------------------------------------------
export class Projectiles {
  constructor(scene) {
    this.maxB = 320;
    const bg = new THREE.BoxGeometry(0.5, 0.5, 11);
    this.bullets = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), this.maxB);
    this.bullets.frustumCulled = false;
    this.bullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bullets.setColorAt(0, new THREE.Color(1, 1, 1));
    const halo = new THREE.BoxGeometry(1.3, 1.3, 7);
    this.halos = new THREE.InstancedMesh(halo, new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.28, depthWrite: false }), this.maxB);
    this.halos.frustumCulled = false;
    this.halos.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.bullets, this.halos);

    const mg = new THREE.CylinderGeometry(0.28, 0.4, 3.4, 8);
    mg.rotateX(Math.PI / 2);
    this.maxM = 40;
    this.missiles = new THREE.InstancedMesh(mg, new THREE.MeshPhongMaterial({ color: 0xdfe6ee, emissive: 0x333333, shininess: 80 }), this.maxM);
    this.missiles.frustumCulled = false;
    const tip = new THREE.ConeGeometry(0.28, 0.9, 8); tip.rotateX(-Math.PI / 2); tip.translate(0, 0, -2.1);
    this.tips = new THREE.InstancedMesh(tip, new THREE.MeshBasicMaterial({ color: 0xff3a3a }), this.maxM);
    this.tips.frustumCulled = false;
    scene.add(this.missiles, this.tips);

    this.maxMine = 60;
    this.mines = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.9, 0), new THREE.MeshPhongMaterial({ color: 0x2a1010, emissive: 0xff2a1a, emissiveIntensity: 0.8, flatShading: true }), this.maxMine);
    this.mines.frustumCulled = false;
    this.mineGlow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: GLOW_TEX(), color: 0xff3020, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), this.maxMine);
    this.mineGlow.frustumCulled = false;
    scene.add(this.mines, this.mineGlow);
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
  }

  update(race, world, time, camQuat) {
    const tr = race.track;
    const m = this._m;
    const f = (d) => tr.sample(d);
    let n = 0;
    for (const b of race.bullets) {
      if (n >= this.maxB) break;
      const fr = f(b.dist);
      const x = b.x, h = b.h;
      m.makeBasis(new THREE.Vector3(...fr.R), new THREE.Vector3(...fr.U), new THREE.Vector3(-fr.T[0], -fr.T[1], -fr.T[2]));
      m.setPosition(fr.P[0] + fr.R[0] * x + fr.U[0] * h, fr.P[1] + fr.R[1] * x + fr.U[1] * h, fr.P[2] + fr.R[2] * x + fr.U[2] * h);
      this.bullets.setMatrixAt(n, m);
      this.halos.setMatrixAt(n, m);
      const lv = b.owner ? b.owner.livery : 0;
      this._c.set(LIVERY_COL(lv));
      this.bullets.setColorAt(n, this._c.clone().lerp(new THREE.Color(1, 1, 1), 0.65));
      this.halos.setColorAt(n, this._c);
      n++;
    }
    this.bullets.count = this.halos.count = n;
    this.bullets.instanceMatrix.needsUpdate = this.halos.instanceMatrix.needsUpdate = true;
    if (this.bullets.instanceColor) { this.bullets.instanceColor.needsUpdate = true; this.halos.instanceColor.needsUpdate = true; }

    n = 0;
    for (const mi of race.missiles) {
      if (n >= this.maxM) break;
      const fr = f(mi.dist);
      // aim along velocity: tangent plus lateral component
      const vx = mi.vx / Math.max(mi.vs, 1), vh = mi.vh / Math.max(mi.vs, 1);
      const T = new THREE.Vector3(...fr.T).addScaledVector(new THREE.Vector3(...fr.R), vx).addScaledVector(new THREE.Vector3(...fr.U), vh).normalize();
      const U = new THREE.Vector3(...fr.U);
      const Rv = new THREE.Vector3().crossVectors(T, U).normalize();
      const U2 = new THREE.Vector3().crossVectors(Rv, T).normalize();
      m.makeBasis(Rv, U2, T.clone().negate());
      m.setPosition(fr.P[0] + fr.R[0] * mi.x + fr.U[0] * mi.h, fr.P[1] + fr.R[1] * mi.x + fr.U[1] * mi.h, fr.P[2] + fr.R[2] * mi.x + fr.U[2] * mi.h);
      this.missiles.setMatrixAt(n, m);
      this.tips.setMatrixAt(n, m);
      n++;
    }
    this.missiles.count = this.tips.count = n;
    this.missiles.instanceMatrix.needsUpdate = this.tips.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const mine of race.mines) {
      if (n >= this.maxMine) break;
      const fr = f(mine.dist);
      const pos = new THREE.Vector3(fr.P[0] + fr.R[0] * mine.x + fr.U[0] * mine.h, fr.P[1] + fr.R[1] * mine.x + fr.U[1] * mine.h, fr.P[2] + fr.R[2] * mine.x + fr.U[2] * mine.h);
      const blink = mine.arm > 0 ? 0.4 : 0.8 + 0.5 * Math.sin(time * 8 + mine.id);
      m.compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(time * 0.8 + mine.id, time * 1.3, 0)), new THREE.Vector3(1, 1, 1));
      this.mines.setMatrixAt(n, m);
      m.compose(pos, camQuat, new THREE.Vector3(9 * blink, 9 * blink, 1));
      this.mineGlow.setMatrixAt(n, m);
      n++;
    }
    this.mines.count = this.mineGlow.count = n;
    this.mines.instanceMatrix.needsUpdate = this.mineGlow.instanceMatrix.needsUpdate = true;
  }
}

import { LIVERIES } from './sim.js';
const LIVERY_COL = (i) => LIVERIES[i % LIVERIES.length].glow;

// ---------------------------------------------------------------------------
// Speed dust: streaks rushing past the camera (attached to the camera)
// ---------------------------------------------------------------------------
export class SpeedDust {
  constructor(count = 520) {
    const pos = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2);
    const seed = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.pow(Math.random(), 0.8) * 70;
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r * 0.62, sz = Math.random();
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        seed[o] = sx; seed[o + 1] = sy; seed[o + 2] = sz;
        end[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.uniforms = { uOffset: { value: 0 }, uLen: { value: 1 }, uAlpha: { value: 0.4 }, uColor: { value: new THREE.Color('#bfe9ff') } };
    this.mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform float uOffset; uniform float uLen; varying float vA; uniform float uAlpha;
        void main(){ float D = 420.0; float z = mod(aSeed.z*D + uOffset, D); vec3 p = vec3(aSeed.xy, -(D - z) + 6.0);
          p.z += aEnd*uLen; vA = (1.0-aEnd*0.9)*uAlpha*smoothstep(0.0,40.0,z)*(1.0 - smoothstep(D*0.7,D,z)*0.0) * (0.35+0.65*smoothstep(D,D*0.6,z)); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
      fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, vA); }`,
    }));
    this.mesh.frustumCulled = false;
  }
  update(dt, speed, boost, color) {
    this.uniforms.uOffset.value += speed * dt;
    this.uniforms.uLen.value = 2 + speed * 0.045 * (1 + boost * 0.8);
    this.uniforms.uAlpha.value = 0.12 + Math.min(0.55, speed / 700) + boost * 0.15;
    if (color) this.uniforms.uColor.value.set(color);
  }
}

// ---------------------------------------------------------------------------
// Post-processing: bloom + radial blur + chromatic aberration + vignette
// ---------------------------------------------------------------------------
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.w = 0; this.h = 0;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    const isGL2 = renderer.capabilities.isWebGL2;
    this.msaa = isGL2 && THREE.WebGLMultisampleRenderTarget;
    this.bright = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.78 } }, vertexShader: QUAD_VS,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThresh;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(uThresh, uThresh+0.35, l); gl_FragColor = vec4(c*k, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } }, vertexShader: QUAD_VS,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir;
        void main(){ vec3 s = texture2D(tDiffuse, vUv).rgb*0.2270270270;
          s += texture2D(tDiffuse, vUv + uDir*1.3846153846).rgb*0.3162162162; s += texture2D(tDiffuse, vUv - uDir*1.3846153846).rgb*0.3162162162;
          s += texture2D(tDiffuse, vUv + uDir*3.2307692308).rgb*0.0702702703; s += texture2D(tDiffuse, vUv - uDir*3.2307692308).rgb*0.0702702703;
          gl_FragColor = vec4(s, 1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tB1: { value: null }, tB2: { value: null },
        uBloom: { value: 0.9 }, uRadial: { value: 0 }, uAberr: { value: 0.0015 }, uFlash: { value: new THREE.Vector4(0, 0, 0, 0) },
        uTime: { value: 0 }, uVig: { value: 0.55 }, uWarp: { value: 0 },
      },
      vertexShader: QUAD_VS,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tB1; uniform sampler2D tB2;
        uniform float uBloom; uniform float uRadial; uniform float uAberr; uniform vec4 uFlash; uniform float uTime; uniform float uVig;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec2 d = vUv - vec2(0.5, 0.46);
          float r = length(d);
          vec2 dir = d;
          vec3 c = vec3(0.0);
          float ab = uAberr*(0.4 + r*2.2) + uRadial*0.004;
          if (uRadial > 0.002) {
            float tot = 0.0;
            for (int i = 0; i < 9; i++) {
              float t = float(i)/8.0;
              float w = 1.0 - t*0.7;
              vec2 uv = vUv - dir*t*uRadial*0.22*smoothstep(0.05,0.6,r*1.6);
              c += vec3(texture2D(tScene, uv + dir*ab).r, texture2D(tScene, uv).g, texture2D(tScene, uv - dir*ab).b)*w;
              tot += w;
            }
            c /= tot;
          } else {
            c = vec3(texture2D(tScene, vUv + dir*ab).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - dir*ab).b);
          }
          vec3 bl = texture2D(tB1, vUv).rgb*0.75 + texture2D(tB2, vUv).rgb*0.95;
          c += bl*uBloom;
          // filmic-ish curve
          c = c*(1.0 + c*0.12)/(1.0 + c*0.55);
          c = pow(c, vec3(0.92));
          float vig = smoothstep(0.95, 0.28, r*(1.0+uVig*0.5));
          c *= mix(1.0, vig, uVig);
          c += uFlash.rgb*uFlash.a*(0.35 + 0.65*smoothstep(0.1,0.8,r));
          c += (h(vUv*1000.0 + uTime) - 0.5)*0.012;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
  }
  _rt(w, h, depth, msaa) {
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: depth, stencilBuffer: false };
    if (msaa && this.msaa) { const t = new THREE.WebGLMultisampleRenderTarget(w, h, opts); t.samples = 4; return t; }
    return new THREE.WebGLRenderTarget(w, h, opts);
  }
  resize(w, h, useMsaa = true) {
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (w === this.w && h === this.h && useMsaa === this.useMsaa) return;
    this.w = w; this.h = h; this.useMsaa = useMsaa;
    for (const k of ['main', 'a1', 'b1', 'a2', 'b2']) this[k]?.dispose();
    this.main = this._rt(w, h, true, useMsaa);
    const w1 = Math.max(2, w >> 2), h1 = Math.max(2, h >> 2), w2 = Math.max(2, w >> 3), h2 = Math.max(2, h >> 3);
    this.a1 = this._rt(w1, h1, false); this.b1 = this._rt(w1, h1, false);
    this.a2 = this._rt(w2, h2, false); this.b2 = this._rt(w2, h2, false);
    this.sz1 = [w1, h1]; this.sz2 = [w2, h2];
  }
  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }
  /** Render `scene` from `camera` into the current viewport rect with post effects. */
  render(scene, camera, fx, rect) {
    const r = this.r;
    this.resize(rect.w, rect.h, fx.msaa !== false);
    r.setRenderTarget(this.main);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);
    // bloom
    this.bright.uniforms.tDiffuse.value = this.main.texture;
    this.pass(this.bright, this.a1);
    this.blur.uniforms.tDiffuse.value = this.a1.texture;
    this.blur.uniforms.uDir.value.set(1 / this.sz1[0], 0);
    this.pass(this.blur, this.b1);
    this.blur.uniforms.tDiffuse.value = this.b1.texture;
    this.blur.uniforms.uDir.value.set(0, 1 / this.sz1[1]);
    this.pass(this.blur, this.a1);
    this.blur.uniforms.tDiffuse.value = this.a1.texture;
    this.blur.uniforms.uDir.value.set(1 / this.sz2[0] * 1.6, 0);
    this.pass(this.blur, this.a2);
    this.blur.uniforms.tDiffuse.value = this.a2.texture;
    this.blur.uniforms.uDir.value.set(0, 1 / this.sz2[1] * 1.6);
    this.pass(this.blur, this.b2);
    this.blur.uniforms.tDiffuse.value = this.b2.texture;
    this.blur.uniforms.uDir.value.set(1 / this.sz2[0] * 2.4, 0);
    this.pass(this.blur, this.a2);
    this.blur.uniforms.tDiffuse.value = this.a2.texture;
    this.blur.uniforms.uDir.value.set(0, 1 / this.sz2[1] * 2.4);
    this.pass(this.blur, this.b2);
    // composite to screen rect
    const u = this.comp.uniforms;
    u.tScene.value = this.main.texture; u.tB1.value = this.a1.texture; u.tB2.value = this.b2.texture;
    u.uRadial.value = fx.radial || 0;
    u.uAberr.value = fx.aberr ?? 0.0015;
    u.uFlash.value.set(fx.flash?.[0] || 0, fx.flash?.[1] || 0, fx.flash?.[2] || 0, fx.flash?.[3] || 0);
    u.uTime.value = fx.time || 0;
    u.uBloom.value = fx.bloom ?? 0.9;
    u.uVig.value = fx.vignette ?? 0.55;
    this.quad.material = this.comp;
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
