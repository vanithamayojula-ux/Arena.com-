/* ============================================================================
 * ARENA ARCADE — GAME CATALOG
 * ============================================================================
 * The single source of truth for every game in the portal. Adding a game is
 * one entry in GAMES below — the gate cards, the in-portal switcher dropdown,
 * the category filters and all counts render themselves from this file.
 *
 * Entry fields
 * ------------
 *   id          string   unique, kebab-case. Used for launchGate('<id>').
 *   title       string   display name, "Name: Subtitle" form is fine.
 *   folder      string   game folder under games/ (used to build asset paths)
 *   entry       string   the playable file, relative to the repo root
 *   rank        'S'|'A'  drives the badge colour and the "[RANK S]" prefixes
 *   category    string   key into CATEGORIES below
 *   desc        string   card blurb
 *   danger      0-100    drives the bar width AND the label (auto-derived)
 *   accent      string   CSS colour for the danger text
 *   gradient    string   CSS gradient for the danger bar fill
 *   controls    string   left-hand stat line
 *   engine      string   right-hand stat line
 *   typeTag     string   the tag stamped across the thumbnail
 *   thumb       string   screenshot, relative to repo root
 *   thumbAlt    string   optional fallback image if thumb 404s
 *   keywords    string   extra words matched by the portal search
 *   featured    object   optional; marks the boss banner above the grid
 *
 * DANGER LABELS are derived from `danger`, so you never set them by hand:
 *   90+ EXTREME   75-89 HIGH   50-74 MODERATE   below 50 LOW
 * ========================================================================== */

(function (global) {
  'use strict';

  // Category filter tabs, in display order. Any category used by a game that
  // is missing here gets appended automatically, so a new category never
  // needs a second edit.
  const CATEGORIES = {
    predator: { label: 'PREDATOR & 3D' },
    typing: { label: 'COMBAT TYPING' },
    chronos: { label: 'TEMPORAL & EXPEDITION' },
  };

  const GAMES = [
    {
      id: 'apex',
      title: 'APEX: The Cretaceous Chase',
      folder: 'games/apex',
      entry: 'games/apex/index.html',
      rank: 'S',
      category: 'predator',
      desc: 'Command a mighty Tyrannosaur in a lush prehistoric valley. Track prey scent cones, sprint to build momentum, snap jaw bites, and survive goring Triceratops horns.',
      danger: 99,
      accent: 'var(--neon-red)',
      gradient: 'linear-gradient(90deg, #ff0055, #ff1744)',
      controls: 'WASD / Mouse Aim / Space Bite',
      engine: 'ENGINE: CANVAS 2D',
      typeTag: 'RED GATE // APEX HUNTER',
      thumb: 'games/apex/screenshots/frame.png',
      thumbAlt: 'games/apex/screenshots/bestiary.png',
      keywords: 'Dinosaur Tyrannosaur T Rex Chase Hunt Predator',
      featured: {
        badge: 'S-RANK APEX GATE',
        button: '[ HUNT AS APEX PREDATOR ]',
      },
    },
    {
      id: 'neon-run',
      title: 'Neon Run: Midnight Express',
      folder: 'games/neon-run',
      entry: 'games/neon-run/index.html',
      rank: 'S',
      category: 'predator',
      desc: 'An S-Rank Red Gate trial. Three speeding subway tracks, zero brakes. Leap trains, slide under barrier gates, and harvest monarch gold before the city consumes you.',
      danger: 98,
      accent: 'var(--neon-red)',
      gradient: 'linear-gradient(90deg, #ff0055, #ff1744)',
      controls: 'A / D Steer • Space Jump • S Slide',
      engine: 'ENGINE: THREE.JS 3D',
      typeTag: 'RED GATE // 3D RUNNER',
      thumb: 'games/neon-run/screenshots/game-3d.png',
      thumbAlt: 'games/neon-run/screenshots/menu-3d.png',
      keywords: 'Runner Subway Train 3D Three Neon Endless',
    },
    {
      id: 'cyberstrike',
      title: 'Cyberstrike: Laser Blaster',
      folder: 'games/cyberstrike',
      entry: 'games/cyberstrike/play.html',
      rank: 'A',
      category: 'typing',
      desc: 'High-tech combat trial. Decimate falling word projectiles and boss missiles with precision keyboard strikes, trigger EMP bombs, freeze time, and unlock shadow streaks.',
      danger: 85,
      accent: '#ff3366',
      gradient: 'linear-gradient(90deg, #e11d48, #fb7185)',
      controls: 'Type falling words • ESC Pause',
      engine: 'FEAT: EMP BOMBS',
      typeTag: 'RED GATE // LASER TYPING',
      thumb: 'games/cyberstrike/screenshots/cyberstrike.png',
      keywords: 'Typing Combat Blaster Neon Words Keyboard',
    },
    {
      id: 'typestorm',
      title: 'Typestorm: Neon Blitz',
      folder: 'games/typestorm',
      entry: 'games/typestorm/play.html',
      rank: 'A',
      category: 'typing',
      desc: 'Relentless speed trial. Blast raining words before your energy barrier shatters. Chain combos, unleash OVERDRIVE mode, and etch your hunter alias on the Hall of Fame.',
      danger: 80,
      accent: '#ff5500',
      gradient: 'linear-gradient(90deg, #e11d48, #fb7185)',
      controls: 'Keyboard / Touch • Combos',
      engine: 'FEAT: OVERDRIVE BOOST',
      typeTag: 'RED GATE // WORD BLITZ',
      thumb: 'games/typestorm/screenshots/typestorm.png',
      keywords: 'Typing Speed Words Combo Blitz Neon Keyboard',
    },
    {
      id: 'letters-wind',
      title: 'Letters on the Wind: Post Boy',
      folder: 'games/ghibli-style-delivery-game',
      entry: 'games/ghibli-style-delivery-game/play.html',
      rank: 'A',
      category: 'chronos',
      desc: 'Whimsical delivery expedition. Cycle across rolling coastal hills, preserve postal stamina, converse with eccentric villagers, and deliver urgent mail before dusk settles.',
      danger: 65,
      accent: '#4ade80',
      gradient: 'linear-gradient(90deg, #10b981, #4ade80)',
      controls: 'Bicycle / Touch • Dialogues',
      engine: 'FEAT: STAMINA & COMBOS',
      typeTag: 'RED GATE // WIND COURIER',
      thumb: 'games/ghibli-style-delivery-game/screenshots/ghibli.png',
      keywords: 'Ghibli Postman Delivery Courier Letters Wind Whimsical Bike',
    },
    {
      id: 'time-echo',
      title: 'Time Echo: Chronology Lab',
      folder: 'games/time-echo',
      entry: 'games/time-echo/index.html',
      rank: 'S',
      category: 'chronos',
      desc: 'Mind-bending temporal puzzle trial. Record 5-second echo loops to clone your past actions, hold pressure relays open, dodge lethal spikes, and conquer 100 distinct testing chambers.',
      danger: 94,
      accent: '#38bdf8',
      gradient: 'linear-gradient(90deg, #0284c7, #38bdf8)',
      controls: 'Arrows / WASD • Space Jump',
      engine: 'FEAT: 100 SECTORS ARCHIVE',
      typeTag: 'RED GATE // TIME ECHO',
      thumb: 'games/time-echo/screenshots/menu.png',
      thumbAlt: 'games/time-echo/screenshots/time-echo.png',
      keywords: 'Temporal Puzzle Platformer Time Chronology Lab Echo Loop',
    },
  ];

  // ---------------------------------------------------------------- helpers

  function dangerLabel(danger) {
    if (danger >= 90) return 'EXTREME';
    if (danger >= 75) return 'HIGH';
    if (danger >= 50) return 'MODERATE';
    return 'LOW';
  }

  // Category keys in display order: the ones declared above first, then any
  // extra ones a newly added game introduced.
  function orderedCategories() {
    const seen = new Set();
    const keys = Object.keys(CATEGORIES);
    GAMES.forEach(function (g) {
      if (!seen.has(g.category)) {
        seen.add(g.category);
        if (!keys.includes(g.category)) keys.push(g.category);
      }
    });
    return keys.map(function (key) {
      return Object.assign({ key: key }, CATEGORIES[key] || { label: key.toUpperCase() });
    });
  }

  // Small cache-busting suffix so a redeploy invalidates the browser copy of
  // the catalog itself without touching asset URLs.
  const V = '?v=' + Date.now().toString(36);

  // Normalise each game once: fill in derived fields so the render code stays
  // dumb. `search` is what the portal matches a query against.
  const entries = GAMES.map(function (g) {
    return Object.assign({}, g, {
      badgeClass: 'badge-' + String(g.rank || 'A').toLowerCase(),
      dangerLabel: dangerLabel(g.danger),
      gateName: '[RANK ' + (g.rank || 'A') + ': RED GATE] ' + g.title,
      switcherLabel: '[RANK ' + (g.rank || 'A') + '] ' + g.title,
      search: [g.title, g.keywords, g.typeTag, g.engine]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      thumbSrc: g.thumb + V,
    });
  });

  global.ARENA = {
    games: entries,
    categories: orderedCategories(),
    version: V,
  };
})(typeof window !== 'undefined' ? window : globalThis);