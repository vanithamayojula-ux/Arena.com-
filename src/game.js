// The hunt itself: wave state, herding AI orchestration, bite resolution,
// camera, and the frame draw. No DOM access in here — that lives in main.js.

import { WORLD, PLAYER, PREY, RAPTOR, WAVES, COMBO, HERD } from './config.js';
import { World } from './world.js';
import { Player, Prey, Raptor, Particles, FloatText } from './entities.js';
import { drawCreature, drawShadow, drawBiteCone, drawAim } from './render.js';
import { clamp, dist2, makeRandom, TAU } from './utils.js';

export function createGame({ canvas, minimap, hud, sfx, makeCanvas: canvasFactory }) {
  const g = canvas.getContext('2d');
  const mg = minimap.getContext('2d');

  const game = {
    state: 'menu', // menu | playing | paused | over
    world: new World(),
    player: null,
    prey: [],
    raptors: [],
    herds: new Map(),
    particles: new Particles(),
    floaters: new FloatText(),
    camera: { x: WORLD.w / 2, y: WORLD.h / 2, zoom: 1, playerX: 0, playerY: 0, shake: 0 },
    view: { w: 960, h: 600, dpr: 1 },
    score: 0,
    caught: 0,
    wave: 1,
    quota: WAVES.baseQuota,
    waveCaught: 0,
    timeLeft: WAVES.baseTime,
    combo: 1,
    comboTimer: 0,
    bestCombo: 1,
    elapsed: 0,
    lastStepPhase: 0,
    rand: makeRandom(9182734),
  };

  // ------------------------------------------------------------ wave spawning

  function herdSpecs(wave) {
    const budget = WAVES.baseQuota + (wave - 1) * WAVES.quotaPerWave + 9;
    const specs = [];
    let left = budget;
    let herdId = 0;

    // a couple of gazelle herds
    const gazelleHerds = 2 + (wave > 2 ? 1 : 0);
    for (let i = 0; i < gazelleHerds && left > 3; i++) {
      const n = Math.min(left - 2, game.rand.int(5, 7));
      specs.push({ type: 'gazelle', count: n, id: herdId++ });
      left -= n;
    }
    // a parasaur herd
    for (let i = 0; i < 1 + (wave > 1 ? 1 : 0) && left > 3; i++) {
      const n = Math.min(left - 1, game.rand.int(3, 5));
      specs.push({ type: 'parasaurolophus', count: n, id: herdId++ });
      left -= n;
    }
    // triceratops: the big-ticket, dangerous meal
    const trikes = wave >= 2 ? Math.min(3, 1 + Math.floor(wave / 3)) : 1;
    for (let i = 0; i < trikes && left > 0; i++) {
      specs.push({ type: 'triceratops', count: 1, id: herdId++ });
      left -= 1;
    }
    return specs;
  }

  function spawnWave(wave) {
    game.prey = [];
    game.raptors = [];
    game.herds.clear();

    const speedMul = 1 + Math.min(0.4, (wave - 1) * 0.05);
    const aggroMul = 1 + Math.min(0.5, (wave - 1) * 0.06);

    for (const spec of herdSpecs(wave)) {
      const spot = game.world.randomOpenSpot(240);
      const spread = spec.type === 'triceratops' ? 60 : 120;
      for (let i = 0; i < spec.count; i++) {
        const a = game.rand.range(0, TAU);
        const r = game.rand.range(0, spread);
        const x = clamp(spot.x + Math.cos(a) * r, 80, WORLD.w - 80);
        const y = clamp(spot.y + Math.sin(a) * r, 80, WORLD.h - 80);
        const p = new Prey(x, y, spec.type, spec.id, makeRandom(game.rand.int(1, 1e6)));
        p.mul = speedMul;
        p.sightMul = aggroMul;
        game.prey.push(p);
      }
    }

    const raptorCount = Math.min(9, 2 + Math.floor(wave * 0.9));
    for (let i = 0; i < raptorCount; i++) {
      const spot = game.world.randomOpenSpot(300);
      const r = new Raptor(spot.x, spot.y, makeRandom(game.rand.int(1, 1e6)));
      r.mul = speedMul;
      game.raptors.push(r);
    }

    game.quota = WAVES.baseQuota + (wave - 1) * WAVES.quotaPerWave;
    game.timeLeft = Math.max(WAVES.minTime, WAVES.baseTime + (wave - 1) * WAVES.timePerWave);
    game.waveCaught = 0;
    hud.wave(game.wave);
    hud.quota(game.waveCaught, game.quota);
    hud.timer(game.timeLeft);
    hud.toast(`WAVE ${game.wave}`, '#e0b64a');
  }

  // ------------------------------------------------------------------ lifecycle

  function reset() {
    game.world = new World(game.rand.int(1, 1e9));
    game.world.buildLayers(makeCanvas);
    game.player = new Player(WORLD.w / 2, WORLD.h / 2);
    game.score = 0;
    game.caught = 0;
    game.wave = 1;
    game.combo = 1;
    game.bestCombo = 1;
    game.comboTimer = 0;
    game.elapsed = 0;
    game.particles = new Particles();
    game.floaters = new FloatText();
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    game.camera.shake = 0;
    spawnWave(1);
    hud.score(0);
    hud.combo(1);
  }

  function makeCanvas(w, h) {
    // Injected by the test harness; in the browser this builds an offscreen
    // canvas for the pre-rendered terrain layers.
    if (canvasFactory) return canvasFactory(w, h);
    const c =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
    c.width = w;
    c.height = h;
    return c;
  }

  function start() {
    reset();
    game.state = 'playing';
    sfx.start?.();
    sfx.roar?.();
    sfx.ambience?.();
    hud.show(true);
  }

  function pause() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
  }

  function resume() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
  }

  function togglePause() {
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  }

  function quit() {
    game.state = 'menu';
    sfx.stopAmbience?.();
    hud.show(false);
  }

  function gameOver(reason) {
    if (game.state === 'over') return;
    game.state = 'over';
    sfx.gameOver?.();
    sfx.stopAmbience?.();
    hud.gameOver({
      reason,
      score: game.score,
      combo: game.bestCombo,
      caught: game.caught,
      wave: game.wave,
    });
  }

  // ------------------------------------------------------------------- scoring

  function addScore(amount, x, y, label) {
    game.score += amount;
    game.caught++;
    game.floaters.add(x, y, label || `+${amount}`, '#e0b64a', 24);
    hud.score(game.score);
  }

  function bumpCombo() {
    game.combo = Math.min(COMBO.max, game.combo + 1);
    game.comboTimer = COMBO.window;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    hud.combo(game.combo);
    sfx.combo?.(game.combo);
  }

  function breakCombo() {
    if (game.combo > 1) {
      game.combo = 1;
      hud.combo(1);
    }
    game.comboTimer = 0;
  }

  function killPrey(p) {
    p.alive = false;
    const gained = Math.round(p.cfg.points * game.combo);
    addScore(gained, p.x, p.y - 20, `+${gained}`);
    game.waveCaught++;
    bumpCombo();

    game.player.hunger = clamp(game.player.hunger + PLAYER.hungerPerCatch, 0, PLAYER.hungerMax);
    if (p.cfg.points >= 400) game.player.heal(10);

    game.particles.burst(p.x, p.y, p.cfg.body, 16, game.rand, 190);
    game.particles.leaves(p.x, p.y, game.rand);
    game.camera.shake = Math.min(14, game.camera.shake + (p.radius > 20 ? 12 : 7));
    sfx.kill?.(p.cfg.radius > 20 ? 0.7 : 1.2);

    hud.quota(game.waveCaught, game.quota);
    hud.toast(`${p.cfg.label} down  x${game.combo}`, '#e0b64a');

    if (game.waveCaught >= game.quota) {
      const bonus = Math.round(game.timeLeft * 12 * game.wave);
      game.score += bonus;
      game.floaters.add(game.player.x, game.player.y - 60, `WAVE BONUS +${bonus}`, '#8fe07a', 26);
      hud.score(game.score);
      sfx.waveClear?.();
      hud.toast(`WAVE CLEARED  +${bonus}`, '#8fe07a');
      game.wave++;
      spawnWave(game.wave);
    }
  }

  function killRaptor(r) {
    r.alive = false;
    const gained = Math.round(RAPTOR.points * game.combo);
    addScore(gained, r.x, r.y - 18, `+${gained}`);
    game.particles.burst(r.x, r.y, RAPTOR.body, 14, game.rand, 170);
    game.camera.shake = Math.min(14, game.camera.shake + 6);
    sfx.screech?.();
  }

  // --------------------------------------------------------------------- update

  function updateHerdStats() {
    game.herds.clear();
    const acc = new Map();
    for (const p of game.prey) {
      if (!acc.has(p.herdId)) acc.set(p.herdId, { ax: 0, ay: 0, n: 0, members: [] });
      const h = acc.get(p.herdId);
      h.ax += p.vx;
      h.ay += p.vy;
      h.n++;
      h.members.push(p);
    }
    for (const [id, h] of acc) {
      h.ax /= h.n;
      h.ay /= h.n;
      game.herds.set(id, h);
    }
    // neighbour samples for separation (small herds => cheap)
    for (const h of acc.values()) {
      for (const p of h.members) {
        const list = [];
        for (const o of h.members) {
          if (o === p) continue;
          if (list.length >= 5) break;
          list.push(o);
        }
        p._neighbours = list;
      }
    }
  }

  function resolveBite() {
    const pl = game.player;
    if (!pl.consumeStrike()) return;

    let connected = false;

    for (const p of game.prey) {
      if (!p.alive) continue;
      if (!pl.inBiteCone(p.x, p.y, p.radius)) continue;
      connected = true;
      const dead = p.damage(PLAYER.biteDamage);
      game.particles.burst(p.x, p.y, p.cfg.stripe, 7, game.rand, 110);
      // knockback
      const a = Math.atan2(p.y - pl.y, p.x - pl.x);
      p.vx += Math.cos(a) * 220;
      p.vy += Math.sin(a) * 220;
      p.stamina = Math.max(0, p.stamina - 0.8);
      if (dead) {
        killPrey(p);
      } else {
        // a surviving triceratops sometimes turns and gores
        if (p.type === 'triceratops' && game.rand.chance(0.5)) {
          if (pl.damage(p.cfg.goreDamage)) {
            game.camera.shake = 12;
            game.floaters.add(pl.x, pl.y - 50, `-${p.cfg.goreDamage}`, '#d9622b', 22);
            hud.toast('GORED!', '#d9622b');
            sfx.hurt?.();
            breakCombo();
          }
        }
      }
    }

    for (const r of game.raptors) {
      if (!r.alive) continue;
      if (!pl.inBiteCone(r.x, r.y, r.radius)) continue;
      connected = true;
      const dead = r.damage(PLAYER.biteDamage);
      r.retreat = 1.4;
      const a = Math.atan2(r.y - pl.y, r.x - pl.x);
      r.vx += Math.cos(a) * 260;
      r.vy += Math.sin(a) * 260;
      game.particles.burst(r.x, r.y, RAPTOR.stripe, 6, game.rand, 120);
      if (dead) killRaptor(r);
    }

    if (connected) {
      sfx.chomp?.();
      game.camera.shake = Math.min(16, game.camera.shake + 4);
    } else {
      sfx.biteAir?.();
    }
  }

  function update(dt) {
    if (game.state !== 'playing') return;
    game.elapsed += dt;

    const pl = game.player;
    const input = game.inputState;

    // --- wave clock
    game.timeLeft -= dt;
    hud.timer(game.timeLeft);
    if (game.timeLeft <= 0) {
      gameOver('The sun set before you filled your quota. The valley keeps its herds.');
      return;
    }

    // --- combo decay
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) breakCombo();
    }

    // --- player
    const wasStriking = pl.isStriking;
    pl.update(dt, input, game.world);
    if (input.bite) pl.startBite();
    if (pl.isStriking && !wasStriking) resolveBite();

    if (pl.moving) {
      const stepEvery = 0.42;
      game.lastStepPhase += dt * (pl.speed / 90);
      if (game.lastStepPhase > stepEvery) {
        game.lastStepPhase = 0;
        sfx.step?.(pl.sprinting);
        if (pl.speed > 120) game.particles.dust(pl.x - Math.cos(pl.angle) * 20, pl.y - Math.sin(pl.angle) * 20, pl.vx, pl.vy, game.rand, pl.sprinting ? 2 : 1);
      }
    }

    // --- herds
    updateHerdStats();
    const threats = [pl, ...game.raptors.filter((r) => r.alive)];
    for (const p of game.prey) {
      if (!p.alive) continue;
      p.update(dt, game.world, threats, game.herds.get(p.herdId));
      if (p.moving && p.speed > 160 && game.rand.chance(0.12)) {
        game.particles.dust(p.x, p.y, p.vx, p.vy, game.rand, 1);
      }
    }
    game.prey = game.prey.filter((p) => p.alive);

    // --- raptors
    const livePrey = game.prey;
    for (const r of game.raptors) {
      if (!r.alive) continue;
      // pack separation sample
      r._neighbours = game.raptors.filter((o) => o !== r && o.alive).slice(0, 4);
      r.update(dt, game.world, livePrey, pl);
      const dmg = r.tryContact(pl);
      if (dmg > 0) {
        if (pl.damage(dmg)) {
          game.floaters.add(pl.x, pl.y - 50, `-${dmg}`, '#d9622b', 22);
          game.camera.shake = 10;
          sfx.hurt?.();
          breakCombo();
        }
        const a = Math.atan2(r.y - pl.y, r.x - pl.x);
        r.vx += Math.cos(a) * 200;
        r.vy += Math.sin(a) * 200;
        r.retreat = 0.8;
      }
      // raptors steal prey out from under you
      for (const p of livePrey) {
        if (!p.alive) continue;
        if (dist2(r.x, r.y, p.x, p.y) < (r.radius + p.radius + 6) ** 2 && p.type !== 'triceratops') {
          p.alive = false;
          game.particles.burst(p.x, p.y, p.cfg.stripe, 10, game.rand, 130);
          game.floaters.add(p.x, p.y - 18, 'STOLEN', '#d9622b', 18);
          breakCombo();
        }
      }
    }
    game.raptors = game.raptors.filter((r) => r.alive);
    game.prey = game.prey.filter((p) => p.alive);

    // Keep the valley populated: if a wave's worth is nearly gone, send more in.
    if (game.prey.length < 4) {
      const spot = game.world.randomOpenSpot(320);
      const types = ['gazelle', 'gazelle', 'parasaurolophus'];
      const id = 100 + game.rand.int(0, 999);
      for (let i = 0; i < 4; i++) {
        const a = game.rand.range(0, TAU);
        const p = new Prey(
          clamp(spot.x + Math.cos(a) * 90, 80, WORLD.w - 80),
          clamp(spot.y + Math.sin(a) * 90, 80, WORLD.h - 80),
          game.rand.pick(types),
          id,
          makeRandom(game.rand.int(1, 1e6))
        );
        p.mul = 1 + Math.min(0.4, (game.wave - 1) * 0.05);
        game.prey.push(p);
      }
      hud.toast('Fresh herd on the plain', '#8fe07a');
    }

    // --- fx + meters
    game.particles.update(dt);
    game.floaters.update(dt);
    game.camera.shake = Math.max(0, game.camera.shake - dt * 26);
    hud.bars({
      stamina: pl.stamina / PLAYER.staminaMax,
      health: pl.hp / PLAYER.hpMax,
      hunger: pl.hunger / PLAYER.hungerMax,
    });

    if (pl.dead) {
      gameOver('The raptor pack brought you down. Nothing in the valley mourns a rex.');
      return;
    }
    if (pl.starving) {
      gameOver('You starved on your feet. A hunter that cannot catch dinner does not last.');
    }
  }

  // --------------------------------------------------------------------- camera

  function updateCamera(dt) {
    const cam = game.camera;
    const pl = game.player;
    if (!pl) return;
    const targetZoom = clamp(
      Math.min(game.view.w / 1180, game.view.h / 760) * (pl.sprinting ? 0.93 : 1),
      0.55,
      1.3
    );
    cam.zoom += (targetZoom - cam.zoom) * clamp(dt * 3, 0, 1);

    const leadX = clamp(pl.vx * 0.28, -140, 140);
    const leadY = clamp(pl.vy * 0.28, -110, 110);
    const halfW = game.view.w / (2 * cam.zoom);
    const halfH = game.view.h / (2 * cam.zoom);
    let tx = clamp(pl.x + leadX, halfW, WORLD.w - halfW);
    let ty = clamp(pl.y + leadY, halfH, WORLD.h - halfH);
    if (WORLD.w < halfW * 2) tx = WORLD.w / 2;
    if (WORLD.h < halfH * 2) ty = WORLD.h / 2;
    const k = clamp(dt * 6, 0, 1);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.playerX = pl.x;
    cam.playerY = pl.y;
  }

  // ----------------------------------------------------------------------- draw

  function draw(time) {
    const { w, h, dpr } = game.view;
    const cam = game.camera;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#16241a';
    g.fillRect(0, 0, w, h);

    if (!game.world.terrain) return;

    const shake = cam.shake;
    const sx = shake > 0 ? (game.rand.rng() - 0.5) * shake : 0;
    const sy = shake > 0 ? (game.rand.rng() - 0.5) * shake : 0;

    g.save();
    g.translate(w / 2 + sx, h / 2 + sy);
    g.scale(cam.zoom, cam.zoom);
    g.translate(-cam.x, -cam.y);

    // ground, drawn from the visible sub-rect only
    const vw = w / cam.zoom;
    const vh = h / cam.zoom;
    const left = clamp(cam.x - vw / 2, 0, WORLD.w);
    const top = clamp(cam.y - vh / 2, 0, WORLD.h);
    const sw = Math.min(vw, WORLD.w - left);
    const sh = Math.min(vh, WORLD.h - top);
    if (sw > 0 && sh > 0) {
      g.drawImage(game.world.terrain, left, top, sw, sh, left, top, sw, sh);
    }

    // gather everything drawable and sort by depth
    const drawList = [];
    if (game.player) drawList.push(game.player);
    for (const p of game.prey) drawList.push(p);
    for (const r of game.raptors) drawList.push(r);
    drawList.sort((a, b) => a.y - b.y);

    for (const e of drawList) drawShadow(g, e);
    for (const e of drawList) {
      drawCreature(g, e, time);
    }

    if (game.player) {
      drawBiteCone(g, game.player);
      drawAim(g, game.player, game.inputState?.aimActive);
    }

    game.particles.draw(g);
    game.floaters.draw(g);

    // canopies sit above the animals
    if (sw > 0 && sh > 0 && game.world.canopy) {
      g.drawImage(game.world.canopy, left, top, sw, sh, left, top, sw, sh);
    }

    g.restore();

    drawVignette(w, h);
    drawOffscreenMarkers(w, h, cam);
    drawMinimap();
  }

  function drawVignette(w, h) {
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4,10,6,0.62)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // hunger red-out
    const pl = game.player;
    if (!pl) return;
    const danger = Math.max(1 - pl.hp / 35, 0) * 0.4 + Math.max(1 - pl.hunger / 25, 0) * 0.35;
    if (danger > 0.01) {
      const dg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      dg.addColorStop(0, 'rgba(0,0,0,0)');
      dg.addColorStop(1, `rgba(150,25,15,${clamp(danger, 0, 0.6).toFixed(3)})`);
      g.fillStyle = dg;
      g.fillRect(0, 0, w, h);
    }
  }

  function drawOffscreenMarkers(w, h, cam) {
    if (!game.player) return;
    const margin = 34;
    for (const r of game.raptors) {
      const sx = (r.x - cam.x) * cam.zoom + w / 2;
      const sy = (r.y - cam.y) * cam.zoom + h / 2;
      if (sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20) continue;
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      const px = clamp(sx, margin, w - margin);
      const py = clamp(sy, margin, h - margin);
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.globalAlpha = 0.85;
      g.fillStyle = '#d9622b';
      g.beginPath();
      g.moveTo(10, 0);
      g.lineTo(-7, -7);
      g.lineTo(-7, 7);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  let minimapBg = null;
  function drawMinimap() {
    const mw = minimap.width;
    const mh = minimap.height;
    if (!minimapBg) {
      minimapBg = makeCanvas(mw, mh);
      const b = minimapBg.getContext('2d');
      b.fillStyle = '#243a20';
      b.fillRect(0, 0, mw, mh);
      const kx = mw / WORLD.w;
      const ky = mh / WORLD.h;
      b.fillStyle = '#2c5560';
      for (const wtr of game.world.water) {
        b.beginPath();
        b.ellipse(wtr.x * kx, wtr.y * ky, wtr.rx * kx, wtr.ry * ky, wtr.rot, 0, TAU);
        b.fill();
      }
      b.fillStyle = '#5c5b54';
      for (const rock of game.world.rocks) {
        b.beginPath();
        b.arc(rock.x * kx, rock.y * ky, Math.max(1, rock.r * kx), 0, TAU);
        b.fill();
      }
      b.fillStyle = '#2f4a24';
      for (const t of game.world.trees) {
        b.beginPath();
        b.arc(t.x * kx, t.y * ky, Math.max(1.2, t.canopy * kx * 0.7), 0, TAU);
        b.fill();
      }
    }
    mg.clearRect(0, 0, mw, mh);
    mg.drawImage(minimapBg, 0, 0);
    const kx = mw / WORLD.w;
    const ky = mh / WORLD.h;

    for (const p of game.prey) {
      mg.fillStyle = p.type === 'triceratops' ? '#a8b58d' : '#e8d5ae';
      mg.fillRect(p.x * kx - 1, p.y * ky - 1, p.type === 'triceratops' ? 3 : 2, p.type === 'triceratops' ? 3 : 2);
    }
    for (const r of game.raptors) {
      mg.fillStyle = '#d9622b';
      mg.fillRect(r.x * kx - 1.5, r.y * ky - 1.5, 3, 3);
    }
    if (game.player) {
      const pl = game.player;
      mg.fillStyle = '#e0b64a';
      mg.beginPath();
      mg.arc(pl.x * kx, pl.y * ky, 3.4, 0, TAU);
      mg.fill();
      // view cone
      mg.strokeStyle = 'rgba(224,182,74,0.65)';
      mg.lineWidth = 1;
      mg.beginPath();
      mg.moveTo(pl.x * kx, pl.y * ky);
      mg.lineTo(pl.x * kx + Math.cos(pl.angle) * 11, pl.y * ky + Math.sin(pl.angle) * 11);
      mg.stroke();
    }
    // viewport box
    const cam = game.camera;
    const vw = game.view.w / cam.zoom;
    const vh = game.view.h / cam.zoom;
    mg.strokeStyle = 'rgba(239,227,200,0.35)';
    mg.strokeRect((cam.x - vw / 2) * kx, (cam.y - vh / 2) * ky, vw * kx, vh * ky);
  }

  // -------------------------------------------------------------------- public

  return {
    game,
    start,
    pause,
    resume,
    togglePause,
    quit,
    gameOver,
    update,
    draw,
    updateCamera,
    /** Exposed so main.js (and tests) can hand the loop its input snapshot. */
    setInput(state) {
      game.inputState = state;
    },
    setInputStateRef(state) {
      game.inputState = state;
    },
    setView(v) {
      game.view = v;
    },
    /** Test hook: build terrain layers with an injected canvas factory. */
    buildTerrain(factory) {
      game.world.buildLayers(factory);
    },
    get player() {
      return game.player;
    },
    // handy for tests / debug
    internals: { killPrey, spawnWave, resolveBite, addScore, breakCombo },
    PREY,
    HERD,
  };
}
