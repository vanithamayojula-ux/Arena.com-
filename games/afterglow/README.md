# AFTERGLOW — A Tour with the Ashfall Players

*A narrative action-adventure set in a world where the sun has been permanently dimmed.*

Twelve years ago the sun became a coal. Civilization did not end — it went
outdoors, got cold, and started itemizing. You lead the **Ashfall Players**: four
former soldiers turned traveling performers who earn their keep with juggling,
fire, puppets, and a tuba named Siegfried. Combat is rare and brutal; almost
every problem is better solved with a song, a show, or a shrewd sentence at a
negotiation table. The currency is light itself — lantern oil, chits, and the
flames everyone is trying to keep alive.

Tone: melancholy, dark humor, quiet hope.

## Play

```
npm start          # from the repo root, then open http://localhost:5173/games/afterglow/
```

No build step, no dependencies: Canvas 2D + WebAudio, everything painted and
scored procedurally at runtime. Key art: `screenshots/card.jpg`,
`screenshots/menu.jpg`.

## The five acts

| Act | Where | What you actually do |
| --- | ----- | -------------------- |
| **Prologue — The Dimming** | the last camp before Vellum Hollow | meet the troupe, learn the verbs, choose who you sit with |
| **1 — Permit for Collective Joy** | Vellum Hollow checkpoint & square | negotiate with Sergeant Hask (Form 7-B), set the stage, a first **performance** (resonance rings), dodge the Wick Trust’s Light Tithe |
| **2 — The Cold Road** | the crossing to Halloway | **keep the flames alive**: wind gusts, relighting torches with lantern oil, find a child who counts the dark, then the one time words fail — a **brutal, avoidable ambush** you can bow out of, rob, talk down, or end |
| **3 — The Two Lamps of Halloway** | a canal town at war over hope | two **negotiations** (Wick Trust vs. the Lamplight Choir), backstage choices that move troupe trust, then the big show: a three-lane performance where you *operate the spotlight* |
| **4 — What the Dark Owes** | a dead lighthouse | parley with Slat of the Wisp Reavers — or fight him off — then the **light-guard set piece**: hold three braziers until the dawn bells, luring wisps away with song, shoving them into lamplight, the pistol only as a last regret |
| **Epilogue — Dawn, Technically** | the lantern festival | the valley, and your troupe, react to every deal you struck; the keeper’s log closes with a generated final page |

## Systems

- **Performance (minigame):** shrinking resonance rings on a beat grid. Move the
  spotlight onto the right performer for solo bonuses. Crowd meter decays;
  combos make the audience roar. Failing is funny, never fatal.
- **Negotiation (minigame):** a *tension* read-the-room engine. Each NPC likes
  and hates approaches (`respect / jest / honest / barter / gift / threat`), the
  hints are diegetic ("his thumb keeps angling the ledger"), and concessions cost
  real resources (chits, promises, a braided wick).
- **Light survival:** your lantern burns oil; wind gusts snuff unshielded flames;
  relighting costs oil; troupe trust reacts to which flames you let die.
- **Combat:** exactly two sequences in the whole game. Shove + roll + a pistol
  with a hand-counted number of rounds. Outcomes (spared / robbed / talked down /
  worse) rewrite the epilogue.
- **Relationships:** Bodfrie, Nadia and Tomas each carry a 0–4 trust meter that
  unlocks lines, concessions, and endings (e.g. Nadia talks the ambush down only
  if she trusts you). Pell joins if you take the road choice.
- **Saves:** per-act checkpoints + settings (text speed, reduced motion, mute)
  in `localStorage`; Continue from the title.

## Controls

| Key | |
| --- | --- |
| ← → / A D | walk, move the spotlight |
| SPACE / Enter | continue, hit a cue, select |
| E | speak / interact / shove / relight |
| Q | sing (lure the wisps) |
| F | gunshot (the last resort; ammo is finite and mourned) |
| Shift | roll |
| Esc | intermission menu (save, settings) |

Touch: on-screen pad + A/E/♪/roll buttons on coarse pointers.

## Layout

```
afterglow/
├── index.html            entry — canvas + boot
├── styles.css            the theatre walls + touch overlay
├── src/
│   ├── main.js           app shell: modes, saves, title, pause, render pipeline
│   ├── story.js          ALL content: worlds, acts, dialogue, deals, cue sheets
│   ├── flow.js           step interpreter + dialogue engine (story ⟂ engine)
│   ├── world.js          exploration stages (walk, interact, follow-train)
│   ├── minigames.js      perf / negotiate / road / guard / combat
│   ├── paint.js          procedural painter: skies, ridges, light masks, grain
│   ├── actors.js         rim-lit silhouettes, walk cycles, portraits, crowd
│   ├── ui.js             dialogue plates, HUD, meters, cards, toasts
│   ├── audio.js          procedural score (10 themes) + wind + sfx
│   ├── input.js          keyboard map + touch layer
│   └── util.js           seeded rng, noise, text layout, effect application
└── tests/
    ├── story.test.mjs    content-graph integrity (outcomes, worlds, lanes, deals)
    ├── boot.test.mjs     real entry point on a DOM stub: menu→prologue→camp→
    │                     gate negotiation→perf→pause
    └── helpers.mjs       canvas/window stubs
```

## Testing

```
node tests/story.test.mjs
node tests/boot.test.mjs
# or from repo root: npm test
```
