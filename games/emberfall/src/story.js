// Aggregates the tour. Content lives in storyA (prologue, ch1) and storyB (ch2, ch3,
// endings); this file is the spine the director reads, and the shape the story test
// asserts against.

import { GAME, FRAGMENTS, PROLOGUE, CHAPTER1 } from './storyA.js';
import { CHAPTER2, CHAPTER3, ENDINGS, TITLE_BLURB, HOWTO, LEDGER_NOTE } from './storyB.js';

export const CHAPTERS = [PROLOGUE, CHAPTER1, CHAPTER2, CHAPTER3];
export { GAME, FRAGMENTS, ENDINGS, TITLE_BLURB, HOWTO, LEDGER_NOTE };

export function beatsOf(step) {
  switch (step.type) {
    case 'vignette':
    case 'campfire':
      return step.beats || [];
    case 'negotiation': {
      const n = step.npc;
      return [...(n.intro || []), ...(n.winBeats || []), ...(n.loseBeats || []),
        ...((n.endgame?.choices || []).flatMap((c) => [...(c.beats || []), ...(c.loseBeats || [])]))];
    }
    case 'watch':
      return [...(step.arena.intro || []), ...(step.arena.winBeats || []), ...(step.arena.loseBeats || [])];
    case 'fight':
      return [...(step.fight.intro || []), ...(step.fight.winBeats || []), ...(step.fight.loseBeats || []), ...(step.fight.after || [])];
    case 'performance':
      return [...(step.show.outroWin || []), ...(step.show.outroFlop || [])];
    default:
      return [];
  }
}

function beatListFx(beats, report, where, fragIds) {
  for (const bt of beats) {
    if (!bt) { report.errors.push(`${where}: null beat`); continue; }
    report.beats++;
    const fx = typeof bt === 'object' ? bt.fx : null;
    if (fx?.fragment) {
      if (!fragIds.includes(fx.fragment)) report.errors.push(`${where}: unknown fragment "${fx.fragment}"`);
      else if (fragIds._seen) fragIds._seen.add(fx.fragment);
    }
    if (typeof bt === 'object' && bt.tx === undefined && bt.set === undefined && bt.choices === undefined) {
      report.warnings.push(`${where}: beat without text, set, or choices`);
    }
  }
}

// Walks every chapter/step/branch for the headless test — returns a report.
export function validateStory() {
  const report = { steps: 0, beats: 0, encounters: 0, errors: [], warnings: [] };
  const fragIds = Object.keys(FRAGMENTS);
  fragIds._seen = new Set();
  CHAPTERS.forEach((ch) => {
    if (!Array.isArray(ch.steps) || !ch.steps.length) { report.errors.push(`${ch.id}: no steps`); return; }
    ch.steps.forEach((st) => {
      report.steps++;
      const where = `${ch.id}/${st.type}`;
      beatListFx(beatsOf(st), report, where, fragIds);
      if (st.type === 'road' && st.route) {
        const r = st.route;
        if (!(r.len > 0)) report.errors.push(`${where}: road has no length`);
        if (!(r.burn > 0)) report.errors.push(`${where}: road has no burn`);
        for (const e of r.encounters || []) {
          report.encounters++;
          if (!e.prompt || !e.prompt.choices?.length) report.errors.push(`${where}: encounter without choices`);
          else for (const c of e.prompt.choices) {
            if (c.go && !['next', 'sing', 'fight'].includes(c.go)) report.errors.push(`${where}: unknown encounter jump "${c.go}"`);
            if (c.set?.fragment) {
              if (!fragIds.includes(c.set.fragment)) report.errors.push(`${where}: encounter grants unknown fragment "${c.set.fragment}"`);
              else fragIds._seen.add(c.set.fragment);
            }
          }
        }
        for (const gl of r.glimmers || []) {
          if (gl.kind === 'fragment' && !fragIds.includes(gl.id)) report.errors.push(`${where}: glimmer fragment "${gl.id}" unknown`);
          else if (gl.kind === 'fragment') fragIds._seen.add(gl.id);
        }
      }
      if (st.type === 'performance') {
        const sh = st.show;
        if (!sh.acts?.length) report.errors.push(`${where}: show has no acts`);
        (sh.acts || []).forEach((a, ai) => {
          if (!['tap', 'hold', 'pattern'].includes(a.kind)) report.errors.push(`${where}: act ${ai} kind "${a.kind}"`);
          if (!(a.bpm > 0) || !(a.bars > 0)) report.errors.push(`${where}: act ${ai} bad bpm/bars`);
        });
        for (const ev of sh.events || []) {
          if (!(ev.atAct >= 0) || ev.atAct >= sh.acts.length) report.errors.push(`${where}: event on unknown act`);
          for (const c of ev.choices || []) {
            if (c.set?.flag) fragIds._seen && 0; // flags are free-form
          }
        }
      }
      if (st.type === 'negotiation') {
        const n = st.npc;
        const tones = Object.keys(n.lines || {});
        if (!tones.length) report.errors.push(`${where}: npc has no lines`);
        for (const k of tones) if (!Array.isArray(n.lines[k]) || !n.lines[k].length) report.errors.push(`${where}: tone "${k}" empty`);
        if (!(n.guard > 0)) report.errors.push(`${where}: npc has no guard`);
        if (!(n.exchanges > 0)) report.errors.push(`${where}: no exchange count`);
        if (!n.endgame?.choices?.length) report.errors.push(`${where}: no endgame`);
      }
      if (st.type === 'watch') {
        const a = st.arena;
        if (!(a.duration > 20)) report.errors.push(`${where}: watch too short`);
        if (!(a.lamps >= 3 && a.lamps <= 6)) report.errors.push(`${where}: lamp count out of ring range`);
      }
      if (st.type === 'fight' && !(st.fight.exchanges >= 3)) report.errors.push(`${where}: fight must be brief but not trivial`);
      void where;
    });
  });
  // every fragment must be reachable in a playthrough
  for (const id of fragIds) {
    if (!fragIds._seen.has(id)) report.errors.push(`fragment "${id}" is unobtainable`);
  }
  return report;
}
