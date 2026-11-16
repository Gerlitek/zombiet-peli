import { Rand, randInt } from './random';

// Number decomposition (hajotelma): a number is split into parts that add up to it, e.g. 12 = 7 + 5.
// The player sees the target and all parts but one, and picks the missing part from the choices.
export type PuzzleLevel = 'easy' | 'medium' | 'hard';
export const PUZZLE_LEVELS: PuzzleLevel[] = ['easy', 'medium', 'hard'];

export interface Puzzle {
  target: number;
  shown: number[];   // the visible parts
  answer: number;    // the missing part
  choices: number[]; // answer + two typical mistakes, shuffled
}

const RULES: Record<PuzzleLevel, { min: number; max: number; parts: number; step: number }> = {
  easy: { min: 5, max: 20, parts: 2, step: 1 },
  medium: { min: 30, max: 100, parts: 2, step: 1 },
  hard: { min: 300, max: 1000, parts: 3, step: 10 },
};

export function makePuzzle(level: PuzzleLevel, rand: Rand): Puzzle {
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

export const harder = (level: PuzzleLevel): PuzzleLevel => PUZZLE_LEVELS[Math.min(PUZZLE_LEVELS.length - 1, PUZZLE_LEVELS.indexOf(level) + 1)];
