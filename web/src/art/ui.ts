import Phaser from 'phaser';
import { css, P } from './palette';
import { Pen } from './pixels';
import { W, H } from '../size';

// The game draws into a Phaser Graphics object through the Pen interface.
export function penFor(g: Phaser.GameObjects.Graphics): Pen {
  return {
    rect(x, y, w, h, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillRect(Math.round(x), Math.round(y), w, h);
    },
  };
}

// How many canvas pixels one logical pixel is. Changes when the canvas is resized (full screen, window size).
const zoomOf = (scene: Phaser.Scene) => scene.scale.width / W;

// Every scene works in logical pixels (320 x 240). The camera zooms that up to the real canvas size.
// Called in every scene's create and again whenever the canvas size changes: texts are then redrawn at the new resolution.
export function zoomCamera(scene: Phaser.Scene) {
  const zoom = zoomOf(scene);
  scene.cameras.main.setZoom(zoom).centerOn(W / 2, H / 2);
  for (const o of scene.children.list) if (o instanceof Phaser.GameObjects.Text) o.setResolution(zoom);
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
    .setResolution(zoomOf(scene)).setOrigin(originX, 0).setDepth(10);
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `bold ${size}px ${fontFamily}`;
  const capHeight = ctx.measureText('H').actualBoundingBoxAscent;
  return moveLabel(t.setData('lift', pad + Math.max(0, t.getTextMetrics().ascent - capHeight)), y);
}

// Moves a label so that the top of its capital letters is at y. A plain setY would put the top of the line box there, and the text would sit too low.
export function moveLabel(text: Phaser.GameObjects.Text, y: number) {
  return text.setY(y - text.getData('lift') * text.scaleY);
}
