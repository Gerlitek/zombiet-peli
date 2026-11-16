import { P } from './palette';
import { B, D, E, L, Part, Pen, ell, figure, limb } from './pixels';

// One character type = one row of numbers. Lengths are in pixels, angles in radians.
export interface Look {
  leg: number; tor: number; arm: number; head: number;
  lw: number;      // limb width
  tw: number;      // torso width
  armA: number;    // arm rest angle, measured from straight down
  swing: number;   // how far the arms swing
  pace: number;    // step frequency
  hunch?: number;  // forward lean
  sway?: number;   // side to side wobble
  nod?: number;    // head lolling
  tall?: number;   // head height / width
  s?: number;      // overall scale
  skin: number; shirt: number; pants: number; headCol?: number; eye: number; eyeS?: number;
  cape?: number; crown?: boolean; plume?: boolean; sword?: boolean; frown?: boolean;
}

export interface Pose {
  seed?: number;    // phase offset so characters do not move in sync
  still?: boolean;  // frozen in place
  tint?: number;
  alpha?: number;
  glow?: number;    // VIP zombies glow
  club?: boolean;   // a rare zombie carries a weapon
}

const { sin, cos, round: R, max, abs } = Math;

// x, y = the point between the feet. t = time in seconds.
// All motion comes from sine waves: step, arm arcs, body sway, head nod. No animation frames.
export function drawCharacter(p: Pen, x: number, y: number, d: Look, t: number, o: Pose = {}) {
  const s = d.s ?? 1, ph = t * d.pace + (o.seed ?? 0), mv = o.still ? 0 : 1, a = o.alpha ?? 1;
  const leg = d.leg * s, tor = d.tor * s, arm = d.arm * s, hr = R(d.head * s), lw = max(1, R(d.lw * s));
  const lean = (d.hunch ?? 0) + sin(ph * 0.5) * (d.sway ?? 0) * mv;
  const hip = { x, y: y - leg }, spread = 2 * s;
  const footL = { x: x - spread - sin(ph) * s * mv, y: y - max(0, sin(ph)) * 2 * s * mv };
  const footR = { x: x + spread + sin(ph) * s * mv, y: y - max(0, -sin(ph)) * 2 * s * mv };
  const neck = { x: hip.x + sin(lean) * tor, y: hip.y - cos(lean) * tor };
  const nod = lean * 1.4 + sin(ph * 0.7 + 1) * (d.nod ?? 0) * mv;
  const ry = R(hr * (d.tall ?? 1));
  const head = { x: R(neck.x + sin(nod) * hr), y: R(neck.y - cos(nod) * ry * 0.8) };
  const sh = { x: neck.x, y: neck.y + s };
  const angL = -d.armA - sin(ph) * d.swing * mv + lean, angR = d.armA + sin(ph + 2) * d.swing * mv + lean;
  const handL = { x: sh.x + sin(angL) * arm, y: sh.y + cos(angL) * arm };
  const handR = { x: sh.x + sin(angR) * arm, y: sh.y + cos(angR) * arm };

  ell(p, x, y, R(5 * s), max(1, R(1.5 * s)), P.ink, 0.4 * a); // shadow
  if (o.glow !== undefined) ell(p, x, y - leg - tor / 2, R(10 * s), R(13 * s), o.glow, 0.1);

  const parts: Part[] = [];
  if (d.cape !== undefined) parts.push(L(neck.x, neck.y + 2, x - sin(ph * 0.5) * 2, y - 1, 12 * s, d.cape));
  parts.push(L(hip.x, hip.y, footL.x, footL.y, lw + 1, d.pants), L(hip.x, hip.y, footR.x, footR.y, lw + 1, d.pants));
  parts.push(L(sh.x, sh.y, handL.x, handL.y, lw + 1, d.skin), L(sh.x, sh.y, handR.x, handR.y, lw + 1, d.skin));
  parts.push(L(hip.x, hip.y, neck.x, neck.y, d.tw * s, d.shirt));
  parts.push(E(head.x, head.y, hr, ry, d.headCol ?? d.skin));
  if (d.crown) for (const dx of [-3, 0, 3]) parts.push(B(head.x + dx, head.y - ry - (dx ? 2 : 3), 1, dx ? 2 : 3, P.sand));
  if (d.plume) parts.push(L(head.x, head.y - ry, head.x - 3, head.y - ry - 3, 2, P.iceL, false));
  const es = R((d.eyeS ?? 1) * max(1, s * 0.8)), ex = max(1, R(hr * 0.45));
  parts.push(D(head.x - ex - es + 1, head.y - 1, es, es, d.eye), D(head.x + ex, head.y - 1, es, es, d.eye));
  if (d.frown) parts.push(D(head.x - 1, head.y + 3, 3, 1, P.ink), D(head.x - 2, head.y + 4, 1, 1, P.ink), D(head.x + 2, head.y + 4, 1, 1, P.ink));
  if (d.shirt === P.ice) parts.push(D(R((hip.x + neck.x) / 2), R((hip.y + neck.y) / 2) - 1, 1, 3, P.iceL));
  figure(p, parts, o);

  if (d.sword || o.club) {
    // The knight's black sword has a light rim so it reads against the night. A zombie's club is a plain bone.
    const ang = 0.5 + sin(ph * 0.5) * 0.15 * mv, len = (d.sword ? 14 : 9) * s;
    const tip = { x: handR.x + sin(ang) * len, y: handR.y - cos(ang) * len };
    limb(p, handR.x, handR.y, tip.x, tip.y, d.sword ? 3 : 2, d.sword ? P.rain : P.bone, false, 0, a);
    if (d.sword) {
      limb(p, handR.x, handR.y, tip.x - sin(ang), tip.y + cos(ang), 1, P.ink, false, 0, a);
      limb(p, handR.x - cos(ang) * 3, handR.y - sin(ang) * 3, handR.x + cos(ang) * 3, handR.y + sin(ang) * 3, 1, P.iceL, false, 0, a);
    }
  }
}

// Surprise zombie: a gift box with eyes. Opens into a random zombie.
export function drawGift(p: Pen, x: number, y: number, t: number, o: Pose = {}) {
  const hop = abs(sin(t * 5)) * 2, top = R(y - 11 - hop), lid = R(sin(t * 5));
  ell(p, x, y, 6, 1, P.ink, 0.4);
  figure(p, [
    L(x - 2, y - 3 - hop, x - 3, y, 2, P.rot), L(x + 2, y - 3 - hop, x + 3, y, 2, P.rot),
    B(x - 5, top + 3, 11, 7, P.ice), B(x - 6, top - 1 - lid, 13, 3, P.iceL),
    D(x, top + 3, 1, 7, P.bone), D(x - 3, top + 2, 2, 1, P.sick), D(x + 2, top + 2, 2, 1, P.sick),
  ], o);
  p.rect(x - 2, top - 3 - lid, 2, 2, P.bone); p.rect(x + 1, top - 3 - lid, 2, 2, P.bone);
}
