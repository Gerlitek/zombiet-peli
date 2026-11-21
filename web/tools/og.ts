// Draws the link preview image (Open Graph, 1200 x 630) with the game's own drawing code.
// Run `npm run dev`, open /tools/og.html and take a screenshot of the canvas into public/og.png.
import { drawCharacter } from '../src/art/character';
import { css, P } from '../src/art/palette';
import { Pen } from '../src/art/pixels';
import { HEROES } from '../src/data/characters';
import { ZOMBIES } from '../src/data/zombies';

const OW = 1200, OH = 630, PX = 6; // one game pixel = 6 x 6 image pixels
const out = (document.getElementById('og') as HTMLCanvasElement).getContext('2d')!;

// Page background as on the site: dark, a matte pink glow in two corners, a pink line at the top.
out.fillStyle = '#0F1115';
out.fillRect(0, 0, OW, OH);
for (const [x, y, a] of [[0, 0, 0.16], [OW, OH, 0.13]]) {
  const glow = out.createRadialGradient(x, y, 0, x, y, OW * 0.6);
  glow.addColorStop(0, `rgba(232, 90, 165, ${a})`);
  glow.addColorStop(1, 'rgba(232, 90, 165, 0)');
  out.fillStyle = glow;
  out.fillRect(0, 0, OW, OH);
}
const line = out.createLinearGradient(0, 0, OW, 0);
line.addColorStop(0, 'rgba(232, 90, 165, 0)');
line.addColorStop(0.3, 'rgba(232, 90, 165, 0.45)');
line.addColorStop(0.7, 'rgba(232, 90, 165, 0.45)');
line.addColorStop(1, 'rgba(232, 90, 165, 0)');
out.fillStyle = line;
out.fillRect(0, 0, OW, 4);

// The game frame on the right, as #game on the page: dark surface, border, pink shadow.
const frame = { x: 640, y: 95, w: 500, h: 440 };
out.save();
out.shadowColor = 'rgba(232, 90, 165, 0.35)';
out.shadowBlur = 60;
out.fillStyle = css(P.ink);
out.beginPath();
out.roundRect(frame.x, frame.y, frame.w, frame.h, 28);
out.fill();
out.restore();
out.lineWidth = 4;
out.strokeStyle = '#252D3F';
out.stroke();

// The scene inside the frame, drawn in game pixels and scaled up without smoothing.
const sw = Math.floor(frame.w / PX), sh = Math.floor(frame.h / PX);
const small = document.createElement('canvas');
small.width = sw;
small.height = sh;
const g = small.getContext('2d')!;
const pen: Pen = { rect: (x, y, w, h, color, alpha = 1) => { g.globalAlpha = alpha; g.fillStyle = css(color); g.fillRect(Math.round(x), Math.round(y), w, h); } };
pen.rect(0, 0, sw, sh, P.sky);
pen.rect(0, sh - 16, sw, 16, P.moss0);
pen.rect(0, sh - 16, sw, 1, P.moss1);
drawCharacter(pen, 22, sh - 10, { ...HEROES.knight.look, s: (HEROES.knight.look.s ?? 1) * 1.4 }, 0, { still: true });
drawCharacter(pen, 50, sh - 12, ZOMBIES.normal.look, 0.4, { seed: 5, left: true });
drawCharacter(pen, 70, sh - 8, ZOMBIES.kauhu.look, 1.1, { seed: 2, left: true });
out.save();
out.beginPath();
out.roundRect(frame.x + 2, frame.y + 2, frame.w - 4, frame.h - 4, 26);
out.clip();
out.imageSmoothingEnabled = false;
out.drawImage(small, frame.x + 2, frame.y + 2, sw * PX, sh * PX);
out.restore();

// Text on the left, in the page's colors.
out.textBaseline = 'alphabetic';
out.fillStyle = '#7CC8F2';
out.font = '800 76px Inter, system-ui, sans-serif';
out.fillText('Ylläri-', 70, 270);
out.fillText('Zombit', 70, 352);
out.fillStyle = '#A9AFBA';
out.font = '500 32px Inter, system-ui, sans-serif';
out.fillText('Taistele zombeja vastaan.', 72, 420);
out.fillStyle = 'rgba(232, 90, 165, 0.8)';
out.font = '500 26px Inter, system-ui, sans-serif';
out.fillText('zombit.gerlitek.fi', 72, 520);
