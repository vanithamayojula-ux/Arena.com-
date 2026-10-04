// The rules of remembering: the listening channel, what a restored memory does to
// the world, the tide, lucidity, and the finale.
//
// This lives here rather than inside main.js for one reason: main.js needs WebGL and a
// document, so it cannot be imported by a test, and rules that cannot be tested are rules
// that quietly stop being true. Everything here is wiring-free — the world reactions are
// announced through `events`, and main.js decides what that means (a ripple, a sound, a
// shadow, a card on screen).
import { MEMORIES, CITY as CFG } from './content.js';

export const CHANNEL_SECONDS = 3.3;      // how long you must hold E
export const REACH = 7.0;                // how close you must stand
export const AIM_DOT = 0.35;             // how well you must be looking at it
export const LUCIDITY_CALM = 0.028;      // per second, near somewhere you have restored
export const LUCIDITY_FAR = 0.012;       // per second, out in the dark
export const LUCIDITY_DANGER = 0.05;     // per second, per unit of danger
export const DRAIN_PER_HIT = 0.16;       // what a shadow takes out of you

export function createProgress({ events = {} } = {}) {
  const restored = new Set();

  const state = {
    tide: CFG.waterLevel,
    lucidity: 1,
    danger: 0,
    channel: null,        // { shard, t, lineIndex }
    reverieT: 0,
    finaleT: 0,
    collapses: 0,
    listening: false,
  };

  const tideFor = (count = restored.size) =>
    CFG.waterLevel + count * CFG.tidePerMemory + (restored.has('sealing') ? 0.35 : 0);

  /** The orrery only opens once every other fragment is back. */
  function canListen(mem) {
    if (!mem) return false;
    if (restored.has(mem.id)) return false;
    if (mem.id === 'self' && restored.size < MEMORIES.length - 1) return false;
    return true;
  }

  /* ── the listening channel ── */

  function begin(shard) {
    if (state.channel || !shard || shard.restored) return false;
    if (!canListen(shard.memory)) return false;
    state.channel = { shard, t: 0, lineIndex: -1 };
    state.listening = true;
    events.onListenStart?.(shard);
    events.sting?.(shard.memory.kind);
    events.whisper?.(shard.memory.speaker);
    return true;
  }

  function cancel() {
    if (!state.channel) return;
    events.onListenStop?.(state.channel.shard);
    state.channel = null;
    state.listening = false;
    events.onListenEnd?.();
  }

  /** Advance the channel; restores the fragment when the ring fills. */
  function stepChannel(dt) {
    const c = state.channel;
    if (!c) return;
    const { shard } = c;
    c.t += dt;
    const p = Math.min(1, c.t / CHANNEL_SECONDS);
    const lines = shard.memory.lines;
    const idx = Math.min(lines.length - 1, Math.floor(p * lines.length));
    if (idx !== c.lineIndex) {
      c.lineIndex = idx;
      events.onLine?.(shard.memory.speaker, lines[idx], idx);
    }
    events.onProgress?.(p);
    if (p >= 1) {
      state.channel = null;
      state.listening = false;
      events.onListenEnd?.();
      restore(shard);
    }
  }

  /**
   * Hold E while looking at a fragment. `aimed` is the shard the crosshair is on
   * (or null), `holding` whether E is down.
   */
  function interact(aimed, holding) {
    if (state.channel) {
      if (!aimed || state.channel.shard !== aimed || !holding) cancel();
      return;
    }
    if (aimed && holding) begin(aimed);
  }

  /* ── restoring ── */

  function restore(shard) {
    const mem = shard.memory;
    if (restored.has(mem.id)) return null;
    restored.add(mem.id);

    // the tide is the clock of the whole game
    state.tide = tideFor();
    state.lucidity = Math.min(1, state.lucidity + 0.25);

    const info = {
      mem, shard,
      tide: state.tide,
      count: restored.size,
      dark: mem.kind === 'dark' || mem.id === 'sealing',
      spawns: [],
    };

    if (info.dark) {
      // dark memories leave something behind
      info.spawns.push(mem.id === 'bargain' ? { at: 'shadowSpawn', kind: mem.id } : { at: 'gates', offset: [0, 2, -6], kind: mem.id });
      if (mem.id === 'sealing') info.spawns.push({ at: 'gates', offset: [-14, 2, 4], kind: 'sealing' });
    }

    events.onRestore?.(info);
    if (info.dark) events.onDanger?.(0.55);
    events.onReverie?.(mem);
    events.onJournal?.(restored);

    // the last fragment starts the finale
    if (restored.size >= MEMORIES.length) {
      state.finaleT = 0.1;
      events.onFinaleReady?.();
    }
    return info;
  }

  /* ── lucidity: the player's grip on the memory ── */

  function drain(amount = DRAIN_PER_HIT) {
    state.lucidity = Math.max(0, state.lucidity - amount);
    if (state.lucidity <= 0.001) collapse();
  }

  function tick(dt, { nearRestored = false, calm = false } = {}) {
    const gain = (nearRestored || calm ? LUCIDITY_CALM : LUCIDITY_FAR) - state.danger * LUCIDITY_DANGER;
    state.lucidity = Math.max(0, Math.min(1, state.lucidity + gain * dt));
    if (state.lucidity <= 0.001) collapse();
  }

  function collapse() {
    state.collapses++;
    state.lucidity = 0.42;
    events.onCollapse?.();
  }

  function setDanger(target) { state.danger = Math.max(0, Math.min(1, target)); }

  /* ── the reverie: the four seconds after a memory comes back ── */

  function startReverie(seconds = 4.4) { state.reverieT = seconds; }

  function updateReverie(dt) {
    if (state.reverieT <= 0) return false;
    state.reverieT -= dt;
    return state.reverieT <= 0;
  }

  function finaleWanted(dt, playing) {
    if (state.finaleT <= 0 || !playing) return false;
    state.finaleT += dt;
    if (state.finaleT > 1.6) { state.finaleT = 0; return true; }
    return false;
  }

  function reset() {
    restored.clear();
    state.tide = CFG.waterLevel;
    state.lucidity = 1;
    state.danger = 0;
    state.channel = null;
    state.collapses = 0;
    state.listening = false;
  }

  return {
    state, restored, tideFor, canListen,
    begin, cancel, stepChannel, interact, restore,
    drain, tick, collapse, setDanger,
    startReverie, updateReverie, finaleWanted, reset,
  };
}
