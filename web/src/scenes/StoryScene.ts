import Phaser from 'phaser';
import { W, H } from '../size';
import { P } from '../art/palette';
import { rng } from '../art/pixels';
import { drawBolt, drawClouds } from '../art/scenery';
import { label, penFor, zoomCamera } from '../art/ui';
import { STORY } from '../data/story';

const GAP = 26;      // distance between lines on the "floor"
const SPEED = 17;    // how fast the text travels, floor pixels per second
const DEPTH = 200;   // how quickly the text shrinks with distance
const FADE = 0.33;   // lines closer together than this would overlap, so they fade out before it
const HORIZON = -90; // vanishing point above the screen: the text fades out near the storm clouds

// The story as a text that slides away into the distance, toward the storm clouds.
export class StoryScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Graphics;
  private clouds!: Phaser.GameObjects.Graphics;
  private lines: Phaser.GameObjects.Text[] = [];
  private clock = 0;
  private offsets: number[] = []; // floor position of each line. An empty line is only half a gap.
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('story');
  }

  create() {
    zoomCamera(this);
    this.clock = 0;
    let at = 0;
    this.offsets = STORY.map((text) => { const mine = at; at += text ? GAP : GAP / 2; return mine; });
    this.keys = this.input.keyboard!.addKeys('DOWN,S,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.sky = this.add.graphics();
    this.lines = STORY.map((text, i) => label(this, W / 2, 0, text, i === 0 ? P.ice : P.iceL, i === 0 ? 18 : 12).setOrigin(0.5, 0.5));
    this.clouds = this.add.graphics().setDepth(20); // above the text, so the text goes behind the clouds
    label(this, W / 2, H - 12, 'ENTER: takaisin valikkoon      NUOLI ALAS: nopeammin', P.rain, 8).setDepth(30);
    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('menu'));
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('menu'));
    this.input.once('pointerdown', () => this.scene.start('menu'));
  }

  update(_: number, deltaMs: number) {
    const fast = this.keys.DOWN.isDown || this.keys.S.isDown || this.keys.SPACE.isDown;
    this.clock += (Math.min(deltaMs, 50) / 1000) * (fast ? 4 : 1);
    const t = this.clock, p = penFor(this.sky.clear());
    p.rect(0, 0, W, H, P.ink);
    const stars = rng(9);
    for (let i = 0; i < 70; i++) {
      const x = stars() * W, y = stars() * H, twinkle = Math.sin(t * 2 + i) > 0.6;
      p.rect(x, y, 1, 1, twinkle ? P.bone : P.storm);
    }
    if (t % 7 < 0.25) { drawBolt(p, 250, 20, 270, 60, Math.floor(t / 7)); p.rect(0, 0, W, H, P.iceL, 0.12); } // far lightning

    // Each line moves away along a tilted floor: the farther it is, the higher and smaller it is drawn.
    const travelled = t * SPEED;
    this.lines.forEach((line, i) => {
      const far = travelled - this.offsets[i]; // how far this line has moved from the bottom edge
      const k = 1 / (1 + Math.max(0, far) / DEPTH);
      const y = HORIZON + (H + 10 - HORIZON) * k - (far < 0 ? far : 0);
      line.setPosition(W / 2, y).setScale(1.1 * k).setAlpha(Phaser.Math.Clamp((k - FADE) * 6, 0, 1)).setVisible(y < H + 12 && k > FADE);
    });
    if (travelled - this.offsets[STORY.length - 1] > DEPTH * 1.2) this.scene.start('menu'); // the last line is gone

    const c = penFor(this.clouds.clear());
    c.rect(0, 0, W, 16, P.sky);
    drawClouds(c, t, 3, 12);
    c.rect(0, H - 18, W, 18, P.ink);
  }
}
