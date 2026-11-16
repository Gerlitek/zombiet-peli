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
export function label(scene: Phaser.Scene, x: number, y: number, text: string, color: number = P.bone, size = 10, originX = 0.5) {
  const pad = Math.ceil(size / 4); // extra room above the text for the dots of Ä and Ö. y still means the top of the letters.
  return scene.add.text(x, y - pad, text, { fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'bold', fontSize: `${size}px`, color: css(color), padding: { top: pad } })
    .setResolution(ZOOM).setOrigin(originX, 0).setDepth(10);
}
