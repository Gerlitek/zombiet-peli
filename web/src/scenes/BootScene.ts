import Phaser from 'phaser';
import { W, H } from '../size';
import { Pen } from '../art/pixels';
import { drawDunesGround, drawForestGround, drawVipGround } from '../art/scenery';
import { penFor } from '../art/ui';
import { warmUp } from '../systems/api';

// No image files: static backgrounds are drawn once with code and baked into textures.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.bake('bg-forest', drawForestGround);
    this.bake('bg-vip', drawVipGround);
    this.bake('bg-dunes', drawDunesGround);
    // Stop the browser from scrolling the page with the arrow keys and space, in every scene from the first screen on.
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    warmUp(); // the API sleeps when nobody plays: the first request is slow, so it is made before the game ends
    this.scene.start('menu');
  }

  private bake(key: string, draw: (p: Pen, w: number, h: number) => void) {
    const g = this.add.graphics();
    draw(penFor(g), W, H);
    g.generateTexture(key, W, H);
    g.destroy();
  }
}
