import Phaser from 'phaser';
import { W } from '../size';
import { P } from '../art/palette';
import { label } from '../art/ui';
import { ACHIEVEMENTS, AchievementId } from '../data/achievements';
import { load } from '../systems/storage';

export interface EndData { won: boolean; kills: number; seconds: number; score: number; earned: AchievementId[] }

export class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create(data: EndData) {
    this.add.image(0, 0, data.won ? 'bg-vip' : 'bg-forest').setOrigin(0).setAlpha(0.35);
    label(this, W / 2, 20, data.won ? 'PELI LÄPÄISTY!' : 'ZOMBIT VOITTIVAT', data.won ? P.ice : P.hurt, 16);
    label(this, W / 2, 46, `Pisteet ${data.score}`, P.bone, 14);
    label(this, W / 2, 66, `Tapot ${data.kills}/10    Aika ${Math.floor(data.seconds)} s`, P.rain);
    if (data.earned.length) label(this, W / 2, 86, `Uusi saavutus: ${data.earned.map((id) => ACHIEVEMENTS[id]).join(', ')}`, P.sand)
      .setWordWrapWidth(300).setAlign('center');
    const saved = load();
    label(this, W / 2, 120, 'VAHVIN (tämä selain)', P.iceL);
    saved.best.forEach((b, i) => label(this, W / 2, 134 + i * 12, `${i + 1}. ${b.nick}  ${b.score}`, i ? P.rain : P.bone));
    label(this, W / 2, 180, `Saavutukset ${saved.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`, P.rain);
    label(this, W / 2, 214, 'Välilyönti: uusi peli', P.ice);
    // Short delay so a key held down during the last fight does not skip this screen.
    this.time.delayedCall(600, () => {
      this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('menu'));
      this.input.once('pointerdown', () => this.scene.start('menu'));
    });
  }
}
