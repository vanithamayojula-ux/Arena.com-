# Umbral Tide — design document

> *Vaelune only surfaces when the sun is eaten. You have until totality to remember it.*

---

## 1. The pitch

A first-person exploration mystery set in a half-sunken, bioluminescent city that appears
only during solar eclipses. You collect fragmented memories from spectral inhabitants and
reconstruct the city's final day — and the environment reacts to what you choose to
remember. Restore a memory of the market and the stalls, the hawking, the smell of figs
all come back. Restore something darker and the city gives you something back that would
rather you put your light out.

**Genre:** first-person exploration / environmental mystery. No combat, no fail state you
can't walk out of. Runtime of this vertical slice: 25–40 minutes.

**The one-line hook:** *the world is rebuilt out of what you remember, and remembering
costs light.*

## 2. Design pillars

1. **Memory is the level editor.** Every collectible you restore visibly rewrites the
   space you are standing in. Restoring is not a progress bar; it is a build action.
2. **The tide is the clock.** Water is time. What you can walk through at the start you
   swim through at the end — the same place, played twice, differently.
3. **Light is a resource and a risk.** The lantern lets you see and pushes dark things
   back, but it burns oil and it is how the city finds you. Curiosity costs light.
4. **Beauty and grief in the same frame.** Watercolour over realism, warm lamps over cold
   water, a soft melancholic score under something that is following you.
5. **Nobody explains the mystery.** There is no lore dump. Six people tell you what
   happened in six fragments, and the player assembles the last day themselves.

## 3. The loop

```
            ┌──────────────────────────────────────────────────────────┐
            │  surface (eclipse begins) → the city appears, lit from    │
            │  underneath, the water thin and walkable                  │
            └───────────────────────────┬──────────────────────────────┘
                                        ▼
   explore a district  ──►  find the one who is still here  ──►  hold E: listen
        ▲                                                              │
        │                                                              ▼
        │                                        ┌──── the city changes ────┐
        │                                        │ stalls + voices return    │
        │                                        │ a lamp sweeps the water   │
        │                                        │ lanterns rise             │
        │                                        │ veins pulse, shadows spawn│
        │                                        │ gates open, quarter lit   │
        │                                        └──────────────┬───────────┘
        │                                                       ▼
        └────── tide rises 13 cm · oil refilled · the journal records it ──────┘
                                        │
                        all six restored ─► totality: the city goes under whole
```

### Session shape

| beat | what the player is doing | what the city is doing |
|---|---|---|
| 0–3 min | learning to walk, wade, and read the compass; the first shard is 60 m away | partial eclipse, fog, cold |
| 3–12 min | two or three warm/still memories; districts start returning to life | stall lanterns, crowds, the observatory lamp |
| 12–25 min | the two dark memories; shadows are stalking; lantern oil is the pressure | the water stains, danger swells, the score turns |
| 25–35 min | the final fragment; the tide is now the main obstacle | near-totality, everything glows, the orrery turns |
| ending | one choice: remain in the memory, or let the water close | totality |

## 4. World: Vaelune

A trading city of thirteen districts built on a shallow shelf, drowned in a single
afternoon. Six are reachable in the slice.

| district | state when you arrive | what the memory does to it |
|---|---|---|
| **the drowned plaza** | a 16 m ring of dry stone around a 5 m deep basin; an orrery on the basin floor; the Archivist's statue with a lamp that never goes out | the orrery spins up, rings turning faster than they should |
| **the market row** | a 15 m wide flooded street; blown-out arcades; the awnings gone | stalls, striped awnings, crates of produce, nine hawkers' lanterns and forty-six standing voices |
| **the light-keepers** (observatory island) | a raised rock disc with a broken dome and a telescope aimed at nothing | the dome turns, the lens lamp sweeps the water; the rune-work on the moon-wall wakes |
| **the amphitheatre** | the stage and the four lowest galleries underwater; the top rim dry | ninety lanterns rise out of the galleries, forty years late |
| **the temple of tides** | four ascending tiers, the drowned stair running down into the flood, a hooded figure in the shrine | the walls' veins pulse red; the water is stained where the bargain was signed |
| **the sea-gates** | two towers, a seized winch, a drowned quarter behind the doors | the gates grind open, the quarter lights up under the water, the tide jumps 35 cm |

Beyond them: 190 procedural ruin-blocks in the fog, half-sunk rooftops all the way to the
skyline, wrecks with their masts still up, a lighthouse that is definitely not drowned
(and does not answer), and a boundary of fog that gently insists you go back.

### The ground-height field

The city is a set of flat plates — rectangles, circles, rings and ramps — and the player's
ground is the *highest plate under them*. That single rule is what makes a stair, a tier,
a bridge and a riverbank all work with the same code, and it is what the tests walk
through to prove every memory is reachable.

## 5. The six memories

Each is an entity: a shard floating where they are, and a figure who turns to face you.

| # | title | speaker | kind | reward | cost |
|---|---|---|---|---|---|
| 1 | The Last Market | Ila, who sold figs | warm | stalls, crowds, warm lanterns | — |
| 2 | The Watching Sky | Solem, astronomer | still | the observatory lamp and its beam | — |
| 3 | The Last Song | Sera of the lower gallery | still | released lanterns, the stage lights | — |
| 4 | The Bargain | Ondine, tide-priest | **dark** | the temple's truth; the water takes a red stain | two shadows |
| 5 | The Sealing | Kesh, gate-warden | **dark** | the gates open; the drowned quarter glows | the tide rises 35 cm, shadows at the gates |
| 6 | The Final Day | the Archivist — you | self | the orrery, the city at full brightness | gated behind the other five |

**The story, assembled by the player.** The tide offered Vaelune safety: descend whole and
undecaying, in exchange for its light. The priests signed. The gates were shut on the
lower quarter to buy the rest of the city an hour. What is left below is a city that keeps
its lamps on, waiting for the next shadow to thin the water — and one Archivist who stayed
awake to keep the record, losing everyone a little more with every eclipse.

## 5b. Onboarding — teaching a game with no HUD tutorial

The brief for this game is atmospheric and oblique, which is exactly the kind of game that
loses players in its first three minutes. The rule adopted: **the game speaks at the moment
a key starts to matter, and then shuts up.**

| when | what the player is told | how |
|---|---|---|
| title screen | what Vaelune is, that it appears during eclipses, who the Archivist is | premise paragraphs beside the controls |
| on "Enter the eclipse" | the whole premise properly: the city, you, and the work | three-panel prologue, space/click to advance, skippable |
| play begins | *follow the compass to the market row* | objective card, paper-mapped to the nearest fragment |
| within 9 m | *stand in the light and hold E until the ring fills* | objective card + keycap prompt |
| first wade | the movement keys | hint strip |
| first swim | space to rise, C to dive, space at a ledge to haul yourself out | hint strip |
| pressed against a ledge | *hold space to haul yourself out* | hint strip, 1.2 s after you get stuck |
| first shadow | F raises the lantern, and nothing dark comes near the light | hint strip |
| tank under 30% | the oil is running low | hint strip |
| first restoration | the tide comes up with every memory you restore | hint strip |
| second restoration | TAB opens the journal | hint strip |
| any time | the full reference, three columns | **H** |

Every hint fires once per session (oil re-arms after a refill), the compass nudge repeats
at most twice, and nothing is ever explained while the player is mid-interaction. The
opening lesson is a state machine in `src/tutorial.js` rather than being tangled into the
frame loop, which is what makes it testable — see `tests/tutorial.mjs`.

## 5c. Legibility — the rules that keep it playable

An eclipse-lit watercolour city is one bad decision away from being unplayable, so these
are treated as hard rules rather than taste:

1. **A shaft of light marks every unrestored fragment.** 46 m tall, additive, visible from
   the far side of the city, fading out within 7 m so it never sits in the middle of the
   view. The compass gives bearing and distance; the beam gives "over there".
2. **The eclipse dims the world; it never blinds it.** Totality costs ~30% of the ambient
   light and a fraction of the colour, not the 70%+ that "atmospheric" would normally mean.
3. **Brightness is the player's, not the designer's.** A default lifted well above the
   original grade, a slider in three places, remembered between sessions, and a post-pass
   that *lifts the darks* as it rises instead of just blowing out the highlights.
4. **Nothing important is only conveyed by contrast.** Interactables are also announced by
   a prompt, a ring, a sound and a beam, so a player on a bad monitor still gets there.
5. **Fog is for distance, not for the middle distance.** Density tuned so silhouettes stay
   readable to ~150 m and the drowned skyline still reads as a skyline.

## 6. Systems

### 6.1 Memory restoration
Walk within 7 m of a shard, look at it, hold **E** for 3.3 s. Progress is shown as a ring
and as the speaker's three lines, typed in live. Completing it: a burst of particles, a
ripple through the water, a 4.4 s "reverie" in which the journal page is read to you and
you cannot move, then the district changes around you.

### 6.2 The tide (difficulty curve)
`tide = 0.13 m × memories restored (+0.35 m once the gates are open)`.
Water is free to enter and slow to cross; the deep basin is a swim. Nothing is ever
*blocked* by the tide, but the city's shortcuts drown one by one.

### 6.3 Water traversal
- **Wade** — up to 1.35 m: movement slows up to 62%, footsteps become splashes.
- **Swim** — deeper: the body floats with the eye just above the waterline, space rises,
  **C** dives. Diving is the only way to see the drowned lower city under your feet.
- **Mantle** — space at a ledge hauls you out of deep water onto anything within 2.6 m of
  the waterline. This is what keeps open water from ever being a trap, and it is why the
  six districts connect.

**Terrain rules the whole game obeys** (all four are enforced by `tests/terrain.mjs`):

1. The floor under you is the highest plate covering you, and it may pull you *down* at most
   0.6 m and push you *up* at most 0.55 m per step. Anything taller than that is a wall you
   cannot walk through — so you never end up inside a tier.
2. While swimming, the floor may shove you up out of it but never drag you down: the tide
   always wins, and you always float.
3. Collision pushes are applied in clamped steps over several iterations, because Vaelune's
   buildings overlap; jumping to the nearest face just lands you inside the next one.
4. If the solver ever has you more than a metre inside geometry for two seconds, you are put
   back on the last spot that was clean. No wedge is ever permanent.

### 6.4 Lucidity and the lantern
Lucidity is your grip on the memory you are walking through. Proximity to a shadow drains
it; proximity to a restored memory restores it. At zero you wake on the plaza with 42% —
the gentlest possible failure state, and one that is diegetic.

The lantern (**F**) is oil-metered (≈29 s of light). Restoring a memory refills it. Shadow
creatures recoil in its cone; hold it on one for 1.5 s and it dissolves for ~30 s. Using
it attracts company.

### 6.5 The eclipse
Coverage runs 0.42 → 1.0 across the run, driven by both restored memories and elapsed
time. As totality deepens: hemi/sun lights fall, exposure rises slightly, the fog thickens,
stars and spores brighten, the horizon glow under the water strengthens, and the post pass
takes colour out of the frame. Totality *is* the finale.

## 7. Art direction — watercolour meeting realism

The brief asks for two things that normally fight: watercolour paint, and realistic
lighting. The solution is to keep them in different layers of the render.

**Layer 1 — realism.** PBR surfaces with procedurally generated albedo, roughness and
normal maps; a directional sun with real shadow mapping; ACES filmic tone mapping; fog
that is part of the lighting model; a physically-motivated water shader with fresnel and
multiple scrolling normal layers; emissive materials for windows, veins and runes, all
bloomed by UnrealBloom in linear HDR.

**Layer 2 — paint.** A chain of passes that treats the render as a wet painting:
1. **Kuwahara simplify** — four quadrant means at two scales, weighting the flattest
   region, which flattens texture noise into washes of colour while keeping edges.
2. **Wet-ink outline** — a Sobel gradient over luminance, multiplied into the frame and
   tinted cold-teal, the way ink pools at the edge of a wash.
3. **Fibre paper grain** — a generated paper texture (fibres, blotches, low-frequency
   staining) multiplied over the frame and drifting imperceptibly.
4. **Grade** — cold shadows, warm highlights, a little desaturation where the eclipse is
   deepest, vignette, and danger bleeding in from the corners of the frame.

Underwater is the same pass with a distortion wobble, a teal push and a low-pass on the
audio bus — the two layers moving together.

**Palette:** deep teal water (`#08161d` → `#16414a`), bioluminescent mint (`#5ff0cf`),
lamp amber (`#ffb066`), shrine rose (`#ff5f7e`), eclipse slate (`#14303a`).

## 8. Audio design — everything synthesised

No audio files. The whole score is WebAudio voices built at runtime.

- **Beds:** brown-noise sea under a low-pass, wind through galleries, and a three-voice
  sub-bass hum (41.2 / 61.7 / 82.4 Hz) that *is* the tide.
- **Music:** a four-chord progression (Am7 – Fmaj7 – Cmaj7 – G6), 18 s per chord, played
  by five slow pad voices through a filter that opens as the city is restored, plus sparse
  pentatonic piano-like strikes every 6–15 s. Restoring a memory brightens the pad
  permanently; the finale plays a drone swell instead.
- **Voices:** whispers are formant-filtered noise bursts, three to seven syllables long,
  panned wide, drenched in the sampler-built reverb.
- **Diegetic tells:** each shard carries its own spatial drone (dark memories at 78 Hz,
  warm ones rising with memory order), so you can find a fragment by ear before sight.
- **Physical language:** footsteps change filter and decay between stone and water; the
  sea-gates are three detuned saws sliding from 46 to 28 Hz over seven seconds; the
  heartbeats are a 62→34 Hz thump pair whose interval tightens with danger.

## 9. Technical architecture

```
index.html ─ importmap ──► vendor/three (r180, unmodified)
   │
   └─ src/main.js   boot · frame loop · eclipse clock · memory flow · states · finale
        ├── sky.js        dome shader: sun/corona/rim, stars, spores
        ├── water.js      1600 m displaced plane: fresnel, ripples, wakes, stain
        ├── city.js       districts, avenues, landings, ruins → merged meshes + plates
        │     └── effects.js  memory furniture and one-draw-call particle systems
        ├── specters.js   six shards, six figures, echo crowds, spatial drones
        ├── shadows.js    stalking entities, lantern recoil, banish, drain
        ├── player.js     wade/swim/dive/mantle, stairs, collision, lantern, oil
        ├── post.js       RenderPass → Bloom → Watercolour → OutputPass
        ├── ui.js         HUD, journal, subtitles, prompts, endings
        └── content.js    all writing
```

**Rules the code keeps:** everything procedural and seeded (the same city every run);
relative paths only (it runs from any subdirectory, including GitHub Pages); no build
step; all static geometry merged per material; particles as single `Points` draws; and a
ground-height field that is the single source of truth for what the player stands on.

**Testing without a browser.** Because the world is pure arithmetic, the whole game can be
built in Node with a stubbed DOM. `tests/smoke.mjs` constructs every module, simulates a
minute of the world at 60 Hz, then drives an autopilot player — with synthetic keydown
events — from the plaza to all six districts under two different tide levels, and runs a
flood-fill reachability proof over the ground field.

## 10. What a full-length version adds

- **Nine cities on the tideline**, each with its own bargain and its own cost of
  remembering; the Archivist travels between eclipses by boat.
- **Memory as a currency of consequence:** restored fragments can be *spent* to keep a
  city surfacing rather than kept, so remembering one place means letting another sink.
- **A choice of what Vaelune becomes:** the six fragments are enough for the truth, but
  not for a verdict. Whose version of the last day the city keeps is the endgame.
- **Deeper traversal:** diving becomes a full mode (breath, pressure, currents), with the
  drowned lower quarter as a second, darker map under the first.
- **A cast that remembers you:** NPCs who appear only in restored districts, who comment
  on the order you chose, and who can be re-listened to for new lines.
- **A photo/memory-scrapbook mode:** the watercolour pass becomes a physical page the
  player can keep, curate and compare.
