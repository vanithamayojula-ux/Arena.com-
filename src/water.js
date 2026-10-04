// The tide. A shader plane that carries bioluminescence, footsteps and the shadow
// of the eclipse. It rises every time the city remembers something.
import * as THREE from 'three';

const MAX_RIPPLES = 14;

export function createWater(scene, { level = 0 } = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uLevel: { value: level },
    uDeep: { value: new THREE.Color('#0e2531') },
    uShallow: { value: new THREE.Color('#22606c') },
    uGlow: { value: new THREE.Color('#7ff7dc') },
    uBlood: { value: new THREE.Color('#ff5f7e') },   // dark memories stain the water
    uBloodAmt: { value: 0.0 },
    uMemories: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.42, 0.2, -0.78).normalize() },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, 99, 0)) },
    uFogColor: { value: new THREE.Color('#1d4450') },
    uFogNear: { value: 16 },
    uFogFar: { value: 205 },
    uCamPos: { value: new THREE.Vector3() },
    uFogMask: { value: 1 },
  };

  const geo = new THREE.PlaneGeometry(1600, 1600, 200, 200);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorld;
      varying float vWave;
      float wave(vec2 p, vec2 d, float f, float a){
        return sin(dot(p, d) * f + uTime * a);
      }
      void main(){
        vec3 p = position;
        vec2 wp = p.xz;
        float w = 0.0;
        w += wave(wp, normalize(vec2(1.0, 0.35)), 0.13, 0.85) * 0.16;
        w += wave(wp, normalize(vec2(-0.4, 1.0)), 0.21, 0.62) * 0.10;
        w += wave(wp, normalize(vec2(0.7, -0.8)), 0.47, 1.35) * 0.045;
        w += wave(wp, normalize(vec2(0.2, 1.0)), 1.9, 2.1) * 0.012;
        p.y += w;
        vWave = w;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vWorld;
      varying float vWave;
      uniform float uTime, uLevel, uMemories, uBloodAmt, uFogNear, uFogFar, uFogMask;
      uniform vec3 uDeep, uShallow, uGlow, uBlood, uSunDir, uFogColor, uCamPos;
      uniform vec4 uRipples[${MAX_RIPPLES}];

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){
        float s = 0.0, a = 0.5;
        for(int i=0;i<5;i++){ s += a * noise(p); p *= 2.03; a *= 0.5; }
        return s;
      }

      void main(){
        vec2 p = vWorld.xz;
        float dist = length(vWorld - uCamPos);
        // three scrolling wave layers make the surface normal
        vec2 q1 = p * 0.35 + vec2(uTime * 0.020, uTime * 0.013);
        vec2 q2 = p * 0.11 - vec2(uTime * 0.008, uTime * 0.011);
        float n1 = fbm(q1), n2 = fbm(q2);
        vec3 nrm = normalize(vec3(
          (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.30,
          1.0,
          (n2 - 0.5) * 0.55 + (n1 - 0.5) * 0.26
        ));

        vec3 view = normalize(uCamPos - vWorld);
        float fres = pow(1.0 - clamp(dot(view, nrm), 0.0, 1.0), 2.6);

        // colour: deep in the middle of the basin, greener where the city rises
        vec3 col = mix(uDeep, uShallow, clamp(0.35 + (1.0 - vWorld.y * 0.4) * 0.2, 0.0, 1.0));
        col += uGlow * (0.06 + uMemories * 0.02);

        // bioluminescent algae stirred by movement
        float algae = smoothstep(0.34, 0.92, fbm(p * 0.16 + vec2(uTime * 0.03, -uTime * 0.02)));
        col += uGlow * algae * (0.16 + 0.06 * uMemories);

        // sun / moon reflection
        vec3 r = reflect(-view, nrm);
        float sunSpec = pow(max(dot(r, normalize(uSunDir)), 0.0), 220.0);
        float sunBroad = pow(max(dot(r, normalize(uSunDir)), 0.0), 14.0) * 0.25;
        col += vec3(1.0, 0.92, 0.78) * (sunSpec * 1.4 + sunBroad);

        // ripple ring buffer: footsteps, wakes, shard pulses
        float rip = 0.0;
        for(int i = 0; i < ${MAX_RIPPLES}; i++){
          vec4 R = uRipples[i];
          float age = R.z;
          if(age > 6.0) continue;
          float d = length(p - R.xy);
          float front = smoothstep(0.0, 1.0, 1.0 - abs(d - age * 2.4) * 0.55);
          rip += front * exp(-age * 0.9) * R.w;
        }
        col += uGlow * rip * 0.75;

        // the player's own wake
        float wake = exp(-length(p - uCamPos.xz) * 0.22) * 0.10;
        col += uGlow * wake * smoothstep(0.05, 0.5, uCamPos.y - uLevel + 0.15);

        // forgotten dark things bleed into the water
        col = mix(col, uBlood, uBloodAmt * smoothstep(0.3, 0.9, fbm(p * 0.05 + uTime * 0.01)) * 0.55);

        // fresnel picks up the sky (which is dark, but the eclipse glows)
        col += uGlow * fres * 0.10 * (1.0 + uMemories * 0.25);
        col = mix(col, uFogColor * 0.8, fres * 0.35);

        float fog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
        fog = pow(fog, 0.8) * uFogMask;
        col = mix(col, uFogColor, fog);

        gl_FragColor = vec4(col, 0.95);
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = level;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  scene.add(mesh);

  let rr = 0;
  const ripples = uniforms.uRipples.value;

  return {
    mesh, uniforms, material: mat,
    get level() { return mesh.position.y; },
    setLevel(y) { uniforms.uLevel.value = y; },
    ripple(x, z, strength = 1) {
      ripples[rr % MAX_RIPPLES].set(x, z, 0, strength);
      rr++;
    },
    setStain(amount) { uniforms.uBloodAmt.value = amount; },
    setMemories(n) { uniforms.uMemories.value = n; },
    update(dt, cameraPos) {
      uniforms.uTime.value += dt;
      uniforms.uCamPos.value.copy(cameraPos);
      for (const R of ripples) if (R.z < 99) R.z += dt;
      // keep the plane under the camera so the horizon never runs out
      mesh.position.x = cameraPos.x;
      mesh.position.z = cameraPos.z;
      mesh.position.y += (uniforms.uLevel.value - mesh.position.y) * Math.min(1, dt * 0.9);
    },
  };
}
