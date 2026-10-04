// ── Vaelune: the last day, told in six fragments ─────────────────────────────
// `effect` ids are consumed by main.js / world modules to mutate the environment.
// `kind` drives colour, audio and danger:  warm | still | dark | self

export const CITY = {
  name: 'Vaelune',
  waterLevel: 0.0,
  tidePerMemory: 0.13, // the city sinks a little further with every memory restored
  fogNear: 12,
  fogFar: 165,
};

export const DISTRICTS = {
  plaza:       { label: 'the sunken plaza',   at: [0, 0],      ground: 0.15 },
  market:      { label: 'the market row',     at: [58, 0],     ground: -0.55 },
  observatory: { label: 'the light-keepers',  at: [-66, -56],  ground: 0.42 },
  amphitheatre:{ label: 'the amphitheatre',   at: [66, -58],   ground: -0.9 },
  temple:      { label: 'the temple of tides',at: [-68, 58],   ground: 0.2 },
  floodgate:   { label: 'the sea-gates',      at: [66, 62],    ground: 0.6 },
};

export const MEMORIES = [
  {
    id: 'market',
    order: 1,
    title: 'The Last Market',
    speaker: 'Ila, who sold figs',
    district: 'market',
    kind: 'warm',
    shardAt: [63, 3.2, 2],
    accent: 0xffb066,
    effect: 'market',
    lines: [
      'Figs. Last of the season, last of everything, and still no one haggled.',
      'I told them: bring a lamp, bring a song, bring anything that floats.',
      'The stalls were loud that morning. I want it loud again.',
    ],
    journal:
      'The market opened at dawn although the sky had a bite taken out of it. Ila stacked figs nobody would pay for, because the counting was the point. Sailors bought nothing and stayed all day.',
    toast: 'Somewhere along the row, a stall-holder starts shouting the price of figs.',
    whisper: 'voices, haggling, the clack of crates',
  },
  {
    id: 'sky',
    order: 2,
    title: 'The Watching Sky',
    speaker: 'Solem, astronomer of the lamp',
    district: 'observatory',
    kind: 'still',
    shardAt: [-66, 3.4, -56],
    accent: 0x9fd8ff,
    effect: 'sky',
    lines: [
      'I charted every eclipse for forty years. This one I could not name.',
      'When the shadow touched the water, the city began to glow — as though we had always been lit from underneath.',
      'I turned the lens on Vaelune instead of the sun. I wanted a last look, not a forecast.',
    ],
    journal:
      "Solem's log, final day: totality three bells past noon; the tide-mark rising faster than any instrument predicted. The astronomer gave up the sky to watch his own streets go dark.",
    toast: 'Far off, a lamp turns and sweeps the water — the city can see itself again.',
    whisper: 'brass ticking, a lens turning',
  },
  {
    id: 'song',
    order: 3,
    title: 'The Last Song',
    speaker: 'Sera of the lower gallery',
    district: 'amphitheatre',
    kind: 'still',
    shardAt: [66, 2.0, -58],
    accent: 0xc9b6ff,
    effect: 'song',
    lines: [
      'They asked me to sing so the crowd would not hear the water coming up the steps.',
      'I sang the harbour song. Four verses. The fifth was for the ones who would not leave.',
      'Sing it back to me, and I will know the city is still in there somewhere.',
    ],
    journal:
      'Sera sang from the flooded stage while the tide climbed the aisles. She never finished the fifth verse. The lanterns her audience released are still rising.',
    toast: 'Lanterns, released forty years late, drift up out of the galleries.',
    whisper: 'a melody, half-remembered',
  },
  {
    id: 'bargain',
    order: 4,
    title: 'The Bargain',
    speaker: 'Ondine, tide-priest of the drowned stair',
    district: 'temple',
    kind: 'dark',
    shardAt: [-68, 5.1, 58],
    accent: 0xff7a9c,
    effect: 'bargain',
    lines: [
      'You will want someone to blame. Blame me. I signed it gladly.',
      'The tide offered to keep us: safe below, unfading. Only a city that remembers itself may surface.',
      'So we paid in light — a city\u2019s worth of it. That is why the water glows when it moves.',
    ],
    journal:
      'The bargain: Vaelune would descend whole, into the tide\u2019s keeping, in exchange for its light. The dark memories cost more to hold, so they sank deepest.',
    toast: 'Something dark uncoils from the temple steps and starts looking for you.',
    whisper: 'a signature, a pen pressed too hard',
  },
  {
    id: 'sealing',
    order: 5,
    title: 'The Sealing',
    speaker: 'Kesh, warden of the sea-gates',
    district: 'floodgate',
    kind: 'dark',
    shardAt: [66, 2.4, 62],
    accent: 0xff8f6a,
    effect: 'sealing',
    lines: [
      'I closed the sea-gates on the order. Half the lower quarter was still walking home.',
      'I heard them on the other side of the wood. Then I stopped hearing them, and heard the tide instead.',
      'Do not tell me the gate was kinder than the flood. Open it. Let the water have what it was owed.',
    ],
    journal:
      'The warden closed the gates at the priests\u2019 order, drowning the lower quarter to buy the rest of the city an hour. Opening them now raises the tide; the debt is owed either way.',
    toast: 'The sea-gates grind open. The tide comes in to take what it was promised.',
    whisper: 'wood swelling, water on the other side of a door',
  },
  {
    id: 'self',
    order: 6,
    title: 'The Final Day',
    speaker: 'the Archivist — that is, you',
    district: 'plaza',
    kind: 'self',
    shardAt: [0, 1.4, 0],
    accent: 0x8ffbe0,
    effect: 'self',
    lines: [
      'I was the one who stayed awake. Someone had to keep the record while the city slept.',
      'Every eclipse the water thins, I walk the streets again — and lose all of you again, one memory at a time.',
      'Remember it with me. Then let it rest. Then let me rest.',
    ],
    journal:
      'The Archivist\u2019s own page: Vaelune surfaces at every eclipse for as long as one of its people remembers it truly. This entry has been rewritten so many times the ink is gone.',
    toast: 'The orrery turns. The whole city is listening.',
    whisper: 'your own voice, thinner than you remember',
  },
];

export const memoryById = (id) => MEMORIES.find((m) => m.id === id);

/* ── the pitch, told in three panels before the player takes a step ── */
export const PREVIEW = {
  eyebrow: 'an eclipse-city requiem',
  tagline: 'Vaelune only surfaces during a solar eclipse.\nYou have until totality to remember it.',
  premise: [
    'A half-sunken city of lamps and markets, glowing from underneath, that appears only during a solar eclipse — and only while somebody remembers it truly.',
    'You are the Archivist, the one who stayed awake. Six of Vaelune\u2019s people are still down there, each holding one fragment of its final day.',
  ],
  cta: 'Enter the eclipse',
};

export const PROLOGUE = [
  {
    title: 'Vaelune',
    kicker: 'the city',
    lines: [
      'Vaelune was a trading city on a shallow shelf of the sea, lit by oil lamps and bioluminescent weeds.',
      'It sank in a single afternoon, with the sun eaten out of the sky \u2014 and it comes back the same way.',
      'Only during an eclipse. Only while somebody remembers it truly.',
    ],
  },
  {
    title: 'The Archivist',
    kicker: 'you',
    lines: [
      'Someone had to stay awake and keep the record, so the city would have a way back up.',
      'That is you, and it has been you for a long time. You walk Vaelune once per eclipse, and lose a little of it every time.',
      'Six of its people are still down there, holding the last day between them. They cannot tell you what happened \u2014 they can only remember it at you.',
    ],
  },
  {
    title: 'What you do',
    kicker: 'the work',
    lines: [
      'Walk the city and find the light of a fragment. Stand close, hold E, and listen until it gives.',
      'What you remember comes back: the market returns as stalls, awnings and voices. The observatory lamp turns again.',
      'Something dark costs something to hold: those memories leave shadows behind that would rather you put your lamp out.',
      'The tide rises with every fragment you restore. By totality the city goes under \u2014 whichever city you have rebuilt.',
    ],
  },
];

/* ── the first two things to do, stated plainly ── */
export const OPENING_GOALS = [
  'follow the compass to the market row',
  'stand in the light and hold E to listen',
];

/* ── contextual hints: shown at the moment the key matters ── */
export const HINTS = {
  move: 'W A S D to wade \u00b7 move the mouse to look \u00b7 shift to hurry on dry stone',
  swim: 'space to rise \u00b7 C to dive \u00b7 space at a ledge to haul yourself out',
  mantle: 'hold space to haul yourself out of the water',
  lantern: 'F raises the lantern \u2014 oil burns, and shadows will not come near the light',
  lowOil: 'the oil is running low',
  tide: 'the tide comes up with every memory you restore',
  journal: 'TAB opens the journal: what you have remembered, and what is still missing',
  lost: 'lucidity gone \u2014 you wake on the plaza, lighter than before',
};

export const FINALE = {
  title: 'Totality',
  lines: [
    'The sun closes. For a moment the city is lit only by what it kept.',
    'Every voice you gave back rises at once out of the water — the market, the lamp, the song, the gate.',
    'Vaelune goes under whole, and lit, and singing. It does not struggle. It never did.',
    'You stay a moment longer than you should. That is allowed. That is the whole point of an Archivist.',
  ],
  epilogue:
    'The water closes over the plaza.\nThe eclipse ends. The sun comes back for the ordinary world.\n\n' +
    'Somewhere under the tide a city keeps its lamps on,\nwaiting for the next shadow to thin the water.',
  card: 'UMBRAL TIDE — for everyone who kept a light on',
};
