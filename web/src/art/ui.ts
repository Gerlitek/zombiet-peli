import Phaser from 'phaser';
import { css, P } from './palette';
import { Pen } from './pixels';
import { W, H, ZOOM } from '../size';

// The game draws into a Phaser Graphics object through the Pen interface.
export function penFor(g: Phaser.GameObjects.Graphics): Pen {
  return {
    rect(x, y, w, h, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillRect(Math.round(x), Math.round(y), w, h);
    },
  };
}

// Every scene works in logical pixels (320 x 240). The camera zooms that up to the real canvas size.
export function zoomCamera(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(ZOOM).centerOn(W / 2, H / 2);
}

// Shrinks a text so it is never wider than maxWidth. Call after every setText on texts that sit inside a box.
export function fit(text: Phaser.GameObjects.Text, maxWidth: number) {
  text.setScale(1);
  if (text.width > maxWidth) text.setScale(maxWidth / text.width);
  return text;
}

// Text helper. Text is drawn at the real canvas resolution, not at the pixel art resolution.
// y is the top of the capital letters. Phaser puts the top of the line box at y, and the font has empty room above the capitals,
// so the real gap is measured and removed. Without this, text in a box sits too low and touches the bottom edge.
export function label(scene: Phaser.Scene, x: number, y: number, text: string, color: number = P.bone, size = 10, originX = 0.5) {
  const pad = Math.ceil(size / 4); // extra room above the text for the dots of Ä and Ö
  const fontFamily = 'Inter, system-ui, sans-serif';
  const t = scene.add.text(x, y, text, { fontFamily, fontStyle: 'bold', fontSize: `${size}px`, color: css(color), padding: { top: pad } })
    .setResolution(ZOOM).setOrigin(originX, 0).setDepth(10);
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `bold ${size}px ${fontFamily}`;
  const capHeight = ctx.measureText('H').actualBoundingBoxAscent;
  return t.setY(y - pad - Math.max(0, t.getTextMetrics().ascent - capHeight));
}
