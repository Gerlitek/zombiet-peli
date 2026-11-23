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

export function drawTuft(p: Pen, x: number, y: number, t: number, c: number = P.dry) {
  const w = R(sin(t * 2 + x));
  p.rect(x, y - 2, 1, 3, c); p.rect(x - 2 + w, y - 3, 1, 3, c); p.rect(x + 2 + w, y - 4, 1, 4, c);
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

// A spruce as a flat silhouette: a short trunk and tiers of branches that widen downwards. x is the middle, base the foot.
export function drawSpruce(p: Pen, x: number, base: number, h: number, c: number, a = 1) {
  const trunk = Math.max(2, R(h * 0.1)), rows = R(h) - trunk, tiers = Math.max(3, R(h / 10)), tier = rows / tiers;
  p.rect(R(x) - 1, base - trunk, 2, trunk, c, a);
  for (let r = 0; r < rows; r++) {
    const i = Math.floor(r / tier), k = (r % tier) / tier; // which tier, and how far down it
    const hw = R(1 + i * 1.5 + k * (2.5 + i * 0.7));
    p.rect(R(x) - hw, base - trunk - rows + r, hw * 2, 1, c, a);
  }
}

// The spruce forest beside the game in full screen: grey silhouettes, see-through, so the far row shows behind the near one.
// The picture repeats sideways: a tree that crosses one edge is drawn again at the other, so the seam does not show.
export function drawSpruceEdge(p: Pen, w: number, h: number) {
  const s = rng(31), white = 0xffffff;
  const row = (n: number, low: number, high: number, sink: number, a: number) => {
    for (let i = 0; i < n; i++) {
      const x = ((i + s() * 0.8) / n) * w, th = low + s() * (high - low), base = h + R(s() * sink);
      for (const dx of [-w, 0, w]) drawSpruce(p, x + dx, base, th, white, a);
    }
  };
  row(9, 120, 170, 0, 0.035); // far
  row(6, 70, 125, 8, 0.05); // near
  p.rect(0, h - 6, w, 6, white, 0.04); // the forest floor
}

export const BOARD = { x: 14, y: 23, w: 292, h: 52 }; // below the hearts, the kill bar and the VIP sign

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

// Rudi-Karri: a robot cat with two heads, seen from the side like drawCat. One head is Rudi (brown colorpoint
// ragdoll), the other Karri (grey mitted ragdoll), both with blue eyes. The body is a metal cat: a long shell
// with a lit stripe, four walking legs and a laser tail. It faces right; mirror: it faces left.
// aim: the laser tail rises over the back like a scorpion's and fires a beam at that point (age = seconds since the shot).
export interface RobotPose { mirror?: boolean; aim?: { x: number; y: number; age: number } }

export function drawCatRobot(p: Pen, x: number, y: number, t: number, o: RobotPose = {}) {
  x = R(x); y = R(y);
  const out = p; // the beam is drawn in world space, outside the mirror
  if (o.mirror) p = { rect: (rx, ry, w, h, c, a) => out.rect(2 * x - R(rx) - w + 1, ry, w, h, c, a) };
  const run = sin(t * 14), step = R(run), blink = floor(t * 3) % 2 === 0, firing = o.aim !== undefined;
  ell(p, x, y, 9, 1, P.ink, 0.4);
  // Laser tail: resting it curls up behind; firing it arches over the back and points forward.
  const mid = firing ? { x: x - 9, y: y - 17 } : { x: x - 12, y: y - 11 + R(sin(t * 4)) };
  const tip = firing ? { x: x - 2, y: y - 22 } : { x: x - 11, y: y - 16 + R(sin(t * 4) * 2) };
  figure(p, [
    L(x - 7, y - 7, mid.x, mid.y, 2, P.storm, false), L(mid.x, mid.y, tip.x, tip.y, 2, P.storm, false),
    B(x - 6, y - 4 + step, 2, 4 - step, P.storm), B(x - 3, y - 4 - step, 2, 4 + step, P.storm), // back legs
    B(x + 2, y - 4 - step, 2, 4 + step, P.storm), B(x + 5, y - 4 + step, 2, 4 - step, P.storm), // front legs
    E(x, y - 7, 8, 3, P.rain), // long metal body
    B(x + 4, y - 11, 2, 3, P.storm), B(x + 9, y - 10, 2, 3, P.storm), // two necks
    ...catHead(x + 3, y - 14, P.storm), // Karri: the same head as the grey mitted cat on the dunes
    ...catHead(x + 10, y - 13, P.bark), // Rudi: the same head as the brown colorpoint cat
  ]);
  for (const lx of [x - 6, x - 3]) p.rect(lx, y - 1, 2, 1, P.ink); // back paws (the front paws are Karri's white mitts)
  p.rect(x - 6, y - 9, 12, 1, P.iceL); // light on the back
  p.rect(x - 5, y - 6, 1, 1, P.storm); p.rect(x + 3, y - 6, 1, 1, P.storm); // rivets
  p.rect(x - 1, y - 7, 2, 2, blink ? P.ice : P.storm); // light on the side
  catFace(p, x + 3, y - 14, P.storm, true); catFace(p, x + 10, y - 13, P.bark, false);
  p.rect(x + 2, y - 1, 2, 1, P.bone); p.rect(x + 5, y - 1, 2, 1, P.bone); // Karri's white mitts on the front paws
  p.rect(tip.x - 1, tip.y - 1, 3, 3, firing || blink ? P.iceL : P.ice); // laser emitter at the tail tip
  if (o.aim && o.aim.age < 0.15) { // the beam: a bright core in a soft glow, from the tail tip to the zombie
    const sx = o.mirror ? 2 * x - tip.x : tip.x, a = 1 - o.aim.age / 0.15;
    limb(out, sx, tip.y, o.aim.x, o.aim.y, 3, P.ice, false, 0, 0.45 * a);
    limb(out, sx, tip.y, o.aim.x, o.aim.y, 1, P.bone, false, 0, a);
    ell(out, o.aim.x, o.aim.y, 3, 2, P.iceL, a);
  }
}

// ---------- practice area: the sand dunes of Kalajoki (Hiekkasärkät) ----------

export const SHORE = 84; // y where the sea meets the sand

// Static background: light summer night sky, low sun, sea, beach and dunes.
export function drawDunesGround(p: Pen, W: number, H: number) {
  p.rect(0, 0, W, 34, P.rain); p.rect(0, 34, W, 16, P.iceL);
  for (let x = 0; x < W; x += 2) p.rect(x, 33, 1, 1, P.iceL);
  ell(p, 70, 50, 13, 13, P.sand); ell(p, 70, 50, 9, 9, P.bone); // the sun stays low over the sea
  p.rect(0, 50, W, SHORE - 50, P.storm);
  const s = rng(21);
  for (let i = 0; i < 40; i++) p.rect(s() * W, 52 + s() * (SHORE - 54), 4 + R(s() * 8), 1, i % 3 ? P.ice : P.rain);
  for (let i = 0; i < 9; i++) p.rect(60 + s() * 20, 52 + i * 3, 6 + R(s() * 10), 1, P.sand); // sun glitter on the water
  p.rect(0, SHORE, W, H - SHORE, P.sand);
  p.rect(0, SHORE, W, 5, P.dry); // wet sand
  // dunes: a shadow side and a light crest
  for (const [x, y, rx, ry] of [[250, 124, 60, 16], [60, 150, 70, 14], [200, 196, 80, 15], [20, 222, 60, 12], [300, 226, 50, 10]]) {
    ell(p, x, y, rx, ry, P.dry); ell(p, x - 2, y - 2, rx - 1, ry - 1, P.sand);
  }
  for (let i = 0; i < 60; i++) p.rect(s() * W, SHORE + 8 + s() * (H - SHORE - 10), 1, 1, i % 2 ? P.dry : P.bone);
}

// Helicopter seen from the side. rotor: 0 = stopped, 1 = full speed.
export function drawHelicopter(p: Pen, x: number, y: number, t: number, rotor: number) {
  x = R(x); y = R(y);
  ell(p, x, y + 1, 16, 2, P.ink, 0.35);
  figure(p, [
    L(x - 9, y - 11, x - 26, y - 14, 2, P.storm, false), B(x - 28, y - 19, 2, 7, P.storm),
    B(x - 9, y - 2, 20, 1, P.cloud), B(x - 5, y - 5, 1, 3, P.cloud), B(x + 6, y - 5, 1, 3, P.cloud),
    E(x, y - 11, 11, 6, P.storm), B(x - 1, y - 20, 2, 3, P.cloud),
  ]);
  ell(p, x + 5, y - 12, 4, 3, P.ice); p.rect(x + 3, y - 14, 2, 1, P.bone);
  p.rect(x - 9, y - 9, 12, 1, P.sand); // stripe
  const span = R(20 * Math.abs(Math.cos(t * (4 + rotor * 22))) * (0.35 + rotor * 0.65)) + 3;
  p.rect(x - span, y - 21, span * 2, 1, P.bone, 0.9);
  if (rotor > 0.5) p.rect(x - 20, y - 21, 40, 1, P.bone, 0.25); // blur at speed
  p.rect(x - 28, y - 17 + R(Math.sin(t * 30) * 2), 1, 3, P.bone);
}

// A ragdoll cat's head, shared by the cats and the Rudi-Karri robot so they look the same:
// a light head with dark ears, a dark mask round the nose, blue eyes and (mitted) a white chin.
const catHead = (hx: number, hy: number, points: number): Part[] => [E(hx, hy, 3, 2, P.bone), B(hx - 3, hy - 4, 2, 2, points), B(hx + 2, hy - 4, 2, 2, points)];
function catFace(p: Pen, hx: number, hy: number, points: number, mitted: boolean) {
  p.rect(hx - 1, hy - 1, 3, 2, points); // mask
  if (mitted) p.rect(hx, hy + 1, 1, 1, P.bone); // white chin
  p.rect(hx - 2, hy - 1, 1, 1, P.ice); p.rect(hx + 2, hy - 1, 1, 1, P.ice); // blue eyes
}

// Ragdoll cat: light fur, darker "points" (face, ears, legs, tail) and blue eyes.
// mitted = white paws and chin (Karri). Without it the paws are dark too: colorpoint (Rudi).
export function drawCat(p: Pen, x: number, y: number, t: number, o: { left: boolean; sitting: boolean; points: number; mitted: boolean }) {
  x = R(x); y = R(y);
  const pen = o.left ? { rect: (rx: number, ry: number, w: number, h: number, c: number, a?: number) => p.rect(2 * x - R(rx) - w + 1, ry, w, h, c, a) } : p;
  const run = o.sitting ? 0 : sin(t * 18), hop = o.sitting ? 0 : R(abs(run)), paw = o.mitted ? P.bone : o.points;
  ell(p, x, y, 6, 1, P.ink, 0.3);
  const by = y - 4 - hop;
  const legs = [x - 4 - R(run), x - 2 + R(run), x + 2 - R(run), x + 4 + R(run)];
  const parts: Part[] = o.sitting
    ? [L(x - 3, y - 1, x - 8, y - 2 + R(sin(t * 3)), 2, o.points, false), E(x - 1, y - 4, 3, 4, P.bone), B(x, y - 1, 1, 1, paw), B(x + 2, y - 1, 1, 1, paw)]
    : [L(x - 5, by, x - 10, by - 3 + R(run), 2, o.points, false), E(x, by, 5, 2, P.bone), ...legs.map((lx) => B(lx, y - 2 - hop, 1, 2, o.points))];
  const hx = x + (o.sitting ? 1 : 5), hy = o.sitting ? y - 10 : by - 3;
  parts.push(...catHead(hx, hy, o.points));
  figure(pen, parts);
  if (!o.sitting) for (const lx of legs) pen.rect(lx, y - 1 - hop, 1, 1, paw); // the paw is the lowest pixel of the leg
  catFace(pen, hx, hy, o.points, o.mitted);
}
