# Neon Run — Midnight Express

A standalone 3D endless runner with three lanes, trains, jumpable barriers, slide gates, collectible coins, and a locally saved best distance.

## Run locally

From this folder:

```sh
python -m http.server 3000
```

Open http://localhost:3000 in a modern WebGL-enabled browser.

From the repository root, the same command serves the game at http://localhost:3000/neon-run/.

No npm install, build step, or external CDN connection is required. Three.js is bundled locally.

## Controls

- Left / Right arrows or A / D: switch lanes
- Up arrow, W, or Space: jump
- Down arrow or S: slide
- Escape or P: pause / resume
- Mobile: swipe left/right/up/down; tap the track to jump

## Files

- `index.html` — page layout and interface
- `game.js` — 3D scene, animation, controls, and gameplay
- `vendor/three.min.js` — Three.js r128
- `vendor/THREE-LICENSE.txt` — bundled dependency's MIT license

## Hosting

Serve this folder with any static web host. All game asset URLs are relative, so it can be hosted at `/neon-run/` without modifying the rest of the repository.

The game requires WebGL; hardware acceleration is recommended. Best distance is stored in browser local storage when available.
