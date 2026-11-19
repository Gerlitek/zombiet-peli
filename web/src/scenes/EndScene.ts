import Phaser from 'phaser';
import { W } from '../size';
import { P } from '../art/palette';
import { fit, label, penFor, zoomCamera } from '../art/ui';
import { drawPanel } from '../art/scenery';
import { ACHIEVEMENTS, AchievementId } from '../data/achievements';
import { WIN_AT } from '../data/rules';
import { drawCharacter } from '../art/character';
import { HEROES } from '../data/characters';
import { nickText } from '../data/nicknames';
import { BoardEntry } from '../systems/api';
import { load } from '../systems/storage';

export interface EndData { won: boolean; kills: number; seconds: number; score: number; earned: AchievementId[]; nick: string; board: Promise<BoardEntry[] | null> }

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
    const heading = label(this, W / 2, 119, mine === 0 ? 'UUSI ENNÄTYS! Parhaat pisteet:' : 'Parhaat pisteet tällä koneella:', mine === 0 ? P.sand : P.iceL);
    const rows = saved.best.map((b, i) => label(this, W / 2, 134 + i * 12, `${i + 1}. ${b.nick}  ${b.score} p${i === mine ? '   ← tämä peli' : ''}`, i === mine ? P.ice : P.rain));
    const note = mine < 0 ? label(this, W / 2, 170, 'Tämä peli ei yltänyt kolmen parhaan joukkoon', P.rain, 7) : null;
    label(this, W / 2, 182, `Saavutukset ${saved.achievements.length}/${Object.keys(ACHIEVEMENTS).length}`, P.rain);
    // The online board arrives a moment later. If it does not (offline, daily cap full, API stopped),
    // the local board stays and a short notice with the knight tells why. The game works the same.
    data.board.then((board) => {
      if (!this.scene.isActive()) return; // the player already left the screen
      if (board) this.showOnline(board, data, [heading, ...rows, ...(note ? [note] : [])]);
      else this.showOffline(heading);
    });
    // The result stays at least three seconds. Only then does the key work and the hint appear,
    // so the screen cannot be skipped by a key pressed during the last fight.
    this.time.delayedCall(3000, () => {
      const hint = label(this, W / 2, 212, 'Paina ENTER ja pelaa uudestaan', P.ice, 12);
      this.tweens.add({ targets: hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
      this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('menu'));
      this.input.once('pointerdown', () => this.scene.start('menu'));
    });
  }

  private showOnline(board: BoardEntry[], data: EndData, old: Phaser.GameObjects.Text[]) {
    old.forEach((t) => t.destroy());
    const top = board.slice(0, 3), own = top.findIndex((b) => nickText(b.nick) === data.nick && b.score === data.score);
    label(this, W / 2, 119, own >= 0 ? 'Olet verkon kärjessä! Parhaat:' : 'Verkon parhaat:', own >= 0 ? P.sand : P.iceL);
    top.forEach((b, i) => label(this, W / 2, 134 + i * 12, `${i + 1}. ${nickText(b.nick)}  ${b.score} p${i === own ? '   ← tämä peli' : ''}`, i === own ? P.ice : P.rain));
  }

  private showOffline(heading: Phaser.GameObjects.Text) {
    heading.setText('Verkkotaulu on tauolla. Pisteesi tallentuvat tälle koneelle:');
    fit(heading, 230);
    const g = this.add.graphics().setDepth(10);
    drawCharacter(penFor(g), 24, 236, HEROES.knight.look, 0, { still: true });
  }
}
