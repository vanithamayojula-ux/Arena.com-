// What comes back when the city remembers something:
// stalls and voices, a turning lamp, released lanterns, dark veins, open gates.
import * as THREE from 'three';
import { makeRNG } from './rng.js';
import { fabricMap, glowSprite, crowdSprite } from './textures.js';

/* ─────────────────────────────  small particle systems  ───────────────────────────── */

class Burst {
  constructor(parent, count = 900) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.col = new Float32Array(count * 3);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(count), 1));
    geo.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
    this.geo = geo;
    this.sizes = geo.attributes.aSize.array;
    this.lives = geo.attributes.aLife.array;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSprite: { value: glowSprite(4, 64, 160, 0.9) }, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aLife, aSize; attribute vec3 aCol;
        varying float vLife; varying vec3 vCol;
        uniform float uPixelRatio;
        void main(){
          vLife = aLife; vCol = aCol;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (220.0 / max(0.001, -mv.z));
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uSprite; varying float vLife; varying vec3 vCol;
        void main(){
          if (vLife <= 0.0) discard;
          vec4 t = texture2D(uSprite, gl_PointCoord);
          gl_FragColor = vec4(vCol * t.rgb, t.a * vLife);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    parent.add(this.points);
  }
  spawn(pos, color, n = 90, spread = 2.4, up = 1.4, life = 3.2) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.head++ % this.count;
      this.pos[k * 3] = pos.x + (Math.random() - 0.5) * spread;
      this.pos[k * 3 + 1] = pos.y + (Math.random() - 0.5) * spread * 0.6;
      this.pos[k * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
      const a = Math.random() * Math.PI * 2, r = Math.random();
      this.vel[k * 3] = Math.cos(a) * r * 1.6;
      this.vel[k * 3 + 1] = up * (0.4 + Math.random());
      this.vel[k * 3 + 2] = Math.sin(a) * r * 1.6;
      this.maxLife[k] = life * (0.6 + Math.random() * 0.7);
      this.life[k] = this.maxLife[k];
      this.lives[k] = 1;
      this.sizes[k] = 18 + Math.random() * 42;
      const tint = 0.7 + Math.random() * 0.6;
      this.col[k * 3] = c.r * tint; this.col[k * 3 + 1] = c.g * tint; this.col[k * 3 + 2] = c.b * tint;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aCol.needsUpdate = true;
  }
  update(dt) {
    let alive = false;
    for (let i = 0; i < this.count; i++) {
      if (this.lives[i] <= 0) continue;
      alive = true;
      const k = i * 3;
      this.vel[k + 1] += dt * 0.35;
      this.vel[k] *= 1 - dt * 0.7; this.vel[k + 2] *= 1 - dt * 0.7;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.life[i] -= dt;
      this.lives[i] = Math.max(0, Math.min(1, this.life[i] / this.maxLife[i]));
    }
    if (alive) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aLife.needsUpdate = true;
    }
  }
}

/* ─────────────────────────────  main  ───────────────────────────── */

export function buildEffects(parent, ctx) {
  const { groundHeight, marketStalls, AX, AZ, STAGE_Y, OX, OZ, GX, GZ, TX, TZ } = ctx;
  const rng2 = makeRNG(777);
  const fx = new THREE.Group();
  fx.name = 'reverie';
  parent.add(fx);

  const burst = new Burst(fx, 1200);

  /* ── mist: one Points system, big soft billboards near the water ── */
  const mistCount = 96;
  const mp = new Float32Array(mistCount * 3), ms = new Float32Array(mistCount), mseed = new Float32Array(mistCount);
  for (let i = 0; i < mistCount; i++) {
    const a = rng2.f() * Math.PI * 2, r = 20 + Math.pow(rng2.f(), 0.6) * 130;
    mp.set([Math.cos(a) * r, rng2.range(-0.4, 5.5), Math.sin(a) * r], i * 3);
    ms[i] = rng2.range(26, 78);
    mseed[i] = rng2.f() * 100;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  mistGeo.setAttribute('aSize', new THREE.BufferAttribute(ms, 1));
  mistGeo.setAttribute('aSeed', new THREE.BufferAttribute(mseed, 1));
  const mistMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0.16 }, uPixelRatio: { value: 1 },
      uSprite: { value: glowSprite(11, 128, 172, 0.5) }, uColor: { value: new THREE.Color('#93c9c4') },
    },
    vertexShader: /* glsl */`
      attribute float aSize, aSeed; uniform float uTime, uPixelRatio; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.03 + aSeed) * 14.0;
        p.z += cos(uTime * 0.024 + aSeed * 1.3) * 14.0;
        p.y += sin(uTime * 0.05 + aSeed * 0.7) * 1.2;
        float d = length(p - cameraPosition);
        vA = smoothstep(240.0, 40.0, d) * smoothstep(30.0, 6.0, d);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (60.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uSprite; uniform float uOpacity; uniform vec3 uColor; varying float vA;
      void main(){
        vec4 t = texture2D(uSprite, gl_PointCoord);
        gl_FragColor = vec4(uColor, t.a * uOpacity * vA);
      }`,
  });
  const mist = new THREE.Points(mistGeo, mistMat);
  mist.frustumCulled = false;
  fx.add(mist);

  /* ── the orrery in the middle of the drowned plaza ── */
  const orrery = new THREE.Group();
  orrery.position.set(0, ctx.BASIN_Y + 2.6, 0);
  fx.add(orrery);
  const orreryRings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2 + i * 1.15, 0.06, 5, 64),
      new THREE.MeshStandardMaterial({ color: 0xb98b46, metalness: 0.85, roughness: 0.35, emissive: 0x7a4d12, emissiveIntensity: 0.5 })
    );
    ring.rotation.set(rng2.range(-1.2, 1.2), rng2.range(-1, 1), rng2.range(-1.2, 1.2));
    orrery.add(ring);
    orreryRings.push({ ring, sx: rng2.range(-0.24, 0.24), sy: rng2.range(-0.3, 0.3), sz: rng2.range(-0.2, 0.2) });
  }
  const moonStone = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 20, 14),
    new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.5, metalness: 0.2 })
  );
  orrery.add(moonStone);
  const orreryGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(13, 128, 168, 1), blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0.25, color: 0x8ffbe0,
  }));
  orreryGlow.scale.setScalar(9);
  orrery.add(orreryGlow);

  /* ── market: stalls, awnings, produce, and the voices that come with them ── */
  const marketGroup = new THREE.Group();
  marketGroup.visible = false;
  fx.add(marketGroup);

  const fabric = new THREE.MeshStandardMaterial({
    map: fabricMap(1, '#b04a3e', '#e7d6b4', { stripes: 9 }),
    roughness: 0.95, side: THREE.DoubleSide,
  });
  const fabricWarm = new THREE.MeshStandardMaterial({
    map: fabricMap(2, '#c98b2e', '#efe0c0', { stripes: 5 }),
    roughness: 0.95, side: THREE.DoubleSide,
  });
  const stallWood = new THREE.MeshStandardMaterial({
    color: 0x6a5238, roughness: 0.88,
  });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffb066, emissiveIntensity: 2.2, roughness: 0.6,
  });

  const stallMeshes = [];
  for (const s of marketStalls) {
    const g = new THREE.Group();
    g.position.set(s.x, s.y - 0.3, s.z);
    g.rotation.y = s.side > 0 ? Math.PI : 0;
    // counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.3), stallWood);
    counter.position.set(0, 0.45, 0.3);
    counter.castShadow = true;
    g.add(counter);
    // posts + awning
    for (const px of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.5, 6), stallWood);
      post.position.set(px, 1.25, -0.4);
      g.add(post);
    }
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.5), s.seed % 2 ? fabric : fabricWarm);
    awn.rotation.x = -Math.PI / 2 + 0.28;
    awn.position.set(0, 2.5, 0.5);
    g.add(awn);
    // produce
    const produceMat = new THREE.MeshStandardMaterial({ color: 0x7d3560, roughness: 0.75, emissive: 0x2a0f22 });
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1 + Math.random() * 0.07, 7, 5), produceMat);
      p.position.set(-1.4 + Math.random() * 2.8, 0.98 + Math.random() * 0.12, 0.1 + Math.random() * 0.5);
      g.add(p);
    }
    // hanging lantern
    const lant = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), lanternMat);
    lant.position.set(s.side > 0 ? -1.75 : 1.75, 2.2, -0.3);
    g.add(lant);
    const lg = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(15, 128, 34, 1), blending: THREE.AdditiveBlending, transparent: true,
      depthWrite: false, opacity: 0.85, color: 0xffc884,
    }));
    lg.scale.setScalar(3.4);
    lg.position.copy(lant.position);
    g.add(lg);
    marketGroup.add(g);
    stallMeshes.push(g);
  }
  const marketLights = [];
  for (let i = 0; i < 3; i++) {
    const lx = marketStalls[0].x + (i - 1) * 13;
    const lz = (i - 1) * 4;
    const l = new THREE.PointLight(0xffb066, 0, 24, 2);
    l.position.set(lx, groundHeight(lx, lz) + 3.4, lz);
    fx.add(l);
    marketLights.push(l);
  }

  // the crowd that returns with the market — one Points cloud, billboarded
  const crowdN = 46;
  const cp = new Float32Array(crowdN * 3), cs = new Float32Array(crowdN), cseed = new Float32Array(crowdN);
  for (let i = 0; i < crowdN; i++) {
    const st = marketStalls[i % marketStalls.length];
    cp.set([
      st.x + rng2.range(-4, 4),
      st.y + 1.05,
      st.z + rng2.range(-3.4, 3.4),
    ], i * 3);
    cs[i] = rng2.range(3.6, 6.2);
    cseed[i] = rng2.f() * 100;
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  crowdGeo.setAttribute('aSize', new THREE.BufferAttribute(cs, 1));
  crowdGeo.setAttribute('aSeed', new THREE.BufferAttribute(cseed, 1));
  const crowdMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 },
      uSprite: { value: crowdSprite(21, 128, 34) }, uColor: { value: new THREE.Color('#ffd6a0') },
    },
    vertexShader: /* glsl */`
      attribute float aSize, aSeed; uniform float uTime, uPixelRatio; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.22 + aSeed) * 0.34;
        p.y += sin(uTime * 0.7 + aSeed * 2.0) * 0.06;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (34.0 / max(1.0, -mv.z));
        vA = smoothstep(70.0, 8.0, length(p - cameraPosition));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uSprite; uniform float uOpacity; uniform vec3 uColor; varying float vA;
      void main(){
        vec4 t = texture2D(uSprite, gl_PointCoord);
        if (t.a < 0.01) discard;
        gl_FragColor = vec4(uColor * t.rgb * 1.3, t.a * uOpacity * vA);
      }`,
  });
  const crowd = new THREE.Points(crowdGeo, crowdMat);
  crowd.frustumCulled = false;
  fx.add(crowd);

  /* ── astronomy: the lamp that turns once the sky is remembered ── */
  const sweepBeam = new THREE.Group();
  sweepBeam.position.set(OX - 5, ctx.OBS_Y + 15.4, OZ - 3);
  fx.add(sweepBeam);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 90, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbfe9ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    })
  );
  beam.rotation.z = Math.PI / 2 - 0.16;
  beam.position.set(45, 0, 0);
  sweepBeam.add(beam);
  const lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(17, 128, 195, 1), blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0, color: 0xbfe9ff,
  }));
  lensGlow.scale.setScalar(14);
  sweepBeam.add(lensGlow);

  /* ── the amphitheatre's released lanterns ── */
  const lanternN = 90;
  const lp = new Float32Array(lanternN * 3), ls = new Float32Array(lanternN), lseed = new Float32Array(lanternN);
  for (let i = 0; i < lanternN; i++) {
    const a = rng2.f() * Math.PI * 2, r = rng2.range(4, 30);
    lp.set([AX + Math.cos(a) * r, STAGE_Y + rng2.range(0.5, 6), AZ + Math.sin(a) * r], i * 3);
    ls[i] = rng2.range(8, 22);
    lseed[i] = rng2.f() * 100;
  }
  const lanternGeo = new THREE.BufferGeometry();
  lanternGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lanternGeo.setAttribute('aSize', new THREE.BufferAttribute(ls, 1));
  lanternGeo.setAttribute('aSeed', new THREE.BufferAttribute(lseed, 1));
  const lanternMatPts = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 },
      uSprite: { value: glowSprite(19, 128, 36, 1) }, uColor: { value: new THREE.Color('#ffcf96') },
    },
    vertexShader: /* glsl */`
      attribute float aSize, aSeed; uniform float uTime, uPixelRatio; varying float vA;
      void main(){
        vec3 p = position;
        float rise = mod(uTime * (0.28 + fract(aSeed) * 0.4) + aSeed, 42.0);
        p.y += rise;
        p.x += sin(uTime * 0.3 + aSeed) * 2.2;
        p.z += cos(uTime * 0.24 + aSeed * 1.4) * 2.2;
        vA = (1.0 - rise / 42.0) * smoothstep(120.0, 10.0, length(p - cameraPosition));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (20.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uSprite; uniform float uOpacity; uniform vec3 uColor; varying float vA;
      void main(){
        vec4 t = texture2D(uSprite, gl_PointCoord);
        gl_FragColor = vec4(uColor * t.rgb, t.a * uOpacity * vA);
      }`,
  });
  const lanterns = new THREE.Points(lanternGeo, lanternMatPts);
  lanterns.frustumCulled = false;
  fx.add(lanterns);

  /* ── the temple's dark veins, already part of the wall material ── */
  const shadowSpawn = new THREE.Vector3(TX + 4, 4.2 + 0.6, TZ - 3);

  /* ── the sea-gates: churn, spray and the promise of more water ── */
  const churn = new THREE.Group();
  churn.position.set(GX, -0.1, GZ + 12);
  fx.add(churn);
  const churnN = 120;
  const chp = new Float32Array(churnN * 3), chs = new Float32Array(churnN);
  for (let i = 0; i < churnN; i++) {
    chp.set([rng2.range(-16, 16), rng2.range(-1.5, 5), rng2.range(-14, 14)], i * 3);
    chs[i] = rng2.range(3, 11);
  }
  const churnGeo = new THREE.BufferGeometry();
  churnGeo.setAttribute('position', new THREE.BufferAttribute(chp, 3));
  churnGeo.setAttribute('aSize', new THREE.BufferAttribute(chs, 1));
  const churnMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uPixelRatio: { value: 1 },
      uSprite: { value: glowSprite(23, 128, 178, 1) },
    },
    vertexShader: /* glsl */`
      attribute float aSize; uniform float uTime, uPixelRatio; varying float vA;
      void main(){
        vec3 p = position;
        p.y -= mod(uTime * 1.6 + p.y * 3.0, 7.0) - 2.0;
        vA = smoothstep(120.0, 12.0, length(p - cameraPosition));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (26.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uSprite; uniform float uOpacity; varying float vA;
      void main(){
        vec4 t = texture2D(uSprite, gl_PointCoord);
        gl_FragColor = vec4(vec3(0.62, 0.98, 0.9) * t.rgb, t.a * uOpacity * vA * 0.8);
      }`,
  });
  const churnPts = new THREE.Points(churnGeo, churnMat);
  churnPts.frustumCulled = false;
  churn.add(churnPts);

  /* ── the drowned quarter, lit from under the water once the gates give ── */
  const drownedGlowMat = new THREE.MeshBasicMaterial({
    color: 0x39d6c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  for (let i = 0; i < 26; i++) {
    const a = rng2.f() * Math.PI * 2, r = 20 + rng2.f() * 70;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(rng2.range(5, 12), rng2.range(5, 12)), drownedGlowMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(GX + Math.cos(a) * r * 0.5 - 20, -1.4, GZ + Math.sin(a) * r * 0.7);
    fx.add(p);
  }

  const flags = { market: false, sky: false, song: false, bargain: false, sealing: false, self: false };
  marketGroup.visible = false;

  const effects = {
    fx, burst, mist, crowd, crowdMat, lanterns, lanternMatPts, churnMat, drownedGlowMat,
    beam, lensGlow, sweepBeam, orrery, orreryRings, moonStone, orreryGlow,
    marketGroup, marketLights, shadowSpawn, flags,
    skyRestored: false,
    gateRushTimer: 0,
    update(dt, t, playerPos, state) {
      burst.update(dt);
      mistMat.uniforms.uTime.value = t;
      crowdMat.uniforms.uTime.value = t;
      lanternMatPts.uniforms.uTime.value = t;
      churnMat.uniforms.uTime.value = t;

      const remembered = state.memoryCount;
      mistMat.uniforms.uOpacity.value = 0.10 + remembered * 0.022;
      crowdMat.uniforms.uOpacity.value += ((flags.market ? 0.75 : 0) - crowdMat.uniforms.uOpacity.value) * Math.min(1, dt * 0.5);
      lanternMatPts.uniforms.uOpacity.value += ((flags.song ? 0.9 : 0) - lanternMatPts.uniforms.uOpacity.value) * Math.min(1, dt * 0.35);
      churnMat.uniforms.uOpacity.value += ((flags.sealing ? 0.9 : 0) - churnMat.uniforms.uOpacity.value) * Math.min(1, dt * 0.3);
      drownedGlowMat.opacity += ((flags.sealing ? 0.16 : 0) - drownedGlowMat.opacity) * Math.min(1, dt * 0.2);

      this.skyRestored = flags.sky;
      // market lanterns flicker
      const flick = 0.75 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 13.7) * 0.05;
      for (const l of marketLights) l.intensity += ((flags.market ? 26 : 0) * flick - l.intensity) * Math.min(1, dt * 0.7);
      for (const g of stallMeshes) {
        const s = 1 + Math.sin(t * 3 + g.position.x) * 0.04;
        g.scale.setScalar(s);
      }

      // orrery rings turn slowly; they spin up with the final memory
      const speed = flags.self ? 3.2 : 1.0;
      for (const o of orreryRings) {
        o.ring.rotation.x += dt * o.sx * 0.35 * speed;
        o.ring.rotation.y += dt * o.sy * 0.5 * speed;
        o.ring.rotation.z += dt * o.sz * 0.28 * speed;
      }
      orreryGlow.material.opacity = 0.18 + remembered * 0.06 + Math.sin(t * 1.3) * 0.04;
      orreryGlow.scale.setScalar(8 + Math.sin(t * 0.7) * 0.6 + remembered * 0.5);
      orrery.position.y = ctx.BASIN_Y + 2.6 + Math.sin(t * 0.5) * 0.12;
      orrery.rotation.y += dt * 0.05 * speed;

      // a tide that pushes back through the open gates
      if (flags.sealing && playerPos) {
        this.gateRushTimer -= dt;
        if (this.gateRushTimer <= 0) {
          this.gateRushTimer = 0.5;
          fx.userData.onGateRush?.(GX + (Math.random() - 0.5) * 30, GZ + 4 + Math.random() * 16);
        }
      }
    },
    place(x, y, z, kind, count = 60) {
      burst.spawn(new THREE.Vector3(x, y, z), kind, count);
    },
  };

  return effects;
}

/* ── which furniture answers to which restored memory ── */
export const FURNITURE = {
  market:  { setVisible: (on, fx) => { fx.flags.market = on; fx.marketGroup.visible = on; } },
  sky:     { setVisible: (on, fx) => { fx.flags.sky = on; fx.beam.material.opacity = on ? 0.16 : 0; fx.lensGlow.material.opacity = on ? 0.5 : 0; } },
  song:    { setVisible: (on, fx) => { fx.flags.song = on; } },
  bargain: { setVisible: (on, fx) => { fx.flags.bargain = on; } },
  sealing: { setVisible: (on, fx) => { fx.flags.sealing = on; } },
  self:    { setVisible: (on, fx) => { fx.flags.self = on; } },
};
