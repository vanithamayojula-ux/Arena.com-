// All the tunable numbers for the hunt live here.

export const WORLD = { w: 2600, h: 1900 };

export const PLAYER = {
  radius: 23,
  accelResponse: 1.5, // thrust = drag * maxSpeed * this, so the cap is reachable
  maxSpeed: 258,
  sprintMax: 452,
  turnRate: 11, // radians / sec
  drag: 7.2,
  staminaMax: 100,
  staminaDrain: 32,
  staminaRegen: 21,
  regenDelay: 0.85,
  biteRange: 92,
  biteArc: 1.7, // full cone, radians
  biteWindup: 0.1,
  biteStrike: 0.16,
  biteCooldown: 0.44,
  biteDamage: 2,
  hpMax: 100,
  hungerMax: 100,
  hungerDrain: 1.15,
  hungerPerCatch: 24,
  iFrames: 0.8,
};

export const PREY = {
  gazelle: {
    label: 'Gazelle',
    radius: 12,
    scale: 0.62,
    grazeSpeed: 46,
    fleeSpeed: 318,
    panicSpeed: 352,
    turnRate: 5.2,
    stamina: 2.1, // seconds of hard sprint before it blows
    recover: 2.6,
    hp: 1,
    points: 100,
    sight: 250,
    fleeAngle: 0.55,
    body: '#c8a46a',
    belly: '#e8d5ae',
    stripe: '#8a6a3a',
  },
  parasaurolophus: {
    label: 'Parasaur',
    radius: 17,
    scale: 0.92,
    grazeSpeed: 40,
    fleeSpeed: 262,
    panicSpeed: 296,
    turnRate: 4.1,
    stamina: 3.4,
    recover: 3.2,
    hp: 1,
    points: 180,
    sight: 230,
    fleeAngle: 0.42,
    body: '#8f9f63',
    belly: '#c3cb96',
    stripe: '#5f6f3c',
  },
  triceratops: {
    label: 'Triceratops',
    radius: 26,
    scale: 1.5,
    grazeSpeed: 32,
    fleeSpeed: 178,
    panicSpeed: 214,
    turnRate: 2.6,
    stamina: 5.2,
    recover: 4.4,
    hp: 3,
    points: 420,
    sight: 200,
    fleeAngle: 0.3,
    goreDamage: 16,
    body: '#7e8f6b',
    belly: '#a8b58d',
    stripe: '#4f5c42',
  },
};

export const RAPTOR = {
  radius: 15,
  scale: 0.74,
  speed: 300,
  sprint: 352,
  turnRate: 6.4,
  hp: 3,
  points: 250,
  sight: 320,
  contactDamage: 8,
  contactCooldown: 1.25,
  body: '#8c4a3c',
  belly: '#c08a6a',
  stripe: '#5d2c22',
};

export const HERD = {
  separation: 26,
  cohesion: 60,
  separationWeight: 2.4,
  alignmentWeight: 0.9,
  cohesionWeight: 0.5,
  neighbourRadius: 130,
};

export const WAVES = {
  baseQuota: 5,
  quotaPerWave: 2,
  baseTime: 48,
  timePerWave: 3,
  minTime: 32,
};

export const COMBO = {
  window: 3.6,
  max: 8,
};

export const COLORS = {
  grassBase: '#3f5c30',
  grassLight: '#587a3a',
  grassDark: '#2f4526',
  dirt: '#7a6642',
  water: '#2c5560',
  waterEdge: '#4a7f80',
  rock: '#6b6a63',
  rockDark: '#454540',
  tree: '#2f4a24',
  treeLight: '#476b32',
};
