# Time Echo

A browser-based 2D puzzle-platformer built with plain HTML, CSS, and JavaScript. No framework, external asset, or build step is required.

## Play

Open `index.html` in a modern browser, or serve the repository with any static file server. Click **PLAY GAME** on the title screen to begin. For example:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- **Left / Right arrows** — move (A / D are also supported)
- **Space** — jump; hold it for a higher jump
- **Menu** — return to the separate title screen
- **Restart** — restart the current chamber
- Clear a chamber and choose **Next Sector** to unlock the next level; unlocked chambers can be revisited from the 100-level archive

A five-second rolling recording is replayed as a time echo every five seconds. Echoes repeat recorded positions and actions, then stay at the end of their path. Stand on a relay during a recording to leave an echo there; only echoes can hold relay signals open. The 100-sector campaign has three tutorial chambers followed by 97 deterministic, individually varied routes. New sectors unlock in order; unlocked progress is saved in this browser. Later chambers steadily add relays, tighter routes, wider rifts, spikes, faster sweepers, and tougher jump physics. The completion button names the next sector so it is clear how to continue. A quick **How to Play** guide sits above the stage; sound effects can be toggled in the header.
