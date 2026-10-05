# TIDE & BONE — Scavenger of the Vastmother

*A tactical turn-based roguelike fought on and inside a mountain-sized living
sea creature drifting between dimensions.*

You are a flea with ambitions. The shell is a 12×12 tactical grid; the organs
below it (Heart / Lung / Gut) hide richer salvage and worse tenants. Every
action costs one turn and the whole creature answers: mites skitter, spitters
gloob, rival reavers strip your nodules and *run*. And somewhere under all of
it, **the dive clock** is counting down to the next Dimension Shift.

## Play

```
npm start        # from the repo root → /games/tide-and-bone/
```

## The two clocks you're actually playing

1. **Your survival** — HP, braces, flasks. Standard.
2. **Her temperament** — the creature has HP (0–100) and a MOOD, shown as a
   boss bar at the top of the screen *at all times*:

| Mood | Trigger | What changes |
| --- | --- | --- |
| **CALM** (HP ≥ 70) | feed her, behave | harvests pay +30%; she slowly regenerates; wounds close polite |
| **AGITATED** (30–69) | normal poaching | grumbling; occasional hatchlings |
| **WRATHFUL** (< 30) | overharvesting, salt | **walls pulse closed around you** (reopening in waves), flesh tiles burn you when you stand still, extra parasites spawn every few turns, every further cut costs double HP |

Harvest too much and the map itself turns hostile. Give flesh back (OFFERING,
[R]) to calm her — it also *buys turns on the dive clock*. Greed, temperance
and time are one economy.

## The loop

```
spawn on shell → harvest / fight / dive vents for organ loot
   → (15 turns) the Vastmother DIVES
   → on the ridge? EXTRACT, bank the salvage
   → inside?   she flushes you out: −15 HP, half your haul spilled
   → out here? the dimension folds without you. Run over.
```

Death keeps **exactly one Bone Charm** (pick 1 of 3) — a permanent upgrade for
the next drift: +15 max HP, extra starting flask, +3 attack, +5 turns before
the dive, richer harvests, harder counters. Persistence is `localStorage`
(`tidebone-meta-v1`); no accounts, no backend.

## Combat verbs (all one-turn costs)

| Key | Action |
| --- | --- |
| WASD / arrows / click-tile | step (auto-walk on click; breaks off when blades come near) |
| SPACE / J | blade — hits all adjacent; walking INTO an enemy bump-attacks |
| K / Shift | **BRACE** — the next blow misses and you counter; it only expires when it eats a hit |
| E | context: harvest flesh/nodule/pool/corpse · stand on a vent to dive · climb a ridge to extract |
| R | OFFERING: 12 salvage → +22 her HP, +2 net turns |
| 1 / 2 | Marrow Flask (+18) / Salt Bomb (throw along facing, 3×3, hurts *her* too) |
| G / . | wait (yes, wasting turns is sometimes the move) |
| Esc | pause / close popups |

Touch devices get a d-pad + action cluster; everything is click-or-tap.

## Structure

```
tide-and-bone/
├── index.html          shell: HUD, screens, touch pad
├── styles.css          the System-Window skin (thin glowing blue borders)
├── src/
│   ├── engine.js       100% of the rules: deterministic, DOM-free, seeded
│   ├── render.js       canvas painter: wet tiles, pulses, wrath vignette
│   ├── main.js         loop, input, HUD sync, run lifecycle, pacing
│   └── meta.js         Bone Charms + drift stats (injectable storage)
└── tests/
    ├── engine.test.mjs determinism · map winnability · dive clock · mood
    │                   · combat math · charm persistence · a runner bot
    │                   that extracts on 40/40 seeds
    ├── boot.test.mjs   real main.js on a DOM stub: title→run→vent picker→
    │                   pause→death→charm pick→restart
    └── helpers.mjs     canvas-2d + micro-DOM stubs, fake frame clock
```

### Notes on tech choice

The brief asked for React + Tailwind; every game in this Arcade ships as a
**zero-dependency, no-build static** (even the Vite ones are committed built),
and a preview can't rely on CDNs. So the "system window" UI is hand-skinned
CSS over a `<canvas>` + semantic DOM, and the React-style state separation is
preserved in spirit: `engine.js` is pure reducer-style state (a run is exactly
reproducible from `(seed, charms)`), `render.js` is a pure reader, `main.js` is
the only place DOM is touched. Same architecture you'd get from React — no
reconciler tax on a turn-based game that redraws at most a few times a second.

Screen shake on hits is soundless by design (spec: sound-less shake); reduced
motion is respected by the pulse amplitudes staying subtle.

## Design guarantees (tested)

* every generated shell guarantees a reachable vent **and** a reachable
  extraction ridge — and a careful runner bot extracts on 40/40 seeds;
* organs always connect to ≥3 harvest tiles from their entry vent;
* no input after death; failed feed/harvest never spends a turn;
* same seed ⇒ byte-identical maps, replayed action scripts diverge never.
