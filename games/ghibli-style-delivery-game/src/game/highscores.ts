export interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  deliveries: number;
  date: number;
}

const KEY = "lotw-highscores-v1";
const NAME_KEY = "lotw-name";
const MAX = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function getName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "Postie";
  } catch {
    return "Postie";
  }
}
export function setName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

/** Returns [list, id of new entry or null if it didn't place] */
export function submitScore(score: number, deliveries: number): [ScoreEntry[], string | null] {
  const list = loadScores();
  if (score <= 0) return [list, null];
  const entry: ScoreEntry = { id: Math.random().toString(36).slice(2), name: getName(), score, deliveries, date: Date.now() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, MAX);
  persist(top);
  return [top, top.some((e) => e.id === entry.id) ? entry.id : null];
}

export function renameEntry(id: string, name: string): ScoreEntry[] {
  const list = loadScores();
  const e = list.find((x) => x.id === id);
  if (e) e.name = name;
  persist(list);
  setName(name);
  return list;
}
