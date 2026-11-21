import { Rand, randInt } from './random';

// Number decomposition (hajotelma): a number is split into parts that add up to it, e.g. 12 = 7 + 5.
// The player sees the target and all parts but one, and picks the missing part from the choices.
// Master (mestari) is the other way round: the player finds the two parts themselves (makePairPuzzle).
export type PuzzleLevel = 'easy' | 'medium' | 'hard' | 'master';
export const PUZZLE_LEVELS: PuzzleLevel[] = ['easy', 'medium', 'hard', 'master'];

export interface Puzzle {
  target: number;
  shown: number[];   // the visible parts
  answer: number;    // the missing part
  choices: number[]; // answer + two typical mistakes, shuffled
}

const RULES: Record<Exclude<PuzzleLevel, 'master'>, { min: number; max: number; parts: number; step: number }> = {
  easy: { min: 5, max: 20, parts: 2, step: 1 },
  medium: { min: 30, max: 100, parts: 2, step: 1 },
  hard: { min: 300, max: 1000, parts: 3, step: 10 },
};

export function makePuzzle(level: Exclude<PuzzleLevel, 'master'>, rand: Rand): Puzzle {
  const rule = RULES[level];
  const target = randInt(rand, rule.min / rule.step, rule.max / rule.step) * rule.step;
  // Cut the target into parts. Every part is at least one step.
  const shown: number[] = [];
  let rest = target;
  for (let i = 1; i < rule.parts; i++) {
    const part = randInt(rand, 1, (rest - (rule.parts - i) * rule.step) / rule.step) * rule.step;
    shown.push(part);
    rest -= part;
  }
  const answer = rest;
  // Wrong choices are typical mistakes, not random numbers: off by one step or by ten steps.
  const wrong = [answer + rule.step, answer - rule.step, answer + 10 * rule.step, answer - 10 * rule.step]
    .filter((n) => n > 0 && n !== answer);
  const first = wrong.splice(randInt(rand, 0, wrong.length - 1), 1)[0];
  const second = wrong[randInt(rand, 0, wrong.length - 1)];
  const choices = [answer, first, second];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = randInt(rand, 0, i);
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { target, shown, answer, choices };
}

export const puzzleText = (p: Puzzle) => `${p.target} = ${p.shown.join(' + ')} + ?`;

// A faster solve gives a bigger bonus: 200 at once, 100 when the time is almost out.
export const puzzleBonus = (secondsLeft: number, secondsTotal: number) => 100 + Math.round((100 * secondsLeft) / secondsTotal);

// Master: `? + ? = 150`. Five drops, and exactly one pair of them adds up to the target.
// The other three are near misses (one or ten off a right part), so guessing by size does not work.
export interface PairPuzzle {
  target: number;
  pair: [number, number];
  choices: number[]; // five different numbers, shuffled
}

export const PAIR_CHOICES = 5;

export function makePairPuzzle(rand: Rand): PairPuzzle {
  for (;;) {
    // Both parts are between 30 % and 70 % of the target, so no part stands out by its size alone.
    const target = randInt(rand, 100, 200), a = randInt(rand, Math.ceil(target * 0.3), Math.floor(target * 0.7)), b = target - a;
    const pick = (list: number[]) => list.splice(randInt(rand, 0, list.length - 1), 1)[0];
    const nearA = [a + 1, a - 1, a + 10, a - 10], nearB = [b + 1, b - 1, b + 10, b - 10];
    const choices = [a, b, pick(nearA), pick(nearB), pick([...nearA, ...nearB])]; // one more near miss of either part
    const sums = choices.flatMap((x, i) => choices.slice(i + 1).map((y) => x + y)).filter((n) => n === target);
    if (new Set(choices).size !== PAIR_CHOICES || sums.length !== 1) continue; // try again: the answer must be unique
    for (let i = choices.length - 1; i > 0; i--) {
      const j = randInt(rand, 0, i);
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return { target, pair: [a, b], choices };
  }
}

export const pairText = (p: PairPuzzle, picked: number[]) => `${picked[0] ?? '?'} + ${picked[1] ?? '?'} = ${p.target}`;
