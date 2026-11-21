import { P } from '../art/palette';

// A weapon is one row of data. Three behaviors (kind) are the only weapon code in the game:
//   strike = hit the nearest zombie in range, orbit = blades circle the player, status = effect in an area.
// Every weapon works only when the player presses the attack key (space).
export interface WeaponDef {
  name: string;
  info: string;                     // one line shown on the wheel: what the weapon does
  wheel: 'base' | 'forest' | 'vip'; // base weapons are never on a wheel
  weight: number;                   // chance on the wheel
  kind: 'strike' | 'orbit' | 'status';
  damage: number;
  range: number;      // strike/status: reach in px. orbit: radius of the circle
  cooldown: number;   // seconds between strikes or status pulses
  color: number;      // icon and effect color
  knock?: number;     // how far a hit throws the zombie
  area?: boolean;     // strike hits every zombie in range
  quake?: number;     // the blow shakes the ground: zombies up to this far take a smaller hit (the child's idea)
  effect?: 'heal' | 'squash' | 'shake' | 'freeze' | 'whirl' | 'tornado' | 'robot';
  blades?: number;
  spin?: number;      // orbit speed, radians per second
}

export const WEAPONS = {
  sword:     { name: 'Musta miekka', info: 'Vahva peruslyönti', wheel: 'base', weight: 0, kind: 'strike', damage: 2, range: 26, cooldown: 0.3, color: P.rain, knock: 140 },
  fist:      { name: 'Nyrkki', info: 'Nopea peruslyönti', wheel: 'base', weight: 0, kind: 'strike', damage: 1, range: 22, cooldown: 0.3, color: P.iceL, knock: 60 },
  gloves:    { name: 'Superhanskat', info: 'Lyö zombin kauas ja antaa sydämiä', wheel: 'forest', weight: 3, kind: 'strike', damage: 3, range: 26, cooldown: 0.8, color: P.hurt, knock: 320, effect: 'heal' },
  katanas:   { name: 'Mini-katanat', info: 'Kaksi terää pyörii, kun lyöt', wheel: 'forest', weight: 3, kind: 'orbit', damage: 1, range: 18, cooldown: 5, color: P.bone, blades: 2, spin: 5, effect: 'whirl' },
  hammer:    { name: 'Moukari', info: 'Maa tärähtää: osuu kaikkiin lähellä oleviin', wheel: 'forest', weight: 2, kind: 'strike', damage: 2, range: 34, cooldown: 1.5, color: P.sand, knock: 140, area: true, quake: 72, effect: 'shake' },
  nunchaku:  { name: 'Nuntsakot', info: 'Pyörii lähelläsi, kun lyöt', wheel: 'forest', weight: 2, kind: 'orbit', damage: 1, range: 11, cooldown: 0, color: P.hurt, blades: 1, spin: 11 },
  laser:     { name: 'Laser-miekka', info: 'Kolme terää ja tornado pyörivät, kun lyöt', wheel: 'vip', weight: 3, kind: 'orbit', damage: 2, range: 22, cooldown: 0, color: P.iceL, blades: 3, spin: 6, effect: 'tornado' },
  ice:       { name: 'Siniset jäähanskat', info: 'Lyönti jäädyttää lähellä olevat', wheel: 'vip', weight: 3, kind: 'status', damage: 0, range: 46, cooldown: 3.5, color: P.ice, effect: 'freeze' },
  squeeze:   { name: 'Puristushanskat', info: 'Litistää zombin avuttomaksi', wheel: 'vip', weight: 3, kind: 'strike', damage: 1, range: 26, cooldown: 1.2, color: P.storm, effect: 'squash' },
  rudikarri: { name: 'Rudi-Karri-robotti', info: 'Olet robotti minuutin: isku kaataa kenet vain', wheel: 'vip', weight: 0, kind: 'strike', damage: 999, range: 30, cooldown: 0.25, color: P.sand, knock: 160, effect: 'robot' },
} satisfies Record<string, WeaponDef>;

export type WeaponId = keyof typeof WEAPONS;

// Rudi-Karri is very rare. The wheel shows the number below as a joke, the real chance is RK_ODDS per VIP spin.
// The shown number is the child's decision. The real chance must not be impossible: 1 / 10 per VIP spin.
// (1 / 500 and 1 / 20 were tried first: the robot was never seen.)
export const RK_ODDS = 1 / 10;
export const RK_SHOWN = '0,00000001 %';
