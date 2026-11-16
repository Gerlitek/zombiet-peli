import { WIN_AT } from '../data/rules';

export interface RunResult {
  kills: number;
  hearts: number;      // hearts left at the end
  seconds: number;     // play time, puzzle time excluded
  won: boolean;
  puzzleBonus: number; // 100 - 200 for the opened lock stone
}

// The maximum is bounded on purpose: the server can reject impossible scores.
export function score(r: RunResult): number {
  const timeBonus = r.won ? Math.max(0, 300 - Math.floor(r.seconds)) : 0;
  return r.kills * 100 + r.hearts * 50 + timeBonus + (r.won ? 500 : 0) + r.puzzleBonus;
}

export const MAX_SCORE = score({ kills: WIN_AT, hearts: 5, seconds: 0, won: true, puzzleBonus: 200 });
