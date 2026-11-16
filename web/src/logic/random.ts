export type Rand = () => number; // returns 0 <= x < 1, like Math.random

// Pick one key. A bigger weight means a bigger chance. Weight 0 is never picked.
export function pickWeighted<K extends string>(weights: Record<K, number>, rand: Rand): K {
  const entries = Object.entries(weights) as [K, number][];
  let roll = rand() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [key, w] of entries) {
    roll -= w;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export const randInt = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
