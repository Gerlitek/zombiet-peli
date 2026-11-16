import { describe, expect, it } from 'vitest';
import { rng } from '../art/pixels';
import { WIN_AT } from '../data/rules';
import { RK_ODDS, WEAPONS } from '../data/weapons';
import { makePuzzle, PUZZLE_LEVELS, puzzleBonus } from './puzzle';
import { pickWeighted } from './random';
import { MAX_SCORE, score } from './score';
import { slices, spin } from './wheel';

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
  it.each(PUZZLE_LEVELS)('%s: parts add up to the target and the answer is among three different choices', (level) => {
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
