// Everything the game remembers lives in this browser's localStorage. Nothing is sent anywhere.
const KEY = 'yllari-zombiet';

export interface Saved {
  nick: [number, number, number]; // indexes into the nickname word lists + a number
  hero: string;
  level: string;
  achievements: string[];
  best: { nick: string; score: number }[];
}

const DEFAULTS: Saved = { nick: [0, 0, 0], hero: 'knight', level: 'easy', achievements: [], best: [] };

export function load(): Saved {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS }; // private mode or broken data: play without saving
  }
}

export function save(change: Partial<Saved>): Saved {
  const next = { ...load(), ...change };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

export function addBest(nick: string, score: number) {
  const best = [...load().best, { nick, score }].sort((a, b) => b.score - a.score).slice(0, 3);
  save({ best });
}

// Returns true when the achievement is new.
export function unlock(id: string): boolean {
  const have = load().achievements;
  if (have.includes(id)) return false;
  save({ achievements: [...have, id] });
  return true;
}
