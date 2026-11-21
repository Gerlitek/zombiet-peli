import { Look, drawCharacter, drawGift } from '../art/character';
import { P } from '../art/palette';
import { Pen, clipBelow, figure, B } from '../art/pixels';
import { ZOMBIES, ZombieDef, ZombieType, randomZombie } from '../data/zombies';
import { Rand } from '../logic/random';

// A living zombie is a plain object. Times (stun, frozen...) are clock values in seconds: "until".
export interface Zombie {
  type: ZombieType;
  trait: ZombieDef['trait'];
  look: Look;
  x: number; y: number;
  hp: number; speed: number;
  seed: number;
  kx: number; ky: number;      // knockback velocity
  stun: number; frozen: number; squashed: number; flash: number;
  riseFrom: number;            // clock when it started to rise from the puddle
  lungeAt: number; lungeUntil: number;
  armed: boolean;              // rare: carries a weapon, drops a heart
  vip: boolean;
  hits: Record<string, number>; // last hit time per orbit weapon
  trail: { x: number; y: number }[];
}

export const RISE_TIME = 1;
export interface Field { x0: number; x1: number; y0: number; y1: number }

export function makeZombie(type: ZombieType, x: number, y: number, clock: number, vip: boolean, rand: Rand): Zombie {
  const def: ZombieDef = ZOMBIES[type];
  const base = def.trait === 'random' ? randomZombie(rand) : def;
  // VIP zombies are super strong: more health, faster, bigger.
  const look = vip ? { ...base.look, s: (base.look.s ?? 1) * 1.3 } : base.look;
  return {
    type, trait: def.trait, look, x, y,
    hp: base.hp * (vip ? 2 : 1), speed: base.speed * (vip ? 1.4 : 1),
    seed: rand() * 10, kx: 0, ky: 0, stun: 0, frozen: 0, squashed: 0, flash: 0,
    riseFrom: clock, lungeAt: 0, lungeUntil: 0,
    armed: def.trait !== 'gift' && rand() < 1 / 8, vip, hits: {}, trail: [],
  };
}

export const isRising = (z: Zombie, clock: number) => clock < z.riseFrom + RISE_TIME;
const isHeld = (z: Zombie, clock: number) => clock < z.stun || clock < z.frozen || clock < z.squashed || isRising(z, clock);

export function moveZombie(z: Zombie, tx: number, ty: number, clock: number, dt: number, f: Field) {
  if (!isHeld(z, clock)) {
    const dx = tx - z.x, dy = ty - z.y, dist = Math.hypot(dx, dy) || 1;
    let speed = z.speed;
    if (z.trait === 'lunge') {
      // Kauhu-zombi sneaks. When close it stops for a moment, then lunges.
      if (dist < 56 && clock > z.lungeAt) { z.stun = clock + 0.45; z.lungeUntil = clock + 1; z.lungeAt = clock + 3.5; }
      if (clock < z.lungeUntil) speed *= 4.5;
    }
    z.x += (dx / dist) * speed * dt;
    z.y += (dy / dist) * speed * dt;
    if (z.trait === 'trail') {
      const last = z.trail[z.trail.length - 1];
      if (!last || Math.hypot(last.x - z.x, last.y - z.y) > 7) { z.trail.push({ x: z.x, y: z.y }); if (z.trail.length > 7) z.trail.shift(); }
    }
  }
  z.x += z.kx * dt; z.y += z.ky * dt;
  const drag = Math.pow(0.002, dt);
  z.kx *= drag; z.ky *= drag;
  z.x = Math.min(f.x1, Math.max(f.x0, z.x)); z.y = Math.min(f.y1, Math.max(f.y0, z.y));
}

export function knock(z: Zombie, fromX: number, fromY: number, power: number) {
  const dx = z.x - fromX, dy = z.y - fromY, dist = Math.hypot(dx, dy) || 1, k = power * (z.trait === 'heavy' ? 0.2 : 1);
  z.kx += (dx / dist) * k; z.ky += (dy / dist) * k;
}

// The sand trail slows the hero down (PlayScene.slowed), so it is drawn as clear patches of sand.
export function drawTrail(p: Pen, z: Zombie) {
  z.trail.forEach((s, i) => { p.rect(s.x - 3, s.y - 1, 7, 3, P.dry); p.rect(s.x - 2 + (i % 3), s.y - 1, 2, 1, P.sand); });
}

// faceLeft: zombies turn toward the player.
export function drawZombie(p: Pen, z: Zombie, clock: number, faceLeft: boolean) {
  const x = Math.round(z.x), y = Math.round(z.y), s = z.look.s ?? 1;
  const frozen = clock < z.frozen, squashed = clock < z.squashed;
  const pose = {
    seed: z.seed, still: isHeld(z, clock), tint: clock < z.flash ? P.bone : undefined,
    alpha: frozen ? 0.6 : 1, glow: z.vip ? P.sick : undefined, club: z.armed, left: faceLeft,
  };
  if (frozen) { // ice block
    const h = Math.round((z.look.leg + z.look.tor + z.look.head * 2) * s) + 3, w = Math.round(16 * s);
    figure(p, [B(x - w / 2, y - h, w, h + 1, P.iceL)]);
    p.rect(x - w / 2 + 2, y - h + 2, w - 4, h - 3, P.ice);
  }
  if (z.trait === 'gift') return drawGift(p, x, y, clock + z.seed, pose);
  // Squeezed flat by the squeeze gloves: short and wide.
  const look = squashed ? { ...z.look, leg: z.look.leg * 0.35, tor: z.look.tor * 0.35, tw: z.look.tw * 1.8 } : z.look;
  if (isRising(z, clock)) {
    const k = (clock - z.riseFrom) / RISE_TIME, full = (look.leg + look.tor + look.head * 2) * s;
    return drawCharacter(clipBelow(p, y + 1), x, y + (1 - k) * full, look, clock, pose);
  }
  drawCharacter(p, x, y, look, clock, pose);
}
