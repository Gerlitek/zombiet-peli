import Phaser from 'phaser';
import { W } from '../size';
import { drawCharacter, drawGift } from '../art/character';
import { P, css } from '../art/palette';
import { drawPanel } from '../art/scenery';
import { label, penFor, zoomCamera } from '../art/ui';
import { HEROES, HeroId } from '../data/characters';
import { Nick, nickText, rollNick } from '../data/nicknames';
import { ZOMBIES } from '../data/zombies';
import { PUZZLE_LEVELS, PuzzleLevel } from '../logic/puzzle';
import { load, save } from '../systems/storage';

const LEVEL_NAMES: Record<PuzzleLevel, string> = { easy: 'Helppo', medium: 'Keski', hard: 'Vaikea' };
const HERO_IDS = Object.keys(HEROES) as HeroId[];
// Layout in logical pixels. Cards and buttons can be chosen with keys or by clicking.
const CARD = { y: 86, w: 84, h: 72, xs: [72, 164] };
const PILL = { y: 178, w: 56, h: 18, xs: [70, 132, 194] }; // tall enough for letters like p and j
const inside = (px: number, py: number, x: number, y: number, w: number, h: number) => px >= x && px < x + w && py >= y && py < y + h;

export class MenuScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private hero: HeroId = 'knight';
  private level: PuzzleLevel = 'easy';
  private nick: Nick = [0, 0, 0];
  private nickLabel!: Phaser.GameObjects.Text;
  private heroLabels: Phaser.GameObjects.Text[][] = [];
  private levelLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('menu');
  }

  create() {
    zoomCamera(this);
    const saved = load();
    this.hero = saved.hero in HEROES ? (saved.hero as HeroId) : 'knight';
    this.level = PUZZLE_LEVELS.includes(saved.level as PuzzleLevel) ? (saved.level as PuzzleLevel) : 'easy';
    this.nick = saved.nick[2] ? saved.nick : rollNick(Math.random);

    this.add.image(0, 0, 'bg-forest').setOrigin(0);
    this.g = this.add.graphics();
    label(this, W / 2, 8, 'YLLÄRI-ZOMBIET', P.ice, 20);
    this.nickLabel = label(this, W / 2, 36, '');
    label(this, W / 2, 49, 'Paina N, jos haluat toisen nimen', P.rain, 7);

    label(this, W / 2, 70, 'Valitse hahmo nuolilla  ←  →', P.iceL);
    this.heroLabels = HERO_IDS.map((id, i) => {
      const cx = CARD.xs[i] + CARD.w / 2;
      const texts = [label(this, cx, CARD.y + 46, HEROES[id].name), label(this, cx, CARD.y + 59, HEROES[id].info, P.rain, 7)];
      // Safety net: a text that is wider than the card is shrunk to fit, so nothing can leak out of the box.
      for (const t of texts) if (t.width > CARD.w - 8) t.setScale((CARD.w - 8) / t.width);
      return texts;
    });

    label(this, W / 2, 163, 'Hajotelmien vaikeus nuolilla  ↑  ↓', P.iceL);
    this.levelLabels = PUZZLE_LEVELS.map((lv, i) => label(this, PILL.xs[i] + PILL.w / 2, PILL.y + 3, LEVEL_NAMES[lv]));

    const start = label(this, W / 2, 202, 'Paina ENTER ja aloita', P.ice, 12);
    label(this, 106, 222, 'H: harjoittele hiekkasärkillä', P.sand, 8);
    label(this, 232, 222, 'T: lue tarina', P.sand, 8);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => { this.nick = rollNick(Math.random); this.refresh(); });
    kb.on('keydown-LEFT', () => this.pickHero(HERO_IDS[0]));
    kb.on('keydown-RIGHT', () => this.pickHero(HERO_IDS[1]));
    kb.on('keydown-UP', () => this.pickLevel(PUZZLE_LEVELS.indexOf(this.level) + 1));
    kb.on('keydown-DOWN', () => this.pickLevel(PUZZLE_LEVELS.indexOf(this.level) - 1));
    kb.once('keydown-ENTER', () => this.start());
    kb.once('keydown-H', () => this.start('practice'));
    kb.once('keydown-T', () => this.scene.start('story'));
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.click(ptr.worldX, ptr.worldY));
    this.refresh();
  }

  update(time: number) {
    const p = penFor(this.g.clear()), t = time / 1000;
    drawPanel(p, 80, 32, 160, 28, P.storm);
    drawPanel(p, 40, 219, 132, 15, P.sand);
    drawPanel(p, 196, 219, 72, 15, P.sand);
    HERO_IDS.forEach((id, i) => {
      const chosen = id === this.hero, x = CARD.xs[i];
      drawPanel(p, x, CARD.y, CARD.w, CARD.h, chosen ? P.ice : P.storm, chosen ? P.cloud : P.ink);
      if (chosen) drawPanel(p, x - 1, CARD.y - 1, CARD.w + 2, CARD.h + 2, P.ice, P.cloud); // thicker border on the chosen card
      // The hero is drawn bigger than in the game so the choice is easy to see. Only the chosen one moves.
      const look = { ...HEROES[id].look, s: (HEROES[id].look.s ?? 1) * 1.6 };
      drawCharacter(p, x + CARD.w / 2, CARD.y + 42, look, t, { still: !chosen });
    });
    PUZZLE_LEVELS.forEach((lv, i) => {
      const chosen = lv === this.level;
      drawPanel(p, PILL.xs[i], PILL.y, PILL.w, PILL.h, chosen ? P.ice : P.storm, chosen ? P.cloud : P.ink);
    });
    drawCharacter(p, 26, 214, ZOMBIES.kauhu.look, t, { seed: 2 });
    drawCharacter(p, 296, 212, ZOMBIES.normal.look, t, { seed: 5, left: true });
    drawGift(p, 284, 236, t);
  }

  private click(x: number, y: number) {
    const hero = CARD.xs.findIndex((cx) => inside(x, y, cx, CARD.y, CARD.w, CARD.h));
    const level = PILL.xs.findIndex((px) => inside(x, y, px, PILL.y, PILL.w, PILL.h));
    if (hero >= 0) this.pickHero(HERO_IDS[hero]);
    else if (level >= 0) this.pickLevel(level);
    else if (inside(x, y, 80, 32, 160, 28)) { this.nick = rollNick(Math.random); this.refresh(); }
    else if (y > 218 && x > 192) this.scene.start('story');
    else if (y > 218) this.start('practice');
    else if (y > 198) this.start();
  }

  private pickHero(id: HeroId) {
    this.hero = id;
    this.refresh();
  }

  private pickLevel(index: number) {
    this.level = PUZZLE_LEVELS[Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, index))];
    this.refresh();
  }

  private refresh() {
    this.nickLabel.setText(`Pelinimesi: ${nickText(this.nick)}`);
    HERO_IDS.forEach((id, i) => this.heroLabels[i][0].setColor(css(id === this.hero ? P.bone : P.rain)));
    PUZZLE_LEVELS.forEach((lv, i) => this.levelLabels[i].setColor(css(lv === this.level ? P.bone : P.rain)));
    save({ nick: this.nick, hero: this.hero, level: this.level });
  }

  private start(scene: 'play' | 'practice' = 'play') {
    this.scene.start(scene, { hero: this.hero, level: this.level, nick: nickText(this.nick) });
  }
}
