export const ACHIEVEMENTS = {
  first: 'Ensimmäinen tappo',
  vip: 'VIP-vieras',
  won: 'Peli läpäisty',
  flawless: 'Ei naarmuakaan',
  fast: 'Salamannopea',
  giant: 'Jättien kaataja',
  lord: 'Lordin voittaja',
  puzzle: 'Hajotelmamestari',
  rudikarri: 'Rudi-Karrin ystävä',
} as const;

export type AchievementId = keyof typeof ACHIEVEMENTS;
