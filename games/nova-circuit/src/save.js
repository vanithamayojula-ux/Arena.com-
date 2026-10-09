// localStorage persistence: settings, pilot profile, records and championship progress.
const KEY = 'nova-circuit.v1';

export const DEFAULTS = () => ({
  name: 'PILOT',
  p1: { ship: 'viper', livery: 0 },
  p2: { ship: 'razor', livery: 1 },
  settings: { music: 0.55, sfx: 0.8, quality: 'auto', cam: 'chase', fps: 0 },
  setup: { track: 0, laps: 3, rivals: 4, difficulty: 1, combat: 1 },
  records: {}, // trackId -> { lap, race: { laps: time } }
  career: { races: 0, wins: 0, kills: 0, titles: 0 },
  champ: null,
});

export function load(storage = globalThis.localStorage) {
  const d = DEFAULTS();
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return d;
    const j = JSON.parse(raw);
    for (const k of Object.keys(d)) {
      if (j[k] === undefined) continue;
      d[k] = d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && j[k] ? { ...d[k], ...j[k] } : j[k];
    }
  } catch { /* corrupt save: fall back to defaults */ }
  return d;
}

export function save(data, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* storage full / private mode */ }
}

/** Update personal bests; returns which ones were beaten. */
export function recordResult(data, trackId, laps, bestLap, raceTime) {
  const r = (data.records[trackId] ||= { lap: null, race: {} });
  const out = { lap: false, race: false };
  if (isFinite(bestLap) && (r.lap === null || bestLap < r.lap)) { r.lap = bestLap; out.lap = true; }
  if (isFinite(raceTime) && (r.race[laps] === undefined || raceTime < r.race[laps])) { r.race[laps] = raceTime; out.race = true; }
  return out;
}
