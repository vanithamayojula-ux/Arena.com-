// The travelling ledger: every number the story cares about lives here.
// Scenes mutate state through `G.spend`, `G.bond`, `G.flag` so the epilogue and the
// save file always agree. Safe to import headless (localStorage is feature-detected).

export const OIL_MAX = 100;
export const SAVE_KEY = 'emberfall.save.v1';

export function freshState() {
  return {
    chapter: 0,          // index into CHAPTERS
    step: 0,             // index into the current chapter's steps
    oil: 62,             // lantern fuel — the road's clock
    silver: 14,          // coin, spent on tolls and bribes
    morale: 55,          // the troupe's spirit
    rep: 8,              // how the roads speak of the Lantern Troupe
    relit: 0,            // lamps the troupe saved across the world
    lostLamps: 0,        // lamps that went dark while the troupe watched
    shows: 0,            // performances given
    ovations: 0,         // standing ovations
    bonds: { dill: 46, bram: 48, fenn: 42 },   // 0..100 trust of each player
    trust: 52,           // the troupe as a whole trusts its prompter (Vera)
    flags: {},           // narrative flags ('toldTruth', 'sangAway', ...)
    fragments: {},       // collected lore fragments id -> true
    wickGift: false,     // Ashvale's spare wick for the Sunkey (one free relight)
    injury: null,        // 'bram' etc. if someone took a bad night
    muted: false,
    log: [],             // epilogue ticker: human-readable ledger lines
  };
}

export function hasLocal() {
  try { return typeof localStorage !== 'undefined' && localStorage; } catch (e) { return false; }
}

export function saveState(s) {
  if (!hasLocal()) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      chapter: s.chapter, step: s.step, oil: s.oil, silver: s.silver,
      morale: s.morale, rep: s.rep, relit: s.relit, lostLamps: s.lostLamps,
      shows: s.shows, ovations: s.ovations, bonds: s.bonds, trust: s.trust,
      flags: s.flags, fragments: s.fragments, wickGift: s.wickGift,
      injury: s.injury, muted: s.muted, log: s.log.slice(-40),
    }));
  } catch (e) { /* private mode: the tour forgets, as most things do */ }
}

export function loadState() {
  if (!hasLocal()) return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    const s = freshState();
    Object.assign(s, d);
    s.bonds = Object.assign({ dill: 46, bram: 48, fenn: 42 }, d.bonds || {});
    s.flags = d.flags || {};
    s.fragments = d.fragments || {};
    s.log = d.log || [];
    return s;
  } catch (e) { return null; }
}

export function wipeSave() {
  if (!hasLocal()) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

export function bondMin(s) {
  const b = s.bonds;
  return Math.min(b.dill, b.bram, b.fenn);
}

export function bondAtLeast(s, who, v) {
  return s.bonds[who] >= v;
}

export function addLog(s, line) {
  s.log.push(line);
  if (s.log.length > 60) s.log.shift();
}

// Which ending the tour earns. Pure function of state so the test can pin it.
export function computeEnding(s) {
  const b = bondMin(s);
  const hope = s.relit * 2 + s.ovations * 3 + b + s.trust + (s.flags.sangAway ? 12 : 0) + (s.flags.gaveOil ? 8 : 0);
  if (s.flags.beaconDark) return 'silence';
  if (hope >= 108 && b >= 50) return 'chain';
  if (s.flags.foughtMoths && s.morale < 42) return 'sorrow';
  return 'sorrow';
}

export const ENDING_TITLES = {
  chain: 'THE CHAIN OF SMALL SUNS',
  sorrow: 'SORROW, SPONSORED',
  silence: 'THE SIXTH SILENCE',
};
