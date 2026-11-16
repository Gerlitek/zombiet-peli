import Phaser from 'phaser';
import { W, H } from '../size';
import { Look, drawCharacter } from '../art/character';
import { P } from '../art/palette';
import { B, L, ell, figure } from '../art/pixels';
import { drawDrop, drawPanel } from '../art/scenery';
import { label, penFor } from '../art/ui';
import { Puzzle, PuzzleLevel, makePuzzle, puzzleBonus, puzzleText } from '../logic/puzzle';
import { track } from '../systems/telemetry';

const ROUNDS = 3, TIME = 45, DROP_Y = 150, DROP_X = [96, 160, 224], CHEST = { x: 160, y: 124 };

export interface PuzzleData { level: PuzzleLevel; look: Look; speed: number; done: (bonus: number) => void }

// Lock stone: time stops, the player walks into the drop with the missing part.
// Three correct answers open the Lightning Cave, where a chest waits.
export class PuzzleScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private cfg!: PuzzleData;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private puzzle!: Puzzle;
  private alive: boolean[] = [];        // which drops are still there
  private round = 0;
  private left = TIME;
  private asked = 0;                    // clock when the current puzzle appeared
  private clock = 0;
  private phase: 'puzzle' | 'cave' = 'puzzle';
  private pos = { x: 160, y: 216 };
  private title!: Phaser.GameObjects.Text;
  private question!: Phaser.GameObjects.Text;
  private numbers: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('puzzle');
  }

  create(data: PuzzleData) {
    this.cfg = data;
    this.round = 0; this.left = TIME; this.clock = 0; this.phase = 'puzzle'; this.pos = { x: 160, y: 216 };
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.title = label(this, W / 2, 6, '', P.iceL);
    this.question = label(this, W / 2, 46, '', P.bone, 16);
    this.numbers = DROP_X.map((x) => label(this, x, DROP_Y - 7, '', P.bone, 12));
    this.next();
  }

  private next() {
    this.puzzle = makePuzzle(this.cfg.level, Math.random);
    this.alive = [true, true, true];
    this.asked = this.clock;
    this.pos = { x: 160, y: 216 };
    this.title.setText(`HAJOTELMA ${this.round + 1}/${ROUNDS}`);
    this.question.setText(puzzleText(this.puzzle));
    this.numbers.forEach((t, i) => t.setText(String(this.puzzle.choices[i])).setVisible(true));
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000, k = this.keys;
    this.clock += dt;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    this.pos.x = Phaser.Math.Clamp(this.pos.x + dx * norm * this.cfg.speed * dt, 12, W - 12);
    this.pos.y = Phaser.Math.Clamp(this.pos.y + dy * norm * this.cfg.speed * dt, 100, H - 6);

    if (this.phase === 'puzzle') {
      this.left -= dt;
      if (this.left <= 0) return this.finish(0); // out of time: the stone closes, no penalty
      DROP_X.forEach((x, i) => {
        if (this.alive[i] && Math.hypot(this.pos.x - x, this.pos.y - 8 - DROP_Y) < 14) this.answer(i);
      });
    } else if (Math.hypot(this.pos.x - CHEST.x, this.pos.y - CHEST.y) < 14) {
      return this.finish(puzzleBonus(this.left, TIME));
    }
    this.draw(dx !== 0 || dy !== 0);
  }

  private answer(i: number) {
    const picked = this.puzzle.choices[i], correct = picked === this.puzzle.answer;
    track('puzzle_answered', { level: this.cfg.level, target: this.puzzle.target, parts: this.puzzle.shown, answer: picked, correct, time_ms: Math.round((this.clock - this.asked) * 1000) });
    if (!correct) { // a wrong drop just breaks
      this.alive[i] = false;
      this.numbers[i].setVisible(false);
      this.cameras.main.shake(80, 0.005);
      return;
    }
    if (++this.round < ROUNDS) return this.next();
    this.phase = 'cave';
    this.pos = { x: 160, y: 222 };
    this.title.setText('SALAMALUOLA');
    this.question.setText('Kävele arkulle').setFontSize(10);
    this.numbers.forEach((t) => t.setVisible(false));
    this.cameras.main.flash(300, 181, 225, 248);
  }

  private finish(bonus: number) {
    this.scene.stop();
    this.scene.resume('play');
    this.cfg.done(bonus);
  }

  private draw(moving: boolean) {
    const p = penFor(this.g.clear()), t = this.clock;
    if (this.phase === 'puzzle') {
      p.rect(0, 0, W, H, P.ink, 0.6); // the frozen game shows through
      ell(p, 160, 54, 76, 26, P.ice, 0.1 + Math.sin(t * 3) * 0.04);
      figure(p, [B(84, 34, 152, 40, P.storm), B(92, 28, 136, 8, P.storm)]);
      p.rect(88, 38, 144, 32, P.ink); p.rect(88, 38, 144, 1, P.ice); p.rect(88, 69, 144, 1, P.ice);
      for (let i = 0; i < ROUNDS; i++) p.rect(148 + i * 9, 76, 6, 3, i < this.round ? P.ice : P.storm);
      drawPanel(p, 110, 20, 100, 6, P.storm);
      p.rect(111, 21, Math.round((98 * this.left) / TIME), 4, P.ice);
      DROP_X.forEach((x, i) => {
        if (!this.alive[i]) return;
        const y = DROP_Y + Math.sin(t * 2 + i * 2) * 3;
        ell(p, x, DROP_Y + 22, 9, 2, P.ink, 0.4);
        drawDrop(p, x, y, 13);
        ell(p, x, y + 1, 10, 8, P.ink);
        this.numbers[i].setY(y - 6);
      });
    } else {
      p.rect(0, 0, W, H, P.ink);
      ell(p, 160, 150, 150, 80, P.sky);
      ell(p, 160, 110, 70, 40, P.ice, 0.12 + Math.sin(t * 2) * 0.05);
      // lightning frozen into crystals
      const crystals = [[60, 150, -8, 46], [92, 120, 5, 30], [236, 126, -6, 34], [268, 156, 9, 50], [160, 96, 0, 26]];
      figure(p, crystals.map(([x, y, tilt, h]) => L(x, y, x + tilt, y - h, 7, P.ice)));
      crystals.forEach(([x, y, tilt, h]) => p.rect(x + tilt / 2, y - h * 0.7, 1, Math.round(h * 0.4), P.iceL));
      figure(p, [B(CHEST.x - 9, CHEST.y - 10, 18, 10, P.bark), B(CHEST.x - 10, CHEST.y - 14, 20, 5, P.sand)]);
      p.rect(CHEST.x - 1, CHEST.y - 11, 3, 4, P.iceL);
    }
    drawCharacter(p, Math.round(this.pos.x), Math.round(this.pos.y), this.cfg.look, t, { still: !moving });
  }
}
