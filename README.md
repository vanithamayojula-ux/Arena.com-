# Arena Arcade

A hub of browser games with a portal for browsing and playing in-hub. Six
games ship today:

| Game | Folder | Entry | Engine |
| ---- | ------ | ----- | ------ |
| **APEX — The Cretaceous Chase** | `games/apex/` | `index.html` | Canvas 2D (procedural art + audio) |
| **Neon Run — Midnight Express** | `games/neon-run/` | `index.html` | Three.js 3D Endless Runner |
| **Cyberstrike — Laser Blaster** | `games/cyberstrike/` | `play.html` | React + Tailwind + Vite |
| **Typestorm — Neon Blitz** | `games/typestorm/` | `play.html` | React + Tailwind + Vite |
| **Letters on the Wind — Post Boy's Day** | `games/ghibli-style-delivery-game/` | `play.html` | React + Tailwind + Vite |
| **Time Echo — Chronology Lab** | `games/time-echo/` | `index.html` | HTML5 Canvas Temporal Puzzle Platformer |

## Run locally

```sh
npm install     # once — installs each game's deps via npm workspaces
npm run build   # builds the Vite games, writes their play.html
npm start       # http://localhost:3000
```

`npm start` serves the portal and every game. Game routes are resolved from
the catalog, so `/games/apex/`, `/games/typestorm/` etc. all work without
being registered anywhere.

## Deploy to Vercel

```sh
vercel          # or connect the repo in the Vercel dashboard
```

The root `vercel.json` declares this a static site with no framework. Vercel
runs `npm install` then `npm run build`, and serves the repo root. No
`outputDirectory` juggling, no per-service config, and new game folders need
no deploy settings.

Two things worth knowing:

- **`play.html` and `dist/` are not in git.** They are build output, listed in
  `.gitignore`, regenerated on every deploy. A game therefore can never ship a
  stale `play.html` that disagrees with its `src/`.
- **Each game's `package.json` must have a unique `name`.** They are npm
  workspaces, and npm rejects duplicate workspace names.

## Adding a game

Two steps. Nothing else needs editing — the gate cards, the filter tabs and
their counts, the in-portal switcher, the footer and the boss banner all
derive from the catalog.

**1. Add the files.**

- **Plain HTML/Canvas/JS game?** Drop it in `games/<id>/` with a playable
  `index.html` and any `screenshots/`. No build step; the catalog points
  straight at it.
- **Vite/React game?** Drop it in `games/<id>/` with a `package.json` whose
  `name` is unique and which has a `build` script. `tools/build-games.mjs`
  discovers it automatically, builds it, and copies `dist/index.html` to
  `games/<id>/play.html`. You do not need to touch `package.json` scripts.

**2. Add one entry to [`games/catalog.js`](games/catalog.js).**

```js
{
  id: 'my-game',                          // unique, kebab-case
  title: 'My Game: Subtitle',
  entry: 'games/my-game/play.html',       // or index.html
  rank: 'A',                              // 'S' or 'A' — drives the badge colour
  category: 'typing',                     // an existing category, or a new name
  desc: 'One or two sentences for the card.',
  danger: 85,                             // 0-100 — sets the bar and its label
  accent: '#ff3366',                      // danger text colour
  gradient: 'linear-gradient(90deg, #e11d48, #fb7185)',
  controls: 'Type words • ESC Pause',
  engine: 'FEAT: EMP BOMBS',
  typeTag: 'RED GATE // MY GAME',
  thumb: 'games/my-game/screenshots/shot.png',
  keywords: 'extra words the portal search matches',
}
```

Then redeploy. The card, its category tab, the dropdown option and all counts
appear automatically. A category you invent that isn't listed yet gets its own
filter tab appended on the fly.

Mark one game as the hero banner with an optional `featured` block:

```js
featured: { badge: 'S-RANK MY GATE', button: '[ ENTER THE MYSTERY ]' },
```

## Structure

```
Arena/
├── games/
│   ├── catalog.js         # the game list — edit this to add a game
│   ├── apex/              # Canvas 2D dino hunt
│   │   ├── screenshots/   # thumbnails for the portal cards
│   │   ├── src/           # game source (ES modules)
│   │   ├── tests/         # headless simulation + entry-point tests
│   │   └── index.html     # standalone playable entry point
│   ├── neon-run/          # Three.js runner (vendored, no build)
│   ├── time-echo/         # Canvas puzzle-platformer (no build)
│   ├── cyberstrike/       # Vite game -> built to play.html
│   ├── typestorm/         # Vite game -> built to play.html
│   └── ghibli-style-delivery-game/
├── tools/
│   └── build-games.mjs    # discovers and builds every game with a build script
├── index.html             # the portal (cards render from the catalog)
├── server.js              # dependency-free static server for local dev
├── vercel.json            # static-site deploy config
└── package.json           # npm workspaces + build/test scripts
```

## Test

```sh
npm test
```

Runs the APEX simulation headlessly — movement, herd stamina, bite cone, waves,
game-over, pause, collision — plus a boot test of its real entry point.