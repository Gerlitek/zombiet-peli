import { P } from '../art/palette';
import { Pen, limb } from '../art/pixels';
import { drawCatRobot } from '../art/scenery';
import { WEAPONS, WeaponDef, WeaponId } from '../data/weapons';
import { Zombie, isRising, knock } from './zombies';

// Nothing attacks by itself: every weapon works when the player presses the attack key.
// (Only the Rudi-Karri robot acts alone, because it is a robot.)
export const SWING_TIME = 0.3;  // seconds one swing animation lasts
const ACTIVE_TIME = 0.9;        // seconds the orbiting blades spin after one press

// What the player owns: weapon level, next allowed use, and what to draw.
export interface Arsenal {
  level: Partial<Record<WeaponId, number>>;
  nextAt: Partial<Record<WeaponId, number>>;
  fx: Partial<Record<WeaponId, { at: number; x: number; y: number }>>;
  angle: Partial<Record<WeaponId, number>>; // orbit position of the blades
  punches: number;
  swingAt: number;      // clock of the last attack press: drives the hero's swing animation
  activeUntil: number;  // orbiting blades do damage until this time
  robot?: Robot;        // the Rudi-Karri robot, once owned
}

// The Rudi-Karri robot circles the player like a blade, but it hunts: when a zombie comes close
// to the player, the robot dashes to it, kills it and flies back. A short rest between dashes
// keeps it from clearing the whole field at once. (A plain orbit could not reach zombies that
// were already next to the player, inside its circle.)
export interface Robot { x: number; y: number; target: Zombie | null; restUntil: number }
const HUNT_RANGE = 44;  // the robot goes after zombies this close to the player
const ROBOT_SPEED = 220; // pixels per second
const ROBOT_REST = 0.8;  // seconds between dashes; shorter on higher levels

// What weapons need from the game. PlayScene implements this.
export interface Combat {
  clock: number;
  dt: number;
  attack: boolean;        // the attack key was pressed
  px: number; py: number; // player position
  zombies: Zombie[];
  hit(z: Zombie, damage: number, weapon: WeaponId): void;
  heal(): void;
  shake(): void;
}

export const newArsenal = (): Arsenal => ({ level: {}, nextAt: {}, fx: {}, angle: {}, punches: 0, swingAt: -9, activeUntil: 0 });

function updateRobot(a: Arsenal, id: WeaponId, c: Combat, near: { z: Zombie; d: number }[]) {
  const def: WeaponDef = WEAPONS[id];
  a.angle[id] = (a.angle[id] ?? 0) + c.dt * (def.spin ?? 1);
  const home = bladePos(a, id, 0, c), homeY = home.y + 9; // the robot stands on the ground: y is its feet, like a zombie's
  const r = (a.robot ??= { x: home.x, y: homeY, target: null, restUntil: 0 });
  if (r.target && (r.target.hp <= 0 || !c.zombies.includes(r.target))) r.target = null; // killed by something else
  if (!r.target && c.clock >= r.restUntil) r.target = near.find((n) => n.d < HUNT_RANGE)?.z ?? null;

  const goal = r.target ?? { x: home.x, y: homeY };
  const dx = goal.x - r.x, dy = goal.y - r.y, dist = hypot(dx, dy), step = ROBOT_SPEED * c.dt;
  if (dist <= step) { r.x = goal.x; r.y = goal.y; } else { r.x += (dx / dist) * step; r.y += (dy / dist) * step; }

  if (r.target && hypot(r.target.x - r.x, r.target.y - r.y) < 8) {
    c.hit(r.target, def.damage, id);
    r.target = null;
    r.restUntil = c.clock + ROBOT_REST / a.level[id]!;
  }
}

export function addWeapon(a: Arsenal, id: WeaponId) {
  a.level[id] = (a.level[id] ?? 0) + 1; // the same weapon again = one level higher
}

const owned = (a: Arsenal) => Object.keys(a.level) as WeaponId[];
const isRobot = (def: WeaponDef) => def.effect === 'robot';
// With blades around the hero, an attack waves the arms instead of striking.
export const hasBlades = (a: Arsenal) => owned(a).some((id) => WEAPONS[id].kind === 'orbit' && !isRobot(WEAPONS[id]));
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
  if (c.attack) { a.swingAt = c.clock; a.activeUntil = c.clock + ACTIVE_TIME; }
  const bladesActive = c.clock < a.activeUntil;
  const near = c.zombies
    .filter((z) => !isRising(z, c.clock))
    .map((z) => ({ z, d: hypot(z.x - c.px, z.y - c.py) }))
    .sort((p, q) => p.d - q.d);

  for (const id of owned(a)) {
    const def: WeaponDef = WEAPONS[id];
    if (isRobot(def)) { updateRobot(a, id, c, near); continue; }
    const damage = def.damage ? def.damage + a.level[id]! - 1 : 0;
    const ready = c.clock >= (a.nextAt[id] ?? 0);

    if (def.kind === 'strike' && c.attack && ready) {
      a.nextAt[id] = c.clock + def.cooldown; // a miss also costs the cooldown
      const inRange = near.filter((n) => n.d < def.range).map((n) => n.z);
      const targets = def.area ? inRange : inRange.slice(0, 1);
      if (!targets.length) continue;
      a.fx[id] = { at: c.clock, x: targets[0].x, y: targets[0].y };
      if (def.effect === 'shake') c.shake();
      if (def.effect === 'heal' && ++a.punches % 3 === 0) c.heal(); // superhanskat "pull health"
      for (const z of targets) {
        knock(z, c.px, c.py, def.knock ?? 0);
        z.stun = c.clock + 0.3;
        c.hit(z, damage, id);
        if (def.effect === 'squash') z.squashed = c.clock + 1.6; // flat and helpless: the next hit kills
      }
    }

    if (def.kind === 'orbit') {
      const active = bladesActive;
      a.angle[id] = (a.angle[id] ?? 0) + c.dt * (def.spin ?? 1) * (active ? 1 : 0.15); // idle blades only drift
      if (active) {
        for (let i = 0; i < (def.blades ?? 1); i++) {
          const b = bladePos(a, id, i, c);
          for (const { z } of near) {
            if (hypot(z.x - b.x, z.y - 8 - b.y) < 10 && c.clock - (z.hits[id] ?? -9) > 0.4) { z.hits[id] = c.clock; c.hit(z, damage, id); }
          }
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

function ring(p: Pen, x: number, y: number, r: number, color: number, alpha: number) {
  for (let i = 0; i < 24; i++) p.rect(x + cos((i * PI) / 12) * r, y - 6 + sin((i * PI) / 12) * r * 0.5, 2, 1, color, alpha);
}

export function drawWeapons(p: Pen, a: Arsenal, c: Combat) {
  const bladesActive = c.clock < a.activeUntil;
  for (const id of owned(a)) {
    const def: WeaponDef = WEAPONS[id], fx = a.fx[id], age = fx ? c.clock - fx.at : 9;
    if (def.kind === 'strike' && fx && age < 0.15) { // impact star
      for (let i = 0; i < 6; i++) p.rect(fx.x + cos(i) * (3 + age * 50), fx.y - 9 + sin(i) * (3 + age * 50), 2, 2, i % 2 ? P.bone : def.color);
    }
    if (def.kind !== 'strike' && fx && age < 0.4) ring(p, fx.x, fx.y, 8 + age * 90, def.color, 1 - age * 2.5);
    if (def.kind !== 'orbit') continue;
    if (isRobot(def)) { if (a.robot) drawCatRobot(p, Math.round(a.robot.x), Math.round(a.robot.y), c.clock); continue; }
    const active = bladesActive;
    if (def.effect === 'tornado' && active) { // blue laser tornado around the player
      for (let i = 0; i < 26; i++) {
        const k = i / 26, ang = c.clock * 7 + i * 0.9, r = 4 + k * 16;
        p.rect(c.px + cos(ang) * r, c.py - k * 34 + sin(ang) * 2, k > 0.6 ? 2 : 1, 1, i % 3 ? P.ice : P.iceL, 0.35 + k * 0.5);
      }
    }
    for (let i = 0; i < (def.blades ?? 1); i++) {
      const b = bladePos(a, id, i, c);
      const shape = BLADE[id] ?? { len: 4, w: 1 }, alpha = active ? 1 : 0.7; // idle blades are a little dim
      const dx = cos(b.ang + 1.5) * shape.len, dy = sin(b.ang + 1.5) * shape.len * 0.75;
      if (id === 'laser') limb(p, b.x - dx, b.y - dy, b.x + dx, b.y + dy, 4, P.ice, false, 0, alpha * 0.35); // glow
      if (id === 'nunchaku') for (let k = 1; k < 5; k++) p.rect(c.px + (b.x - c.px) * (k / 5), c.py - 9 + (b.y - c.py + 9) * (k / 5), 1, 1, P.bone, alpha); // chain to the hand
      limb(p, b.x - dx, b.y - dy, b.x + dx, b.y + dy, shape.w, def.color, false, 0, alpha);
      if (id === 'katanas') p.rect(b.x - dx - 1, b.y - dy - 1, 3, 3, P.ice, alpha); // handle
      if (active) for (let k = 1; k < 4; k++) p.rect(c.px + cos(b.ang - k * 0.3) * def.range, c.py - 9 + sin(b.ang - k * 0.3) * def.range * 0.5, 1, 1, P.iceL, 0.6 - k * 0.15);
      p.rect(b.x, b.y, 1, 1, P.ice);
    }
  }
}
