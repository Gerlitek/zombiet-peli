import Phaser from 'phaser';
import { W, H } from '../size';
import { P } from '../art/palette';
import { drawCatRobot, drawPanel } from '../art/scenery';
import { label, penFor, zoomCamera } from '../art/ui';
import { RK_SHOWN, WEAPONS, WeaponId } from '../data/weapons';
import { WheelName, slices, spin } from '../logic/wheel';

const COLORS = [P.rain, P.storm, P.moss1, P.bark, P.cloud]; // muted on purpose: the wheel is a reward, not the main thing
const CX = 84, CY = 122, RADIUS = 60, TOP = -Math.PI / 2;
const LIST_X = 162, LIST_Y = 44, ROW = 27;
const RARE = { x: 156, y: 128, w: 156, h: 58 }; // the Rudi-Karri box on the VIP wheel

// Wheel of fortune. Runs on top of the paused game and gives one weapon.
// The screen always tells three things: why the wheel came, what can be won, and what was won.
export class WheelScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private ids: WeaponId[] = [];   // slices on the wheel
  private rowTexts: Phaser.GameObjects.Text[][] = [];
  private rareTexts: Phaser.GameObjects.Text[] = [];
  private vip = false;
  private clock = 0;
  private rot = 0;
  private state: 'wait' | 'spin' | 'done' = 'wait';
  private result!: WeaponId;
  private hint!: Phaser.GameObjects.Text;
  private card: Phaser.GameObjects.Text[] = [];
  private canContinue = false;
  private cardShown = false;
  private done!: (id: WeaponId) => void;

  constructor() {
    super('wheel');
  }

  create(data: { wheel: WheelName; reason: string; done: (id: WeaponId) => void }) {
    zoomCamera(this);
    this.input.keyboard!.once('keydown-ESC', () => { this.scene.stop('play'); this.scene.start('menu'); }); // Esc: leave the game
    this.done = data.done;
    this.ids = slices(data.wheel);
    this.vip = data.wheel === 'vip';
    this.state = 'wait';
    this.rot = 0;
    this.result = spin(data.wheel, Math.random); // the result is decided by pure logic, the wheel only shows it
    // Development only: open the page with ?rk to always win Rudi-Karri from the VIP wheel, for testing and showing.
    if (import.meta.env.DEV && this.vip && location.search.includes('rk')) this.result = 'rudikarri';
    this.g = this.add.graphics();
    label(this, W / 2, 5, data.wheel === 'vip' ? 'VIP-ONNENPYÖRÄ' : 'ONNENPYÖRÄ', P.iceL, 14);
    label(this, W / 2, 23, data.reason, P.sand); // why the wheel appeared
    this.rowTexts = this.ids.map((id, i) => {
      const y = LIST_Y + i * ROW;
      return [label(this, LIST_X + 16, y + 2, WEAPONS[id].name, P.bone, 10, 0), label(this, LIST_X + 16, y + 14, WEAPONS[id].info, P.rain, 7, 0)];
    });
    // Rudi-Karri has its own box: it is not a normal slice but the thin white line on the wheel.
    this.rareTexts = !this.vip ? [] : [
      label(this, RARE.x + 6, RARE.y + 4, 'SUPERHARVINAINEN', P.sand, 7, 0),
      label(this, RARE.x + 6, RARE.y + 13, WEAPONS.rudikarri.name, P.bone, 10, 0),
      label(this, RARE.x + 6, RARE.y + 26, 'Saat sen, jos punainen osoitin\npysähtyy valkoiselle viivalle.', P.rain, 7, 0),
      label(this, RARE.x + 6, RARE.y + 46, `Mahdollisuus ${RK_SHOWN}`, P.sand, 7, 0), // short on purpose: must fit inside the box
    ];
    // result card texts, hidden until the wheel stops
    // They sit below the wheel and the list, so nothing is covered: the winning slice and row stay visible.
    this.card = [label(this, W / 2, 193, '', P.iceL, 14), label(this, W / 2, 211, '', P.bone, 8), label(this, W / 2, 224, '', P.ice, 8)];
    this.card.forEach((t) => t.setVisible(false).setDepth(20));
    this.canContinue = false; this.cardShown = false;
    // The wheel waits for Enter, so there is time to read which weapons can be won.
    this.hint = label(this, W / 2, 206, 'Lue rauhassa, mitä voit saada.\nPaina ENTER ja pyöräytä.', P.ice).setAlign('center');
    this.input.keyboard!.on('keydown-ENTER', () => this.press());
    this.input.on('pointerdown', () => this.press());
  }

  private startSpin() {
    {
      this.state = 'spin';
      this.hint.setText('Pyörä pyörii...');
      // Turn so that the middle of the winning slice stops under the pointer. Rudi-Karri is the hair-thin line at angle 0.
      const seg = (Math.PI * 2) / this.ids.length, i = this.ids.indexOf(this.result);
      const target = TOP - (i < 0 ? 0 : (i + 0.5) * seg) + Math.PI * 2 * 3;
      this.tweens.add({ targets: this, rot: target, duration: 1800, ease: 'Cubic.easeOut', onComplete: () => this.showResult() });
    }
  }

  private press() {
    if (this.state === 'wait') this.startSpin();
    else if (this.state === 'done' && this.canContinue) {
      this.scene.stop();
      this.scene.resume('play');
      this.done(this.result);
    }
  }

  private showResult() {
    this.state = 'done';
    // First the wheel just stands still for a moment: the pointer shows the winning slice and its row lights up.
    // Then a card below the wheel tells what was won. It stays until the player presses Enter.
    this.hint.setVisible(false);
    this.ids.forEach((id, i) => this.rowTexts[i].forEach((t) => t.setAlpha(id === this.result ? 1 : 0.3)));
    this.rareTexts.forEach((t) => t.setAlpha(this.result === 'rudikarri' ? 1 : 0.3));
    this.time.delayedCall(900, () => {
      this.cardShown = true;
      this.card[0].setText(`Sait aseen: ${WEAPONS[this.result].name}`);
      this.card[1].setText(WEAPONS[this.result].info);
      this.card.forEach((t) => t.setVisible(true));
    });
    this.time.delayedCall(2200, () => { this.canContinue = true; this.card[2].setText('Paina ENTER ja jatka peliä'); });
  }

  update(_: number, deltaMs: number) {
    this.clock += deltaMs / 1000;
    const g = this.g.clear(), p = penFor(g), seg = (Math.PI * 2) / this.ids.length, done = this.state === 'done';
    p.rect(0, 0, W, H, P.ink, 0.9);
    drawPanel(p, 6, 38, W - 12, 152, P.storm, P.sky);

    g.fillStyle(P.bone).fillCircle(CX, CY, RADIUS + 3);
    this.ids.forEach((id, i) => {
      const dim = done && id !== this.result;
      g.fillStyle(dim ? P.cloud : COLORS[i]).slice(CX, CY, RADIUS, this.rot + i * seg, this.rot + (i + 1) * seg).fillPath();
      g.lineStyle(1, P.ink).lineBetween(CX, CY, CX + Math.cos(this.rot + i * seg) * RADIUS, CY + Math.sin(this.rot + i * seg) * RADIUS);
    });
    if (this.vip) { // Rudi-Karri: a thin white line with a golden dot at the rim, so it can be found on the wheel
      const ex = CX + Math.cos(this.rot) * RADIUS, ey = CY + Math.sin(this.rot) * RADIUS;
      g.lineStyle(2, P.bone).lineBetween(CX, CY, ex, ey);
      g.fillStyle(P.ink).fillCircle(ex, ey, 4).fillStyle(P.sand).fillCircle(ex, ey, 3);
    }
    g.fillStyle(P.ink).fillCircle(CX, CY, 8).fillStyle(P.bone).fillCircle(CX, CY, 6);
    // pointer: the slice under it is the prize
    g.fillStyle(P.ink).fillTriangle(CX - 7, CY - RADIUS - 12, CX + 7, CY - RADIUS - 12, CX, CY - RADIUS + 8);
    // The pointer is red so it cannot be mixed up with the white Rudi-Karri line on the wheel.
    g.fillStyle(P.hurt).fillTriangle(CX - 5, CY - RADIUS - 11, CX + 5, CY - RADIUS - 11, CX, CY - RADIUS + 5);

    // list: one row per slice, same color as the slice
    this.ids.forEach((id, i) => {
      const y = LIST_Y + i * ROW, mine = done && id === this.result;
      if (mine) drawPanel(p, LIST_X - 4, y - 1, W - LIST_X - 6, ROW - 2, P.iceL, P.cloud);
      drawPanel(p, LIST_X, y + 3, 11, 11, P.ink, done && !mine ? P.cloud : COLORS[i]);
    });
    if (this.vip) {
      const mine = done && this.result === 'rudikarri';
      drawPanel(p, RARE.x, RARE.y, RARE.w, RARE.h, mine ? P.iceL : P.sand, mine ? P.cloud : P.ink);
      drawCatRobot(p, RARE.x + RARE.w - 16, RARE.y + 20, this.clock);
    }
    if (this.cardShown) drawPanel(p, 30, 191, W - 60, 46, P.iceL, P.cloud);
  }
}
