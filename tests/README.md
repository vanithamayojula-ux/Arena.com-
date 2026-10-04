# Tests

Umbral Tide has no bundler and no runtime dependencies, but its world is pure arithmetic,
so the whole game can be built and simulated in Node with a stubbed DOM. That is what
these two scripts do.

## Setup (one line)

The game's modules import `three` as a bare specifier, which the browser resolves with the
import map in `index.html`. Node needs a real package for it. Point one at the vendored
copy:

```sh
mkdir -p node_modules/three
ln -s "$PWD/vendor/three/build"    node_modules/three/build
ln -s "$PWD/vendor/three/examples" node_modules/three/examples
printf '{"name":"three","version":"0.180.0","type":"module","exports":{".":"./build/three.module.js","./addons/*":"./examples/jsm/*"}}' > node_modules/three/package.json
```

(`npm i three@0.180.0` in the repo root works just as well, but it downloads what the repo
already vendors.)

## `node tests/wiring.mjs`

Static check: every `import` resolves to a file that exists, every named import is actually
exported by its target (including the vendored three addons), every DOM id the UI touches
exists in `index.html`, the vendor addon directories are present, and no `window.__` debug
globals or TODOs are left in `src/`.

## `node tests/smoke.mjs`

The real thing. It stubs:

- `document.createElement('canvas')` with a 2D context that records nothing but never
  throws, so every procedural texture in `src/textures.js` is genuinely executed;
- `window` with an event registry, so the player can be driven with synthetic keydowns;
- `AudioContext` as absent, so `Soundscape` exercises its own "no audio device" paths.

Then it:

1. imports all fourteen modules and constructs sky, water, city, specters, shadows, player;
2. checks the generated world — the plaza is walkable, every shard anchor floats above its
   local floor, no plate is `NaN`, merged meshes have geometry;
3. simulates **60 seconds of the whole world at 60 Hz** (including spawning shadows,
   restoring memories and rising the tide) and asserts the player never becomes
   non-finite and never falls out of the world;
4. drives an **autopilot player** from the plaza to all six districts using synthetic
   input, under both flat water and a 1.2 m risen tide, and reports the travel time;
5. runs a **flood-fill reachability proof** over the ground-height field with the same
   movement rules the player obeys (0.55 m step-up, any drop, any water, mantle out onto
   anything within arm's reach of the surface) and asserts every district and every
   fragment is reachable.

That last test is the reason the city's staircases, avenue landings and mantle exist:
it caught four districts being walled off from the plaza and an invisible lid over the
amphitheatre.

## `npx eslint src/` (optional)

`eslint.config.mjs` in the repo root is deliberately tiny — it checks for undefined
identifiers, unreachable code, duplicate keys and bad `typeof`, which is what actually
catches bugs in a codebase this size. It needs `eslint` and `globals` installed
(`npm i -D eslint globals`) but nothing in the game imports them.

## `node tests/map.mjs`

Prints an ASCII map of the whole city sampled out of `city.groundHeight()` — deep water,
the drowned basin, wading depth, dry stone, platforms and tiers, with the six memories
numbered. It is the quickest sanity check after moving anything: the plaza should sit in
the middle with five avenues radiating out to the districts, and every memory number
should be sitting on something you can stand on.

## `node tests/terrain.mjs`

The ground itself, checked directly. This is the suite that catches "the terrain feels
broken" bugs, and it earned its keep: it found the player walking *into* walls, being
dragged to the bottom of deep water instead of floating, buildings that overlapped into
unclimbable corners, and an invisible 3 m shelf that shadowed the whole temple.

It checks:

1. **Settling** — 3000+ walkable cells, player dropped above each one: never falls through,
   never hovers over dry stone.
2. **Walking** — 48,000 frames of randomised walking: the player's feet never end up below
   the floor they are standing on.
3. **Buildings** — walking at 157 buildings from four directions never gets you inside;
   dropped inside one, you always get out.
4. **Water** — in the drowned plaza basin the player floats at the surface (eye 0.12 m above
   the waterline), and can always haul themselves back onto the ring.
5. **Shards** — all six memory anchors sit within interaction range of ground the player can
   stand on.
6. **Sanity** — most of the walkable city is dry at low tide.

## `node tests/tutorial.mjs`

Onboarding, checked as behaviour rather than as copy. It asserts that the title screen and
prologue actually state what the game is, who you are and what you do (the prologue must
mention *hold E*, *tide*, *shadow* and *remember*); that the opening lesson names the market
row and then asks for **E**; that each contextual hint fires exactly once — including the
awkward ones (the mantle hint only when you are genuinely stuck against a ledge in water,
the low-oil warning only once per tank, re-arming after a refill); and that a two-minute
session never repeats a hint more than twice.
