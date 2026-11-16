import Phaser from 'phaser';
import { W } from '../size';
import { P } from '../art/palette';
import { label, penFor, zoomCamera } from '../art/ui';
import { drawPanel } from '../art/scenery';
import { ACHIEVEMENTS, AchievementId } from '../data/achievements';
import { WIN_AT } from '../data/rules';
import { load } from '../systems/storage';

export interface EndData { won: boolean; kills: number; seconds: number; score: number; earned: AchievementId[]; nick: string }

export class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create(data: EndData) {
    zoomCamera(this);
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('menu'));
    // The forest background has no frames of its own, so the text gets its own two panels and nothing overlaps.
    this.add.image(0, 0, 'bg-forest').setOrigin(0).setAlpha(0.3);
    const p = penFor(this.add.graphics());
    drawPanel(p, 30, 8, W - 60, 76, data.won ? P.ice : P.hurt, P.ink);
    drawPanel(p, 40, 114, W - 80, 84, P.storm, P.ink);
    label(this, W / 2, 14, data.won ? 'PELI LÄPÄISTY!' : 'ZOMBIT VOITTIVAT', data.won ? P.ice : P.hurt, 20);
    label(this, W / 2, 42, `Sait ${data.score} pistettä`, P.bone, 14);
    label(this, W / 2, 64, `Tapot ${data.kills}/${WIN_AT}    Aika ${Math.floor(data.seconds)} s`, P.rain);
    if (data.earned.length) label(this, W / 2, 88, `Uusi saavutus: ${data.earned.map((id) => ACHIEVEMENTS[id]).join(', ')}`, P.sand)
      .setFontSize(8).setWordWrapWidth(300).setAlign('center');
    const saved = load();
    // The three best scores saved in this browser. The game just played is marked, so it is clear whose result is whose.
    const mine = saved.best.findIndex((b) => b.nick === data.nick && b.score === data.score);
    label(this, W / 2, 119, mine === 0 ? 'UUSI ENNÄTYS! Parhaat pisteet:' : 'Parhaat pisteet tällä koneella:', mine === 0 ? P.sand : P.iceL);
    saved.best.forEach((b, i) => label(this, W / 2, 134 + i * 12, `${i + 1}. ${b.nick}  ${b.score} p${i === mine ? '   ← tämä peli' : ''}`, i === mine ? P.ice : P.rain));
    if (mine < 0) label(this, W / 2, 170, 'Tämä peli ei yltänyt kolmen parhaan joukkoon', P.rain, 7);
    label(this, W / 2, 182, `Saavutukset ${saved.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`, P.rain);
    // The result stays at least three seconds. Only then does the key work and the hint appear,
    // so the screen cannot be skipped by a key pressed during the last fight.
    this.time.delayedCall(3000, () => {
      const hint = label(this, W / 2, 212, 'Paina ENTER ja pelaa uudestaan', P.ice, 12);
      this.tweens.add({ targets: hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
      this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('menu'));
      this.input.once('pointerdown', () => this.scene.start('menu'));
    });
  }
}
