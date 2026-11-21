import { Look } from '../art/character';
import { P } from '../art/palette';
import { WeaponId } from './weapons';

export interface HeroDef {
  name: string;
  info: string;
  look: Look;
  speed: number;
  weapon: WeaponId;   // base weapon, always in use
  healEvery?: number; // gets a heart back after this many kills
}

// Knight: dark helmet with white eyes, light blue armor, black sword (from the child's drawing).
const KNIGHT: Look = {
  leg: 7, tor: 7, arm: 7, head: 4, lw: 2, tw: 5, armA: 0.55, swing: 0.3, pace: 8,
  skin: P.rain, shirt: P.ice, pants: P.storm, headCol: P.storm, eye: P.bone, eyeS: 1, sword: true, plume: true,
};

export const HEROES = {
  knight: { name: 'Ritari', info: 'Vahva musta miekka', look: KNIGHT, speed: 70, weapon: 'sword' },
  mini: { name: 'Minipelaaja', info: 'Nopea ja parantuu', speed: 92, weapon: 'fist', healEvery: 8,
    look: { ...KNIGHT, s: 0.68, sword: false, plume: false, headCol: P.ice, shirt: P.iceL, skin: P.iceL, eye: P.ink, pace: 11 } },
} satisfies Record<string, HeroDef>;

export type HeroId = keyof typeof HEROES;
