import { RK_ODDS, WEAPONS, WeaponDef, WeaponId } from '../data/weapons';
import { Rand, pickWeighted } from './random';

export type WheelName = 'forest' | 'vip';

// The slices of a wheel, in drawing order.
export function slices(wheel: WheelName): WeaponId[] {
  return (Object.keys(WEAPONS) as WeaponId[]).filter((id) => (WEAPONS[id] as WeaponDef).wheel === wheel && WEAPONS[id].weight > 0);
}

// One spin. The VIP wheel has a tiny separate chance for Rudi-Karri before the normal weighted pick.
export function spin(wheel: WheelName, rand: Rand, rkOdds = RK_ODDS): WeaponId {
  if (wheel === 'vip' && rand() < rkOdds) return 'rudikarri';
  const weights = Object.fromEntries(slices(wheel).map((id) => [id, WEAPONS[id].weight])) as Record<WeaponId, number>;
  return pickWeighted(weights, rand);
}
