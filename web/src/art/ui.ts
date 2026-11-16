import Phaser from 'phaser';
import { css, P } from './palette';
import { Pen } from './pixels';

// The game draws into a Phaser Graphics object through the Pen interface.
export function penFor(g: Phaser.GameObjects.Graphics): Pen {
  return {
    rect(x, y, w, h, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillRect(Math.round(x), Math.round(y), w, h);
    },
  };
}

// Text helper. The font is a placeholder until a pixel font with ä and ö is chosen.
export function label(scene: Phaser.Scene, x: number, y: number, text: string, color: number = P.bone, size = 10, originX = 0.5) {
  return scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, color: css(color) }).setOrigin(originX, 0).setDepth(10);
}
