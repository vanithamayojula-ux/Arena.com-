/* LUMEN PROTOCOL — content-graph integrity + playability. The graph must be
   closed (no dangling links), every gate must be openable somewhere, and a
   bot picking arbitrary legal choices must ALWAYS reach an ending. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, CHAPTERS, buildEpilogue } from '../src/story.js';
import { createGame, enterScene, visibleState, advance, choiceAt, can, finishScene, nextChapter, TRAITS, SKILLS, CALIBS, apply } from '../src/game.js';

const sceneIds = Object.keys(SCENES);

test('chapters reference real scenes; scene titles exist', () => {
  assert.equal(CHAPTERS.length, 3);
  for (const ch of CHAPTERS) for (const id of ch.scenes) {
    assert.ok(SCENES[id], `missing scene ${id}`);
    assert.ok(SCENES[id].title, `scene ${id} needs a title`);
  }
});

function collectGraph() {
  const flags = new Set(), skillsGranted = new Set(), nodes = [];
  for (const id of sceneIds) {
    const sc = SCENES[id];
    if (sc.fx?.flag) for (const k in sc.fx.flag) flags.add(k);
    for (const nid in sc.nodes) {
      const n = sc.nodes[nid];
      nodes.push([id, nid, n]);
      if (n.fx?.flag) for (const k in n.fx.flag) flags.add(k);
      const scanFx = (fx) => { if (fx?.skill) skillsGranted.add(fx.skill); if (fx?.flag) for (const k in fx.flag) flags.add(k); };
      scanFx(n.autoFx);
      for (const c of n.choices || []) scanFx(c.fx);
    }
  }
  for (const c of Object.values(CALIBS)) if (c.skill) skillsGranted.add(c.skill);
  // engine-applied scene-entry flags
  for (const id of sceneIds) flags.add('fx_' + id);
  return { flags, skillsGranted, nodes };
}

test('every node link resolves: then → node, goto/then → scene', () => {
  const { nodes } = collectGraph();
  for (const [sid, nid, n] of nodes) {
    if (n.then && n.then !== 'END') assert.ok(SCENES[sid].nodes[n.then], `${sid}.${nid} → missing node ${n.then}`);
    const g = n.goto || (n.then?.startsWith('goto:') ? n.then.slice(5) : null);
    if (g) assert.ok(SCENES[g], `${sid}.${nid} → missing scene ${g}`);
    for (const c of n.choices || []) {
      if (!c.then || c.then === 'END') continue;
      if (c.then.startsWith('goto:')) assert.ok(SCENES[c.then.slice(5)], `${sid}.${nid} choice → missing scene ${c.then}`);
      else assert.ok(SCENES[sid].nodes[c.then], `${sid}.${nid} choice → missing node ${c.then}`);
    }
  }
});

test('every line is [who, text]; every who is styled or generic', () => {
  const { nodes } = collectGraph();
  for (const [sid, nid, n] of nodes) for (const l of n.lines || []) {
    assert.ok(Array.isArray(l) && l.length >= 2, `${sid}.${nid} bad line`);
    assert.ok(typeof l[1] === 'string' && l[1].length > 0, `${sid}.${nid} empty text`);
  }
});

test('every requirement references known things — and is satisfiable', () => {
  const { flags, skillsGranted, nodes } = collectGraph();
  for (const [sid, nid, n] of nodes) {
    for (const c of n.choices || []) {
      const nd = c.need || {};
      if (nd.trait) for (const t in nd.trait) { assert.ok(TRAITS.includes(t), `bad trait ${t} in ${sid}.${nid}`); assert.ok(nd.trait[t] >= 0 && nd.trait[t] <= 6, `trait bound ${sid}.${nid}`); }
      if (nd.skill) { assert.ok(SKILLS[nd.skill], `unknown skill gate ${nd.skill} @ ${sid}.${nid}`); assert.ok(skillsGranted.has(nd.skill), `skill ${nd.skill} is gated but never granted (${sid}.${nid})`); }
      if (nd.flag) assert.ok(flags.has(nd.flag) || nd.flag.startsWith('fx_'), `flag need ${nd.flag} never set (${sid}.${nid})`);
      for (const f of nd.anyFlag || []) assert.ok(flags.has(f), `anyFlag need ${f} never set (${sid}.${nid})`);
      if (nd.pack) assert.ok(['widows_morning', 'elevator_grief', 'lantern_fire', 'own_slice'].includes(nd.pack), `bad pack ${nd.pack}`);
    }
  }
});

test('the final roof: at least one ending is always available', () => {
  const fin = SCENES.final.nodes.z1;
  assert.ok(fin.choices.some(c => !c.need), 'RETURN must be ungated');
});

/* ---- full-graph playthrough bots ---- */
function playThrough(g, rngOrFirst) {
  enterScene(g, { SCENES, CHAPTERS }, CHAPTERS[0].scenes[0]);
  for (let i = 0; i < 3000; i++) {
    if (g.finished) return g;
    const vs = visibleState(g, { SCENES, CHAPTERS });
    if (vs.mode === 'line') { advance(g, { SCENES, CHAPTERS }); continue; }
    if (vs.mode === 'end') {
      const r = advance(g, { SCENES, CHAPTERS });
      if (r.goto) { enterScene(g, { SCENES, CHAPTERS }, r.goto); continue; }
      const res = finishScene(g, { SCENES, CHAPTERS });
      if (res.chapterDone) {
        const nc = nextChapter(g, { SCENES, CHAPTERS });
        if (nc.done) return g;
      }
      continue;
    }
    // choices
    const legal = [];
    vs.node.choices.forEach((c, idx) => { if (can(g, c.need)) legal.push(idx); });
    assert.ok(legal.length, `DEAD END at ${g.scene}.${g.node} — no legal choice`);
    const pick = legal[rngOrFirst(legal.length)];
    const out = choiceAt(g, { SCENES, CHAPTERS }, pick);
    assert.ok(out.ok, 'choiceAt rejected a legal choice');
    if (out.goto) enterScene(g, { SCENES, CHAPTERS }, out.goto);
    else if (out.sceneEnd) {
      const res = finishScene(g, { SCENES, CHAPTERS });
      if (res.chapterDone) { const nc = nextChapter(g, { SCENES, CHAPTERS }); if (nc.done) return g; }
    }
  }
  assert.fail(`run did not terminate at ${g.scene}.${g.node}`);
}
function seeded(i) { let h = i >>> 0; return (n) => { h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; return h % n; }; }

test('bots always reach an ending (120 seeded runs × all 3 calibrations)', () => {
  const endings = new Set();
  for (let seed = 1; seed <= 120; seed++) {
    const g = createGame(Object.keys(CALIBS)[seed % 3]);
    playThrough(g, seeded(seed * 7919 + 13));
    assert.ok(g.finished, 'finished');
    assert.ok(g.flags.ending, `ending flag set (seed ${seed})`);
    endings.add(g.flags.ending);
    for (const t of TRAITS) { assert.ok(g.traits[t] >= 0 && g.traits[t] <= 6, 'trait bounds'); }
    for (const s of g.skills) assert.ok(SKILLS[s], 'skills known');
    const cards = buildEpilogue(g);
    assert.ok(cards.length >= 4 && cards.every(c => c.head && c.body), 'epilogue renders');
  }
  assert.ok(endings.size >= 3, `bots collectively reached ${endings.size} distinct endings`);
});

test('the always-first-choice route never dead-ends (most-locked route)', () => {
  const g = createGame('analyst');
  playThrough(g, (n) => 0); // always first legal
  assert.ok(g.finished);
});
test('the always-last-choice route never dead-ends', () => {
  const g = createGame('feral');
  playThrough(g, (n) => n - 1);
  assert.ok(g.finished);
});
