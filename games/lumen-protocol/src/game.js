/* LUMEN PROTOCOL — the engine. Pure, DOM-free, JSON-serializable state plus a
   dialogue-graph runner. Everything the player is (traits, skills, scars,
   carried minds) lives here; story.js supplies the graph; ui/city/main render
   it. A save is a full game, so autosave is trivially safe. */

export const TRAITS = ['empathy', 'lucidity', 'defiance', 'relic'];

export const SKILLS = {
  echo_sight:    { name: 'ECHO SIGHT',       desc: 'You read the tells of the grieving: when testimony files itself away, you notice. Opens contradiction options and the WEAVE in reconciliation.' },
  flood_tongue:  { name: 'FLOOD TONGUE',     desc: 'You learned the cadence of the drowned tiers from a dead man’s grief. Soothing checks succeed where words normally sink.' },
  frost_read:    { name: 'FROST READ',       desc: 'A copy of someone’s last clear morning, kept for yourself. You can tell a remembered moment from an invented one.' },
  ghost_key:     { name: 'GHOST KEY',        desc: 'You can knock in the cipher the Vault wardens use. Locked doors remember you kindly.' },
  jury_rig:      { name: 'JURY RIG',         desc: 'You can offer a “certified” memory that never existed. Once. The implant winks when you do.' },
  choir_static:  { name: 'CHOIR STATIC',     desc: 'At high RELIC the carried minds hum under your words. Some people hear it and trust you more. Some run.' },
  steel_memo:    { name: 'STEEL MEMORY',     desc: 'You refuse to forget on other people’s schedule. Resists forced wipes; unlocks holding-a-package past its deadline.' },
  saint_freq:    { name: 'SAINT FREQUENCY',  desc: 'The tiers whisper that a courier once carried a man’s funeral across town for free. They let you do things.' },
};

export const PACKS = {
  widows_morning: {
    name: 'A WIDOW’S LAST MORNING', who: 'sealed for SERA',
    desc: 'Forty-one minutes: coffee, an argument about a lamp, sunlight at a bad angle. Her husband’s last morning, uploaded by him, unsent.',
    passive: 'While you carry someone’s tenderness, other people’s soften around you a little.',
    whisper: '…he left the lamp on. She’ll notice tonight. She notices everything now.',
  },
  elevator_grief: {
    name: 'GRIEF, TIER 38 (UNCLAIMED)', who: 'no next of kin',
    desc: 'A drowned-tier elevator man’s grief for the flood that took his floor. Nobody filed to receive it. It is riding with you, free of charge.',
    passive: 'His grief teaches cadence. Words sink less.',
    whisper: 'You learn it from me, courier. You sink, you float, you sink — that’s the tide of them.',
  },
  lantern_fire: {
    name: 'THE LANTERN FIRE (FRAGMENTED)', who: 'spliced — see testimony',
    desc: 'The night the lantern market burned. Three witnesses, three versions, one delivery address that keeps changing. Splice it and carry it.',
    passive: 'A contradiction is a handle. You can hold it two ways.',
    whisper: 'Who do you love more tonight — the sister, or the survivor?',
  },
  own_slice: {
    name: 'SEALDED SLICE — COURIER [REDACTED]', who: 'YOU (involuntary)',
    desc: 'Your own enlistment-day deletion, riding in your implant like a note in your own handwriting you can’t stop reading.',
    passive: 'You are carrying yourself. The hum never fully stops.',
    whisper: 'You always did leave the lamp on. Every life. Every time.',
  },
};

/* calibration archetypes: starting loadout + one early flavor difference */
export const CALIBS = {
  saint:   { name: 'THE SAINT',      blurb: 'You take their grief like weather. The tiers half-believe you’re holy.', traits: { empathy: 2 }, skill: 'saint_freq' },
  analyst: { name: 'THE ANALYST',    blurb: 'You carry minds the way a scalpel carries an edge. Clean. Readable. Cold.', traits: { lucidity: 2 }, skill: 'frost_read' },
  feral:   { name: 'THE RELIQUARY',  blurb: 'You keep too much. The dead talk over each other in you, and you’ve stopped minding.', traits: { relic: 2, defiance: 1 }, skill: 'choir_static' },
};

export function createGame(calib = 'saint') {
  const c = CALIBS[calib] || CALIBS.saint;
  const traits = { empathy: 0, lucidity: 0, defiance: 0, relic: 0 };
  for (const k in c.traits) traits[k] = Math.max(0, Math.min(6, c.traits[k]));
  return {
    v: 1, calib,
    chapter: 1, chapterStep: 0, scene: null, node: null, line: 0,
    traits,
    skills: c.skill ? [c.skill] : [],
    flags: {},
    packs: {},          // id -> { mode?, deliveredTo?, }
    scars: [],          // strings shown in the epilogue
    log: [],            // rolling transcript tail (for save restore display)
    finished: false, ending: null,
    _sceneFx: false,
  };
}

/* --------------------------------------------------------------- queries - */
export function hasSkill(g, id) { return g.skills.includes(id); }
export function carrying(g) { return Object.keys(g.packs).filter(k => !g.packs[k].delivered); }
export function can(g, need) {
  if (!need) return true;
  if (need.trait) for (const t in need.trait) if (g.traits[t] < need.trait[t]) return false;
  if (need.skill && !hasSkill(g, need.skill)) return false;
  if (need.flag && !g.flags[need.flag]) return false;
  if (need.noFlag && g.flags[need.noFlag]) return false;
  if (need.pack && !g.packs[need.pack]) return false;
  if (need.noPack && g.packs[need.noPack]) return false;
  if (need.anyFlag && !need.anyFlag.some(k => g.flags[k])) return false;
  return true;
}
export function personaOf(g) {
  const t = g.traits;
  if (t.relic >= 5) return { id: 'choir', name: 'THE CHOIR', blurb: 'You are a room with a view of every life that ever rented it.' };
  if (t.empathy >= 5) return { id: 'saint', name: 'THE LANTERN SAINT', blurb: 'The flooded tiers say a courier once carried a whole funeral across town for free. They mean you.' };
  if (t.defiance >= 5) return { id: 'glitch', name: 'THE GLITCHSAINT', blurb: 'You lie to corp wardens in ciphers they can’t audit. The city files you under “force of nature.”' };
  if (t.lucidity >= 5) return { id: 'frost', name: 'THE FROST READER', blurb: 'You can tell a remembered moment from an invented one, and you have stopped offering that opinion for free.' };
  return { id: 'courier', name: 'THE COURIER', blurb: 'Still legible. Still one person, technically. The implant disagrees, gently.' };
}

/* ---------------------------------------------------------------- effects */
/* fx = { trait:{empathy:1}, skill:'x', skillRemove:'y', flag:{k:v}, scar:'txt',
         gain:'packId', deliver:{pack:'id', mode:'original'|'copy', to:'who'}, drop:'id',
         goto:'sceneId' } — returns UI events */
export function apply(g, fx) {
  const evs = [];
  if (!fx) return evs;
  if (fx.trait) for (const t in fx.trait) {
    if (!TRAITS.includes(t)) continue;
    const before = g.traits[t];
    g.traits[t] = Math.max(0, Math.min(6, before + fx.trait[t]));
    if (g.traits[t] !== before) evs.push({ t: 'trait', k: t, up: fx.trait[t] > 0, delta: g.traits[t] - before });
  }
  if (fx.skill && !g.skills.includes(fx.skill)) { g.skills.push(fx.skill); evs.push({ t: 'skill', id: fx.skill }); }
  if (fx.skillRemove && g.skills.includes(fx.skillRemove)) { g.skills = g.skills.filter(s => s !== fx.skillRemove); evs.push({ t: 'skillLost', id: fx.skillRemove }); }
  if (fx.flag) for (const k in fx.flag) {
    const v = fx.flag[k];
    if (v === false) delete g.flags[k]; else g.flags[k] = v;
  }
  if (fx.scar) { g.scars.push(fx.scar); evs.push({ t: 'scar', text: fx.scar }); }
  if (fx.gain && !g.packs[fx.gain]) { g.packs[fx.gain] = {}; evs.push({ t: 'gain', id: fx.gain }); }
  if (fx.drop && g.packs[fx.drop]) { delete g.packs[fx.drop]; evs.push({ t: 'drop', id: fx.drop }); }
  if (fx.deliver) {
    const p = g.packs[fx.deliver.pack];
    if (p) {
      p.delivered = fx.deliver.mode; p.to = fx.deliver.to;
      evs.push({ t: 'deliver', id: fx.deliver.pack, mode: fx.deliver.mode });
    }
  }
  for (const e of evs) g.log.push(e.t + ':' + (e.k || e.id || e.text || ''));
  if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
  return evs;
}

/* ---------------------------------------------------------- whispers feed */
export function whispersFor(g, sceneId) {
  const out = [];
  for (const id of carrying(g)) {
    const p = PACKS[id];
    if (p && p.whisper) out.push({ pack: id, text: p.whisper });
  }
  return out;
}

/* ----------------------------------------------------------------- saving */
export const SAVE_KEY = 'lumen-save-v1';
export function saveGame(g, storage) {
  try { if (storage) storage.setItem(SAVE_KEY, JSON.stringify(g)); } catch { /* private mode */ }
}
export function loadGame(storage) {
  try {
    const raw = storage ? storage.getItem(SAVE_KEY) : null;
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (!g || g.v !== 1 || !g.traits) return null;
    return g;
  } catch { return null; }
}
export function clearSave(storage) { try { if (storage) storage.removeItem(SAVE_KEY); } catch {} }


/* ═════════════════════ scene/node runner (pure) ════════════════════════
   A node = {lines:[[who,text]…], fx?, then?|choices?|goto?}. advance() walks
   lines; at node end: then → next node, goto → next scene, choices → wait for
   input, END → end of scene (caller advances the chapter backbone). */

export function enterScene(g, story, id) {
  const sc = story.SCENES[id];
  if (!sc) throw new Error('missing scene: ' + id);
  g.scene = id; g.node = sc.start || 'start'; g.line = 0;
  const ch = story.CHAPTERS[g.chapter - 1];
  const bi = ch ? ch.scenes.indexOf(id) : -1;
  if (bi >= 0) g.chapterStep = bi + 1;
  if (sc.fx && !g.flags['fx_' + id]) { apply(g, sc.fx); g.flags['fx_' + id] = 1; }
  nodeEnterFx(g, sc.nodes[g.node]);
  return g;
}
/* node-level fx = “on arrival, permanently”: applied once per (scene,node) */
export function nodeEnterFx(g, n) {
  if (!n || !n.fx) return;
  const k = 'nfx_' + g.scene + '.' + g.node;
  if (g.flags[k]) return;
  g.flags[k] = 1;
  apply(g, n.fx);
}
export function curNode(g, story) {
  const sc = story.SCENES[g.scene];
  return sc && sc.nodes[g.node];
}
export function visibleState(g, story) {
  const n = curNode(g, story);
  if (!n) return { mode: 'end' };
  const lines = n.lines || [];
  if (g.line < lines.length) return { mode: 'line', node: n, line: lines[g.line], total: lines.length };
  if (n.choices) return { mode: 'choices', node: n, line: null, total: lines.length };
  return { mode: 'end', node: n, line: null, total: lines.length };
}
/* consumes the shown line; on the last line resolves then/goto/choices/end */
export function advance(g, story) {
  const n = curNode(g, story);
  if (!n) return {};
  const lines = n.lines || [];
  if (g.line < lines.length) g.line++;
  if (g.line < lines.length) return {};
  if (n.choices) return {};
  if (n.then && n.then !== 'END') { g.node = n.then; g.line = 0; nodeEnterFx(g, curNode(g, story)); return {}; }
  if (n.goto) return { goto: n.goto };
  return { sceneEnd: true };
}
export function choiceAt(g, story, idx) {
  const n = curNode(g, story);
  const c = n && n.choices && n.choices[idx];
  if (!c) return { ok: false };
  if (!can(g, c.need)) return { ok: false, locked: true };
  const evs = apply(g, c.fx);
  let out = { ok: true, evs };
  const then = c.then;
  if (then === 'END' || !then) { out.sceneEnd = true; }
  else if (then.startsWith('goto:')) { out.goto = then.slice(5); }
  else { g.node = then; g.line = 0; nodeEnterFx(g, curNode(g, story)); }
  return out;
}
export function finishScene(g, story) {
  const ch = story.CHAPTERS[g.chapter - 1];
  if (!ch) return { done: true };
  if (g.chapterStep >= ch.scenes.length) return { chapterDone: true };
  g.chapterStep++;
  const nextId = ch.scenes[g.chapterStep - 1];
  enterScene(g, story, nextId);
  return { next: nextId };
}
export function nextChapter(g, story) {
  g.chapter++; g.chapterStep = 0;
  const ch = story.CHAPTERS[g.chapter - 1];
  if (!ch) { g.finished = true; return { done: true }; }
  enterScene(g, story, ch.scenes[0]);
  return { next: ch.scenes[0], chapter: g.chapter };
}
