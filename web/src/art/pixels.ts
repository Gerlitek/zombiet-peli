import { P } from './palette';

// Everything on screen is built from one operation: fill a rectangle.
// A Pen hides where the rectangle goes (a Phaser Graphics object in the game).
export interface Pen {
  rect(x: number, y: number, w: number, h: number, color: number, alpha?: number): void;
}

const R = Math.round;

export function ell(p: Pen, cx: number, cy: number, rx: number, ry: number, c: number, a = 1) {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
    p.rect(R(cx) - hw, R(cy) + y, hw * 2 + 1, 1, c, a);
  }
}

// A limb is a line with a leaf profile: thin at both ends, thick in the middle (as in the child's drawings).
export function limb(p: Pen, x0: number, y0: number, x1: number, y1: number, w: number, c: number, leaf = true, grow = 0, a = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = Math.max(1, R(leaf ? w * Math.sin(Math.PI * (0.14 + 0.72 * t)) : w)) + grow * 2;
    p.rect(x0 + (x1 - x0) * t - th / 2, y0 + (y1 - y0) * t - th / 2, th, th, c, a);
  }
}

export type Part =
  | { kind: 'limb'; x0: number; y0: number; x1: number; y1: number; w: number; c: number; leaf: boolean }
  | { kind: 'ell'; x: number; y: number; rx: number; ry: number; c: number }
  | { kind: 'box'; x: number; y: number; w: number; h: number; c: number }
  | { kind: 'dot'; x: number; y: number; w: number; h: number; c: number }; // detail without outline (eyes)

export const L = (x0: number, y0: number, x1: number, y1: number, w: number, c: number, leaf = true): Part => ({ kind: 'limb', x0, y0, x1, y1, w, c, leaf });
export const E = (x: number, y: number, rx: number, ry: number, c: number): Part => ({ kind: 'ell', x, y, rx, ry, c });
export const B = (x: number, y: number, w: number, h: number, c: number): Part => ({ kind: 'box', x, y, w, h, c });
export const D = (x: number, y: number, w: number, h: number, c: number): Part => ({ kind: 'dot', x, y, w, h, c });

// Draw all parts once in ink (one pixel bigger), then in color: a dark outline around the whole figure.
// tint replaces every fill color (hit flash), alpha fades the figure (frozen, invulnerable).
export function figure(p: Pen, parts: Part[], o: { tint?: number; alpha?: number } = {}) {
  const a = o.alpha ?? 1;
  for (const grow of [1, 0]) {
    for (const s of parts) {
      const c = grow ? P.ink : o.tint ?? s.c;
      if (s.kind === 'limb') limb(p, s.x0, s.y0, s.x1, s.y1, s.w, c, s.leaf, grow, a);
      else if (s.kind === 'ell') ell(p, s.x, s.y, s.rx + grow, s.ry + grow, c, a);
      else if (s.kind === 'box') p.rect(s.x - grow, s.y - grow, s.w + grow * 2, s.h + grow * 2, c, a);
      else if (!grow) p.rect(s.x, s.y, s.w, s.h, c, a);
    }
  }
}

// A pen that draws nothing below maxY. Used when a zombie rises from a puddle.
export function clipBelow(p: Pen, maxY: number): Pen {
  return {
    rect(x, y, w, h, c, a) {
      const hh = Math.min(h, maxY - R(y));
      if (hh > 0) p.rect(x, y, w, hh, c, a);
    },
  };
}

// Small seeded random generator (mulberry32): the same seed always gives the same scenery.
export function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
