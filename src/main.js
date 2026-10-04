// ─────────────────────────────────────────────────────────────────────────────
//  Umbral Tide — main loop, the eclipse clock, the six memories, the ending.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createCity } from './city.js';
import { createSpecters } from './specters.js';
import { createShadows } from './shadows.js';
import { createPlayer } from './player.js';
import { createPost } from './post.js';
import { createUI } from './ui.js';
import { Soundscape } from './audio.js';
import { createTutorial } from './tutorial.js';
import { MEMORIES, CITY as CFG, PREVIEW, PROLOGUE, HINTS, FINALE } from './content.js';

const STATE = {
  LOADING: 'loading', START: 'start', PROLOGUE: 'prologue', QUICKSTART: 'quickstart',
  PLAY: 'play', PAUSED: 'paused', JOURNAL: 'journal', HELP: 'help', REVERIE: 'reverie',
  FINALE: 'finale', EPILOGUE: 'epilogue',
};

/* ────────────────────────────── renderer / scene ────────────────────────────── */

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.65);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1d4450, 0.0058);

const camera = new THREE.PerspectiveCamera(71, window.innerWidth / window.innerHeight, 0.06, 920);
camera.position.set(0, 2, 13);
scene.add(camera);                  // so the lantern (a child of the camera) is lit

/* ────────────────────────────── world ────────────────────────────── */

const audio = new Soundscape();
const sky = createSky(scene, { seed: 4 });
const water = createWater(scene, { level: CFG.waterLevel });
const city = createCity(scene, { seed: 20240410 });
const specters = createSpecters(scene, {
  city, memories: MEMORIES,
  onRestore: (shard) => restoreMemory(shard),
});
const shadows = createShadows(scene, {
  city,
  onDrain: (amount, s) => {
    lucidity = Math.max(0, lucidity - amount / 100);
    player.addShake(1.2);
    flash = 0.55; flashColor.set('#ffdfe6');
    audio.heartbeat(1);
    ui.toast('Something takes a little of your light.', 3600);
    water.ripple(s.group.position.x, s.group.position.z, 1);
  },
  onTrail: (x, z, s) => water.ripple(x, z, s),
});
const player = createPlayer(camera, canvas, {
  city, audio,
  onFootstep: (pos, inWater, speed, strength) => {
    if (inWater || strength) water.ripple(pos.x, pos.z, strength ?? (inWater ? 0.55 : 0.3));
  },
  onSwim: () => water.ripple(player.position.x, player.position.z, 0.9),
});
player.state.pos.set(0, city.PLAZA_Y + 1.68, 13);
player.state.yaw = 0;                 // facing the drowned plaza and the orrery
for (const c of city.colliders) player.addCollider(c.x, c.z, c.w, c.d, c.rot, c.baseY, c.topY);
city.effects.fx.userData.onGateRush = (x, z) => water.ripple(x, z, 0.9);

const post = createPost(renderer, scene, camera, { pixelRatio: DPR });
post.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

/* ────────────────────────────── lights ────────────────────────────── */

const hemi = new THREE.HemisphereLight(0x93b6cc, 0x16303a, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3c0, 1.15);
sun.position.copy(city.sunDir).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.bias = -0.0012;
scene.add(sun);
scene.add(sun.target);   // the shadow box travels with the player
const moonFill = new THREE.DirectionalLight(0x8fbede, 0.45);
moonFill.position.set(60, 90, -40);
scene.add(moonFill);
const ambient = new THREE.AmbientLight(0x2e4450, 0.95);
scene.add(ambient);

/* ────────────────────────────── game state ────────────────────────────── */

let state = STATE.LOADING;
let clock = new THREE.Clock();
let elapsed = 0;
let tide = CFG.waterLevel;
let lucidity = 1;
let flash = 0;
let flashColor = new THREE.Color('#ffffff');
let fade = 0;
let fadeColor = new THREE.Color('#04070a');
let coverage = 0.42;
let totality = 0.42;
let danger = 0;
let memoryGlow = 0;
let memoryGlowColor = new THREE.Color('#8ffbe0');
const restored = new Set();
let prologueIndex = 0;
let channel = null;          // { shard, t, lineIndex }
let reverieTimer = 0;
let finaleTimer = 0;
let boundaryLine = 0;
let boundaryCooldown = 0;
let averageFrame = 0;

/* ── how bright the world is drawn. Stored, and adjustable in the pause menu ── */
const BRIGHTNESS_DEFAULT = 1.15;         // 1.0 = the original, quite gloomy grade
let brightness = BRIGHTNESS_DEFAULT;
try {
  const saved = parseFloat(localStorage.getItem('vaelune.brightness'));
  if (isFinite(saved) && saved >= 0.7 && saved <= 2.0) brightness = saved;
} catch (_e) { /* private mode, no matter */ }

function applyBrightness(k, remember = true) {
  brightness = Math.max(0.7, Math.min(2.0, k));
  // 0.7 → 0, 1.6 → 1: the shader lift tracks the exposure
  post.setBrightness((brightness - 0.75) / 0.85);
  if (remember) { try { localStorage.setItem('vaelune.brightness', String(brightness)); } catch (_e) { /* ignore */ } }
}
const camFwd = new THREE.Vector3();

const ui = createUI({
  onBegin: () => beginPrologue(),
  onQuickStartDone: () => dismissQuickStart(),
  onPrologueNext: () => advancePrologue(),
  onPrologueSkip: () => startPlaying(true),
  onResume: () => resume(),
  onRemain: () => {
    // stay in the memory: the city drowns around you and you keep walking it
    ui.hideFinale();
    state = STATE.EPILOGUE;
    player.freeze(false);
    lockPointer();
    ui.toast(FINALE.card, 10000);
    setTimeout(() => ui.say('the Archivist', FINALE.epilogue, { instant: false }), 1800);
  },
});

specters.group.visible = true;

/* ────────────────────────────── eclipse clock ────────────────────────────── */

function updateEclipse(dt) {
  // The shadow deepens with every fragment the city gets back; time pushes it too.
  const byMemory = restored.size / MEMORIES.length;
  const wanted = state === STATE.EPILOGUE ? 0.22
    : state === STATE.FINALE || state === STATE.EPILOGUE ? 1
      : Math.min(1, 0.42 + byMemory * 0.5 + Math.min(1, elapsed / 900) * 0.14);
  coverage += (wanted - coverage) * Math.min(1, dt * (state === STATE.EPILOGUE ? 0.06 : 0.16));
  totality = THREE.MathUtils.smoothstep(coverage, 0.25, 0.92);
  sky.setEclipse(coverage, totality);
  audio.setTotality(totality);
  // totality still dims the world, but never below what the player needs to walk it
  hemi.intensity = 1.05 - totality * 0.34;
  sun.intensity = 1.15 * (1 - totality * 0.7);
  ambient.intensity = 0.95 - totality * 0.22;
  renderer.toneMappingExposure = (1.25 + totality * 0.16) * brightness;
}

/* ────────────────────────────── memory flow ────────────────────────────── */

function beginChannel(shard) {
  channel = { shard, t: 0, lineIndex: -1 };
  ui.hideGoal();
  ui.clearHint();
  specters.setListening(shard, true);
  audio.memorySting(shard.memory.kind);
  audio.whisper(shard.memory.speaker);
}

function stepChannel(dt) {
  if (!channel) return;
  const { shard } = channel;
  const dur = 3.3;
  channel.t += dt;
  const p = Math.min(1, channel.t / dur);
  const lines = shard.memory.lines;
  const idx = Math.min(lines.length - 1, Math.floor(p * lines.length));
  if (idx !== channel.lineIndex) {
    channel.lineIndex = idx;
    ui.say(shard.memory.speaker, lines[idx]);
    audio.chime(420 + idx * 110, 0.05);
  }
  ui.setPrompt(true, 'listening…', p);
  if (p >= 1) {
    const s = channel.shard;
    channel = null;
    ui.setPrompt(false);
    specters.restore(s);
  }
}

function cancelChannel() {
  if (!channel) return;
  specters.setListening(channel.shard, false);
  channel = null;
  ui.setPrompt(false);
  ui.quiet();
}

function restoreMemory(shard) {
  const mem = shard.memory;
  restored.add(mem.id);
  city.setMemoryRestored(mem.id, true);
  water.setMemories(restored.size);
  tide = CFG.waterLevel + restored.size * CFG.tidePerMemory + (restored.has('sealing') ? 0.35 : 0);
  water.setLevel(tide);
  audio.setTide(tide);
  player.setOil(100);
  lucidity = Math.min(1, lucidity + 0.25);

  city.effects.place(shard.position.x, shard.position.y, shard.position.z, mem.accent, 180);
  water.ripple(shard.position.x, shard.position.z, 1.4);
  for (let i = 0; i < 5; i++) {
    setTimeout(() => water.ripple(shard.position.x + (Math.random() - 0.5) * 26, shard.position.z + (Math.random() - 0.5) * 26, 0.7), i * 260);
  }
  audio.chime(mem.kind === 'dark' ? 150 : 660, 0.1);
  memoryGlow = 1;
  memoryGlowColor.set(mem.accent);

  enterReverie(mem);

  if (mem.kind === 'dark' || mem.id === 'sealing') {
    // dark memories leave something behind
    const p = mem.id === 'bargain'
      ? city.effects.shadowSpawn.clone()
      : city.landmarks.gates.clone().add(new THREE.Vector3(Math.random() * 20 - 10, 2, -6));
    shadows.spawnAt(p, mem.id);
    if (mem.id === 'sealing') {
      shadows.spawnAt(city.landmarks.gates.clone().add(new THREE.Vector3(-14, 2, 4)), 'sealing');
      audio.gateGroan();
    }
    danger = 0.55;
    water.setStain(Math.min(0.5, restored.size * 0.09));
    ui.toast(mem.toast, 7000);
  } else {
    ui.toast(mem.toast, 6500);
  }

  ui.renderJournal(MEMORIES, restored, restored.size / MEMORIES.length);
  checkFinale();
}

function enterReverie(mem) {
  state = STATE.REVERIE;
  reverieTimer = 4.4;
  player.freeze(true);
  camera.rotation.z = 0;
  flash = 0.85;
  ui.setPrompt(false);
  ui.say('', mem.journal, { instant: false });
  memoryGlow = 1;
}

function checkFinale() {
  if (restored.size < MEMORIES.length) return;
  finaleTimer = 0.1;
}

/* ────────────────────────────── the opening lesson ────────────────────────────── */

const tutorial = createTutorial({
  setGoal: (text, kicker) => ui.setGoal(text, kicker),
  hint: (key, text, ms) => ui.hint(key, text, ms),
  say: (who, line) => ui.say(who, line),
});

function updateTutorial(dt) {
  if (state !== STATE.PLAY) return;
  const tgt = nextTarget();
  tutorial.update(dt, {
    player: player.state,
    nearest: tgt ? { mem: tgt.mem, dist: tgt.dist, at: tgt.at } : null,
    restoredSize: restored.size,
    shadows: shadows.count,
  });
}

/* ────────────────────────────── objective ────────────────────────────── */

function nextTarget() {
  const remaining = MEMORIES.filter((m) => !restored.has(m.id));
  if (!remaining.length) return null;
  // the Archivist's own fragment is the last thing to point at, and only when it is all that is left
  const others = remaining.filter((m) => m.id !== 'self');
  const pool = others.length ? others : remaining;
  const from = player.position;
  let best = null, bestD = Infinity;
  for (const m of pool) {
    const anchor = city.shardAnchors[m.id];
    if (!anchor) continue;
    const d = Math.hypot(anchor.x - from.x, anchor.z - from.z);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best ? { mem: best, dist: bestD, at: city.shardAnchors[best.id] } : null;
}

applyBrightness(brightness, false);      // set the saved/default grade before the first frame
ui.onBrightness((v) => applyBrightness(v));
ui.setBrightnessValue(brightness);

function dismissQuickStart() {
  ui.hideQuickStart();
  if (state !== STATE.QUICKSTART) return;
  state = STATE.PLAY;
  player.freeze(false);
  lockPointer();
  // the field guide is also the "what next" panel, so point at the first job
  tutorial.start();
  setTimeout(() => { if (state === STATE.PLAY) ui.hint('W A S D', HINTS.move, 9000); }, 2600);
}

/* ────────────────────────────── main loop ────────────────────────────── */

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  averageFrame += (dt - averageFrame) * 0.02;

  const playing = state === STATE.PLAY || state === STATE.REVERIE || state === STATE.EPILOGUE || state === STATE.FINALE;

  // ── eclipse + world ──
  updateEclipse(dt);
  water.update(dt, camera.position);
  water.setLevel(tide);
  sky.update(dt, camera);
  city.update(dt, elapsed, player.position);
  shadows.update(dt, elapsed, player.position, {
    lanternOn: player.state.lanternOn, lanternPos: camera.position, sanity: lucidity,
  });
  danger += ((shadows.threat * 0.8 + (1 - lucidity) * 0.6) - danger) * Math.min(1, dt * 0.8);
  audio.setDanger(danger);

  // keep the shadow-casting sun and its box centred on the player
  sun.target.position.copy(player.position);
  sun.target.updateMatrixWorld();
  sun.position.copy(player.position).addScaledVector(city.sunDir, 110);

  // ── player ──
  if (playing) {
    player.update(dt, {
      waterLevel: tide,
      time: elapsed,
      danger,
      onBoundary: () => {
        if (boundaryCooldown <= 0) {
          boundaryCooldown = 16;
          const lines = ['The fog does not let go that way.', 'There is nothing out there but more of the same water.', 'Vaelune is behind you. It always is.'];
          ui.say('', lines[boundaryLine++ % lines.length], { instant: true });
          audio.whisper('stay');
        }
      },
    });
  }
  boundaryCooldown -= dt;

  // audio listener follows the camera
  camera.getWorldDirection(camFwd);
  audio.setListener(camera.position, camFwd, camera.up);
  audio.setUnderwater(player.state.submerged && state !== STATE.REVERIE ? 1 : 0);

  // ── interaction ──
  let aimed = null;
  if (state === STATE.PLAY) {
    const hit = specters.nearest(player.position, { maxDist: 7.0, requireUnrestored: true });
    if (hit) {
      tmpTo.copy(hit.shard.position).sub(camera.position).normalize();
      if (tmpTo.dot(camFwd) > 0.35) { aimed = hit.shard; }
    }
    const winchDist = camera.position.distanceTo(city.landmarks.winch);
    const gateReady = restored.has('sealing');
    if (!aimed && winchDist < 5.5 && to2(camera, city.landmarks.winch) > 0.3) {
      aimed = { winch: true, ready: gateReady };
    }

    if (aimed && aimed.winch) {
      ui.setAim(true);
      ui.setPrompt(true, aimed.ready ? 'the gates are open — the water is coming in' : 'hold E — the winch is seized without the warden', 0);
      if (!aimed.ready && keys.has('KeyE')) {
        if (boundaryCooldown <= 0) {
          boundaryCooldown = 10;
          ui.say('', 'The wheel turns and turns and nothing gives. Someone has to remember how this works.', { instant: false });
        }
      }
    } else if (aimed) {
      const s = aimed;
      ui.setAim(true);
      const blocked = s.memory.id === 'self' && restored.size < MEMORIES.length - 1;
      if (blocked) {
        ui.setPrompt(true, 'not yet — the city is not finished remembering', 0);
      } else {
        ui.setPrompt(true, 'hold E — listen', channel && channel.shard === s ? Math.min(1, channel.t / 3.3) : 0);
        if (keys.has('KeyE')) { if (!channel) beginChannel(s); }
        else if (channel && channel.shard === s) cancelChannel();
      }
    } else {
      ui.setAim(false);
      ui.setPrompt(false);
      if (channel) cancelChannel();
    }
  } else {
    ui.setPrompt(false);
  }

  if (channel && state === STATE.PLAY) stepChannel(dt);

  // ── specters ──
  specters.update(dt, elapsed, camera.position, camera.position);

  // ── the opening lesson ──
  updateTutorial(dt);

  // ── objective + HUD ──
  const tgt = nextTarget();
  if (tgt && state !== STATE.FINALE && state !== STATE.EPILOGUE) {
    const bearing = Math.atan2(tgt.at.x - player.position.x, tgt.at.z - player.position.z);
    ui.setObjective(`fragment ${tgt.mem.order} · ${tgt.mem.district}`, tgt.dist, bearing, player.state.yaw);
    ui.setGuideObjective(
      channel ? 'listening\u2026 keep holding E'
        : tgt.dist < 9 ? 'stand in the light and hold E'
          : `head for ${tgt.mem.district} \u2014 ${Math.round(tgt.dist)} m, follow the compass`
    );
  } else if (restored.size >= MEMORIES.length) {
    ui.setObjective(null);
    ui.setGuideObjective('the city is whole \u2014 go to the orrery in the drowned plaza');
  } else {
    ui.setObjective(null);
    ui.setGuideObjective('follow the compass to the next fragment');
  }
  ui.setStats({
    lucidity,
    oil: player.oil / 100,
    eclipse: 1 - totality,
  });
  ui.setAim(!!aimed && !aimed.winch);

  // ── the epilogue: the water keeps coming, slowly, and there is nothing to do about it ──
  if (state === STATE.EPILOGUE) {
    tide += dt * 0.05;
    water.setLevel(tide);
    audio.setTide(tide);
  }

  // ── lucidity ──
  const nearRestored = specters.shards.some((s) => s.restored && s.position.distanceTo(player.position) < 26);
  const calm = state === STATE.REVERIE || state === STATE.FINALE || state === STATE.EPILOGUE;
  lucidity += ((nearRestored || calm ? 0.028 : 0.012) - danger * 0.05) * dt;
  lucidity = Math.max(0, Math.min(1, lucidity));
  if (lucidity <= 0.001 && state === STATE.PLAY) {
    // carried back to the plaza, lighter than before
    player.state.pos.set(0, city.PLAZA_Y + 1.68, 13);
    player.state.vel.set(0, 0, 0);
    lucidity = 0.42;
    flash = 1;
    flashColor.set('#0a1420');
    shadows.clear();
    ui.say('', 'You come back to yourself on the plaza stones, the way you always do.', { instant: false });
  }

  // ── states ──
  if (state === STATE.REVERIE) {
    reverieTimer -= dt;
    if (reverieTimer <= 0) {
      state = STATE.PLAY;
      player.freeze(false);
      ui.quiet();
    }
  }
  if (finaleTimer > 0 && state === STATE.PLAY) {
    finaleTimer += dt;
    if (finaleTimer > 1.6) {
      finaleTimer = 0;
      state = STATE.FINALE;
      player.freeze(true);
      shadows.clear();
      ui.showFinale(FINALE.title, FINALE.lines);
      audio.memorySting('self');
      audio.droneSwell(1);
      tide = CFG.waterLevel + 1.15;
      fadeColor.set('#04070a');
      setTimeout(() => {
        ui.setEpilogue(FINALE.card + '\n\n' + FINALE.epilogue, true);
      }, 9000);
    }
  }

  // ── post ──
  flash = Math.max(0, flash - dt * 1.9);
  memoryGlow = Math.max(0, memoryGlow - dt * 0.22);
  const underwater = player.state.submerged && state !== STATE.REVERIE && state !== STATE.FINALE ? 1 : 0;
  post.render(dt, {
    underwater,
    totality,
    danger: Math.min(1, danger),
    flash,
    flashColor,
    fade,
    fadeColor,
    memory: memoryGlow * (restored.size > 0 ? 1 : 0),
    memoryColor: memoryGlowColor,
    bloomStrength: (0.62 + restored.size * 0.06) * (1 - (brightness - 1.15) * 0.12),
  });

  // adaptive quality: the painter is the expensive part
  if (averageFrame > 0.028 && renderer.getPixelRatio() > 0.85) {
    renderer.setPixelRatio(Math.max(0.85, renderer.getPixelRatio() - 0.15));
    post.setRadius(1.0);
  }
}

const tmpV = new THREE.Vector3();
const tmpF = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
function to2(cam, target) {
  tmpV.copy(target).sub(cam.position).normalize();
  cam.getWorldDirection(tmpF);
  return tmpV.dot(tmpF);
}

/* ────────────────────────────── lifecycle ────────────────────────────── */

const keys = new Set();
window.addEventListener('keydown', (e) => {
  // the prologue advances on space, like a page — and must not queue up a jump
  if (state === STATE.PROLOGUE) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
      e.preventDefault();
      advancePrologue();
    }
    return;
  }

  keys.add(e.code);

  // the quick-start card closes on any of the obvious keys
  if (state === STATE.QUICKSTART) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyH') {
      e.preventDefault();
      dismissQuickStart();
    }
    return;
  }

  // the field guide panel, toggled with G
  if (e.code === 'KeyG' && state === STATE.PLAY) {
    ui.toggleGuide();
    return;
  }

  // how to play, any time
  if (e.code === 'KeyH' && (state === STATE.PLAY || state === STATE.HELP)) {
    const open = ui.toggleHelp();
    if (open) {
      state = STATE.HELP;
      player.freeze(true);
      document.exitPointerLock?.();
    } else {
      state = STATE.PLAY;
      player.freeze(false);
      lockPointer();
    }
    return;
  }
  if (state === STATE.HELP && e.code === 'Escape') {
    ui.toggleHelp(false);
    state = STATE.PAUSED;
    ui.showPause(`${restored.size} of ${MEMORIES.length} fragments restored`);
    return;
  }

  if (e.code === 'Tab') {
    e.preventDefault();
    if (state === STATE.PLAY || state === STATE.JOURNAL) {
      const open = ui.toggleJournal();
      if (open) { state = STATE.JOURNAL; player.freeze(true); document.exitPointerLock?.(); }
      else { state = STATE.PLAY; player.freeze(false); lockPointer(); }
    }
  }
  if (e.code === 'Escape' && (state === STATE.PLAY || state === STATE.JOURNAL)) pause();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function beginPrologue() {
  ui.hideStart();
  ui.loadingDone();
  prologueIndex = 0;
  state = STATE.PROLOGUE;
  player.freeze(true);
  player.setEnabled(true);
  ui.showPrologue(PROLOGUE, prologueIndex);
  audio.start().then(() => {
    specters.attachAudio();
    audio.setTide(tide);
  });
}

function advancePrologue() {
  if (state !== STATE.PROLOGUE) return;
  prologueIndex++;
  if (prologueIndex >= PROLOGUE.length) { startPlaying(false); return; }
  ui.showPrologue(PROLOGUE, prologueIndex);
  audio.chime(300 + prologueIndex * 90, 0.05);
}

let seenGuide = false;
try { seenGuide = localStorage.getItem('vaelune.seenGuide') === 'yes'; } catch (_e) { /* ignore */ }

async function startPlaying(skipped) {
  ui.hidePrologue();
  ui.loadingDone();
  state = STATE.PLAY;
  player.setEnabled(true);
  player.freeze(false);
  lockPointer();

  // the field guide is on unless the player turned it off
  let guideOn = true;
  try { guideOn = localStorage.getItem('vaelune.guidePanel') !== 'off'; } catch (_e) { /* ignore */ }
  ui.showGuide(guideOn);

  // first time through, hold their hand properly before letting go
  if (!seenGuide) {
    seenGuide = true;
    try { localStorage.setItem('vaelune.seenGuide', 'yes'); } catch (_e) { /* ignore */ }
    state = STATE.QUICKSTART;
    player.freeze(true);
    document.exitPointerLock?.();
    ui.showQuickStart();
    return;
  }
  if (skipped) ui.say('the Archivist', 'Six fragments. Find the light, stand close, hold E.', { instant: false });
  else audio.memorySting('still');
  audio.chime(520, 0.06);

  // the two opening goals, stated plainly, then the first control hint
  tutorial.start();
  setTimeout(() => {
    if (state === STATE.PLAY && tutorial.state.step === 0) ui.hint('W A S D', HINTS.move, 9000);
  }, 3000);
}

let pointerWarned = false;
function lockPointer() {
  try {
    const p = canvas.requestPointerLock?.({ unadjustedMovement: false });
    if (p && typeof p.catch === 'function') p.catch(pointerLockFailed);
  } catch (_e) { pointerLockFailed(); }
}
function pointerLockFailed() {
  if (pointerWarned) return;
  pointerWarned = true;
  ui.toast('Pointer lock is blocked here — hold the mouse button down to look around, or steer with the arrow keys.', 11000);
}
document.addEventListener('pointerlockerror', pointerLockFailed);

function pause() {
  if (state !== STATE.PLAY && state !== STATE.JOURNAL) return;
  state = STATE.PAUSED;
  player.freeze(true);
  ui.toggleJournal(false);
  document.exitPointerLock?.();
  ui.showPause(`${restored.size} of ${MEMORIES.length} fragments restored · tide ${tide.toFixed(1)} m`);
}

function resume() {
  ui.hidePause();
  state = STATE.PLAY;
  player.freeze(false);
  lockPointer();
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && state === STATE.PLAY && elapsed > 1) pause();
});
canvas.addEventListener('click', () => {
  if (state === STATE.PLAY) lockPointer();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  post.resize(w, h);
  post.uniforms.uResolution.value.set(w, h);
  sky.setPixelRatio(DPR);
  specters.setPixelRatio(DPR);
});

/* ────────────────────────────── boot ────────────────────────────── */

// the title screen copy lives in content.js with the rest of the writing
(function paintStartScreen() {
  const startEl = document.getElementById('start');
  if (!startEl) return;
  const eyebrow = startEl.querySelector('.eyebrow');
  const tagline = startEl.querySelector('.tagline');
  const premise = startEl.querySelector('.premise');
  const cta = document.getElementById('beginBtn');
  if (eyebrow) eyebrow.textContent = PREVIEW.eyebrow;
  if (tagline) tagline.innerHTML = PREVIEW.tagline.replace('\n', '<br/>');
  if (cta) cta.textContent = PREVIEW.cta;
  if (premise) {
    premise.innerHTML = '';
    for (const para of PREVIEW.premise) {
      const el = document.createElement('p');
      el.textContent = para;
      premise.appendChild(el);
    }
  }
})();

sky.setPixelRatio(DPR);
specters.setPixelRatio(DPR);
ui.renderJournal(MEMORIES, restored, 0);
ui.showStart();
ui.loadingDone();
ui.setStats({ lucidity: 1, oil: 1, eclipse: 0.42 });
frame();

// exposed for tinkering from the console
window.VAELUNE = { THREE, scene, camera, renderer, city, water, sky, specters, shadows, player, post, ui, audio,
  get state() { return state; }, restored, restoreAll: () => specters.shards.forEach((s) => specters.restore(s)) };
