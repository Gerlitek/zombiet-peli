import { P } from '../art/palette';
import { Pen } from '../art/pixels';
import { drawBolt, drawClouds } from '../art/scenery';

export interface Tree { x: number; y: number; h: number; seed: number; burnUntil: number }

// Rain, clouds and lightning. Lightning strikes a tree (or the ground) about every five seconds.
export class Weather {
  private rain: { x: number; y: number; speed: number }[] = [];
  private nextBolt = 3;
  private bolt = { at: -9, x: 0, y: 0, seed: 0 };

  constructor(private w: number, private h: number) {
    for (let i = 0; i < 70; i++) this.rain.push({ x: Math.random() * (w + 60), y: Math.random() * h, speed: 150 + Math.random() * 80 });
  }

  update(clock: number, dt: number, trees: Tree[]) {
    for (const d of this.rain) {
      d.y += d.speed * dt; d.x -= d.speed * dt * 0.2;
      if (d.y > this.h) { d.y = -4; d.x = Math.random() * (this.w + 60); }
    }
    if (clock >= this.nextBolt) {
      this.nextBolt = clock + 4 + Math.random() * 3;
      const tree = trees[Math.floor(Math.random() * (trees.length + 1))]; // sometimes no tree: strikes the ground
      this.bolt = tree
        ? { at: clock, x: tree.x, y: tree.y - tree.h, seed: clock }
        : { at: clock, x: 20 + Math.random() * (this.w - 40), y: 90 + Math.random() * 60, seed: clock };
      if (tree) tree.burnUntil = clock + 2.5;
    }
  }

  drawSky(p: Pen, clock: number) {
    drawClouds(p, clock, 3, 6);
  }

  drawFront(p: Pen, clock: number) {
    for (const d of this.rain) p.rect(d.x, d.y, 1, 4, P.rain, 0.5);
    const age = clock - this.bolt.at;
    if (age < 0.3) {
      drawBolt(p, this.bolt.x - 20, 12, this.bolt.x, this.bolt.y, Math.floor(this.bolt.seed * 10));
      p.rect(0, 0, this.w, this.h, P.iceL, 0.22 * (1 - age / 0.3)); // flash lights the whole screen
    }
  }
}
