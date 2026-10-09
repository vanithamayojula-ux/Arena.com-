// The four circuits of the Nova Circuit championship. Each is a turtle program
// (see track.js) plus an art-direction block consumed by the renderer.

import { LAYOUTS } from './layouts.js';
import { SOLVED } from './solved.js';

export const TRACKS = [
  {
    id: 'frostline',
    scale: 1.7,
    name: 'FROSTLINE RUN',
    place: 'Kryos Asteroid Belt',
    blurb: 'Wide ice-field sweepers under a curtain of aurora. The perfect place to learn how fast you can really go.',
    difficulty: 1,
    laps: 3,
    bank: 150,
    ops: null,
    art: {
      seed: 11,
      palette: { base: '#07182b', grid: '#3fd8ff', accent: '#9bf4ff', rail: '#58e6ff', gate: '#7be9ff', glow: '#bff7ff' },
      sky: { a: '#02050f', b: '#0b3a6b', c: '#26e0c4', sun: [0.55, 0.35, -0.75], sunColor: '#cfefff', sunSize: 0.012, nebula: 1.4, aurora: 1.0 },
      fog: { color: '#05152b', density: 0.00055 },
      light: { sun: '#dff4ff', ambient: '#35557a' },
      scatter: [
        { type: 'rock', count: 420, color: '#9fc3de', min: 8, max: 46, near: 70, far: 700, emissive: '#0c2b45' },
        { type: 'crystal', count: 110, color: '#8ae9ff', min: 14, max: 60, near: 90, far: 500 },
      ],
      planet: { pos: [-1700, 500, -2400], radius: 900, color: '#3b78c8', color2: '#8fc4f5', ring: true },
      gateEvery: 70,
    },
  },
  {
    id: 'helios',
    scale: 1.2,
    name: 'HELIOS FURNACE',
    place: 'Orbit of the Dying Star Vael',
    blurb: 'Skim the corona of a red giant. A monster loop, a plunge toward the sun, and molten debris everywhere.',
    difficulty: 2,
    laps: 3,
    bank: 150,
    ops: null,
    art: {
      seed: 23,
      palette: { base: '#1a0707', grid: '#ff7a1c', accent: '#ffd25e', rail: '#ff5a1a', gate: '#ff9a3a', glow: '#ffe6a8' },
      sky: { a: '#080106', b: '#6b0f10', c: '#ff7a14', sun: [-0.25, 0.28, -0.93], sunColor: '#ffb870', sunSize: 0.09, nebula: 1.0, aurora: 0 },
      fog: { color: '#220707', density: 0.0007 },
      light: { sun: '#ffc78a', ambient: '#5a2418' },
      scatter: [
        { type: 'rock', count: 460, color: '#5a2a1c', min: 8, max: 54, near: 70, far: 760, emissive: '#ff4a0a', emissiveAmt: 0.55 },
        { type: 'spire', count: 90, color: '#ff6a18', min: 20, max: 80, near: 90, far: 500 },
      ],
      sun: { pos: [-900, 700, -3600], radius: 1300, color: '#ff8a2a' },
      gateEvery: 64,
    },
  },
  {
    id: 'nebula',
    scale: 1.6,
    name: 'NEBULA CORKSCREW',
    place: 'The Veil Nebula',
    blurb: 'Twisting gates through a violet storm. Barrel-roll corkscrews, crystal spires and a drop that steals your stomach.',
    difficulty: 3,
    laps: 3,
    bank: 160,
    ops: null,
    art: {
      seed: 37,
      palette: { base: '#12062a', grid: '#c04dff', accent: '#ff7bf0', rail: '#e050ff', gate: '#ff5fd0', glow: '#ffc4fb' },
      sky: { a: '#050010', b: '#2a0b5e', c: '#ff3fb4', sun: [0.2, 0.55, -0.8], sunColor: '#ffd0f8', sunSize: 0.018, nebula: 2.0, aurora: 0.35 },
      fog: { color: '#160a33', density: 0.0007 },
      light: { sun: '#f1d0ff', ambient: '#43286e' },
      scatter: [
        { type: 'crystal', count: 300, color: '#d57cff', min: 18, max: 90, near: 80, far: 650 },
        { type: 'rock', count: 220, color: '#5b3a8a', min: 8, max: 40, near: 80, far: 700, emissive: '#3a0a66' },
        { type: 'ring', count: 7, color: '#ff6fe0', min: 160, max: 260, near: 200, far: 520 },
      ],
      planet: { pos: [1900, -300, -2800], radius: 700, color: '#ff4fc0', color2: '#4b1d9a', ring: false },
      gateEvery: 58,
    },
  },
  {
    id: 'station',
    scale: 1.3,
    name: 'STATION ZERO TRENCH',
    place: 'Dreadnought Mauler, Fleet Graveyard',
    blurb: 'A flat-out trench run through a dead warship while the fleet battle rages overhead. Double loops. No mercy.',
    difficulty: 4,
    laps: 3,
    bank: 150,
    ops: null,
    art: {
      seed: 53,
      palette: { base: '#0a1210', grid: '#3dff9a', accent: '#ff4d4d', rail: '#31f5a0', gate: '#ff4a52', glow: '#c8ffe2' },
      sky: { a: '#010504', b: '#0a2a3a', c: '#3dc9ff', sun: [0.0, 0.5, -0.86], sunColor: '#d4f4ff', sunSize: 0.02, nebula: 0.9, aurora: 0 },
      fog: { color: '#041016', density: 0.0008 },
      light: { sun: '#cfe9ff', ambient: '#2b4a52' },
      scatter: [
        { type: 'tower', count: 520, color: '#26363a', min: 30, max: 190, near: 56, far: 420, emissive: '#2dffb0' },
        { type: 'rock', count: 120, color: '#3a4a50', min: 8, max: 34, near: 120, far: 640, emissive: '#06201a' },
      ],
      planet: { pos: [1500, 900, -3000], radius: 800, color: '#2a6a8a', color2: '#9ad8ff', ring: false },
      battle: true,
      gateEvery: 62,
    },
  },
];

for (const t of TRACKS) t.ops = SOLVED[t.id] || LAYOUTS[t.id];
