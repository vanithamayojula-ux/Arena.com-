# Giant Cat Chase — Highway Escape

A 3D Three.js chase game. A car races down a neon highway while a kilometre-tall tabby cat chases you from behind. Dodge traffic, barrels, crates, boulders, logs, fences, trucks, potholes, oil slicks, rolling yarn balls and pits; use ramps to fly; watch the rear-view mirror for the cat's paw swipes.

## Run

Start the hub (`npm start`) and open http://localhost:5173/games/giant-cat-chase/, or open `index.html` through any static server.

## Controls

- ← / → or A / D: change lane
- ↑ / W / Space: jump (clears low obstacles, launches off ramps)
- ↓ / S: brake (the cat gains on you)
- Shift / X: nitro boost (refilled by coins)
- Esc / P: pause · M: mute
- Mobile: swipe left/right to change lanes, swipe up to jump, swipe down to brake, tap for nitro

## Rules

- 5 hits (solid obstacles) and you're wrecked.
- Falling into a pit ends the run.
- If the cat's gap closes to zero, you're caught.
- Close calls, coins, and distance all add to points. Best score is saved locally.

Three.js is vendored in `vendor/`, so no CDN or build step is needed.
