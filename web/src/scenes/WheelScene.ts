import Phaser from 'phaser';
import { W, H } from '../size';
import { P } from '../art/palette';
import { drawPanel } from '../art/scenery';
import { label, penFor } from '../art/ui';
import { RK_SHOWN, WEAPONS, WeaponId } from '../data/weapons';
import { WheelName, slices, spin } from '../logic/wheel';

const COLORS = [P.ice, P.iceL, P.storm, P.rain, P.cloud];
const CX = 104, CY = 128, RADIUS = 70, TOP = -Math.PI / 2;

// Wheel of fortune. Runs on top of the paused game and gives one weapon.
export class WheelScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private ids: WeaponId[] = [];
  private rot = 0;
  private state: 'wait' | 'spin' | 'done' = 'wait';
  private result!: WeaponId;
  private hint!: Phaser.GameObjects.Text;
  private done!: (id: WeaponId) => void;

  constructor() {
    super('wheel');
  }

  create(data: { wheel: WheelName; done: (id: WeaponId) => void }) {
    this.done = data.done;
    this.ids = slices(data.wheel);
    this.state = 'wait';
    this.rot = 0;
    this.result = spin(data.wheel, Math.random); // the result is decided by pure logic, the wheel only shows it
    this.g = this.add.graphics();
    label(this, W / 2, 10, data.wheel === 'vip' ? 'VIP-ONNENPYÖRÄ' : 'ONNENPYÖRÄ', P.iceL, 16);
    this.ids.forEach((id, i) => label(this, 210, 44 + i * 16, WEAPONS[id].name, P.bone, 10, 0));
    if (data.wheel === 'vip') {
      label(this, 198, 134, 'Rudi-Karri-robotti', P.sand, 10, 0);
      label(this, 198, 148, RK_SHOWN, P.bone, 14, 0);
    }
    this.hint = label(this, W / 2, 218, 'Välilyönti: pyöräytä', P.ice);
    this.input.keyboard!.on('keydown-SPACE', () => this.press());
    this.input.on('pointerdown', () => this.press());
  }

  private press() {
    if (this.state === 'wait') {
      this.state = 'spin';
      this.hint.setText('');
      // Turn so that the middle of the winning slice stops under the pointer. Rudi-Karri is the hair-thin line at angle 0.
      const seg = (Math.PI * 2) / this.ids.length, i = this.ids.indexOf(this.result);
      const target = TOP - (i < 0 ? 0 : (i + 0.5) * seg) + Math.PI * 2 * 5;
      this.tweens.add({
        targets: this, rot: target, duration: 2600, ease: 'Cubic.easeOut',
        onComplete: () => { this.state = 'done'; this.hint.setText(`Sait: ${WEAPONS[this.result].name}!  (välilyönti)`); },
      });
    } else if (this.state === 'done') {
      this.scene.stop();
      this.scene.resume('play');
      this.done(this.result);
    }
  }

  update() {
    const g = this.g.clear(), p = penFor(g), n = this.ids.length, seg = (Math.PI * 2) / n;
    p.rect(0, 0, W, H, P.sky, 0.92);
    g.fillStyle(P.bone).fillCircle(CX, CY, RADIUS + 3);
    this.ids.forEach((_, i) => {
      g.fillStyle(COLORS[i % COLORS.length]).slice(CX, CY, RADIUS, this.rot + i * seg, this.rot + (i + 1) * seg).fillPath();
      drawPanel(p, 196, 46 + i * 16, 9, 9, P.ink, COLORS[i % COLORS.length]);
    });
    if (this.ids.includes('laser')) { // VIP wheel: the hair-thin Rudi-Karri slice
      g.lineStyle(1, P.sand).lineBetween(CX, CY, CX + Math.cos(this.rot) * RADIUS, CY + Math.sin(this.rot) * RADIUS);
      drawPanel(p, 192, 130, 122, 40, P.sand);
    }
    g.fillStyle(P.ink).fillCircle(CX, CY, 8).fillStyle(P.sand).fillCircle(CX, CY, 6);
    g.fillStyle(P.ink).fillTriangle(CX - 6, CY - RADIUS - 11, CX + 6, CY - RADIUS - 11, CX, CY - RADIUS + 7);
    g.fillStyle(P.hurt).fillTriangle(CX - 4, CY - RADIUS - 10, CX + 4, CY - RADIUS - 10, CX, CY - RADIUS + 4);
  }
}
