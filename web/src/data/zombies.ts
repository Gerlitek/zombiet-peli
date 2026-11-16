import { Look } from '../art/character';
import { P } from '../art/palette';
import { Rand, randInt } from '../logic/random';

// A zombie type is one row of data: how it looks (Look) and how it plays. Adding a type = adding a row.
export interface ZombieDef {
  name: string;
  look: Look;
  hp: number;
  speed: number;  // px per second
  weight: number; // spawn chance
  trait?: 'lunge' | 'trail' | 'heavy' | 'random' | 'gift';
}

const BASE: Look = {
  leg: 8, tor: 7, arm: 10, head: 4, lw: 2, tw: 4, armA: 0.95, swing: 0.6, hunch: 0.22, sway: 0.22, nod: 0.5, pace: 3.5,
  skin: P.rot, shirt: P.storm, pants: P.bark, eye: P.sick, eyeS: 2,
};

export const ZOMBIES = {
  // "Versio 1" drawing: thin, clothes on, mouth closed.
  normal: { name: 'Tavallinen zombi', hp: 2, speed: 20, weight: 5, look: BASE },
  // "Kauhu-zombi" drawing: sways, limbs make big arcs, hunched, head lolls. Sneaks, then lunges.
  kauhu: { name: 'Kauhu-zombi', hp: 3, speed: 13, weight: 4, trait: 'lunge',
    look: { ...BASE, leg: 7, tor: 8, arm: 14, head: 5, tall: 1.25, lw: 3, tw: 6, armA: 0.6, swing: 0.85, hunch: 0.42, sway: 0.34, nod: 0.75, pace: 2.6, shirt: P.moss1, pants: P.moss1, eye: P.ink, frown: true } },
  sand: { name: 'Hiekkazombi', hp: 3, speed: 26, weight: 3, trait: 'trail',
    look: { ...BASE, skin: P.sand, shirt: P.dry, eye: P.ink, pace: 4.2 } },
  giant: { name: 'Jättizombi', hp: 8, speed: 11, weight: 1, trait: 'heavy',
    look: { ...BASE, s: 1.8, lw: 3, tw: 6, pace: 2, sway: 0.14, shirt: P.bark, pants: P.cloud } },
  random: { name: 'Random zombi', hp: 2, speed: 20, weight: 2, trait: 'random', look: BASE },
  // The child's "Darth Vader zombie" as an original character: black cape, golden spiked crown, green eyes.
  lord: { name: 'Pimeä lordi', hp: 6, speed: 30, weight: 1,
    look: { ...BASE, skin: P.cloud, shirt: P.ink, pants: P.ink, headCol: P.ink, cape: P.cloud, crown: true, hunch: 0.08, sway: 0.08, pace: 4.5, armA: 0.6, swing: 0.3 } },
  // "Kaikenlaiset zombit" and the name of the game: a gift box that opens into a random zombie.
  gift: { name: 'Ylläri-zombi', hp: 1, speed: 24, weight: 2, trait: 'gift', look: BASE },
} satisfies Record<string, ZombieDef>;

export type ZombieType = keyof typeof ZOMBIES;

export const spawnWeights = () => Object.fromEntries(Object.entries(ZOMBIES).map(([k, z]) => [k, z.weight])) as Record<ZombieType, number>;

// Random zombie: new proportions, colors, health and speed every time.
export function randomZombie(rand: Rand): { look: Look; hp: number; speed: number } {
  const pick = (colors: number[]) => colors[randInt(rand, 0, colors.length - 1)];
  return {
    hp: randInt(rand, 1, 5),
    speed: randInt(rand, 12, 34),
    look: { ...BASE, leg: randInt(rand, 6, 10), tor: randInt(rand, 5, 9), arm: randInt(rand, 7, 14), head: randInt(rand, 3, 5), hunch: rand() * 0.5, pace: 2.5 + rand() * 3,
      skin: pick([P.rot, P.sick, P.rain, P.hurt, P.sand]), shirt: pick([P.storm, P.hurt, P.dry, P.bark]), pants: pick([P.bark, P.cloud, P.moss1]) },
  };
}
