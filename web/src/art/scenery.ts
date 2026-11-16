import { P } from './palette';
import { B, E, L, Part, Pen, ell, figure, limb, rng } from './pixels';

const { sin, round: R, floor, sqrt, abs, min } = Math;

export function drawTree(p: Pen, x: number, y: number, h: number, seed: number, burning: boolean, t: number) {
  const r = rng(seed), tilt = (r() - 0.5) * 6, top = { x: x + tilt, y: y - h };
  const parts: Part[] = [L(x, y, top.x, top.y, 3, P.bark, false)];
  for (let i = 0; i < 4; i++) {
    const k = 0.35 + r() * 0.6, bx = x + tilt * k, by = y - h * k, dir = i % 2 ? 1 : -1, len = 4 + r() * 7;
    parts.push(L(bx, by, bx + dir * len, by - len * (0.3 + r() * 0.7), 1, P.bark, false));
  }
  ell(p, x, y, 5, 1, P.ink, 0.4);
  figure(p, parts);
  if (burning) for (let i = 0; i < 6; i++) p.rect(top.x - 3 + r() * 6, top.y - ((t * 14 + i * 5) % 12), 1, 1, i % 2 ? P.sand : P.hurt);
}

export function drawTuft(p: Pen, x: number, y: number, t: number) {
  const w = R(sin(t * 2 + x));
  p.rect(x, y - 2, 1, 3, P.dry); p.rect(x - 2 + w, y - 3, 1, 3, P.dry); p.rect(x + 2 + w, y - 4, 1, 4, P.dry);
}

// Big crosshatched raindrop, as in the page sketch. Zombies are born from these.
export function drawDrop(p: Pen, x: number, y: number, r: number) {
  x = R(x); y = R(y);
  for (let dy = -r * 2; dy <= r; dy++) {
    const hw = dy < 0 ? floor(r * (1 + dy / (r * 2))) : floor(sqrt(r * r - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) p.rect(x + dx, y + dy, 1, 1, abs(dx) === hw ? P.rain : (x + dx + y + dy) % 2 ? P.storm : P.ice);
  }
}

export function drawClouds(p: Pen, t: number, seed: number, yBase: number) {
  const r = rng(seed);
  for (let i = 0; i < 12; i++) {
    const x = ((r() * 380 + t * (2 + r() * 2)) % 380) - 30, y = yBase + r() * 14, rx = 16 + R(r() * 16), ry = 6 + R(r() * 5);
    ell(p, x, y, rx, ry, P.cloud); ell(p, x - 3, y - 3, rx - 6, ry - 3, P.storm);
  }
}

export function drawBolt(p: Pen, x0: number, y0: number, x1: number, y1: number, seed: number) {
  const r = rng(seed);
  let x = x0, y = y0;
  while (y < y1) {
    const ny = min(y1, y + 6 + r() * 8);
    const nx = x1 + (x - x1) * ((y1 - ny) / (y1 - y0)) + (ny < y1 ? (r() - 0.5) * 16 : 0);
    limb(p, x, y, nx, ny, 3, P.ice, false); limb(p, x, y, nx, ny, 1, P.bone, false);
    x = nx; y = ny;
  }
}

export function drawHeart(p: Pen, x: number, y: number, c: number) {
  p.rect(x + 1, y, 1, 1, c); p.rect(x + 3, y, 1, 1, c); p.rect(x, y + 1, 5, 2, c); p.rect(x + 1, y + 3, 3, 1, c); p.rect(x + 2, y + 4, 1, 1, c);
}

export function drawPanel(p: Pen, x: number, y: number, w: number, h: number, border: number, fill: number = P.ink) {
  p.rect(x, y, w, h, border); p.rect(x + 1, y + 1, w - 2, h - 2, fill);
}

export const HORIZON = 72;

// Static forest background: sky, far trees, rotten moss, dirty water. Drawn once into a texture.
export function drawForestGround(p: Pen, W: number, H: number) {
  p.rect(0, 0, W, HORIZON, P.sky);
  for (let x = 0; x < W; x += 2) p.rect(x, HORIZON - 12 + ((x / 2) % 2) * 2, 1, 1, P.cloud);
  const far = rng(11);
  for (let i = 0; i < 14; i++) {
    const x = far() * W, h = 10 + far() * 14;
    p.rect(x, HORIZON - h, 2, h, P.ink); p.rect(x - 3, HORIZON - h * 0.7, 3, 1, P.ink); p.rect(x + 2, HORIZON - h * 0.5, 4, 1, P.ink);
  }
  p.rect(0, HORIZON, W, H - HORIZON, P.moss0);
  const g = rng(5);
  for (let i = 0; i < 16; i++) ell(p, g() * W, HORIZON + 10 + g() * 160, 10 + R(g() * 16), 3 + R(g() * 4), P.moss1);
  for (let i = 0; i < 40; i++) p.rect(g() * W, HORIZON + 6 + g() * 160, 1, 1, i % 3 ? P.rot : P.dry);
  ell(p, 236, 196, 44, 13, P.ink); ell(p, 236, 195, 42, 12, P.cloud);
  for (let i = 0; i < 5; i++) p.rect(205 + i * 14, 190 + (i % 3) * 5, 6, 1, P.storm);
  p.rect(222, 199, 3, 2, P.dry); p.rect(251, 192, 2, 2, P.rot);
}

export const BOARD = { x: 14, y: 16, w: 292, h: 58 };

// Static VIP box background: back board on poles, lit stage floor, light blue rail.
export function drawVipGround(p: Pen, W: number, H: number) {
  p.rect(0, 0, W, H, P.sky);
  p.rect(30, 60, 4, 30, P.storm); p.rect(286, 60, 4, 30, P.storm);
  drawPanel(p, BOARD.x, BOARD.y, BOARD.w, BOARD.h, P.ice);
  for (let y = 0; y < 9; y++) p.rect(0, 90 + y * y * 2, W, 1, P.cloud);
  for (let i = -8; i <= 8; i++) limb(p, 160 + i * 14, 84, 160 + i * 52, H, 1, P.cloud, false);
  p.rect(0, 84, W, 2, P.ice);
  for (let x = 6; x < W; x += 24) p.rect(x, 78, 2, 8, P.ice);
  p.rect(0, 78, W, 1, P.iceL);
  ell(p, 160, 160, 120, 50, P.ice, 0.1);
}

// Rudi-Karri: a two-headed cat robot. One head is Rudi, the other is Karri.
export function drawCatRobot(p: Pen, x: number, y: number, t: number) {
  const tail = sin(t * 4) * 2;
  ell(p, x, y, 7, 1, P.ink, 0.4);
  figure(p, [
    L(x - 6, y - 5, x - 9, y - 11 + tail, 1, P.sand, false), B(x - 5, y - 8, 11, 6, P.rain),
    B(x - 8, y - 14, 7, 6, P.bone), B(x - 8, y - 16, 2, 2, P.bone), B(x - 3, y - 16, 2, 2, P.bone),
    B(x + 2, y - 14, 7, 6, P.sand), B(x + 2, y - 16, 2, 2, P.sand), B(x + 7, y - 16, 2, 2, P.sand),
    B(x - 4, y - 2, 2, 2, P.storm), B(x + 3, y - 2, 2, 2, P.storm),
    E(x, y - 5, 1, 1, P.ice),
  ]);
  for (const hx of [x - 6, x + 4]) { p.rect(hx, y - 12, 1, 2, P.ice); p.rect(hx + 3, y - 12, 1, 2, P.ice); }
}
