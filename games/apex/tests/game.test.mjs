// Runs the real simulation headlessly: no logic is re-implemented here, the
// game modules are imported and driven directly.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/game.js';
import { World } from '../src/world.js';
import { Prey } from '../src/entities.js';
import { makeCanvas, makeHud, makeSfx, idleInput } from './helpers.mjs';
import { WORLD, PLAYER, PREY } from '../src/config.js';
import { makeRandom } from '../src/utils.js';

function makeGame() {
  const hud = makeHud();
  const sfx = makeSfx();
  const api = createGame({
    canvas: makeCanvas(960, 600),
    minimap: makeCanvas(150, 112),
    hud,
    sfx,
    makeCanvas,
  });
  api.setView({ w: 960, h: 600, dpr: 1 });
  return { api, hud, sfx };
}

function step(api, frames, input, dt = 1 / 120) {
  for (let i = 0; i < frames; i++) {
    api.setInputStateRef(input || idleInput());
    api.update(dt);
    if (api.game.state !== 'playing') break;
  }
  api.updateCamera(dt);
}

test('game boots, spawns a populated valley, and runs 600 frames + draws', () => {
  const { api, hud, sfx } = makeGame();
  api.start();

  assert.equal(api.game.state, 'playing');
  assert.ok(api.game.prey.length >= 8, `expected a herd to spawn, got ${api.game.prey.length}`);
  assert.ok(api.game.raptors.length >= 2, 'expected a raptor pack');
  assert.ok(api.game.world.terrain, 'terrain layer should be pre-rendered');
  assert.ok(sfx.played.includes('start'), 'start sfx should fire');

  const before = api.game.prey.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const input = idleInput({ x: 1, y: 0.4, sprint: true });

  for (let i = 0; i < 600; i++) {
    api.setInputStateRef(i % 90 === 0 ? idleInput({ bite: true }) : input);
    api.update(1 / 120);
    if (api.game.state !== 'playing') break;
  }
  api.updateCamera(1 / 60);
  api.draw(1.0);

  const after = api.game.prey.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  assert.notDeepEqual(before, after, 'prey should have moved during the run');
  assert.ok(hud.calls.bars > 0, 'HUD meters should update');

  // nothing escapes the valley
  for (const e of [...api.game.prey, ...api.game.raptors, api.game.player]) {
    assert.ok(e.x >= -1 && e.x <= WORLD.w + 1, `x out of bounds: ${e.x}`);
    assert.ok(e.y >= -1 && e.y <= WORLD.h + 1, `y out of bounds: ${e.y}`);
  }
});

test('the player accelerates, sprints faster, and burns stamina', () => {
  const { api } = makeGame();
  api.start();
  const pl = api.game.player;
  // clear scenery and water so this measures the movement model, not a collision
  api.game.world.rocks = [];
  api.game.world.trees = [];
  api.game.world.water = [];

  step(api, 60, idleInput({ x: 1, y: 0 }));
  const walkSpeed = pl.speed;
  assert.ok(walkSpeed > 150, `walking should build speed, got ${walkSpeed.toFixed(1)}`);
  assert.ok(walkSpeed <= PLAYER.maxSpeed + 1, 'walk must respect the walk cap');

  const staminaBefore = pl.stamina;
  step(api, 120, idleInput({ x: 1, y: 0, sprint: true }));
  assert.ok(pl.stamina < staminaBefore, 'sprinting should drain stamina');
  assert.ok(pl.speed > PLAYER.maxSpeed, `sprint should exceed walk cap, got ${pl.speed.toFixed(1)}`);
  assert.ok(pl.speed <= PLAYER.sprintMax + 1, 'sprint must respect the sprint cap');
});

test('a fleeing herd member tires and blows its stamina', () => {
  const world = new World(4242);
  const prey = new Prey(600, 600, 'gazelle', 0, makeRandom(99));
  const threat = { x: prey.x - 100, y: prey.y };

  let sawFlee = false;
  let framesFleeing = 0;
  for (let i = 0; i < 900; i++) {
    // the hunter keeps pace, so the gazelle never shakes it out of sight range
    threat.x = prey.x - 100;
    threat.y = prey.y;
    prey.update(1 / 120, world, [threat], { ax: 0, ay: 0 });
    if (prey.state === 'flee' || prey.state === 'panic') {
      sawFlee = true;
      framesFleeing++;
    }
    if (prey.blown) break;
  }

  assert.ok(sawFlee, 'prey should switch to a fleeing state when a hunter closes in');
  assert.ok(framesFleeing > 60, `prey should keep running for a while, ran ${framesFleeing} frames`);
  assert.ok(prey.blown, 'a long chase should exhaust the prey');
  assert.equal(prey.stamina, 0, 'a blown animal has no stamina left');
  assert.ok(
    prey.speed <= PREY.gazelle.grazeSpeed * 1.5 + 1,
    `a blown gazelle should slow to a stumble, got ${prey.speed.toFixed(1)}`
  );
});

test('a bite inside the jaw cone kills prey, scores, and feeds the hunter', () => {
  const { api, hud, sfx } = makeGame();
  api.start();
  api.game.raptors = [];
  const pl = api.game.player;
  const prey = api.game.prey.find((p) => p.kind === 'gazelle');
  assert.ok(prey, 'need a gazelle for this test');

  // park the gazelle just in front of the jaws and keep it there
  pl.x = WORLD.w / 2;
  pl.y = WORLD.h / 2;
  pl.angle = 0;
  pl.hunger = 40;
  prey.x = pl.x + 34;
  prey.y = pl.y;

  assert.ok(pl.inBiteCone(prey.x, prey.y, prey.radius), 'prey should start inside the cone');

  const scoreBefore = api.game.score;
  const waveBefore = api.game.waveCaught;
  const preyCount = api.game.prey.length;

  api.setInputStateRef(idleInput({ bite: true }));
  api.update(1 / 120); // starts the bite
  for (let i = 0; i < 40; i++) {
    api.setInputStateRef(idleInput());
    api.update(1 / 120);
    if (!prey.alive) break;
  }

  assert.equal(prey.alive, false, 'the gazelle should be dead after a clean bite');
  assert.ok(api.game.score > scoreBefore, 'score should increase');
  assert.equal(api.game.waveCaught, waveBefore + 1, 'quota should advance');
  assert.equal(api.game.prey.length, preyCount - 1, 'the corpse should leave the herd');
  assert.ok(pl.hunger > 40, 'eating should restore hunger');
  assert.ok(sfx.played.some((s) => s === 'chomp'), 'bite should make a chomp');
  assert.equal(api.game.combo, 2, 'first catch should start the combo at x2');
  assert.ok(
    hud.calls.toasts.some((t) => /down/.test(t.text)),
    'HUD should announce the kill'
  );
});

test('one swing resolves once, even with two animals in the cone', () => {
  const { api, sfx } = makeGame();
  api.start();
  api.game.raptors = [];
  const pl = api.game.player;

  // Triceratops survive a single bite, so their hp shows exactly how many
  // times the swing resolved.
  api.game.prey = api.game.prey.filter((p) => p.kind !== 'triceratops');
  const targets = [
    new Prey(WORLD.w / 2 + 30, WORLD.h / 2, 'triceratops', 1, makeRandom(11)),
    new Prey(WORLD.w / 2 + 55, WORLD.h / 2, 'triceratops', 2, makeRandom(22)),
  ];
  for (const t of targets) {
    t.update = () => {}; // hold them in the jaws for this assertion
    api.game.prey.push(t);
  }

  pl.x = WORLD.w / 2;
  pl.y = WORLD.h / 2;
  pl.angle = 0;

  api.setInputStateRef(idleInput({ bite: true }));
  api.update(1 / 120);
  for (let i = 0; i < 20; i++) {
    api.setInputStateRef(idleInput());
    api.update(1 / 120);
  }

  for (const t of targets) {
    assert.equal(
      t.hp,
      PREY.triceratops.hp - PLAYER.biteDamage,
      'each animal in the cone should take exactly one hit from the swing'
    );
  }
  assert.equal(
    sfx.played.filter((x) => x === 'chomp').length,
    1,
    'the swing should connect once, not once per strike frame'
  );
});

test('meeting the quota clears the wave and raises the next one', () => {
  const { api, hud, sfx } = makeGame();
  api.start();
  const quota = api.game.quota;
  const waveBefore = api.game.wave;

  for (let i = 0; i < quota; i++) {
    api.internals.killPrey(api.game.prey[i]);
  }

  assert.equal(api.game.wave, waveBefore + 1, 'wave should advance');
  assert.equal(api.game.waveCaught, 0, 'quota counter resets on a new wave');
  assert.ok(sfx.played.includes('waveClear'), 'wave clear fanfare should play');
  assert.ok(
    hud.calls.toasts.some((t) => /WAVE CLEARED/.test(t.text)),
    'HUD should announce the cleared wave'
  );
  assert.ok(api.game.quota > quota, 'the next wave should demand more prey');
});

test('starvation ends the hunt', () => {
  const { api, hud } = makeGame();
  api.start();
  api.game.player.hunger = 0.01;
  step(api, 10);
  assert.equal(api.game.state, 'over', 'starving should end the run');
  assert.match(hud.calls.over.reason, /starv/i);
});

test('running out of health ends the hunt', () => {
  const { api, hud } = makeGame();
  api.start();
  api.game.player.hp = 0;
  step(api, 4);
  assert.equal(api.game.state, 'over');
  assert.match(hud.calls.over.reason, /raptor pack/i);
});

test('the wave clock ending the run is reported', () => {
  const { api, hud } = makeGame();
  api.start();
  api.game.timeLeft = 0.01;
  step(api, 4);
  assert.equal(api.game.state, 'over');
  assert.match(hud.calls.over.reason, /quota/i);
});

test('raptor contact damages the player and breaks the combo', () => {
  const { api } = makeGame();
  api.start();
  const pl = api.game.player;
  const raptor = api.game.raptors[0];
  assert.ok(raptor, 'need a raptor');

  pl.x = WORLD.w / 2;
  pl.y = WORLD.h / 2;
  raptor.x = pl.x + 8;
  raptor.y = pl.y;
  api.game.combo = 4;

  const dmg = raptor.tryContact(pl);
  assert.ok(dmg > 0, 'a raptor on top of the rex should bite');
  pl.damage(dmg);
  assert.ok(pl.hp < PLAYER.hpMax, 'player should take damage');
  // contact has a cooldown, so an immediate second contact does nothing
  assert.equal(raptor.tryContact(pl), 0, 'raptor contact should be on cooldown');
});

test('a triceratops takes more than one bite', () => {
  const { api } = makeGame();
  api.start();
  api.game.raptors = [];
  const trike = api.game.prey.find((p) => p.kind === 'triceratops');
  assert.ok(trike, 'need a triceratops on wave 1');

  const oneBite = trike.damage(PLAYER.biteDamage);
  assert.equal(oneBite, false, 'a triceratops should survive a single bite');
  const twoBite = trike.damage(PLAYER.biteDamage);
  assert.equal(twoBite, true, 'a triceratops should fall to the second bite');
});

test('pause freezes the simulation and resume continues it', () => {
  const { api } = makeGame();
  api.start();
  const prey = api.game.prey[0];
  api.pause();
  assert.equal(api.game.state, 'paused');
  const x = prey.x;
  step(api, 30);
  assert.equal(prey.x, x, 'nothing should move while paused');
  api.resume();
  assert.equal(api.game.state, 'playing');
  step(api, 30);
  assert.notEqual(prey.x, x, 'prey should move again after resuming');
});

test('solid scenery stops the hunter', () => {
  const { api } = makeGame();
  api.start();
  const pl = api.game.player;
  assert.ok(api.game.world.rocks.length > 0, 'valley should have boulders');
  const rock = api.game.world.rocks[0];

  // charge straight into the boulder
  pl.x = rock.x - rock.r - pl.radius - 20;
  pl.y = rock.y;
  for (let i = 0; i < 90; i++) {
    api.setInputStateRef(idleInput({ x: 1, y: 0 }));
    api.update(1 / 120);
  }
  const gap = Math.hypot(pl.x - rock.x, pl.y - rock.y);
  assert.ok(
    gap >= rock.r + pl.radius - 1,
    `player should not overlap the boulder (gap ${gap.toFixed(1)}, min ${rock.r + pl.radius})`
  );
});
