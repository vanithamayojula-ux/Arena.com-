// The eclipse: sky dome with a bitten-out sun, stars, drifting spores.
import * as THREE from 'three';
import { glowSprite, paperTexture } from './textures.js';

export function createSky(scene, { seed = 4 } = {}) {
  const group = new THREE.Group();
  scene.add(group);

  const sunDir = new THREE.Vector3(-0.42, 0.2, -0.78).normalize();

  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uCoverage: { value: 0.35 },   // 0 = open sun, 1 = total eclipse
      uTotality: { value: 0.2 },    // darkness of the world
      uZenith: { value: new THREE.Color('#152a3c') },
      uHorizon: { value: new THREE.Color('#33505f') },
      uGlowColor: { value: new THREE.Color('#6ff0d4') },
      uSunColor: { value: new THREE.Color('#ffe7c2') },
      uNoise: { value: paperTexture(seed + 3, 512) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime, uCoverage, uTotality;
      uniform vec3 uSunDir, uZenith, uHorizon, uGlowColor, uSunColor;
      uniform sampler2D uNoise;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }

      void main(){
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y * 1.35 + 0.18, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.85));

        // slow breathing of the sky, like wet paper drying
        float grain = texture2D(uNoise, dir.xz * 1.6 + uTime * 0.004).r;
        col *= 0.92 + grain * 0.30;

        // bioluminescent horizon: the city's glow leaking up into the weather
        float horiz = exp(-max(dir.y, 0.0) * 7.5);
        col += uGlowColor * horiz * (0.20 + 0.6 * uTotality) * (0.6 + grain * 0.8);

        // the sun, being eaten
        float ang = acos(clamp(dot(dir, normalize(uSunDir)), -1.0, 1.0));
        float R = mix(0.085, 0.052, uCoverage);        // apparent radius shrinks as it dims
        float disc = smoothstep(R - 0.004, R + 0.004, ang);
        float inner = 1.0 - smoothstep(R * 0.55, R, ang);
        vec3 sunCol = uSunColor * (1.0 - uCoverage) * 2.6;

        // corona only shows when the sun is covered
        float ca = max(0.0, ang - R);
        float corona = exp(-ca * 22.0) * 0.9 + exp(-ca * 5.5) * 0.28;
        float rays = 0.72 + 0.5 * noise(vec2(atan(dir.z, dir.x) * 5.0, ang * 30.0 - uTime * 0.03));
        vec3 cor = uSunColor * corona * rays * uCoverage * 1.5;

        // a faint halo behind the moon even before totality
        float halo = exp(-ang * 3.2) * 0.16 * (1.0 - uCoverage);

        col = col * mix(1.0, 0.35, uTotality * (1.0 - exp(-ang * 3.0)));  // darken around the sun
        col += sunCol * inner * 0.9;
        col = mix(col, vec3(0.03, 0.045, 0.07), disc * 0.965);
        col += cor + uSunColor * halo;

        // a thin bright rim at the edge of the moon
        float rim = exp(-abs(ang - R) * 900.0) * uCoverage * 1.4;
        col += uSunColor * rim;

        // deep-water grime at the very bottom of the sky
        col = mix(col, vec3(0.06, 0.11, 0.13), smoothstep(0.05, -0.25, dir.y) * 0.80);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 32), domeMat);
  dome.frustumCulled = false;
  group.add(dome);

  /* ── stars ── */
  const starCount = 1300;
  const sPos = new Float32Array(starCount * 3);
  const sSize = new Float32Array(starCount);
  const sSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3().randomDirection();
    v.y = Math.abs(v.y) * 0.95 + 0.05;
    v.multiplyScalar(820);
    sPos.set([v.x, v.y, v.z], i * 3);
    sSize[i] = 1 + Math.random() * 3.2;
    sSeed[i] = Math.random() * 100;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.4 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aSeed;
      uniform float uTime, uPixelRatio; varying float vTw;
      void main(){
        vTw = 0.5 + 0.5 * sin(uTime * (0.4 + fract(aSeed) * 1.6) + aSeed * 12.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (1.0 + vTw * 0.5);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying float vTw;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        gl_FragColor = vec4(vec3(0.75, 0.86, 1.0) * (0.6 + vTw * 0.8), a * uOpacity);
      }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  /* ── spores / motes ── */
  const moteCount = 2200;
  const mPos = new Float32Array(moteCount * 3);
  const mSeed = new Float32Array(moteCount);
  const mSize = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    const r = 8 + Math.pow(Math.random(), 0.65) * 130;
    const a = Math.random() * Math.PI * 2;
    mPos.set([Math.cos(a) * r, Math.random() * 46 - 1.5, Math.sin(a) * r], i * 3);
    mSeed[i] = Math.random() * 100;
    mSize[i] = 1.2 + Math.pow(Math.random(), 3) * 7;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(mSeed, 1));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(mSize, 1));
  const moteMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: 1 },
      uOpacity: { value: 0.55 }, uColor: { value: new THREE.Color('#8ff6dd') },
      uCamY: { value: 0 }, uSprite: { value: glowSprite(2, 128, 165, 0.8) },
    },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute float aSize;
      uniform float uTime, uPixelRatio, uCamY;
      varying float vA;
      void main(){
        vec3 p = position;
        float s = fract(aSeed);
        p.x += sin(uTime * (0.10 + s * 0.22) + aSeed) * 2.4;
        p.z += cos(uTime * (0.08 + s * 0.19) + aSeed * 1.7) * 2.4;
        p.y += sin(uTime * (0.14 + s * 0.1) + aSeed * 2.3) * 1.5 + mod(uTime * (0.16 + s * 0.3), 1.0) * 1.4;
        float d = length(p - cameraPosition);
        vA = smoothstep(150.0, 30.0, d) * smoothstep(1.0, 6.0, p.y - uCamY + 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (300.0 / max(0.001, -mv.z));
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor; uniform sampler2D uSprite;
      varying float vA;
      void main(){
        vec4 t = texture2D(uSprite, gl_PointCoord);
        gl_FragColor = vec4(uColor * t.rgb, t.a * uOpacity * vA);
      }`,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  group.add(motes);

  /* ── the moon: a dull disc in front of the sun, so the eclipse reads volumetrically ── */
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: 0x05070c, transparent: true, opacity: 0.98, fog: false, depthWrite: false })
  );
  moon.scale.setScalar(42);
  moon.position.copy(sunDir).multiplyScalar(700);
  moon.lookAt(0, 0, 0);
  group.add(moon);

  const ZENITH_DARK = new THREE.Color('#152a3c');
  const ZENITH_LIT = new THREE.Color('#2b4358');
  const HORIZON_DARK = new THREE.Color('#33505f');
  const HORIZON_LIT = new THREE.Color('#5b7488');
  const state = { totality: 0, coverage: 0.35 };
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(7, 256, 40, 1), blending: THREE.AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0.0, fog: false,
  }));
  sunSprite.scale.setScalar(320);
  sunSprite.position.copy(sunDir).multiplyScalar(660);
  group.add(sunSprite);

  return {
    group, sunDir, dome, stars, motes, sunSprite,
    setEclipse(coverage, totality) {
      state.coverage = coverage; state.totality = totality;
      domeMat.uniforms.uCoverage.value = coverage;
      domeMat.uniforms.uTotality.value = totality;
      starMat.uniforms.uOpacity.value = 0.18 + totality * 0.72;
      moteMat.uniforms.uOpacity.value = 0.35 + totality * 0.5;
      sunSprite.material.opacity = (1 - coverage) * 0.55;
      domeMat.uniforms.uHorizon.value.lerpColors(HORIZON_LIT, HORIZON_DARK, totality);
      domeMat.uniforms.uZenith.value.lerpColors(ZENITH_DARK, ZENITH_LIT, (1 - totality) * 0.5);
    },
    update(dt, camera) {
      domeMat.uniforms.uTime.value += dt;
      starMat.uniforms.uTime.value += dt;
      moteMat.uniforms.uTime.value += dt;
      moteMat.uniforms.uCamY.value = camera.position.y;
      dome.position.copy(camera.position);
      stars.position.copy(camera.position);
      motes.position.set(0, 0, 0);
    },
    setPixelRatio(r) {
      starMat.uniforms.uPixelRatio.value = r;
      moteMat.uniforms.uPixelRatio.value = r;
    },
  };
}
