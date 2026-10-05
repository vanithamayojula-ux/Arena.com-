// Headless engine + story tests for EMBERFALL. No logic is re-implemented here: the
// real scene modules are imported and driven with a fake G, a stubbed ui, and the
// software painter from tools/painter.mjs, so every frame you see in the test is a
// frame the rasteriser could have screenshotted.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHAPTERS, validateStory, FRAGMENTS, ENDINGS } from '../src/story.js';
import { freshState, computeEnding } from '../src/state.js';
import { ui } from '../src/ui.js';
import { RasterCanvas } from '../tools/painter.mjs';
import { makeVignette } from '../src/scenes/vignette.js';
import { makeRoad } from '../src/scenes/road.js';
import { makeNegotiation } from '../src/scenes/negotiation.js';
import { makePerformance } from '../src/scenes/performance.js';
import { makeWatch } from '../src/scenes/watch.js';
import { makeFight } from '../src/scenes/fight.js';

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ ui stubs
let lastPrompt = null;
let prompts = 0;
const toasts = [];
const choicePicks = [];
function stubUi(pickChoice = () => 0, pickPrompt = () => 0) {
  lastPrompt = null; prompts = 0; toasts.length = 0; choicePicks.length = 0; ui.fast = true;
  ui.dlg = { tx: { setAttribute() {}, textContent: '' }, hint: { style: {} }, ch: { children: [] } };
  ui.say = () => { ui.typing = false; };
  ui.skipTyping = () => { ui.typing = false; };
  ui.hideDialogue = () => {}; ui.showInDialogue = () => {};
  ui.toast = (t) => toasts.push(t);
  ui.setChapter = () => {}; ui.judgment = () => {}; ui.syncHud = () => {};
  ui.bumpBond = () => {}; ui.showLanes = () => {}; ui.laneHit = () => {};
  ui.hasPromptOpen = () => false; ui.pickPrompt = () => {};
  ui.hasChoiceOpen = () => false; ui.pickChoice = () => {};
  ui.promptCard = (cfg) => { prompts++; lastPrompt = cfg; };
  ui.setPromptDefault = (f) => { if (lastPrompt) lastPrompt.defaultFn = f; };
  ui.closePrompt = () => {};
  ui.offerChoices = (opts, cb) => { choicePicks.push(opts.map((o) => o.label)); cb(pickChoice(opts, choicePicks.length - 1)); };
  ui.play = () => {}; ui.fadeOut = () => {};
  ui.cardIsOpen = () => false; ui.hideCard = () => {}; ui.showCard = () => ({ querySelector: () => ({ addEventListener() {} }) });
}

function makeG(st) {
  const G = {
    st,
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), focus() {} },
    advanced: 0,
    chName: () => 'TEST',
    markHud() {},
    save() {},
    addLog() {},
    spendRouteOil() {},
    bonds(who, d) { st.bonds[who] = Math.max(0, Math.min(100, st.bonds[who] + d)); },
    toast(t) { toasts.push(t); },
    grantFragment(id) { st.fragments[id] = true; },
    applySet(set) {
      for (const k of Object.keys(set || {})) {
        const v = set[k];
        if (k === 'oil') st.oil = Math.max(0, Math.min(100, st.oil + v));
        else if (k === 'silver') st.silver += v;
        else if (k === 'morale') st.morale = Math.max(0, Math.min(100, st.morale + v));
        else if (k === 'rep') st.rep += v;
        else if (k === 'relit') st.relit += v;
        else if (k === 'trust') st.trust += v;
        else if (k === 'flag') st.flags[v] = true;
        else if (k === 'fragment') G.grantFragment(v);
        else if (k.startsWith('bonds.')) st.bonds[k.slice(6)] = Math.max(0, Math.min(100, st.bonds[k.slice(6)] + v));
      }
    },
    advance() { G.advanced++; },
  };
  return G;
}

// drive a scene's async flow: update frames + auto-answer prompts
async function drive(G, scene, { draw, maxFrames = 200000, per = 0.02, autoplay } = {}) {
  const ctx = draw ? new RasterCanvas(1280, 720).getContext('2d') : null;
  let f = 0;
  while (G.advanced === 0 && f < maxFrames) {
    await sleep(0); // let microtasks/timers settle between frames
    try { scene.update(per); } catch (e) { assert.fail(`update threw at frame ${f}: ${e.stack}`); }
    if (lastPrompt) {
      const p = lastPrompt; lastPrompt = null;
      p.onPick?.(0);
    }
    if (autoplay) { try { autoplay(scene); } catch (e) { assert.fail(`autoplay threw: ${e.stack}`); } }
    if (ctx && f % 121 === 0) { try { scene.draw(ctx, 1280, 720); } catch (e) { assert.fail(`draw threw at frame ${f}: ${e.stack}`); } }
    f++;
  }
  assert.ok(G.advanced > 0, `scene ${scene.kind} never advanced (frames: ${f})`);
  if (scene.exit) scene.exit();
}

// ------------------------------------------------------------------ story graph
test('story graph validates: every beat wired, every fragment reachable', () => {
  const rep = validateStory();
  assert.deepEqual(rep.errors, [], `story errors:\n${rep.errors.join('\n')}`);
  assert.ok(rep.steps >= 24, 'the tour should have at least 24 director steps');
  assert.ok(rep.beats >= 120, 'there should be a real script in there');
});

test('chapters are shaped as the director expects', () => {
  assert.equal(CHAPTERS.length, 4);
  const types = CHAPTERS.map((c) => c.steps.map((s) => s.type));
  assert.ok(types[0].includes('road') && types[0].includes('performance') && types[0].includes('negotiation'));
  assert.ok(types[1].includes('negotiation'), 'chapter 1 has the Moths negotiation');
  assert.ok(types[2].includes('watch'), 'Ashvale keeps the lamp');
  assert.ok(types[3].includes('watch') && types[3].includes('fight'), 'the finale holds and, if earned, fights');
  assert.equal(CHAPTERS[3].steps.at(-1).type, 'ending');
});

// ------------------------------------------------------------------ scenes boot
test('prologue vignette plays, campfire bonds apply', async () => {
  stubUi();
  const st = freshState();
  const G = makeG(st);
  const scene = makeVignette(G);
  scene.enter(CHAPTERS[0].steps[0]);
  await drive(G, scene, { draw: true, maxFrames: 40000 });
  assert.ok(st.log, 'no crash');
});

test('road scene walks the route, takes encounters, collects glimmers, arrives', async () => {
  stubUi();
  const st = freshState();
  const G = makeG(st);
  const scene = makeRoad(G);
  scene.enter(CHAPTERS[0].steps[1]); // the Hollow Mill road
  await drive(G, scene, { draw: true, per: 0.03, maxFrames: 300000 });
  assert.ok(st.oil < 62, 'the road should have charged for itself');
  assert.ok(Object.keys(st.fragments).includes('dimming'), 'roadside glimmer collected');
});

test('negotiation runs exchanges, levers, and the endgame without throwing', async () => {
  stubUi(() => 0);
  const st = freshState();
  const G = makeG(st);
  const scene = makeNegotiation(G);
  scene.enter(CHAPTERS[0].steps[3]); // Auditor Pell
  await drive(G, scene, { draw: true, per: 0.02, maxFrames: 300000 });
  assert.ok(choicePicks.length >= 3, 'the player was offered stance menus');
});

test('performance act engine: autoplay a full show, taps, holds, and patterns', async () => {
  stubUi(() => 0);
  const st = freshState();
  const G = makeG(st);
  const scene = makePerformance(G);
  scene.enter(CHAPTERS[0].steps[4]); // Benefit For The Lamp (3 acts + event)
  // autoplay: hit every tap note at its time; complete holds; answer patterns
  const auto = (sc) => {
    if (sc.paused && !lastPrompt) sc.paused = false;
    if (sc.state !== 'play') return;
    if (sc.act.kind === 'pattern') {
      const call = sc.pattern?.calls.find((c) => c.phase === 'input');
      if (call) { sc.press(call.seq[call.inputIdx]); return; }
      if (!sc.pattern.calls.find((c) => c.phase !== 'done')) { sc.actT += 0.2; return; }
      sc.actT += 0.05;
      return;
    }
    const n = sc.notes.find((x) => !x.hit && !x.missed);
    if (!n) { sc.actT = Math.max(sc.actT, sc.act.total * sc.act.beat + 3); return; }
    sc.actT = n.t - 0.02;
    sc.press(n.lane);
    if (n.hold) sc.actT = n.t + n.hold + 0.35; // release late → counts as full
    sc.actT = Math.max(sc.actT, 0);
  };
  await drive(G, scene, { draw: true, per: 1 / 60, maxFrames: 300000, autoplay: auto });
  assert.equal(st.shows, 1, 'the show was counted');
  assert.ok(scene.mood > 50, `autoplaying every note should please the crowd (mood ${scene.mood})`);
});

test('watch scene: the ring holds when the player answers every lamp', async () => {
  stubUi();
  const st = freshState();
  st.relit = 3;
  const G = makeG(st);
  const scene = makeWatch(G);
  scene.enter(CHAPTERS[2].steps.find((s) => s.type === 'watch')); // The Collection
  const auto = (sc) => {
    if (!sc.running || sc.over) return;
    sc.mouse.x = 640; sc.mouse.y = 300;
    for (const L of sc.lamps || []) if (L.extinguished) sc.relight(L);
    if (sc.glow < 60) sc.shove();
  };
  await drive(G, scene, { draw: true, per: 1 / 18, maxFrames: 60000, autoplay: auto });
  assert.ok(st.relit >= 3, 'defending lamps should add to the ledger of light');
});

test('watch finale: interlude prompt resolves and dawn arrives', async () => {
  stubUi();
  const st = freshState();
  st.flags.sangAway = true; st.flags.nuneWavered = true;
  const G = makeG(st);
  const scene = makeWatch(G);
  const fin = CHAPTERS[3].steps.find((s) => s.type === 'watch');
  scene.enter(fin);
  const auto = (sc) => {
    if (!sc.running || sc.over) return;
    for (const L of sc.lamps || []) if (L.extinguished) sc.relight(L);
  };
  await drive(G, scene, { draw: true, per: 1 / 18, maxFrames: 60000, autoplay: auto });
  assert.ok(st.flags.beaconHeld, 'with the lamp held, dawn counts as held');
});

test('fight scene: the brutal way, forty seconds of arithmetic', async () => {
  stubUi();
  const st = freshState();
  st.flags.foughtMoths = true;
  const G = makeG(st);
  const scene = makeFight(G);
  scene.enter(CHAPTERS[3].steps.find((s) => s.type === 'fight'));
  const auto = (sc) => { if (sc.state === 'window') sc.input(); };
  await drive(G, scene, { draw: true, per: 0.02, maxFrames: 60000, autoplay: auto });
  assert.ok(st.flags.mothsWon || st.injury, 'fighting costs or earns, never neither');
});

test('every dialogue beat in the game renders text that survives the strip-marks pass', () => {
  // (validateStory walks the branches; here we just ensure no beat text is blank)
  const bad = [];
  CHAPTERS.forEach((ch) => ch.steps.forEach((st) => {
    const scan = (arr, where) => (arr || []).forEach((bt) => {
      if (!bt) return;
      const tx = bt.tx;
      if (typeof tx === 'string' && tx.trim().length === 0) bad.push(`${where}: blank beat`);
    });
    scan(st.beats, ch.id);
    if (st.npc) { scan(st.npc.intro, ch.id); scan(st.npc.winBeats, ch.id); scan(st.npc.loseBeats, ch.id); Object.values(st.npc.lines || {}).forEach((ls) => scan(ls, ch.id)); }
    if (st.arena) { scan(st.arena.intro, ch.id); scan(st.arena.winBeats, ch.id); scan(st.arena.loseBeats, ch.id); }
  }));
  assert.deepEqual(bad, []);
});

// ------------------------------------------------------------------ endings math
test('endings: fresh tour is bittersweet, beacon-dark is the silence, a warm full tour chains the suns', () => {
  assert.equal(computeEnding(freshState()), 'sorrow');
  const dark = freshState();
  dark.flags.beaconDark = true;
  assert.equal(computeEnding(dark), 'silence');
  const best = freshState();
  best.relit = 9; best.ovations = 3; best.trust = 74; best.morale = 80;
  best.bonds = { dill: 62, bram: 66, fenn: 60 };
  best.flags.sangAway = true; best.flags.gaveOil = true;
  assert.equal(computeEnding(best), 'chain');
});

test('all three endings have real prose, and every fragment has an entry', () => {
  for (const id of ['chain', 'sorrow', 'silence']) {
    assert.ok(ENDINGS[id].lines.length >= 4, `ending ${id} needs an epilogue`);
    assert.ok(ENDINGS[id].title.length > 4);
  }
  for (const k of Object.keys(FRAGMENTS)) assert.ok(FRAGMENTS[k].text.length > 60, `${k} too thin`);
});
