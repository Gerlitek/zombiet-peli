// Made-up numbers for the dashboard layout (npm run dev, /tilastot/?demo). Never in the build.
import type { Summary } from './stats';

export const DEMO: Summary = {
  generated: '2026-11-21T02:30:12+00:00',
  recent_days: 30,
  players_recent: 23,
  days: [
    { day: '2026-11-16', started: 4, ended: 3, won: 1 }, { day: '2026-11-17', started: 9, ended: 8, won: 3 },
    { day: '2026-11-18', started: 6, ended: 6, won: 2 }, { day: '2026-11-19', started: 14, ended: 12, won: 5 },
    { day: '2026-11-20', started: 11, ended: 10, won: 6 },
  ],
  games: { started: 44, started_recent: 44, ended: 39, won: 17, median_duration_s: 214, median_kills: 31 },
  characters: { knight: 24, mini: 20 },
  kills_by_zombie: { normal: 520, kauhu: 260, sand: 190, gift: 120, random: 80, giant: 40, lord: 17 },
  hits_by_zombie: { kauhu: 61, normal: 44, sand: 30, giant: 12, lord: 9 },
  wheel_weapons: { gloves: 22, katanas: 19, hammer: 12, nunchaku: 11, laser: 6, ice: 5, rudikarri: 1 },
  achievements: { first: 39, vip: 25, won: 17, puzzle: 9, giant: 8, fast: 4, lord: 3, flawless: 2, rudikarri: 1 },
  puzzles: {
    easy: { answered: 48, correct: 45, median_ms: 3200 },
    hard: { answered: 21, correct: 13, median_ms: 9100 },
    medium: { answered: 33, correct: 27, median_ms: 5400 },
  },
};
