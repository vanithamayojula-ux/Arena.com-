// What the dark memories leave behind. They are slow, patient, and they only
// want the light you are carrying.
import * as THREE from 'three';
import { makeRNG } from './rng.js';

function darkSprite(size = 256, rim = '#ff5f7e') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(2,3,6,0.98)');
  g.addColorStop(0.45, 'rgba(4,5,10,0.82)');
  g.addColorStop(0.72, 'rgba(30,8,20,0.42)');
  g.addColorStop(0.9, 'rgba(255,95,126,0.10)');
  g.addColorStop(1, 'rgba(255,95,126,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // a few torn edges so it does not read as a perfect disc
  const rng = makeRNG(7);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = rng.f() * Math.PI * 2, r = size * (0.3 + rng.f() * 0.22);
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r, size * rng.range(0.03, 0.12), 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tendrilVert = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.x += sin(p.y * 2.6 + uTime * 1.1) * 0.14;
    p.z += cos(p.y * 2.2 + uTime * 0.9) * 0.14;
    p.y += sin(uTime * 1.4 + p.x * 3.0) * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const tendrilFrag = /* glsl */`
  precision highp float;
  uniform float uTime, uOpacity;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  void main(){
    float n = noise(vec2(vUv.x * 14.0, vUv.y * 26.0 - uTime * 1.4));
    float body = smoothstep(0.34, 0.9, n);
    float a = body * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.01, 0.012, 0.02), vec3(0.24, 0.03, 0.09), body * 0.7);
    gl_FragColor = vec4(col, a * uOpacity);
  }`;

export function createShadows(scene, { city, audio, onDrain, onTrail } = {}) {
  const rng = makeRNG(6660);
  const group = new THREE.Group();
  group.name = 'shadows';
  scene.add(group);

  const sprite = darkSprite(256);
  const pool = [];
  const MAX = 7;

  const eyeMat = new THREE.SpriteMaterial({
    map: (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,140,170,1)');
      g.addColorStop(0.4, 'rgba(255,80,120,0.5)');
      g.addColorStop(1, 'rgba(255,60,100,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
  });

  function makeOne() {
    const g = new THREE.Group();
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sprite, transparent: true, depthWrite: false, opacity: 0.0, color: 0xffffff,
    }));
    core.scale.setScalar(4.4);
    g.add(core);

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: tendrilVert, fragmentShader: tendrilFrag,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.5, 8, 16), mat);
    body.position.y = 1.1;
    g.add(body);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.3, 12, 2, true), mat);
    hood.position.y = 2.1;
    g.add(hood);

    const eyes = new THREE.Group();
    for (const s of [-1, 1]) {
      const e = new THREE.Sprite(eyeMat);
      e.scale.setScalar(0.24);
      e.position.set(0.16 * s, 1.98, 0.3);
      eyes.add(e);
    }
    g.add(eyes);

    g.visible = false;
    group.add(g);
    return {
      group: g, core, mat, eyes,
      active: false, opacity: 0, dissolve: 0,
      vel: new THREE.Vector3(), target: new THREE.Vector3(),
      lanternExposure: 0, hitCooldown: 0, respawn: 0, wobble: rng.f() * 10,
      kind: 'temple',
    };
  }
  for (let i = 0; i < MAX; i++) pool.push(makeOne());

  function spawnAt(pos, kind = 'temple') {
    const s = pool.find((p) => !p.active) || pool[0];
    s.active = true;
    s.kind = kind;
    s.opacity = 0;
    s.dissolve = 0;
    s.lanternExposure = 0;
    s.hitCooldown = 0;
    s.respawn = 0;
    s.group.visible = true;
    s.group.position.set(pos.x, pos.y, pos.z);
    if (audio) { audio.droneSwell(0.7); audio.whisper('we are still here'); }
    return s;
  }

  function banish(s, instant = false) {
    s.dissolve = instant ? 1.4 : 0.9;
    s.respawn = 22 + Math.random() * 16;
    if (audio) { audio.whisper('the light, the light'); audio.chime(160, 0.07); }
  }

  const tmp = new THREE.Vector3();
  let threat = 0;

  function update(dt, time, playerPos, { lanternOn = false, lanternPos = null, sanity = 1 } = {}) {
    let near = 0;
    for (const s of pool) {
      if (!s.active) continue;
      s.mat.uniforms.uTime.value = time;

      if (s.dissolve > 0) {
        s.dissolve -= dt;
        const k = Math.max(0, s.dissolve / 0.9);
        s.opacity = k * 0.9;
        s.group.position.y += dt * 6 * (1 - k);
        if (s.dissolve <= 0) {
          s.active = false;
          s.group.visible = false;
          s.core.material.opacity = 0;
          s.mat.uniforms.uOpacity.value = 0;
        }
      } else {
        const d = tmp.copy(playerPos).sub(s.group.position);
        const dist = Math.hypot(d.x, d.z);
        const lit = lanternOn && lanternPos ? Math.hypot(lanternPos.x - s.group.position.x, lanternPos.z - s.group.position.z) : 999;

        // drift / stalk
        const desired = new THREE.Vector3();
        if (dist < 58 && sanity > 0.12) {
          desired.copy(d).setY(0).normalize().multiplyScalar(dist > 3 ? (lanternOn && lit < 14 ? -3.2 : 2.4 + (58 - dist) * 0.02) : 0);
        }
        const wander = Math.sin(time * 0.5 + s.wobble) * 1.1;
        desired.x += Math.cos(time * 0.33 + s.wobble * 2) * 0.55 * wander;
        desired.z += Math.sin(time * 0.29 + s.wobble * 1.7) * 0.55 * wander;
        s.vel.lerp(desired, Math.min(1, dt * (lanternOn && lit < 14 ? 2.6 : 1.1)));

        s.group.position.x += s.vel.x * dt;
        s.group.position.z += s.vel.z * dt;
        const gy = city.groundHeight(s.group.position.x, s.group.position.z);
        const hover = Math.max(gy, -1.2) + 1.35 + Math.sin(time * 0.8 + s.wobble) * 0.22;
        s.group.position.y += (hover - s.group.position.y) * Math.min(1, dt * 1.2);
        s.group.lookAt(playerPos.x, s.group.position.y, playerPos.z);

        if (onTrail && Math.random() < dt * 2.4) onTrail(s.group.position.x, s.group.position.z, 0.25);

        // recoil from the lantern
        if (lanternOn && lit < 11) {
          s.lanternExposure += dt;
          if (audio && Math.random() < dt * 1.4) audio.whisper('do not look');
          if (s.lanternExposure > 1.5) banish(s);
        } else {
          s.lanternExposure = Math.max(0, s.lanternExposure - dt * 0.8);
        }

        // contact
        s.hitCooldown -= dt;
        if (dist < 1.9 && Math.abs(s.group.position.y - playerPos.y) < 3 && s.hitCooldown <= 0) {
          s.hitCooldown = 8;
          onDrain?.(16, s);
          if (audio) { audio.heartbeat(1); audio.whisper('remember us remember us'); }
          banish(s, true);
        }

        s.opacity += ((s.dissolve > 0 ? 0 : 0.92) - s.opacity) * Math.min(1, dt * 1.4);
      }

      s.core.material.opacity = s.opacity;
      s.mat.uniforms.uOpacity.value = s.opacity;
      s.core.scale.setScalar(4.4 + Math.sin(time * 1.3 + s.wobble) * 0.4);
      s.eyes.children.forEach((e) => { e.material = eyeMat; });
      if (s.active) near = Math.max(near, Math.max(0, 1 - Math.hypot(tmp.x, tmp.z) / 45) * s.opacity);
    }

    threat += (near - threat) * Math.min(1, dt * 1.2);
    // respawns
    for (const s of pool) {
      if (!s.active && s.respawn > 0) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 34 + Math.random() * 26;
          spawnAt(new THREE.Vector3(playerPos.x + Math.cos(a) * r, 0, playerPos.z + Math.sin(a) * r), s.kind);
        }
      }
    }
    return threat;
  }

  return {
    group, pool, spawnAt, banish, update,
    get threat() { return threat; },
    get count() { return pool.filter((p) => p.active && p.dissolve <= 0).length; },
    clear() { for (const s of pool) { s.active = false; s.group.visible = false; s.respawn = 0; } },
  };
}
