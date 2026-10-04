# APEX — The Cretaceous Chase

A top-down arcade game about being the biggest thing in the valley — and still
having to *catch* dinner. Play as a tyrannosaur, run herds to exhaustion, fill a
hunting quota each wave, and fend off a raptor pack that steals your kills.

Everything is procedural: the terrain, the dinosaurs, the particles and the
sound are all generated at runtime. **No image or audio assets are shipped.**

## Play

```
npm start          # or: node server.js
```

Then open http://localhost:5173 (the server binds 0.0.0.0 for the live preview).

## Controls

| Input | Action |
| ----- | ------ |
| `W A S D` / arrows | move |
| `Shift` | sprint (burns stamina) |
| `Space` / click | bite |
| mouse | aim your jaws |
| `P` / `Esc` | pause |
| `M` | mute |

Touch devices get an on-screen joystick plus **RUN** / **BITE** buttons.

## The loop

- **Herd AI.** Gazelles, parasaurs and triceratops flock with separation /
  cohesion / alignment, spot you inside a sight radius, and flee. Fleeing burns
  *their* stamina too — a blown animal slows to a stumble, and that is your
  window.
- **Quota waves.** Catch the quota before the timer runs out; each wave is
  faster, sharper-eyed and more demanding.
- **Rivals.** A raptor pack hunts the same herds, steals kills, and bites back.
  Triceratops take three bites and will gore you if you get greedy.
- **Survival meters.** Hunger ticks away constantly (eat to restore it), health
  is your life, stamina gates sprinting. Any of hunger, health or the clock
  ending the run is game over.
- **Combo.** Quick successive catches multiply your score, up to x8.

## Feel & feedback

Movement and rendering are tuned so the hunt reads and *feels* alive:

- **Weighty-but-responsive rex.** Sprint builds up on a ramp instead of snapping,
  a bite is a short lunge that closes distance, and the body banks into turns.
- **Living herds.** Prey meander while grazing and flee in serpentine zig-zags
  (tightest in panic), blowing their stamina so chases end in a stumble.
- **Layered dinosaur art.** Base silhouette + belly shadow + dorsal highlight +
  outline, with gait, head-bob, speed-tied tail swish and sprint stretch.
- **Ground feedback.** Fading footprints, water ripples when wading, rustled
  leaves in ferns, dust, animated water shimmer and sprint speed-lines.
- **Readable valley.** Sparse, translucent tree canopies so the chase is never
  hidden under foliage.

## Structure

| File | Purpose |
| ---- | ------- |
| `index.html` / `styles.css` | shell + HUD / menu styling |
| `src/main.js` | DOM wiring, HUD adapter, resize, frame loop |
| `src/game.js` | waves, herding orchestration, bite resolution, camera, draw |
| `src/entities.js` | player / prey / raptor AI, particles, float text |
| `src/world.js` | procedural terrain + pre-rendered ground/canopy layers |
| `src/render.js` | vector dinosaur rendering (no image assets) |
| `src/audio.js` | synthesised SFX via WebAudio |
| `src/input.js` | keyboard / mouse / touch |
| `src/config.js` | every tuning number |
| `server.js` | dependency-free static server |
| `tests/` | headless simulation + entry-point tests (`node --test`) |
| `tools/` | software rasteriser + previews to actually look at the art |

## Test

```
npm test
```

Runs the real simulation headlessly (movement model, herd stamina, bite cone,
wave/quota, game-over conditions, pause, scenery collision) plus a boot test of
the actual `src/main.js` entry point.

## Inspecting the art (no browser needed)

```
node tools/render-preview.mjs
```

renders the bestiary, a simulated gameplay frame and the terrain to
`art/*.png` using a tiny software rasteriser in `tools/raster.mjs`.
