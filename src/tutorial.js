// The opening lesson: what to do first, and which key matters when.
// Kept out of main.js so it can be tested without a browser (see tests/tutorial.mjs).
import { HINTS } from './content.js';

export function createTutorial({ setGoal, hint, say } = {}) {
  const t = {
    step: 0,               // 0 = reach the first fragment, 1 = listen to it, 2 = the city leads
    elapsed: 0,
    seenSplash: false,
    seenSwim: false,
    seenLantern: false,
    seenTide: false,
    seenJournal: false,
    lowOilSaid: false,
    ledgeTimer: 0,
    sinceRestore: 0,
    nudged: 0,
  };

  function reset() {
    t.step = 0; t.elapsed = 0; t.seenSplash = false; t.seenSwim = false;
    t.seenLantern = false; t.seenTide = false; t.seenJournal = false;
    t.lowOilSaid = false; t.ledgeTimer = 0; t.sinceRestore = 0; t.nudged = 0;
  }

  function start() {
    reset();
    setGoal?.('Follow the compass to the <b>market row</b> and find the light of the first fragment.', 'what to do');
    say?.('the Archivist', 'Six of them are still down here. Start with Ila \u2014 she has been holding the market all this time.');
  }

  /**
   * ctx: { player, nearest, restoredSize, shadows, dt }
   *   player   — the player's state object (swimming, blocked, vel, depth, lanternOn, oil, mantleT, mantleCooldown)
   *   nearest  — { mem, dist } for the fragment the compass is pointing at, or null
   */
  function update(dt, ctx) {
    const p = ctx.player;
    if (!p) return;
    t.elapsed += dt;
    t.sinceRestore += dt;

    /* ── the two opening goals ── */
    if (t.step === 0) {
      if (!ctx.nearest) { t.step = 2; return; }
      if (ctx.nearest.dist < 9) {
        t.step = 1;
        setGoal?.('Stand in the light and <b>hold E</b> until the ring fills. Listen to all of it.', 'what to do');
        hint?.('E', 'hold E to listen', 9000);
      } else if (t.elapsed > 45) {
        // a gentle nudge every 45 s, never a nag
        t.elapsed = 0;
        t.nudged++;
        if (t.nudged <= 2) {
          setGoal?.(`Still following the compass \u2014 the <b>${ctx.nearest.mem.district}</b> is ${Math.round(ctx.nearest.dist)} m away.`, 'what to do');
        }
      }
    } else if (t.step === 1) {
      if (ctx.restoredSize > 0) {
        t.step = 2;
        t.sinceRestore = 0;
        setGoal?.('The city is remembering. <b>Five fragments</b> left \u2014 the compass knows the nearest.', 'what to do');
      }
    }

    /* ── the keys, at the moment they matter ── */
    if (p.swimming && !t.seenSwim) {
      t.seenSwim = true;
      t.seenSplash = true;
      hint?.('space / C', HINTS.swim, 10000);
    } else if (!t.seenSplash && p.depth > 0.4) {
      // first time you are ankle deep is the moment to explain moving at all
      t.seenSplash = true;
      hint?.(null, HINTS.move, 7000);
    }

    // pressed up against a ledge while swimming: the way out is the mantle
    if (p.swimming && p.blocked && Math.hypot(p.vel.x, p.vel.z) < 0.6 && p.mantleT <= 0 && p.mantleCooldown <= 0) {
      t.ledgeTimer += dt;
      if (t.ledgeTimer > 1.2) { hint?.('space', HINTS.mantle, 4500); t.ledgeTimer = 0; }
    } else {
      t.ledgeTimer = 0;
    }

    if (!t.seenLantern && ctx.shadows > 0) {
      t.seenLantern = true;
      hint?.('F', HINTS.lantern, 9000);
    }
    if (!t.seenTide && ctx.restoredSize >= 1 && t.sinceRestore > 11) {
      t.seenTide = true;
      hint?.(null, HINTS.tide, 8000);
    }
    if (p.lanternOn && p.oil < 30 && !t.lowOilSaid) {
      t.lowOilSaid = true;
      hint?.(null, HINTS.lowOil, 5000);
    }
    if (p.oil > 60) t.lowOilSaid = false;
    if (!t.seenJournal && ctx.restoredSize >= 2 && t.sinceRestore > 8) {
      t.seenJournal = true;
      hint?.('TAB', HINTS.journal, 8000);
    }
  }

  return { state: t, update, start, reset };
}
