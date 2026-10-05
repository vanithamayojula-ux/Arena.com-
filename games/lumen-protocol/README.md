# LUMEN PROTOCOL — A Memory Courier RPG

*You carry other people's minds in your implant, and every delivery changes
both ends of the transaction.*

The city is a dense vertical sprawl of neon and budgeted rain. You are a
courier: sealed memories ride your neural implant from donor to recipient —
a widow's last morning, an unclaimed grief, a fire with three versions of
itself. **Every choice permanently edits who you are**: your personality
axes move, abilities are granted, some are taken away, and later scenes
literally only open for the person you've become.

## Play

```
npm start        # from the repo root → /games/lumen-protocol/
```

Zero dependencies, no build, no backend. Everything rendered procedurally.

## The systems

| System | What it does |
| --- | --- |
| **Personality axes** | EMPATHY (open), LUCIDITY (cold-clear), DEFIANCE (edit the rules), RELIC (how much of everyone else lives in you). Choices nudge them; they never reset between chapters. Your PERSONA title (THE COURIER → LANTERN SAINT / FROST READER / GLITCHSAINT / THE CHOIR) is derived from them and shown in the HUD. |
| **Skills are permanent** | ECHO SIGHT catches the pauses where testimony files itself away; FROST READ tells remembered from invented; FLOOD TONGUE soothes in drowned-tier cadence; GHOST KEY, STEEL MEMORY, JURY RIG, SAINT FREQUENCY, CHOIR STATIC. Skills gate whole choices — and a couple of endings. |
| **Cargo** | Packages ride in the tray and whisper in the ticker, changing narration. Deliver the **ORIGINAL** (whole to them, gone from you) or a **COPY** (they get 92%, you keep a ghost — and it sharpens you). Withholding is also a move. |
| **Offerings** | Feeding grief back calms the weather and buys you latitude. Greed, temperance and time are one economy. |
| **Contradictory testimony** | The Lantern Fire has three witnesses and three true memories. You interview all three (your skills decide how much each one shows you), then **splice** one version — or WEAVE all three into a beautiful lie that becomes load-bearing architecture. The version you believe is the version the recipient survives with. |
| **Endings** | RETURN / INTEGRATE / BROADCAST / GLITCH at the final roof. Which are *open* depends on who you became getting there. The epilogue receipt is generated from your flags: every recipient, every held fire, every scar. |

No combat. No game-over. Autosave per scene (`localStorage`
`lumen-save-v1`); CONTINUE recovers mid-run; a finished run clears the save
so the next drift starts clean.

## Structure

```
lumen-protocol/
├── index.html          shell: HUD, dialogue deck, screens
├── styles.css          neon-on-wet-glass skin
├── src/
│   ├── game.js         the engine: state, gates, permanent effects, saves,
│   │                   scene/node runner — pure, JSON-serializable
│   ├── story.js        ALL content: 16 scenes, 3 chapters, the testimonies,
│   │                   epilogue generator
│   ├── city.js         canvas painter: vertical parallax sprawl, rain,
│   │                   per-location sets (shaft / bar / market / vault / roof)
│   └── main.js         dialogue UI, typewriter, HUD sync, screens, input
└── tests/
    ├── story.test.mjs  graph closure + gate satisfiability + 120 seeded bot
    │                   runs (every run must reach an ending; no dead ends)
    ├── game.test.mjs   gates, clamps, cargo, saves, persona thresholds
    ├── boot.test.mjs   real main.js on a DOM stub: title → calibration →
    │                   typed dialogue → digit choices → autosave → chapter card
    └── helpers.mjs     canvas & micro-DOM stubs, fake rAF clock
```

### Controls

| Input | |
| --- | --- |
| Click / SPACE / ENTER | advance dialogue (one press finishes the typewriter, the next moves on) |
| 1…9 | take a listed choice (greyed = locked; the toast tells you what it wants) |
| Scene cards | chapter interstitials: click to continue |

## Design notes

* **React-style architecture without the CDN risk**: `game.js` is a pure
  reducer over `(seed → choices)` state, `city.js`/DOM are readers, and only
  `main.js` touches the document. A run is byte-reproducible and the whole
  content graph is verified headless (`npm test`).
* The 120-bot test is the promise of the design: **any** legal sequence of
  choices, on **any** calibration, reaches an ending — locked branches never
  dead-end; they just cost you versions of yourself.
