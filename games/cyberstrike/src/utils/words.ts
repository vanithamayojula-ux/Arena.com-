export interface WordPack {
  id: string;
  name: string;
  description: string;
  words: {
    easy: string[];   // 3-4 letters
    medium: string[]; // 5-7 letters
    hard: string[];   // 8-11 letters
    boss: string[];   // 12+ letters or short phrases
  };
}

export const WORD_PACKS: WordPack[] = [
  {
    id: "cyberpunk",
    name: "Cyber Hacker",
    description: "Cyberpunk, network, database and hacking terminology",
    words: {
      easy: ["grid", "hack", "node", "byte", "core", "port", "link", "root", "ping", "data", "code", "host", "spam", "user", "leak", "void", "chip", "unix"],
      medium: ["cyber", "matrix", "vector", "kernel", "router", "phish", "trojan", "bypass", "buffer", "cookie", "script", "crypto", "subnet", "system", "packet", "cursor", "server", "upload", "online"],
      hard: ["firewall", "database", "database", "protocol", "quantum", "compiler", "terminal", "backdoor", "keylogger", "exploit", "firmware", "malware", "phreaking", "cybernet", "mainframe", "emulation", "overclock", "decryption", "encryption"],
      boss: [
        "SYNAPSE INTRUSION DETECTED",
        "ACCESS GRANTED BYPASS CORRUPT",
        "EXECUTE OVERRIDE PROTOCOL",
        "QUANTUM COMPUTER QUANTIZE",
        "INITIALIZE DEEP COGNITION LAYER",
        "ZERO DAY EXPLOIT LAUNCHED",
        "DISTRIBUTED DENIAL OF SERVICE",
        "ARTIFICIAL INTELLIGENCE CORE"
      ]
    }
  },
  {
    id: "scifi",
    name: "Cosmic Odyssey",
    description: "Space, astrophysics, spaceflight and futuristic sci-fi words",
    words: {
      easy: ["star", "moon", "void", "ship", "nova", "orbit", "warp", "mars", "hologram", "dust", "beam", "lens", "comet", "atom", "dark"],
      medium: ["nebula", "galaxy", "planet", "plasma", "meteor", "pulsar", "rocket", "cosmic", "shuttle", "engine", "gravity", "beacon", "quasar", "clones", "lander", "cyborg", "mutant", "thruster"],
      hard: ["hyperdrive", "astrophysics", "supernova", "exoplanet", "constellation", "spacecraft", "interstellar", "teleportation", "wormhole", "nanotech", "singularity", "propulsion", "multiverse", "terraform", "extraterrestrial"],
      boss: [
        "EVENT HORIZON COLLAPSE",
        "HYPERDRIVE ENGAGEMENT CONFIRMED",
        "WARP SPEED SPEED STRETCH",
        "SUPERMASSIVE BLACK HOLE ACTIVE",
        "ANTI GRAVITY MATRIX ENGINE",
        "EXTRATERRESTRIAL SIGNAL ENCODING",
        "INTERGALACTIC SYSTEM OVERLORD"
      ]
    }
  },
  {
    id: "coding",
    name: "Developer Edition",
    description: "Software engineering, programming languages, bugs and tools",
    words: {
      easy: ["bug", "git", "java", "html", "css", "loop", "array", "null", "bool", "file", "json", "dom", "ajax", "yaml", "rust", "push", "pull", "test"],
      medium: ["python", "docker", "react", "angular", "compile", "refactor", "commit", "branch", "lambda", "render", "object", "string", "number", "async", "await", "import", "export", "status", "deploy"],
      hard: ["javascript", "typescript", "kubernetes", "framework", "middleware", "recursion", "inheritance", "polymorphism", "callback", "stacktrace", "dependency", "concurrency", "deployment", "repository", "abstraction"],
      boss: [
        "STACK OVERFLOW ERROR RECOVERY",
        "PROMISE RESOLVE UNHANDLED REJECTION",
        "OUT OF MEMORY LEAK TERMINATED",
        "GIT PUSH FORCE ORIGIN MASTER",
        "ASYNCHRONOUS MUTATION OBSERVER",
        "PRODUCTION DEPLOYMENT SUCCESSFUL",
        "TEST SUITE COMPLETED WITH ERRORS"
      ]
    }
  },
  {
    id: "general",
    name: "Classic Arcade",
    description: "A wide mix of fun, active English words to test raw typing speed",
    words: {
      easy: ["fast", "jump", "fire", "cool", "epic", "dash", "rush", "zaps", "boom", "glow", "neon", "play", "game", "hero", "keys", "type", "wave", "vibe"],
      medium: ["arcade", "action", "crystal", "energy", "shadow", "flight", "fever", "hunter", "target", "shield", "dynamo", "spirit", "hazard", "sphere", "magnet", "plasma", "comet", "spark", "blitz"],
      hard: ["lightning", "championship", "accelerator", "destruction", "spectacular", "retrograde", "futuristic", "adrenaline", "synthesizer", "dimension", "atmosphere", "coefficient", "velocity", "turbulence", "equilibrium"],
      boss: [
        "MAXIMUM VELOCITY ACHIEVED",
        "CHAMPIONSHIP MATCH DECLARED",
        "NEON GLOW LIGHTNING STRIDE",
        "REACTIVE ADRENALINE INJECTION",
        "PERFECT TYPING COMBO UNLOCKED",
        "HIGH SCORE BREAKING ATTEMPT",
        "CRITICAL OVERDRIVE SYSTEM ONLINE"
      ]
    }
  }
];

export function getRandomWord(packId: string, level: "easy" | "medium" | "hard" | "boss"): string {
  const pack = WORD_PACKS.find(p => p.id === packId) || WORD_PACKS[0];
  const list = pack.words[level];
  return list[Math.floor(Math.random() * list.length)].toUpperCase();
}
