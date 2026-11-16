import Phaser from 'phaser';
import { W, H } from '../size';
import { drawCharacter, drawGift } from '../art/character';
import { P } from '../art/palette';
import { drawPanel } from '../art/scenery';
import { label, penFor } from '../art/ui';
import { HEROES, HeroId } from '../data/characters';
import { Nick, nickText, rollNick } from '../data/nicknames';
import { ZOMBIES } from '../data/zombies';
import { PUZZLE_LEVELS, PuzzleLevel } from '../logic/puzzle';
import { load, save } from '../systems/storage';

const LEVEL_NAMES: Record<PuzzleLevel, string> = { easy: 'Helppo', medium: 'Keski', hard: 'Vaikea' };

export class MenuScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private hero: HeroId = 'knight';
  private level: PuzzleLevel = 'easy';
  private nick: Nick = [0, 0, 0];
  private texts!: Record<'nick' | 'hero' | 'info' | 'level', Phaser.GameObjects.Text>;

  constructor() {
    super('menu');
  }

  create() {
    const saved = load();
    this.hero = saved.hero in HEROES ? (saved.hero as HeroId) : 'knight';
    this.level = PUZZLE_LEVELS.includes(saved.level as PuzzleLevel) ? (saved.level as PuzzleLevel) : 'easy';
    this.nick = saved.nick[2] ? saved.nick : rollNick(Math.random);

    this.add.image(0, 0, 'bg-forest').setOrigin(0);
    this.g = this.add.graphics();
    label(this, W / 2, 14, 'YLLÄRI-ZOMBIET', P.ice, 20);
    label(this, W / 2, 38, 'Taistele zombieita vastaan', P.rain);
    this.texts = {
      nick: label(this, W / 2, 84, ''),
      hero: label(this, W / 2, 150, '', P.iceL),
      info: label(this, W / 2, 162, '', P.rain),
      level: label(this, W / 2, 180, ''),
    };
    label(this, W / 2, 96, 'N: arvo uusi nimi', P.storm);
    const start = label(this, W / 2, 212, 'Välilyönti: aloita', P.ice);
    this.tweens.add({ targets: start, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    const kb = this.input.keyboard!;
    kb.on('keydown-N', () => { this.nick = rollNick(Math.random); this.refresh(); });
    kb.on('keydown-LEFT', () => this.switchHero());
    kb.on('keydown-RIGHT', () => this.switchHero());
    kb.on('keydown-UP', () => this.switchLevel(1));
    kb.on('keydown-DOWN', () => this.switchLevel(-1));
    kb.once('keydown-SPACE', () => this.start());
    this.input.once('pointerdown', () => this.start());
    this.refresh();
  }

  update(time: number) {
    const p = penFor(this.g.clear()), t = time / 1000;
    drawPanel(p, 60, 80, 200, 30, P.storm);
    drawPanel(p, 60, 116, 200, 82, P.storm);
    (Object.keys(HEROES) as HeroId[]).forEach((id, i) => {
      const x = 130 + i * 60, chosen = id === this.hero;
      if (chosen) drawPanel(p, x - 18, 120, 36, 28, P.ice, P.sky);
      drawCharacter(p, x, 144, HEROES[id].look, t, { still: !chosen });
    });
    drawCharacter(p, 30, 226, ZOMBIES.kauhu.look, t, { seed: 2 });
    drawCharacter(p, 290, 222, ZOMBIES.normal.look, t, { seed: 5 });
    drawGift(p, 268, 232, t);
  }

  private switchHero() {
    this.hero = this.hero === 'knight' ? 'mini' : 'knight';
    this.refresh();
  }

  private switchLevel(step: number) {
    const i = PUZZLE_LEVELS.indexOf(this.level) + step;
    this.level = PUZZLE_LEVELS[Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, i))];
    this.refresh();
  }

  private refresh() {
    this.texts.nick.setText(nickText(this.nick));
    this.texts.hero.setText(`<  ${HEROES[this.hero].name}  >`);
    this.texts.info.setText(HEROES[this.hero].info);
    this.texts.level.setText(`Hajotelmat: ${LEVEL_NAMES[this.level]}  (ylös/alas)`);
    save({ nick: this.nick, hero: this.hero, level: this.level });
  }

  private start() {
    this.scene.start('play', { hero: this.hero, level: this.level, nick: nickText(this.nick) });
  }
}
