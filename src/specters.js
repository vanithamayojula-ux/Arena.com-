// The six who are still here. Each holds one fragment of the city's last day.
import * as THREE from 'three';
import { glowSprite, crowdSprite } from './textures.js';
import { makeRNG } from './rng.js';

const shroudVertex = /* glsl */`
  uniform float uTime;
  varying vec2 vUv;
  varying float vFade;
  void main(){
    vUv = uv;
    vec3 p = position;
    float n = sin(p.y * 3.1 + uTime * 0.9) * 0.05
            + sin(p.x * 4.3 - uTime * 0.6) * 0.045
            + sin(p.z * 5.1 + uTime * 1.3) * 0.04;
    p.x += n; p.z += n * 0.8;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = smoothstep(-0.6, 0.4, p.y);
    gl_Position = projectionMatrix * mv;
  }`;

const shroudFragment = /* glsl */`
  precision highp float;
  uniform float uTime, uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFade;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  void main(){
    float grain = noise(vec2(vUv.x * 22.0, vUv.y * 40.0 - uTime * 0.55));
    float veins = smoothstep(0.42, 0.98, grain);
    float a = (0.18 + veins * 0.72) * vFade;
    a *= smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y) * 1.0);
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * (0.7 + veins * 0.9), a * uOpacity);
  }`;

export function createSpecters(scene, { city, audio, memories, onRestore } = {}) {
  const rng = makeRNG(31337);
  const group = new THREE.Group();
  group.name = 'specters';
  scene.add(group);

  const shards = [];

  for (const mem of memories) {
    const anchor = city.shardAnchors[mem.id] || new THREE.Vector3(...mem.shardAt);
    const pos = anchor.clone();
    const accent = new THREE.Color(mem.accent);

    /* ── the shard: a fragment of the city's own light ── */
    const shardGroup = new THREE.Group();
    shardGroup.position.copy(pos);
    group.add(shardGroup);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x14222a, roughness: 0.18, metalness: 0.35,
      emissive: accent, emissiveIntensity: 0.7,
      transparent: true, opacity: 0.92,
    });
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), stoneMat);
    stone.castShadow = false;
    shardGroup.add(stone);
    // a thin shell of light around the stone
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 1),
      new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true,
      })
    );
    shardGroup.add(shell);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(31, 128, 168, 1), color: accent, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6,
    }));
    glow.scale.setScalar(4.2);
    shardGroup.add(glow);
    const light = new THREE.PointLight(accent.getHex(), 9, 20, 2);
    shardGroup.add(light);

    // A shaft of light standing over the fragment: visible across the whole city,
    // so "where do I go" is never a guess.
    const beamH = 46;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 2.1, beamH, 14, 1, true),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 }, uOpacity: { value: 0.5 },
          uColor: { value: accent.clone() },
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
          precision highp float;
          uniform float uTime, uOpacity; uniform vec3 uColor;
          varying vec2 vUv;
          void main(){
            float up = vUv.y;
            float a = pow(1.0 - up, 1.5) * 0.85 + 0.15;
            a *= 0.55 + 0.45 * sin(uTime * 1.1 + up * 6.0);
            a *= smoothstep(0.0, 0.12, up);            // fade out at the very top
            gl_FragColor = vec4(uColor, a * uOpacity * 0.42);
          }`,
      })
    );
    beam.position.set(pos.x, beamH / 2 - 2, pos.z);
    group.add(beam);

    /* ── the one who remembers ── */
    const wraith = new THREE.Group();
    wraith.position.set(pos.x + 1.6, 0, pos.z + 1.2);
    group.add(wraith);

    const shroudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uOpacity: { value: 0.42 }, uColor: { value: accent.clone() },
      },
      vertexShader: shroudVertex, fragmentShader: shroudFragment,
    });
    const bodyGeo = new THREE.CapsuleGeometry(0.42, 1.25, 8, 18);
    const body = new THREE.Mesh(bodyGeo, shroudMat);
    body.position.y = 1.15;
    wraith.add(body);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 14, 3, true), shroudMat);
    hood.position.y = 2.1;
    wraith.add(hood);

    const eyeMat = new THREE.SpriteMaterial({
      map: glowSprite(33, 64, 40, 1), color: accent, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
    });
    const eyes = new THREE.Sprite(eyeMat);
    eyes.scale.setScalar(0.34);
    eyes.position.set(0, 1.92, 0.24);
    wraith.add(eyes);

    /* ── the small crowd that waits with them ── */
    const echoesN = 9;
    const ep = new Float32Array(echoesN * 3), es = new Float32Array(echoesN), esd = new Float32Array(echoesN);
    for (let i = 0; i < echoesN; i++) {
      const a = rng.f() * Math.PI * 2, r = rng.range(2.6, 7.5);
      ep.set([pos.x + Math.cos(a) * r, 0, pos.z + Math.sin(a) * r], i * 3);
      es[i] = rng.range(3.4, 5.6);
      esd[i] = rng.f() * 100;
    }
    const echoGeo = new THREE.BufferGeometry();
    echoGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    echoGeo.setAttribute('aSize', new THREE.BufferAttribute(es, 1));
    echoGeo.setAttribute('aSeed', new THREE.BufferAttribute(esd, 1));
    const echoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uOp: { value: 0 }, uPixelRatio: { value: 1 },
        uSprite: { value: crowdSprite(41, 128, mem.kind === 'dark' ? 350 : mem.kind === 'warm' ? 34 : 190) },
        uColor: { value: accent.clone() },
      },
      vertexShader: /* glsl */`
        attribute float aSize, aSeed; uniform float uTime, uPixelRatio; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.18 + aSeed) * 0.5;
          p.y += 0.95 + sin(uTime * 0.6 + aSeed * 2.0) * 0.07;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (36.0 / max(1.0, -mv.z));
          vA = smoothstep(62.0, 10.0, length(p - cameraPosition));
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uSprite; uniform float uOp; uniform vec3 uColor; varying float vA;
        void main(){
          vec4 t = texture2D(uSprite, gl_PointCoord);
          if (t.a < 0.01) discard;
          gl_FragColor = vec4(uColor * t.rgb, t.a * uOp * vA);
        }`,
    });
    const echoes = new THREE.Points(echoGeo, echoMat);
    echoes.frustumCulled = false;
    group.add(echoes);

    shards.push({
      id: mem.id, memory: mem, accent,
      position: pos.clone(),
      group: shardGroup, stone, shell, glow, light, beam,
      wraith, shroudMat, eyes,
      echoes, echoMat,
      listening: false, progress: 0, restored: false,
      bob: rng.f() * 6.28, ascend: 0, baseY: pos.y,
      lineIndex: -1,
    });
  }

  /* ── audio drones, one per shard ── */
  const drones = {};
  function attachAudio() {
    for (const s of shards) {
      drones[s.id] = audio?.attachDrone(s.position, s.memory.kind === 'dark' ? 78 : 150 + s.memory.order * 22);
      drones[s.id]?.setActive(0.8);
    }
  }

  const tmp = new THREE.Vector3();

  function nearest(playerPos, { maxDist = 6.5, requireUnrestored = true } = {}) {
    let best = null, bestD = Infinity;
    for (const s of shards) {
      if (requireUnrestored && s.restored) continue;
      const d = tmp.copy(s.position).sub(playerPos).length();
      const dy = Math.abs(s.position.y - playerPos.y);
      if (d < bestD && d < maxDist && dy < 4.2) { best = s; bestD = d; }
    }
    return best ? { shard: best, dist: bestD } : null;
  }

  function forId(id) { return shards.find((s) => s.id === id); }

  function setListening(shard, on) {
    if (!shard) return;
    shard.listening = on;
    if (!on) shard.progress = 0;
  }

  function restore(shard) {
    if (!shard || shard.restored) return;
    shard.restored = true;
    shard.listening = false;
    shard.progress = 1;
    onRestore?.(shard);
  }

  function update(dt, time, playerPos, cameraPos) {
    for (const s of shards) {
      // shard hover + spin
      s.bob += dt;
      const float = Math.sin(s.bob * 0.9) * 0.16;
      s.group.position.y = s.baseY + float;
      s.stone.rotation.y += dt * 0.55;
      s.stone.rotation.x += dt * 0.22;
      s.shell.rotation.y -= dt * 0.4;
      s.shell.rotation.z += dt * 0.3;

      const near = cameraPos ? Math.max(0, 1 - tmp.copy(s.position).sub(cameraPos).length() / 55) : 0;
      const pulse = 0.6 + Math.sin(time * 1.6 + s.bob) * 0.18 + near * 0.5;
      const listeningBoost = s.listening ? 1.4 : 0;
      s.glow.material.opacity = 0.45 + pulse * 0.45 + listeningBoost * 0.4;
      s.glow.scale.setScalar(4.4 + pulse * 1.6 + listeningBoost);

      // the beacon reads from far away and gets out of the way when you arrive
      const distToPlayer = cameraPos ? tmp.copy(s.position).sub(cameraPos).length() : 40;
      const beamWant = s.restored ? 0 : Math.min(1, Math.max(0, (distToPlayer - 7) / 22));
      const beamNow = s.beam.material.uniforms.uOpacity.value;
      s.beam.material.uniforms.uOpacity.value = beamNow + (beamWant * 0.75 - beamNow) * Math.min(1, dt * 1.4);
      s.beam.material.uniforms.uTime.value = time;
      s.beam.visible = s.beam.material.uniforms.uOpacity.value > 0.01;

      if (s.restored) {
        s.ascend += dt;
        s.shroudMat.uniforms.uOpacity.value += ((0.16) - s.shroudMat.uniforms.uOpacity.value) * Math.min(1, dt * 0.5);
        s.wraith.position.y += (2.6 + s.ascend * 0.18 - s.wraith.position.y) * Math.min(1, dt * 0.35);
        s.wraith.rotation.y += dt * 0.12;
        s.stone.material.emissiveIntensity = 1.35 + Math.sin(time * 2 + s.bob) * 0.2;
        s.light.intensity = 13 + Math.sin(time * 1.4) * 3;
        s.echoMat.uniforms.uOp.value += ((0.75) - s.echoMat.uniforms.uOp.value) * Math.min(1, dt * 0.4);
      } else {
        // the one who remembers turns to face you
        const d = tmp.copy(playerPos).sub(s.wraith.position);
        d.y = 0;
        if (d.lengthSq() > 0.001) {
          const targetYaw = Math.atan2(d.x, d.z);
          let diff = targetYaw - s.wraith.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          s.wraith.rotation.y += diff * Math.min(1, dt * 1.4);
        }
        const base = s.memory.kind === 'dark' ? 0.5 : 0.34;
        const target = base + (s.listening ? 0.5 : 0) + Math.sin(time * 1.1 + s.bob) * 0.06;
        s.shroudMat.uniforms.uOpacity.value += (target - s.shroudMat.uniforms.uOpacity.value) * Math.min(1, dt * 1.6);
        s.wraith.position.y += (Math.sin(time * 0.8 + s.bob) * 0.12 + (s.listening ? 0.25 : 0) - s.wraith.position.y) * Math.min(1, dt * 0.8);
        s.stone.material.emissiveIntensity = 0.5 + (s.listening ? 1.2 : 0) + Math.sin(time * 1.3) * 0.12;
        s.light.intensity = 4 + (s.listening ? 9 : 0) + Math.sin(time * 1.7) * 1.5;
      }

      s.shroudMat.uniforms.uTime.value = time;
      s.echoMat.uniforms.uTime.value = time;
      s.eyes.material.opacity = s.restored ? 0.25 : 0.7 + Math.sin(time * 2.2 + s.bob) * 0.2;

      drones[s.id]?.setActive(s.restored ? 1.25 : 0.8 + near * 0.8);
    }
  }

  return { group, shards, nearest, forId, setListening, restore, update, attachAudio, drones,
    setPixelRatio(r) {
      for (const s of shards) { s.echoMat.uniforms.uPixelRatio.value = r; }
    },
  };
}
