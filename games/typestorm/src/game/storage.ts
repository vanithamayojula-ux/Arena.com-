import type { Difficulty } from "./engine";

export interface ScoreEntry {
  name: string;
  score: number;
  wpm: number;
  level: number;
  words: number;
  acc: number;
  diff: Difficulty;
  date: number;
}

const KEY = "typestorm.scores.v2";
export const MAX_SCORES = 8;

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => typeof e?.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

export function persist(list: ScoreEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SCORES)));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function qualifies(list: ScoreEntry[], score: number) {
  if (score <= 0) return false;
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

export function addScore(list: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  const next = [...list, entry].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  persist(next);
  return next;
}

export const DIFF_LABEL: Record<Difficulty, string> = {
  chill: "CHILL",
  standard: "STANDARD",
  blitz: "BLITZ",
};
