# Arena Arcade

A hub of dependency-free browser games with a portal for browsing, searching and
playing in-hub. Currently featuring:

| Game | Folder | Engine |
| ---- | ------ | ------ |
| **APEX — The Cretaceous Chase** | `games/apex/` | Canvas 2D (procedural art + audio) |
| **Neon Run — Midnight Express** | `games/neon-run/` | Three.js 3D Endless Runner |
| **Cyberstrike — Laser Blaster** | `games/cyberstrike/` | React + Tailwind + Vite Combat Typing |
| **Typestorm — Neon Blitz** | `games/typestorm/` | React + Tailwind + Vite High-Speed Typing |
| **Letters on the Wind — Post Boy's Day** | `games/ghibli-style-delivery-game/` | React + Tailwind + Vite Delivery Expedition |
| **Time Echo — Chronology Lab** | `games/time-echo/` | HTML5 Canvas Temporal Puzzle Platformer |
| **Afterglow — A Tour with the Ashfall Players** | `games/afterglow/` | Canvas 2D Narrative Action-Adventure (procedural painterly art + WebAudio score) |

## Run

```
npm start          # or: node server.js
```

Open http://localhost:5173 for the **Arena Arcade portal** (search, category
filters, in-hub player), or jump straight into a game at
http://localhost:5173/games/apex/.

The server binds `0.0.0.0` for the live preview.

## Structure

```
Arena/
├── games/
│   └── apex/                # The Cretaceous Chase (dinosaur hunting game)
│       ├── screenshots/     # rasterised gameplay / bestiary / terrain shots
│       ├── src/             # game source (ES modules)
│       ├── tests/           # headless simulation + entry-point tests
│       ├── tools/           # software rasteriser + art previews
│       ├── index.html       # standalone playable entry point
│       └── styles.css
├── index.html               # Arena Arcade Portal (search, filter, in-hub player)
├── server.js                # dependency-free static server
├── package.json             # npm start / npm test
└── .gitignore
```

## Test

```
npm test
```

Runs the APEX simulation headlessly (movement, herd stamina, bite cone, waves,
game-over, pause, collision) plus a boot test of its real entry point.

## Adding a game

1. Drop it under `games/<id>/` with a playable `index.html` (or `play.html`).
2. Register it in the `GAMES` array at the top of the portal `index.html`.

It then appears in the hub with search, filtering and the in-hub player for free.
