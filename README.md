# Umbral Tide

**A first-person exploration mystery set in Vaelune — a half-sunken, bioluminescent city that only surfaces during solar eclipses.**

You are the Archivist: the one who stayed awake. Vaelune sank with the sun eaten out of
the sky, and it comes back the same way — for the few minutes of an eclipse, and only for
as long as somebody remembers it truly. Six of its people are still down there, each
holding one fragment of the city's final day. Listen to them, and the city starts to
remember itself: awnings and voices return to the market row, a lamp begins to turn in the
observatory, released lanterns climb out of the amphitheatre — and the memories that cost
something to hold leave things behind that would rather you put your light out.

This repository is a **playable vertical slice**: one eclipse, six memories, an ending.

```
python3 -m http.server 8000        # then open http://localhost:8000
```

No build step, no bundler, no network calls at runtime. Three.js is vendored in
`vendor/three/` and every texture, model, sound and note of music in the game is
generated procedurally while it loads — there is not a single binary asset in the repo.

---

## Controls

| key | |
|---|---|
| **W A S D** | wade, walk, swim |
| **mouse** | look (click to capture the pointer; click-and-drag works if the page refuses to lock) |
| **arrow keys** | walk and steer, if you have no mouse |
| **shift** | hurry — only where the water is shallow |
| **space** | step up / rise in water / climb out onto a ledge |
| **C** | dive (swimming) |
| **E** (hold) | listen to a memory |
| **F** | raise the lantern — oil burns, shadows recoil |
| **TAB** | the journal: memories restored |
| **ESC** | pause |

## What the slice does

- **Six districts** built from nothing but arithmetic: the drowned plaza and its orrery,
  the market row, the observatory island, the amphitheatre, the temple of tides, and the
  sea-gates — joined by five avenues and reachable by walking, wading, swimming or
  hauling yourself out of deep water.
- **Six memories**, each with a speaker, three spoken lines and a journal page. Holding
  **E** near a spectral inhabitant plays their fragment and *changes the world*:
  - `the market` — stalls, awnings, produce and a crowd of voices come back to the market row
  - `the sky` — the observatory dome turns and its lamp sweeps the water; the rune-work wakes
  - `the song` — lanterns released forty years late rise out of the amphitheatre galleries
  - `the bargain` — the temple's veins pulse red, the water is stained, and shadow-things spawn
  - `the sealing` — the sea-gates grind open, the drowned quarter lights up, the tide jumps
  - `the final day` — the orrery spins up and the whole city brightens (gated behind the other five)
- **A tide that answers you.** Every restored memory raises the water 13 cm; opening the
  sea-gates adds another 35 cm. Routes you walked dry at the start are chest-deep by the end.
- **Dark memories spawn hostile shadows** that stalk you, drain your lucidity on contact,
  and dissolve if you hold the lantern on them long enough. Lucidity at zero means waking
  up back on the plaza — lighter, and no further along.
- **The eclipse clock.** Coverage and totality deepen with every fragment restored; the
  world cools, the stars come out, and the city starts to glow from underneath.
- **An ending.** Restore all six and totality arrives: the city goes under whole, and lit,
  with all its voices inside.

## Technical shape

| module | what it owns |
|---|---|
| `src/main.js` | boot, the frame loop, the eclipse clock, memory flow, states, finale |
| `src/city.js` | the whole city: 6 districts, 5 avenues, landings, ruins, the ground-height field |
| `src/effects.js` | the furniture that returns with each memory (stalls, crowds, lanterns, churn) |
| `src/specters.js` | the six shards and the ones who remember them |
| `src/shadows.js` | hostile shadows: stalking, lantern recoil, contact, banishment |
| `src/player.js` | first person: wading, swimming, diving, mantling, stairs, lantern, oil |
| `src/post.js` | the watercolour-over-realism pass chain (Kuwahara, paper, wet ink, bloom, grade) |
| `src/sky.js` | the eclipse: sun with a bite out of it, corona, stars, spores |
| `src/water.js` | the tide surface: bioluminescence, wakes, footsteps, the stain of dark memories |
| `src/textures.js` | every texture in the game, drawn into canvases at load time |
| `src/audio.js` | the score and the soundscape, synthesised live in WebAudio |
| `src/content.js` | all the writing: districts, memories, journal pages, the ending |
| `src/ui.js` | HUD, journal, subtitles, prompts |
| `src/rng.js` | seeded noise, so Vaelune is the same city every time |

**The art direction is a system, not an asset pipeline.** The world is built from
realistically lit PBR surfaces (roughness maps, normal maps, a real shadow-casting sun,
ACES tone mapping, bloom), and then a post pass paints *over* it: an edge-preserving
Kuwahara simplify flattens detail into washes of colour, a fibre-grained paper texture
multiplies across the frame, a Sobel gradient pulls wet-ink lines out of the luminance,
and the grade keeps the shadows blue and the lit windows warm. Realistic lighting, painted
surface — the two halves of the brief, kept in separate layers so either can be pushed.

**Performance.** All static geometry is merged per material (a whole district is a couple
of draw calls); crowds, lanterns, mist, spores and particles are one `Points` draw call
each; the water is a single displaced plane. The renderer drops its pixel ratio
automatically if frames get expensive.

## Development

```
python3 -m http.server 8000                 # play
node tests/wiring.mjs                       # imports/exports/DOM ids all line up
node tests/smoke.mjs                        # builds the whole world headlessly and walks it
```

`tests/` stubs the DOM (including canvas 2D and WebAudio) so the entire procedural world
can be constructed and simulated in Node. The smoke test builds the city, walks an
autopilot player from the plaza to all six districts with real input events, and proves
every memory is reachable. See `tests/README.md` for the one-line setup.

## Where this goes next

The slice is deliberately shaped like the first act of something larger: Vaelune is one
of nine eclipsed cities in the same tideline, each with its own district set, its own
bargain and its own cost for remembering. `docs/design.md` has the full pitch — the loop,
the systems, the art direction, the audio design, and what a full-length version adds.

## Credits

Engine: [three.js](https://threejs.org) r180 (MIT), vendored unmodified in `vendor/three/`
with its licence. Everything else — geometry, textures, music, writing, code — is
generated at runtime by the files in `src/`.
