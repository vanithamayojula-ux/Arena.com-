import { buildTrack } from '../src/track.js';
import { TRACKS } from '../src/trackdefs.js';
import { Race, ROSTER } from '../src/sim.js';

export const tracks = TRACKS.map(buildTrack);

export function aiRacers(n = 6, extra = {}) {
  return ROSTER.slice(0, n).map((r, i) => ({ name: r.name, ship: r.ship, livery: r.livery, skill: 0.6, ...extra }));
}

export function makeRace(trackIdx = 0, opts = {}) {
  const racers = opts.racers || aiRacers(opts.n || 6);
  return new Race({ track: tracks[trackIdx], racers, laps: opts.laps ?? 2, seed: opts.seed ?? 7, mode: opts.mode ?? 'race', combat: opts.combat ?? true, difficulty: opts.difficulty ?? 1, instantStart: opts.instantStart });
}

export function run(race, seconds, dt = 1 / 60, each) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) { race.step(dt); if (each) each(race, i); }
}
