import { P } from '../art/palette';

// A weapon is one row of data. Three behaviors (kind) are the only weapon code in the game:
//   strike = hit the nearest zombie in range, orbit = blades circle the player, status = effect in an area.
export interface WeaponDef {
  name: string;
  wheel: 'base' | 'forest' | 'vip'; // base weapons are never on a wheel
  weight: number;                   // chance on the wheel
  kind: 'strike' | 'orbit' | 'status';
  damage: number;
  range: number;      // strike/status: reach in px. orbit: radius of the circle
  cooldown: number;   // seconds between strikes or status pulses
  color: number;      // icon and effect color
  knock?: number;     // how far a hit throws the zombie
  area?: boolean;     // strike hits every zombie in range
  effect?: 'heal' | 'squash' | 'shake' | 'freeze' | 'whirl' | 'tornado' | 'robot';
  blades?: number;
  spin?: number;      // orbit speed, radians per second
}

export const WEAPONS = {
  sword:     { name: 'Musta miekka', wheel: 'base', weight: 0, kind: 'strike', damage: 2, range: 24, cooldown: 0.6, color: P.rain, knock: 80 },
  fist:      { name: 'Nyrkki', wheel: 'base', weight: 0, kind: 'strike', damage: 1, range: 20, cooldown: 0.35, color: P.iceL, knock: 60 },
  gloves:    { name: 'Superhanskat', wheel: 'forest', weight: 3, kind: 'strike', damage: 3, range: 26, cooldown: 0.8, color: P.hurt, knock: 320, effect: 'heal' },
  katanas:   { name: 'Mini-katanat', wheel: 'forest', weight: 3, kind: 'orbit', damage: 1, range: 18, cooldown: 5, color: P.bone, blades: 2, spin: 5, effect: 'whirl' },
  hammer:    { name: 'Moukari', wheel: 'forest', weight: 2, kind: 'strike', damage: 2, range: 34, cooldown: 1.5, color: P.sand, knock: 140, area: true, effect: 'shake' },
  nunchaku:  { name: 'Nuntsakot', wheel: 'forest', weight: 2, kind: 'orbit', damage: 1, range: 11, cooldown: 0, color: P.dry, blades: 1, spin: 11 },
  laser:     { name: 'Laser-miekka', wheel: 'vip', weight: 3, kind: 'orbit', damage: 2, range: 22, cooldown: 0, color: P.iceL, blades: 3, spin: 6, effect: 'tornado' },
  ice:       { name: 'Siniset jääskat', wheel: 'vip', weight: 3, kind: 'status', damage: 0, range: 46, cooldown: 3.5, color: P.ice, effect: 'freeze' },
  squeeze:   { name: 'Puristushanskat', wheel: 'vip', weight: 3, kind: 'strike', damage: 1, range: 26, cooldown: 1.2, color: P.storm, effect: 'squash' },
  rudikarri: { name: 'Rudi-Karri-robotti', wheel: 'vip', weight: 0, kind: 'orbit', damage: 999, range: 26, cooldown: 0, color: P.sand, blades: 1, spin: 1.6, effect: 'robot' },
} satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;

// Rudi-Karri is almost impossible to get. The wheel shows the number below, the real chance is RK_ODDS.
export const RK_ODDS = 1 / 500;
export const RK_SHOWN = '0,00000001 %';
