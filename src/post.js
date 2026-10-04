// Watercolour over realism: an edge-preserving (Kuwahara) simplify, cold paper
// grain, wet-ink outlines, bloom on everything that glows, and a grade that keeps
// the shadows blue and the lit windows warm.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { paperTexture } from './textures.js';

export function createPost(renderer, scene, camera, { pixelRatio = 1 } = {}) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const rt = new THREE.WebGLRenderTarget(
    Math.floor(size.x * pixelRatio), Math.floor(size.y * pixelRatio),
    { type: THREE.HalfFloatType, samples: 4, colorSpace: THREE.LinearSRGBColorSpace }
  );
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.62, 0.7, 0.68);
  composer.addPass(bloom);

  const WatercolourShader = {
    uniforms: {
      tDiffuse: { value: null },
      uPaper: { value: paperTexture(3, 512) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uRadius: { value: 1.35 },
      uEdge: { value: 0.85 },
      uGrain: { value: 0.55 },
      uSaturate: { value: 1.06 },
      uUnderwater: { value: 0 },
      uTotality: { value: 0.3 },
      uDanger: { value: 0 },
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color('#ffffff') },
      uFade: { value: 0 },
      uFadeColor: { value: new THREE.Color('#04070a') },
      uMemory: { value: 0 },
      uMemoryColor: { value: new THREE.Color('#8ffbe0') },
      uVignette: { value: 0.22 },
      uWetness: { value: 0.7 },
      uBright: { value: 0.55 },      // 0 = as gloomy as it gets, 1 = full daylight-ish lift
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse, uPaper;
      uniform vec2 uResolution;
      uniform float uTime, uRadius, uEdge, uGrain, uSaturate, uUnderwater, uTotality,
                    uDanger, uFlash, uFade, uMemory, uVignette, uWetness, uPixelRatio, uBright;
      uniform vec3 uFlashColor, uFadeColor, uMemoryColor;

      vec3 toS(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
      vec3 toL(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(2.2)); }
      float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

      vec3 quad(vec2 uv, vec2 base, float r){
        vec2 t = (1.0 / uResolution) * r * uPixelRatio;
        vec3 a = texture2D(tDiffuse, uv + vec2(-t.x, -t.y)).rgb;
        vec3 b = texture2D(tDiffuse, uv + vec2( t.x, -t.y)).rgb;
        vec3 c = texture2D(tDiffuse, uv + vec2(-t.x,  t.y)).rgb;
        vec3 d = texture2D(tDiffuse, uv + vec2( t.x,  t.y)).rgb;
        vec3 e = texture2D(tDiffuse, uv).rgb;
        vec3 m = (a + b + c + d + e) * 0.2;
        float lo = min(min(min(a.r, b.r), min(c.r, d.r)), e.r);
        float hi = max(max(max(a.r, b.r), max(c.r, d.r)), e.r);
        base = vec2(lo, hi);
        return m;
      }

      void main(){
        vec2 uv = vUv;
        // underwater: the whole image leans and breathes
        if (uUnderwater > 0.001) {
          uv += vec2(sin(uv.y * 22.0 + uTime * 1.6), cos(uv.x * 18.0 - uTime * 1.3)) * 0.0038 * uUnderwater;
          uv += vec2(sin(uTime * 0.7), cos(uTime * 0.53)) * 0.0022 * uUnderwater;
        }

        vec3 centre = toS(texture2D(tDiffuse, uv).rgb);

        // ── Kuwahara-ish simplify: pick the flattest quadrant at two scales ──
        vec3 sum = centre;
        float wsum = 1.0;
        for (int k = 0; k < 2; k++) {
          float r = uRadius * (1.0 + float(k) * 1.9);
          vec2 t = (1.0 / uResolution) * r * uPixelRatio;
          vec3 q[4];
          float v[4];
          for (int i = 0; i < 4; i++) {
            vec2 dir = vec2(i == 0 || i == 3 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0);
            vec3 a = toS(texture2D(tDiffuse, uv + dir * t).rgb);
            vec3 b = toS(texture2D(tDiffuse, uv + dir * t * 0.55).rgb);
            vec3 c = toS(texture2D(tDiffuse, uv + vec2(dir.x * t.x, 0.0)).rgb);
            vec3 d = toS(texture2D(tDiffuse, uv + vec2(0.0, dir.y * t.y)).rgb);
            vec3 m = (a + b + c + d) * 0.25;
            float mean = (luma(a) + luma(b) + luma(c) + luma(d)) * 0.25;
            float var = (pow(luma(a) - mean, 2.0) + pow(luma(b) - mean, 2.0)
                       + pow(luma(c) - mean, 2.0) + pow(luma(d) - mean, 2.0)) * 0.25;
            q[i] = m; v[i] = var + 0.0008;
          }
          float mn = min(min(v[0], v[1]), min(v[2], v[3]));
          float mg = 1.0 / float(k + 1);
          for (int i = 0; i < 4; i++) {
            float w = mg * exp(-(v[i] - mn) * 42.0);
            sum += q[i] * w; wsum += w;
          }
        }
        vec3 col = sum / wsum;
        col = mix(centre, col, 0.82);

        // ── wet-ink outline from a 3x3 luma gradient ──
        vec2 e = (1.0 / uResolution) * uPixelRatio;
        float l00 = luma(toS(texture2D(tDiffuse, uv + vec2(-e.x, -e.y)).rgb));
        float l10 = luma(toS(texture2D(tDiffuse, uv + vec2( 0.0, -e.y)).rgb));
        float l20 = luma(toS(texture2D(tDiffuse, uv + vec2( e.x, -e.y)).rgb));
        float l01 = luma(toS(texture2D(tDiffuse, uv + vec2(-e.x,  0.0)).rgb));
        float l21 = luma(toS(texture2D(tDiffuse, uv + vec2( e.x,  0.0)).rgb));
        float l02 = luma(toS(texture2D(tDiffuse, uv + vec2(-e.x,  e.y)).rgb));
        float l12 = luma(toS(texture2D(tDiffuse, uv + vec2( 0.0,  e.y)).rgb));
        float l22 = luma(toS(texture2D(tDiffuse, uv + vec2( e.x,  e.y)).rgb));
        float gx = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
        float gy = (l02 + 2.0 * l12 + l22) - (l00 + 2.0 * l10 + l20);
        float edge = clamp(length(vec2(gx, gy)) * 2.1, 0.0, 1.0);
        col = mix(col, col * vec3(0.42, 0.5, 0.55), pow(edge, 1.25) * uEdge * 0.75);
        col += vec3(0.02, 0.05, 0.055) * edge * uWetness * 0.35;

        // ── grade: cold shadows, warm lights, a little paper ──
        float l = luma(col);
        col = mix(vec3(l), col, uSaturate);
        // bright mode lifts the darks instead of just blowing out the lights
        float lift = uBright * 0.5;
        col = mix(col, vec3(0.05, 0.10, 0.13) + col * 0.95, (1.0 - smoothstep(0.05, 0.55, l)) * 0.18);
        col += lift * 0.05 * (1.0 - smoothstep(0.0, 0.7, l));
        col += vec3(0.05, 0.032, 0.0) * smoothstep(0.6, 1.0, l);
        col = mix(col, pow(col, vec3(1.12)), 0.25);

        vec2 puv = uv * (uResolution / (512.0 * uPixelRatio)) + vec2(uTime * 0.0035, -uTime * 0.0021);
        float paper = texture2D(uPaper, puv).r;
        float paper2 = texture2D(uPaper, puv * 0.37 + 0.31).r;
        float grain = uGrain * (1.0 - lift * 0.6);
        col *= mix(1.0, 0.94 + paper * 0.22, grain);
        col += (paper2 - 0.5) * 0.03 * grain;
        col *= 1.0 - (1.0 - paper) * 0.05 * grain;

        // the eclipse itself cools everything and steals some colour — but never
        // so much that the player cannot see where they are going
        float dark = uTotality * (1.0 - uBright * 0.55);
        col = mix(col, vec3(luma(col)) * vec3(0.80, 0.90, 1.05), dark * 0.32);
        col *= mix(1.0, 0.94, dark * 0.6);

        // restored memories bloom warm at the edges of the frame
        col += uMemoryColor * uMemory * 0.08;

        // danger: red creeps in from the corners
        float dgrad = length((uv - 0.5) * vec2(1.5, 1.0));
        col = mix(col, vec3(0.28, 0.02, 0.06), uDanger * pow(clamp(dgrad * 1.25, 0.0, 1.0), 2.0) * 0.8);
        col = mix(col, vec3(0.5, 0.06, 0.12), uDanger * 0.12);

        // underwater tint + wobbling light
        col = mix(col, col * vec3(0.55, 0.85, 0.9) + vec3(0.01, 0.05, 0.07), uUnderwater * 0.8);

        // vignette, softened by the brightness control
        float v = 1.0 - uVignette * (1.0 - uBright * 0.65) * pow(clamp(dgrad * 1.42, 0.0, 1.0), 2.3);
        col *= v;

        col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
        col = mix(col, uFadeColor, clamp(uFade, 0.0, 1.0));

        gl_FragColor = vec4(toL(col), 1.0);
      }`,
  };

  const painter = new ShaderPass(WatercolourShader);
  painter.renderToScreen = false;
  composer.addPass(painter);

  const output = new OutputPass();
  composer.addPass(output);

  const u = painter.uniforms;
  function resize(w, h) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
    u.uResolution.value.set(w * pixelRatio, h * pixelRatio);
  }
  resize(size.x, size.y);

  return {
    composer, bloom, painter, uniforms: u,
    render(dt, state = {}) {
      u.uTime.value += dt;
      if (state.underwater !== undefined) u.uUnderwater.value += (state.underwater - u.uUnderwater.value) * Math.min(1, dt * 3.5);
      if (state.totality !== undefined) u.uTotality.value = state.totality;
      if (state.danger !== undefined) u.uDanger.value += (state.danger - u.uDanger.value) * Math.min(1, dt * 2);
      if (state.flash !== undefined) u.uFlash.value = state.flash;
      if (state.flashColor) u.uFlashColor.value.copy(state.flashColor);
      if (state.fade !== undefined) u.uFade.value = state.fade;
      if (state.fadeColor) u.uFadeColor.value.copy(state.fadeColor);
      if (state.memory !== undefined) u.uMemory.value = state.memory;
      if (state.memoryColor) u.uMemoryColor.value.copy(state.memoryColor);
      if (state.exposure !== undefined) renderer.toneMappingExposure = state.exposure;
      if (state.bloomStrength !== undefined) bloom.strength = state.bloomStrength;
      composer.render(dt);
    },
    setRadius(r) { u.uRadius.value = r; },
    /** 0 … 1; also scales tone-mapping exposure through the caller */
    setBrightness(k) {
      u.uBright.value = Math.max(0, Math.min(1, k));
      u.uVignette.value = 0.18 + (1 - k) * 0.2;
    },
  };
}
