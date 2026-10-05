/**
 * Word pools grouped by length tier so the difficulty curve can be
 * controlled precisely. All lowercase, A-Z only, no ambiguous punctuation.
 */

export const TIER_SHORT = [
  "zip","fox","jam","key","vim","web","sun","map","ace","bit","gig","hex","ion","jet","kin","log","mix","nod","opt","pop","quo","rim","sec","tap","urn","vox","wax","yea","zen","arc","bay","cob","dew","elf","fab","gap","hub","ivy","jig","kit","lab","mud","nab","orb","pax","rug","sky","tug","van","wig","yes","zoo","app","bug","code","dash","echo","fast","glow","hue","idle","java","kilo","link","mint","node","opus","ping","quit","rune","sync","type","unit","volt","warp","xeno","yarn","zero","byte","chip","data","enum","flux","grid","host","idea","join","keep","lash","mesh","next","open","pipe","quad","root","site","task","user","view","wifi","zoom","algo","bold","clip","dock","edge","font","gain","helm","icon","kbd","loop","mod",
];

export const TIER_MEDIUM = [
  "accel","binary","canvas","vector","widget","plugin","socket","sprite","shader","thread","token","uptime","vertex","wizard","binary","chipset","cluster","compile","console","decoder","dynamic","emitter","firmware","gateway","handler","indexer","joystick","keyword","latency","machine","network","opacity","payload","quantum","runtime","sandbox","trigger","utility","verbose","wildcard","adapter","blazing","capture","datamax","entropy","feature","gravity","horizon","inertia","jumping","kinetic","lightup","monitor","neutron","overlay","picture","quality","reflect","shields","turbo","unlock","vibrant","wavelet","xylophone","yield","zenith","arcade","blaster","cascade","diamond","eclipse","fusion","glitch","harmony","impulse","jackpot","krypton","luminar","momentum","nova","oxygen","photon","quartz","rocket","stellar","tornado","ultra","vortex","whirl","astral","bionic","cosmic","driver","electro","fathom","gatling","hypers","ionize","jettison","kepler","lightspeed","meteor","nebula","orbit","plasma","quasar","radiant","subspace","teleport","uplink","velocity","wavelength","xray","yielding","zeppelin",
];

export const TIER_LONG = [
  "achievement","asteroidbelt","bioshocker","circuitry","debugging","electrify","frequency","graviton","holograms","interface","juxtapose","kinematics","lightyear","megabytes","navigation","oscillate","pixelated","quaternion","reactors","satellite","transistor","ultrasonic","virtuality","wavelength","xenophobe","zerogravity","accelerator","battleship","cybernautic","dodecahedron","electromagnet","firewalling","gyroscope","hypertunnel","interstellar","juggernaut","kilobytes","labyrinth","microchip","neurolink","observator","projectile","quantified","resonance","synthesis","teleporter","universe","vaporizing","warpdrive","xenosphere","yottabyte","zephyrus","algorithmic","brilliance","calibration","destructive","efficiency","fortresses","generating","hexadecimal","illuminated","juxtaposed","kaleidoscope","lightning","multiplexer","nightshade","overclock","peripheral","quicksilver","reprogram","starfighter","turbulence","undertow","vertiginous","whirlwind","xenomorph","yellowish","zigzagging",
];

export const TIER_EPIC = [
  "extraordinary","supercalibrate","unbelievable","revolutionize","instrumentation","photoluminescent","counterintuitive","interchangeable","microcontroller","telecommunications","overquantization","disproportionate","thermodynamic","unpredictability","systematization","electroencephalogram",
];

const ALL = [...TIER_SHORT, ...TIER_MEDIUM, ...TIER_LONG, ...TIER_EPIC];

export const ALL_WORDS = Array.from(new Set(ALL.map((w) => w.toLowerCase())));

export type Tier = 0 | 1 | 2 | 3;

/** Pick a random word from a weighted blend of tiers for a given level (1-based). */
export function pickWord(level: number, used: Set<string>): string {
  // Blend shifts toward longer words as the game progresses.
  const t = Math.min(level, 10);
  const weights = [
    Math.max(1, 12 - t * 1.1), // short
    4 + t * 0.5, // medium
    t >= 3 ? 1 + (t - 3) * 0.9 : 0, // long
    t >= 7 ? (t - 6) * 0.7 : 0, // epic
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  const pools = [TIER_SHORT, TIER_MEDIUM, TIER_LONG, TIER_EPIC];

  for (let attempt = 0; attempt < 30; attempt++) {
    let r = Math.random() * total;
    let pool = pools[0];
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) {
        pool = pools[i];
        break;
      }
      r -= weights[i];
    }
    const w = pool[(Math.random() * pool.length) | 0];
    if (!used.has(w)) return w;
  }
  // Fallback: any unused word from the global list.
  const free = ALL_WORDS.filter((w) => !used.has(w));
  if (free.length) return free[(Math.random() * free.length) | 0];
  return ALL_WORDS[(Math.random() * ALL_WORDS.length) | 0];
}
