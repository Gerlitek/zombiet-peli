import Phaser from 'phaser';
import { W, H } from '../size';
import { Pen } from '../art/pixels';
import { drawForestGround, drawVipGround } from '../art/scenery';
import { penFor } from '../art/ui';

// No image files: static backgrounds are drawn once with code and baked into textures.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    this.bake('bg-forest', drawForestGround);
    this.bake('bg-vip', drawVipGround);
    this.scene.start('menu');
  }

  private bake(key: string, draw: (p: Pen, w: number, h: number) => void) {
    const g = this.add.graphics();
    draw(penFor(g), W, H);
    g.generateTexture(key, W, H);
    g.destroy();
  }
}
