import { P } from '../art/palette';
import { Pen, limb } from '../art/pixels';
import { RobotPose } from '../art/scenery';
import { WEAPONS, WeaponDef, WeaponId } from '../data/weapons';
import { Zombie, isRising, knock } from './zombies';

// Nothing attacks by itself: every weapon works when the player presses the attack key.
export const SWING_TIME = 0.3;  // seconds one swing animation lasts
const ACTIVE_TIME = 1.6;        // seconds the orbiting blades spin and hurt after one press: long enough to be clearly seen
const FADE_TIME = 0.3;          // the blades fade out during the last part of that time

// What the player owns: weapon level, next allowed use, and what to draw.
export interface Arsenal {
  level: Partial<Record<WeaponId, number>>;
  nextAt: Partial<Record<WeaponId, number>>;
  fx: Partial<Record<WeaponId, { at: number; x: number; y: number }>>;
  angle: Partial<Record<WeaponId, number>>; // orbit position of the blades
  punches: number;
  swingAt: number;      // clock of the last attack press: drives the hero's swing animation
  activeUntil: number;  // orbiting blades do damage until this time
  robotUntil: number;   // the player is the Rudi-Karri robot until this time (0 = not yet)
}

// Rudi-Karri: the player turns into the two-headed cat robot for a minute. Every strike then kills
// the nearest zombie at once (damage 999 in data/weapons.ts). After that the robot goes home.
export const ROBOT_TIME = 60;
export const isRobotForm = (a: Arsenal) => a.level.rudikarri !== undefined;
// The robot faces the way it walks, and the zombie it shoots (strikes turn the hero toward the target).
// Right after a shot, the laser tail aims at the zombie that was hit.
export function robotPose(a: Arsenal, clock: number, faceLeft: boolean): RobotPose {
  const fx = a.fx.rudikarri, age = fx ? clock - fx.at : 9;
  return { mirror: faceLeft, aim: fx && age < SWING_TIME ? { x: fx.x, y: fx.y - 9, age } : undefined };
}

// What weapons need from the game. PlayScene implements this.
export interface Combat {
  clock: number;
  dt: number;
  attack: boolean;        // the attack key was pressed
  px: number; py: number; // player position
  zombies: Zombie[];
  hit(z: Zombie, damage: number, weapon: WeaponId): void;
  heal(): void;
  shake(power: number): void;
  robotGone?(): void;     // the minute as the robot is over
}

export const newArsenal = (): Arsenal => ({ level: {}, nextAt: {}, fx: {}, angle: {}, punches: 0, swingAt: -9, activeUntil: 0, robotUntil: 0 });

export function addWeapon(a: Arsenal, id: WeaponId) {
  a.level[id] = (a.level[id] ?? 0) + 1; // the same weapon again = one level higher
}

const owned = (a: Arsenal) => Object.keys(a.level) as WeaponId[];
// With blades around the hero, an attack waves the arms instead of striking.
export const hasBlades = (a: Arsenal) => owned(a).some((id) => WEAPONS[id].kind === 'orbit');
const { cos, sin, hypot, PI } = Math;

// What the hero visibly wears or carries because of the owned weapons. Spread into the hero's pose.
export function gearOf(a: Arsenal): { gloves?: number; hammer?: boolean } {
  const has = (id: WeaponId) => a.level[id] !== undefined;
  return { hammer: has('hammer'), gloves: has('ice') ? P.ice : has('squeeze') ? P.storm : has('gloves') ? P.hurt : undefined };
}

// Blade length on screen: each orbiting weapon has its own clear shape.
const BLADE: Partial<Record<WeaponId, { len: number; w: number }>> = { katanas: { len: 8, w: 1 }, nunchaku: { len: 5, w: 2 }, laser: { len: 10, w: 2 } };

// Blades circle the player on a flat ellipse, because the view is tilted.
function bladePos(a: Arsenal, id: WeaponId, i: number, c: Combat) {
  const def: WeaponDef = WEAPONS[id], ang = (a.angle[id] ?? 0) + (i * 2 * PI) / (def.blades ?? 1);
  return { x: c.px + cos(ang) * def.range, y: c.py - 9 + sin(ang) * def.range * 0.5, ang };
}

export function updateWeapons(a: Arsenal, c: Combat) {
  if (isRobotForm(a)) { // the minute starts on the first frame after the wheel gives the robot
    a.robotUntil ||= c.clock + ROBOT_TIME;
    if (c.clock >= a.robotUntil) { delete a.level.rudikarri; a.robotUntil = 0; c.robotGone?.(); }
  }
  if (c.attack) { a.swingAt = c.clock; a.activeUntil = c.clock + ACTIVE_TIME; }
  const bladesActive = c.clock < a.activeUntil;
  const near = c.zombies
    .filter((z) => !isRising(z, c.clock))
    .map((z) => ({ z, d: hypot(z.x - c.px, z.y - c.py) }))
    .sort((p, q) => p.d - q.d);

  for (const id of owned(a)) {
    const def: WeaponDef = WEAPONS[id];
    const damage = def.damage ? def.damage + a.level[id]! - 1 : 0;
    const ready = c.clock >= (a.nextAt[id] ?? 0);

    if (def.kind === 'strike' && c.attack && ready) {
      a.nextAt[id] = c.clock + def.cooldown; // a miss also costs the cooldown
      const inRange = near.filter((n) => n.d < def.range).map((n) => n.z);
      const targets = def.area ? inRange : inRange.slice(0, 1);
      // The hammer shakes the whole ground: zombies farther away take the same hit and stagger.
      const shaken = def.quake ? near.filter((n) => n.d >= def.range).map((n) => n.z) : [];
      if (!targets.length && !shaken.length) continue;
      // The hammer hits the ground at the hero's feet, other strikes hit the zombie.
      a.fx[id] = def.quake ? { at: c.clock, x: c.px, y: c.py } : { at: c.clock, x: targets[0].x, y: targets[0].y };
      if (def.effect === 'shake') c.shake(0.014);
      else if (id === 'sword') c.shake(0.004); // a small jolt: the knight's sword feels heavier than a fist
      if (def.effect === 'heal' && ++a.punches % 6 === 0) c.heal(); // superhanskat "pull health": every sixth blow that lands
      for (const z of targets) {
        knock(z, c.px, c.py, def.knock ?? 0);
        z.stun = c.clock + 0.3;
        c.hit(z, damage, id);
        if (def.effect === 'squash') z.squashed = c.clock + 1.6; // flat and helpless: the next hit kills
      }
      for (const z of shaken) {
        knock(z, c.px, c.py, 60);
        z.stun = c.clock + 0.6;
        c.hit(z, damage, id); // the same hit as next to the hammer, only without the big knockback
      }
    }

    if (def.kind === 'orbit') {
      // Blades spin and hurt only for a moment after each attack press. Between presses they are put away.
      if (bladesActive) {
        a.angle[id] = (a.angle[id] ?? 0) + c.dt * (def.spin ?? 1);
        for (const { z, d } of near) {
          if (c.clock - (z.hits[id] ?? -9) <= 0.4) continue; // each blade weapon hits the same zombie at most every 0.4 s
          // A zombie inside the circle (right next to the player) is swept too: the blades alone would pass around it.
          const touched = d < def.range || Array.from({ length: def.blades ?? 1 }, (_, i) => bladePos(a, id, i, c))
            .some((b) => hypot(z.x - b.x, z.y - 8 - b.y) < 10);
          if (touched) { z.hits[id] = c.clock; c.hit(z, damage, id); }
        }
      }
      if (def.effect === 'whirl' && c.attack && ready && near.some((n) => n.d < 44)) { // whirlwind pushes zombies away
        a.nextAt[id] = c.clock + def.cooldown;
        a.fx[id] = { at: c.clock, x: c.px, y: c.py };
        for (const n of near) if (n.d < 44) { knock(n.z, c.px, c.py, 260); n.z.stun = c.clock + 0.5; }
      }
    }

    if (def.kind === 'status' && c.attack && ready) {
      a.nextAt[id] = c.clock + def.cooldown;
      a.fx[id] = { at: c.clock, x: c.px, y: c.py };
      for (const n of near) if (n.d < def.range) n.z.frozen = c.clock + 2;
    }
  }
}

// Each strike weapon has its own hit, so the player sees which weapon did it. (x, y) is the middle of the zombie.
type Impact = (p: Pen, x: number, y: number, age: number, color: number) => void;
const star: Impact = (p, x, y, age, color) => { // fist and others: a small star
  for (let i = 0; i < 6; i++) p.rect(x + cos(i) * (3 + age * 50), y + sin(i) * (3 + age * 50), 2, 2, i % 2 ? P.bone : color);
};
const IMPACT: Partial<Record<WeaponId, Impact>> = {
  sword(p, x, y, age) { // a white slash across the zombie
    const k = Math.min(1, age / 0.08), a = 1 - age * 4;
    for (let i = 0; i < 12 * k; i++) p.rect(x - 9 + i * 1.5, y - 7 + i * 1.2, 2, 1, i % 3 ? P.bone : P.iceL, a);
    for (let i = 0; i < 12 * k; i++) p.rect(x - 8 + i * 1.5, y - 6 + i * 1.2, 2, 1, P.rain, a * 0.6);
  },
  gloves(p, x, y, age, color) { // a big burst: the zombie flies far
    for (let i = 0; i < 10; i++) { const an = i * 0.63, r = 4 + age * 90; limb(p, x + cos(an) * r * 0.5, y + sin(an) * r * 0.5, x + cos(an) * r, y + sin(an) * r, 1, i % 2 ? P.bone : color, false, 0, 1 - age * 5); }
  },
  rudikarri(p, x, y, age) { // where the laser hits: a burst of light (the beam itself is drawn with the robot)
    for (let i = 0; i < 10; i++) { const an = i * 0.63, r = 2 + age * 70; p.rect(x + cos(an) * r, y + sin(an) * r * 0.7, 2, 1, i % 2 ? P.iceL : P.bone, 1 - age * 5); }
  },
  squeeze(p, x, y, age, color) { // two hands press the zombie flat from the sides
    const gap = Math.max(1, 10 - age * 80), a = 1 - age * 4;
    for (const side of [-1, 1]) { p.rect(x + side * gap - 1, y - 4, 2, 9, color, a); p.rect(x + side * (gap + 2) - 1, y - 2, 2, 5, P.bone, a); }
  },
};

function ring(p: Pen, x: number, y: number, r: number, color: number, alpha: number, dots = 24) {
  for (let i = 0; i < dots; i++) p.rect(x + cos((i * 2 * PI) / dots) * r, y - 6 + sin((i * 2 * PI) / dots) * r * 0.5, 2, 1, color, alpha);
}

export function drawWeapons(p: Pen, a: Arsenal, c: Combat) {
  const bladesActive = c.clock < a.activeUntil;
  for (const id of owned(a)) {
    const def: WeaponDef = WEAPONS[id], fx = a.fx[id], age = fx ? c.clock - fx.at : 9;
    if (def.quake && fx && age < 0.5) { // the ground shakes: rings run out over the whole field
      ring(p, fx.x, fx.y + 6, 10 + age * 640, def.color, 1 - age * 2, 160);
      ring(p, fx.x, fx.y + 6, 6 + age * 480, P.bone, 0.6 - age * 1.2, 120);
    }
    if (def.kind === 'strike' && fx && age < 0.2) (IMPACT[id] ?? star)(p, fx.x, fx.y - 9, age, def.color);
    if (def.kind !== 'strike' && fx && age < 0.4) ring(p, fx.x, fx.y, 8 + age * 90, def.color, 1 - age * 2.5);
    if (def.effect === 'freeze' && fx && age < 0.5) { // ice shards fly out with the ring
      for (let i = 0; i < 10; i++) { const r = 10 + age * 80, an = i * 0.63; p.rect(fx.x + cos(an) * r, fx.y - 6 + sin(an) * r * 0.5, 1, 3, P.iceL, 1 - age * 2); }
    }
    if (def.kind !== 'orbit') continue;
    if (!bladesActive) continue; // put away between attacks, so they never look like they are working
    const alpha = Math.min(1, (a.activeUntil - c.clock) / FADE_TIME); // full while hurting, fades just before stopping
    if (def.effect === 'tornado') { // blue laser tornado around the player
      for (let i = 0; i < 26; i++) {
        const k = i / 26, ang = c.clock * 7 + i * 0.9, r = 4 + k * 16;
        p.rect(c.px + cos(ang) * r, c.py - k * 34 + sin(ang) * 2, k > 0.6 ? 2 : 1, 1, i % 3 ? P.ice : P.iceL, (0.35 + k * 0.5) * alpha);
      }
    }
    for (let i = 0; i < (def.blades ?? 1); i++) {
      const b = bladePos(a, id, i, c);
      const shape = BLADE[id] ?? { len: 4, w: 1 };
      const dx = cos(b.ang + 1.5) * shape.len, dy = sin(b.ang + 1.5) * shape.len * 0.75;
      if (id === 'laser') limb(p, b.x - dx, b.y - dy, b.x + dx, b.y + dy, 4, P.ice, false, 0, alpha * 0.35); // glow
      if (id === 'nunchaku') for (let k = 1; k < 5; k++) p.rect(c.px + (b.x - c.px) * (k / 5), c.py - 9 + (b.y - c.py + 9) * (k / 5), 1, 1, P.bone, alpha); // chain to the hand
      limb(p, b.x - dx, b.y - dy, b.x + dx, b.y + dy, shape.w, def.color, false, 0, alpha);
      if (id === 'katanas') p.rect(b.x - dx - 1, b.y - dy - 1, 3, 3, P.ice, alpha); // handle
      for (let k = 1; k < 4; k++) p.rect(c.px + cos(b.ang - k * 0.3) * def.range, c.py - 9 + sin(b.ang - k * 0.3) * def.range * 0.5, 1, 1, P.iceL, (0.6 - k * 0.15) * alpha);
      p.rect(b.x, b.y, 1, 1, P.ice, alpha);
    }
  }
}
