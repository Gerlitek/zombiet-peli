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
import { W, H } from './size';
import { zoomCamera } from './art/ui';
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

// The biggest 4:3 canvas that fits the #game box, in real screen pixels (CSS pixels times devicePixelRatio).
// The canvas has exactly as many pixels as it covers on the screen, so the browser never stretches or shrinks it: that would blur it.
function canvasSize(box: HTMLElement) {
  const dpr = devicePixelRatio;
  const zoom = Math.min(box.clientWidth / W, box.clientHeight / H) * dpr;
  return { dpr, width: Math.floor(W * zoom), height: Math.floor(H * zoom) };
}

function startGame() {
  const box = document.getElementById('game')!;
  const first = canvasSize(box);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: box,
    width: first.width,
    height: first.height,
    pixelArt: true,
    backgroundColor: '#0b0e14',
    // mode NONE: the canvas size is set by fitCanvas below. zoom 1/dpr: one canvas pixel is one screen pixel.
    // fullscreenTarget: the #game element itself goes full screen (otherwise Phaser wraps the canvas in its own div, and the page's CSS does not see the screen size).
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / first.dpr, fullscreenTarget: box },
    scene: [BootScene, MenuScene, StoryScene, PracticeScene, PlayScene, WheelScene, PuzzleScene, EndScene],
  });
  // Runs when the box changes size (full screen starts or ends, the window is resized): resize the canvas, centre it on whole screen pixels and zoom every scene again.
  const fitCanvas = () => {
    if (!game.canvas) return; // the game has not booted yet, and the first size is already right
    const { dpr, width, height } = canvasSize(box);
    game.scale.setZoom(1 / dpr);
    game.scale.resize(width, height);
    game.canvas.style.marginLeft = `${Math.floor((box.clientWidth * dpr - width) / 2) / dpr}px`;
    game.canvas.style.marginTop = `${Math.floor((box.clientHeight * dpr - height) / 2) / dpr}px`;
    for (const scene of game.scene.getScenes(false)) if (scene.cameras?.main) zoomCamera(scene);
  };
  new ResizeObserver(fitCanvas).observe(box);
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
