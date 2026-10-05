/* TIDE & BONE — Bone Charms: the one upgrade you keep across runs, and the
   drift log. Storage is injectable so node tests can pass a Map-like stub. */

export const CHARMS = [
  { id: 'chitin', name: 'Chitinweave', icon: '⛨', desc: '+15 max HP. A pauldron cut from her shell; it still hums.' },
  { id: 'brewer', name: 'Marrow Brewer', icon: '⚗', desc: 'Start with an extra Marrow Flask; yours heal +6.' },
  { id: 'saltlord', name: 'Salt Lord', icon: '✳', desc: 'Start with an extra Salt Bomb. The Church would fine you.' },
  { id: 'boneblade', name: 'Honed Boneblade', icon: '⚔', desc: 'Attack +3. Whetted on a rib, obviously.' },
  { id: 'tidegift', name: "Tidegift", icon: '≈', desc: 'Dive clock +5 turns, +3 after a flush. The current likes you.' },
  { id: 'reaperfocus', name: 'Reaper Focus', icon: '✦', desc: '+4 salvage on every harvest. Greed, refined.' },
  { id: 'thorns', name: 'Brace Thorns', icon: '❦', desc: 'Dodge-counter hits +6 harder. Solo, but meaner.' },
];
export const charmById = id => CHARMS.find(c => c.id === id) || null;

const KEY = 'tidebone-meta-v1';

export function loadMeta(storage) {
  try {
    const raw = storage ? storage.getItem(KEY) : null;
    if (!raw) return { owned: [], runs: 0, hauls: 0, extractions: 0, best: 0 };
    const m = JSON.parse(raw);
    return {
      owned: Array.isArray(m.owned) ? m.owned.filter(id => charmById(id)) : [],
      runs: m.runs | 0, hauls: m.hauls | 0, extractions: m.extractions | 0, best: m.best | 0,
    };
  } catch { return { owned: [], runs: 0, hauls: 0, extractions: 0, best: 0 }; }
}
export function saveMeta(storage, meta) {
  try { if (storage) storage.setItem(KEY, JSON.stringify(meta)); } catch { /* private mode — survive */ }
}

/* pick 3 unowned charms deterministically from a numeric seed */
export function offer(meta, seed = 1) {
  let h = Math.imul(seed >>> 0 ^ 0x9e3779b9, 2654435761) >>> 0;
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const pool = CHARMS.filter(c => !meta.owned.includes(c.id)).slice();
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

/* record a finished run; `picked` may be null (no choice taken yet) */
export function record(meta, { type, haul }, pickedId, storage) {
  const next = { ...meta, owned: meta.owned.slice(), runs: meta.runs + 1, hauls: meta.hauls + (haul | 0), extractions: meta.extractions + (type === 'extracted' ? 1 : 0), best: Math.max(meta.best, haul | 0) };
  if (pickedId && charmById(pickedId) && !next.owned.includes(pickedId)) next.owned.push(pickedId);
  saveMeta(storage, next);
  return next;
}
export function charmsOf(meta) { return meta.owned.filter(charmById).map(id => charmById(id)); }
