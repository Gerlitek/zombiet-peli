import { describe, expect, it } from 'vitest';
import { rng } from '../art/pixels';
import { WIN_AT } from '../data/rules';
import { RK_ODDS, WEAPONS } from '../data/weapons';
import { makePairPuzzle, makePuzzle, PAIR_CHOICES, PUZZLE_LEVELS, puzzleBonus } from './puzzle';
import { pickWeighted } from './random';
import { MAX_SCORE, score } from './score';
import { slices, spin } from './wheel';
import { Combat, ROBOT_TIME, addWeapon, isRobotForm, newArsenal, updateWeapons } from '../systems/weapons';
import { makeZombie } from '../systems/zombies';

describe('pickWeighted', () => {
  it('never picks weight 0 and follows the weights', () => {
    const rand = rng(1), counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) counts[pickWeighted({ a: 3, b: 1, c: 0 }, rand)]++;
    expect(counts.c).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
  });
});

describe('wheel', () => {
  it('forest wheel gives only forest weapons', () => {
    const rand = rng(2);
    for (let i = 0; i < 500; i++) expect(WEAPONS[spin('forest', rand)].wheel).toBe('forest');
  });
  it('Rudi-Karri is not a normal slice, it comes only from its own tiny chance', () => {
    expect(slices('vip')).not.toContain('rudikarri');
    expect(spin('vip', () => 0)).toBe('rudikarri');       // the luckiest possible roll
    expect(spin('forest', () => 0)).not.toBe('rudikarri'); // never from the forest wheel
    const rand = rng(3);
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (spin('vip', rand) === 'rudikarri') hits++;
    expect(hits / 20000).toBeGreaterThan(RK_ODDS * 0.7); // rare, and close to the chosen odds
    expect(hits / 20000).toBeLessThan(RK_ODDS * 1.3);
  });
});

describe('puzzle', () => {
  it.each(PUZZLE_LEVELS.filter((lv) => lv !== 'master'))('%s: parts add up to the target and the answer is among three different choices', (level) => {
    const rand = rng(4);
    for (let i = 0; i < 1000; i++) {
      const p = makePuzzle(level, rand);
      expect(p.shown.reduce((a, b) => a + b, 0) + p.answer).toBe(p.target);
      expect(p.answer).toBeGreaterThan(0);
      expect(p.shown.every((n) => n > 0)).toBe(true);
      expect(p.choices).toContain(p.answer);
      expect(new Set(p.choices).size).toBe(3);
      expect(p.choices.every((n) => n > 0)).toBe(true);
    }
  });
  it('master: exactly one pair of the five drops adds up to the target', () => {
    const rand = rng(7);
    for (let i = 0; i < 1000; i++) {
      const p = makePairPuzzle(rand);
      expect(p.pair[0] + p.pair[1]).toBe(p.target);
      expect(p.choices).toHaveLength(PAIR_CHOICES);
      expect(new Set(p.choices).size).toBe(PAIR_CHOICES);
      expect(p.choices.every((n) => n > 0)).toBe(true);
      const pairs = p.choices.flatMap((x, a) => p.choices.slice(a + 1).filter((y) => x + y === p.target));
      expect(pairs).toHaveLength(1);
      expect(p.target).toBeLessThanOrEqual(200);
    }
  });
  it('faster solve gives a bigger bonus, between 100 and 200', () => {
    expect(puzzleBonus(45, 45)).toBe(200);
    expect(puzzleBonus(0, 45)).toBe(100);
  });
});

describe('score', () => {
  it('a perfect run gives the maximum, and nothing can exceed it', () => {
    expect(score({ kills: WIN_AT, hearts: 5, seconds: 0, won: true, puzzleBonus: 200 })).toBe(MAX_SCORE);
    expect(score({ kills: 10, hearts: 5, seconds: 999, won: true, puzzleBonus: 0 })).toBe(1750); // 1000 + 250 + 500
  });
  it('a lost run gets no time bonus', () => {
    expect(score({ kills: 4, hearts: 0, seconds: 10, won: false, puzzleBonus: 0 })).toBe(400);
  });
});

describe('orbiting blades', () => {
  // The player stands still with one blade weapon and presses attack once at the start.
  function hitsAfterOnePress(weapon: 'laser' | 'katanas' | 'nunchaku', zombieAt: { x: number; y: number }, seconds: number) {
    const arsenal = newArsenal();
    addWeapon(arsenal, weapon);
    const zombie = makeZombie('normal', zombieAt.x, zombieAt.y, -10, false, rng(3));
    let hits = 0, i = 0;
    const c: Combat = { clock: 0, dt: 1 / 60, attack: false, px: 160, py: 150, zombies: [zombie], hit: () => { hits++; }, heal: () => {}, shake: () => {} };
    for (let t = 0; t < seconds; t += c.dt, i++) { c.clock = t; c.attack = i === 0; updateWeapons(arsenal, c); }
    return hits;
  }

  it('the laser also hits a zombie standing right on the player', () => {
    expect(hitsAfterOnePress('laser', { x: 160, y: 150 }, 1)).toBeGreaterThan(0);
  });

  it('do nothing without an attack press', () => {
    const arsenal = newArsenal();
    addWeapon(arsenal, 'laser');
    const zombie = makeZombie('normal', 165, 150, -10, false, rng(3));
    let hits = 0;
    const c: Combat = { clock: 0, dt: 1 / 60, attack: false, px: 160, py: 150, zombies: [zombie], hit: () => { hits++; }, heal: () => {}, shake: () => {} };
    for (let t = 0; t < 3; t += c.dt) { c.clock = t; updateWeapons(arsenal, c); }
    expect(hits).toBe(0);
  });

  it('stop hurting when the spin ends', () => {
    expect(hitsAfterOnePress('laser', { x: 160, y: 150 }, 5)).toBe(hitsAfterOnePress('laser', { x: 160, y: 150 }, 2));
  });
});

describe('Rudi-Karri robot', () => {
  // A minimal game: the player stands still with only the robot, a VIP zombie (super strong) right next to it.
  function world() {
    const arsenal = newArsenal();
    addWeapon(arsenal, 'rudikarri');
    const zombie = makeZombie('giant', 175, 150, -10, true, rng(3)); // risen long ago, VIP strength
    const kills: string[] = [], gone: number[] = [];
    const c: Combat = {
      clock: 0, dt: 1 / 60, attack: false, px: 160, py: 150, zombies: [zombie],
      hit: (z, damage, weapon) => { z.hp -= damage; if (z.hp <= 0) { kills.push(weapon); c.zombies = c.zombies.filter((o) => o !== z); } },
      heal: () => {}, shake: () => {}, robotGone: () => gone.push(c.clock),
    };
    const run = (seconds: number, press = false) => {
      const end = c.clock + seconds;
      for (; c.clock < end; c.clock += c.dt) { c.attack = press; updateWeapons(arsenal, c); press = false; }
    };
    return { arsenal, kills, gone, run };
  }

  it('does nothing by itself: the player is the robot', () => {
    const w = world();
    w.run(2);
    expect(w.kills).toEqual([]);
  });

  it('kills even a VIP giant with one strike', () => {
    const w = world();
    w.run(0.1, true);
    expect(w.kills).toEqual(['rudikarri']);
  });

  it('lasts one minute, then the player is back to normal', () => {
    const w = world();
    w.run(ROBOT_TIME - 1);
    expect(isRobotForm(w.arsenal)).toBe(true);
    w.run(2);
    expect(isRobotForm(w.arsenal)).toBe(false);
    expect(w.gone).toHaveLength(1);
  });
});
