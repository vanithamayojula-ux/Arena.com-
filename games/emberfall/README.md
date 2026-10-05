# Emberfall — The Lantern Troupe

A narrative action-adventure set in a world where the sun has permanently dimmed to "a sixpence
behind wet wool." You play the Lantern Troupe — four former soldiers of the disbanded 47th Light
Infantry, now travelling performers — touring the last lit settlements of a cold coast. Combat is
rare and brutal; almost every problem is solved with performance, negotiation, and stubborn
lamp-lighting. The tone mixes melancholy, dark humour and quiet hope.

Built with plain HTML, CSS and Canvas 2D ES modules. No frameworks, no assets, no build step —
every frame (including the repo's screenshots in `screenshots/`) is painted procedurally by the
same `src/art.js` painter the browser runs.

## Play

Serve the repo (`npm start` at the root) and open `/games/emberfall/`, or open `index.html`
through any static server. The hub at `/` also launches it in the in-hub player.

- **Begin the tour** to start from the Prologue; progress auto-saves per scene (localStorage).
- Four chapters and a dawn. Three endings, computed from lamps relit, bonds kept, and whether you
  shot first.

## The craft (controls)

| Scene | What you do |
| ----- | ----------- |
| Road | `A`/`D` or arrows to walk the cart road, `SPACE` to hustle. Oil burns while you travel; walk over glimmers to pick up caches and lore fragments. Encounters pause the tour for a choice. |
| Negotiation | Read the mood, answer it: **PROUD/ANXIOUS → WARM**, **GREEDY/HOSTILE → FIRM**, **SMUG → WIT**, **PIETY → READ**. Levers (✦) are one-shot arguments unlocked by earlier choices and bonds. Run out of moves and the endgame offers worse ones. |
| Performance | Three act types: juggling = taps (`D` `F` `J` on the line), aria = holds (press and sustain), illusions = answer Cinder's pattern. Keep the ten applause flames lit. Mid-show mishaps pause the music for a reactive choice. |
| Watch (the lamps) | Aim the Sunkey beam with the mouse, click guttered lamps to relight them (costs oil), `SPACE` to shove what grabs you. Get grabbed too long and you go dark — a bond decides who drags you out and what they say about it. |
| Fight | Once in the whole game, if you pick it. Four exchanges, no music, and the ledger remembers. |
| Campfire | Bond beats between chapters. Bonds open the best negotiation lines later. |

`ESC` opens the playbill (pause/ledger). The **LEDGER** button tracks lamps relit — the only
score that stays lit.

## Structure

```
games/emberfall/
├── index.html          # playbill shell: canvas + DOM dialogue UI
├── styles.css
├── src/
│   ├── main.js         # director: steps, save, cards, input routing
│   ├── story.js        # assembles CHAPTERS + the validator the test uses
│   ├── storyA.js       # prologue + chapter one content
│   ├── storyB.js       # chapters two–three, endings, card copy
│   ├── beats.js        # dialogue beat-runner (choices, flags, hops)
│   ├── art.js          # the painter: dusk skies, silhouettes, lamps, darkness compositing
│   ├── ui.js           # DOM layer (dialogue, prompt cards, HUD)
│   ├── audio.js        # small WebAudio synth (drone, ticks, fanfares)
│   ├── state.js        # the travelling ledger + ending maths + localStorage save
│   └── scenes/         # road, negotiation, performance, watch, fight, vignette
├── tools/
│   ├── painter.mjs     # headless software rasteriser (gradients + blend modes) + PNG encoder
│   └── shot.mjs        # renders screenshots/ frames from the real art module
└── tests/
    └── story.test.mjs  # story-graph validation + headless play of every scene type
```

## Test & frames

```sh
node --test games/emberfall/tests/story.test.mjs \
      games/emberfall/tests/soak.test.mjs           # same, plus the full-tour director soak
# (both run inside `npm test` at the repo root)
node games/emberfall/tools/shot.mjs                # regenerate screenshots/*.png
```

## Design notes

- **Failures are content.** Losing a negotiation, a show, or a Watch never ends the tour; it bills
  you in oil, morale, or a line of dialogue that stings. The game's tension is resource arithmetic
  (oil) against narrative debt (bonds).
- **Darkness is a paint layer.** Scenes draw lit geometry, then composite a black layer with
  radial holes cut out (`destination-out`) — which is also why the whole look survives the
  headless rasteriser used for screenshots.
- **One fight.** The brutal combat scene exists exactly once, is deliberately bad at the job, and
  the endings read you for choosing it.
