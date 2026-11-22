import Phaser from 'phaser';
// Inter from the site's own server (bundled by Vite), never from a font service. Latin covers ä and ö.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { PracticeScene } from './scenes/PracticeScene';
import { StoryScene } from './scenes/StoryScene';
import { WheelScene } from './scenes/WheelScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { EndScene } from './scenes/EndScene';
import { W, H, ZOOM } from './size';
import { drawCharacter } from './art/character';
import { css } from './art/palette';
import { Pen } from './art/pixels';
import { HEROES } from './data/characters';

// The logo next to the page title: the knight, drawn by the same code as in the game, standing still.
function drawLogo() {
  const canvas = document.getElementById('logo') as HTMLCanvasElement | null, g = canvas?.getContext('2d');
  if (!canvas || !g) return;
  const pen: Pen = { rect: (x, y, w, h, color, alpha = 1) => { g.globalAlpha = alpha; g.fillStyle = css(color); g.fillRect(Math.round(x), Math.round(y), w, h); } };
  const look = { ...HEROES.knight.look, s: (HEROES.knight.look.s ?? 1) * 1.6 };
  drawCharacter(pen, 20, 45, look, 0, { still: true });
}
drawLogo();

// Game texts are drawn once into canvases, so the font must be ready before the first scene.
// If it is slow, the game starts anyway with the fallback font after a second.
function start() {
  const ready = document.fonts.load('bold 10px Inter');
  Promise.race([ready, new Promise((r) => setTimeout(r, 1000))]).finally(startGame);
}

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W * ZOOM,
    height: H * ZOOM,
    pixelArt: true,
    backgroundColor: '#0b0e14',
    // fullscreenTarget: the #game element itself goes full screen (otherwise Phaser wraps the canvas in its own div, and the page's CSS and the FIT scaling do not see the screen size).
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: 'game' },
    scene: [BootScene, MenuScene, StoryScene, PracticeScene, PlayScene, WheelScene, PuzzleScene, EndScene],
  });
  // The page layout changes when full screen starts or ends: measure again after the browser has laid it out.
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(() => game.scale.refresh()));
  // Development only: lets tests and the browser console reach the running game.
  if (import.meta.env.DEV) Object.assign(window, { game });
}

// The game needs a keyboard. On a touch-only device (a phone, or a tablet without a keyboard)
// a note is shown instead, and the game starts only if the player says a keyboard is attached.
const touchOnly = matchMedia('(hover: none) and (pointer: coarse)').matches;
const note = document.querySelector<HTMLElement>('.touch-note')!;
const hideOnTouch = [document.querySelector<HTMLElement>('.howto')!, document.getElementById('game')!];

if (touchOnly) {
  note.hidden = false;
  hideOnTouch.forEach((el) => (el.hidden = true));
  note.querySelector('button')!.addEventListener('click', () => {
    note.hidden = true;
    hideOnTouch.forEach((el) => (el.hidden = false));
    start();
  }, { once: true });
} else {
  start();
}
