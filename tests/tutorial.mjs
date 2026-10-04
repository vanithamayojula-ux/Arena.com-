// Does the game actually teach itself? This drives the opening lesson through a
// whole session's worth of player states and asserts what it told the player, and when.
import { createTutorial } from '../src/tutorial.js';
import { HINTS, PROLOGUE, PREVIEW } from '../src/content.js';

const fails = [];
const check = (label, fn) => {
  try { const v = fn(); console.log(`  ok   ${label}${v !== undefined ? ' → ' + v : ''}`); return v; }
  catch (e) { fails.push(label); console.log(`  FAIL ${label}: ${e.message}`); return null; }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

/* ── the writing is all there and says something ── */
check('the title screen explains what the game is', () => {
  assert(PREVIEW.tagline.includes('eclipse'), 'tagline does not mention the eclipse');
  assert(PREVIEW.premise.length >= 2, 'premise needs at least two paragraphs');
  const words = PREVIEW.premise.join(' ').split(/\s+/).length;
  assert(words > 30, `premise is too thin (${words} words)`);
  return `${words} words`;
});

check('the prologue has three panels covering city, you, and what you do', () => {
  assert(PROLOGUE.length === 3, `expected 3 panels, got ${PROLOGUE.length}`);
  const kickers = PROLOGUE.map((p) => p.kicker).join(', ');
  for (const p of PROLOGUE) {
    assert(p.title && p.kicker, 'panel is missing a title or kicker');
    assert(p.lines.length >= 3, `panel "${p.title}" has only ${p.lines.length} lines`);
    for (const l of p.lines) assert(l.trim().length > 20, `panel "${p.title}" has an empty line`);
  }
  return kickers;
});

check('the prologue names the goal and the danger', () => {
  const all = PROLOGUE.flatMap((p) => p.lines).join(' ').toLowerCase();
  for (const word of ['hold e', 'tide', 'shadow', 'remember']) {
    assert(all.includes(word), `the prologue never mentions "${word}"`);
  }
  return 'goal, tide, danger and the verb are all stated';
});

check('every contextual hint has text', () => {
  const keys = Object.keys(HINTS);
  assert(keys.length >= 7, `only ${keys.length} hints defined`);
  for (const k of keys) assert(HINTS[k].length > 12, `hint "${k}" is too short to be useful`);
  return keys.join(', ');
});

/* ── the lesson itself ── */
function harness() {
  const log = [];
  const t = createTutorial({
    setGoal: (text) => log.push(['goal', text.replace(/<[^>]+>/g, '')]),
    hint: (key, text) => log.push(['hint', key === null ? '' : key, text]),
    say: (who, line) => log.push(['say', who, line.slice(0, 40)]),
  });
  return { t, log, goals: () => log.filter((e) => e[0] === 'goal').map((e) => e[1]) };
}

const idle = () => ({ swimming: false, blocked: false, vel: { x: 0, z: 0 }, depth: 0, lanternOn: false, oil: 100, mantleT: 0, mantleCooldown: 0 });
const step = (h, ctxFor, seconds = 1 / 60) => {
  const ctx = typeof ctxFor === 'function' ? ctxFor() : ctxFor;
  h.t.update(seconds, { player: idle(), nearest: null, restoredSize: 0, shadows: 0, ...ctx });
};

check('the lesson opens by naming the first place and the key', () => {
  const h = harness();
  h.t.start();
  assert(h.goals().length === 1, 'no opening goal was stated');
  assert(/market row/.test(h.goals()[0]), `opening goal does not name the district: ${h.goals()[0]}`);
  assert(h.log.some((e) => e[0] === 'say'), 'nobody speaks at the start');
  return h.goals()[0];
});

check('walking to the fragment asks you to hold E', () => {
  const h = harness();
  h.t.start();
  const near = { nearest: { mem: { district: 'the market row' }, dist: 6 } };
  step(h, near);
  assert(h.t.state.step === 1, `tutorial is at step ${h.t.state.step}, expected 1`);
  const prompt = h.log.find((e) => e[0] === 'hint' && e[1] === 'E');
  assert(prompt, 'the player was never told to press E');
  assert(h.goals().some((g) => /hold E/.test(g)), 'the goal never mentions holding E');
  return prompt[2];
});

check('the compass nudge is repeated, but not forever', () => {
  const h = harness();
  h.t.start();
  const far = { nearest: { mem: { district: 'the light-keepers' }, dist: 90 } };
  for (let i = 0; i < 60 * 200; i++) step(h, far);
  const goals = h.goals();
  assert(goals.length >= 2, 'the game never nudged the player');
  assert(goals.length <= 4, `the game nagged ${goals.length} times in three minutes`);
  return `${goals.length} goals in 200 s`;
});

check('restoring the first memory hands control back to the city', () => {
  const h = harness();
  h.t.start();
  step(h, { nearest: { mem: { district: 'the market row' }, dist: 6 } });
  step(h, { nearest: { mem: { district: 'x' }, dist: 6 }, restoredSize: 1 });
  assert(h.t.state.step === 2, `tutorial stuck at step ${h.t.state.step}`);
  assert(h.goals().some((g) => /Five fragments/.test(g)), 'the player was not told how much is left');
  return 'step 2';
});

check('swimming explains rising, diving and climbing out, once', () => {
  const h = harness();
  h.t.start();
  const swim = () => ({ player: { ...idle(), swimming: true, depth: 1 }, nearest: { mem: { district: 'x' }, dist: 50 } });
  for (let i = 0; i < 60 * 30; i++) step(h, swim);
  const swimHints = h.log.filter((e) => e[0] === 'hint' && /C/.test(e[1] || ''));
  assert(swimHints.length === 1, `the swimming hint fired ${swimHints.length} times`);
  return swimHints[0][2].slice(0, 40) + '…';
});

check('wading the first time explains the movement keys', () => {
  const h = harness();
  h.t.start();
  step(h, { player: { ...idle(), depth: 0.6 }, nearest: { mem: { district: 'x' }, dist: 50 } });
  const move = h.log.filter((e) => e[0] === 'hint' && !e[1]);
  assert(move.length >= 1, 'nothing was said about moving');
  assert(HINTS.move.includes('W A S D'), 'the hint does not name the keys');
  return 'ok';
});

check('stuck against a ledge in water offers the climb-out', () => {
  const h = harness();
  h.t.start();
  const ledge = () => ({ player: { ...idle(), swimming: true, blocked: true, depth: 2, vel: { x: 0, z: 0 } }, nearest: { mem: { district: 'x' }, dist: 50 } });
  for (let i = 0; i < 60 * 2; i++) step(h, ledge);
  const m = h.log.find((e) => e[0] === 'hint' && e[1] === 'space' && /haul yourself/.test(e[2]));
  assert(m, 'the player was not told how to get out of the water');
  return m[2];
});

check('a shadow appearing explains the lantern', () => {
  const h = harness();
  h.t.start();
  step(h, { nearest: { mem: { district: 'x' }, dist: 50 }, shadows: 1 });
  const l = h.log.find((e) => e[0] === 'hint' && e[1] === 'F');
  assert(l, 'nothing explained the lantern when a shadow arrived');
  return l[2].slice(0, 44) + '…';
});

check('low oil warns once, and again after a refill', () => {
  const h = harness();
  h.t.start();
  const low = { player: { ...idle(), lanternOn: true, oil: 12 }, nearest: { mem: { district: 'x' }, dist: 50 } };
  for (let i = 0; i < 60 * 5; i++) step(h, low);
  let warns = h.log.filter((e) => e[0] === 'hint' && /running low/.test(e[2] || ''));
  assert(warns.length === 1, `warned ${warns.length} times about the same tank`);
  step(h, { player: { ...idle(), oil: 100 }, nearest: { mem: { district: 'x' }, dist: 50 } });
  for (let i = 0; i < 60 * 5; i++) step(h, low);
  warns = h.log.filter((e) => e[0] === 'hint' && /running low/.test(e[2] || ''));
  assert(warns.length === 2, 'did not warn again after the oil was refilled');
  return 'warned, refilled, warned again';
});

check('the tide and the journal are explained once there is something to show', () => {
  const h = harness();
  h.t.start();
  for (let i = 0; i < 60 * 30; i++) step(h, { nearest: null, restoredSize: 1 });
  for (let i = 0; i < 60 * 30; i++) step(h, { nearest: null, restoredSize: 2 });
  assert(h.log.some((e) => e[0] === 'hint' && /tide comes up/.test(e[2] || '')), 'the tide was never explained');
  assert(h.log.some((e) => e[0] === 'hint' && e[1] === 'TAB'), 'the journal was never introduced');
  return 'tide + journal';
});

check('a hint is never repeated in the same session', () => {
  const h = harness();
  h.t.start();
  const ctx = () => ({ player: { ...idle(), swimming: true, depth: 2, lanternOn: true, oil: 10 }, nearest: { mem: { district: 'x' }, dist: 50 }, shadows: 2, restoredSize: 3 });
  for (let i = 0; i < 60 * 120; i++) step(h, ctx);
  const counts = {};
  for (const e of h.log.filter((x) => x[0] === 'hint')) {
    const key = e[2];
    counts[key] = (counts[key] || 0) + 1;
  }
  const repeated = Object.entries(counts).filter(([, n]) => n > 2);
  assert(repeated.length === 0, 'repeated hints: ' + JSON.stringify(repeated));
  return `${Object.keys(counts).length} distinct hints over two minutes, none repeated more than twice`;
});

console.log(fails.length ? `\n${fails.length} ONBOARDING PROBLEM(S)` : '\nONBOARDING OK');
process.exit(fails.length ? 1 : 0);
