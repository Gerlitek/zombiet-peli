import Phaser from 'phaser';
import { W, H } from '../size';
import { drawCharacter } from '../art/character';
import { P } from '../art/palette';
import { B, Pen, ell, figure } from '../art/pixels';
import { SHORE, drawCat, drawCatRobot, drawHelicopter, drawPanel, drawTuft } from '../art/scenery';
import { label, penFor, zoomCamera } from '../art/ui';
import { HEROES, HeroDef, HeroId } from '../data/characters';
import { WEAPONS, WeaponDef, WeaponId } from '../data/weapons';
import { ZombieType } from '../data/zombies';
import { PuzzleLevel } from '../logic/puzzle';
import { Arsenal, Combat, SWING_TIME, addWeapon, drawWeapons, gearOf, hasBlades, isRobotForm, newArsenal, robotPose, updateWeapons } from '../systems/weapons';
import { ATTACK_HINT, attackInput } from '../systems/attack';
import { Field, Zombie, drawTrail, drawZombie, makeZombie, moveZombie } from '../systems/zombies';

// Practice on the sand dunes of Kalajoki (Hiekkasärkät), where this game comes from.
// A helicopter brings the hero. Zombies here cannot hurt, every weapon can be tried,
// and the family cats Rudi and Karri run on the sand.
const FIELD: Field = { x0: 10, x1: W - 10, y0: SHORE + 14, y1: H - 22 };
const LANDING = { x: 250, y: 126, time: 3 }; // where and how long the helicopter lands
const TRY_IDS: WeaponId[] = ['gloves', 'katanas', 'hammer', 'nunchaku', 'laser', 'ice', 'squeeze', 'rudikarri'];
const SHORT = ['Hanskat', 'Katanat', 'Moukari', 'Nuntsakot', 'Laser', 'Jää', 'Puristus', 'Robotti']; // short names that fit under the stands
const STAND_Y = 204;
const standX = (i: number) => 34 + i * 36;
const DUMMIES: ZombieType[] = ['sand', 'normal', 'kauhu'];

interface Cat { name: string; points: number; mitted: boolean; x: number; y: number; tx: number; ty: number; speed: number; sitUntil: number; left: boolean; tag: Phaser.GameObjects.Text }

export class PracticeScene extends Phaser.Scene implements Combat {
  clock = 0;
  dt = 0;
  attack = false;
  private attackPressed!: () => boolean;
  px = 0; py = 0;
  zombies: Zombie[] = [];

  private cfg!: { hero: HeroId; level: PuzzleLevel; nick: string };
  private hero!: HeroDef;
  private arsenal: Arsenal = newArsenal();
  private trying: WeaponId | null = null;
  private facing = { left: true, back: false };
  private moving = false;
  private nextZombie = 0;
  private knocked = 0;
  private cats: Cat[] = [];
  private tufts: { x: number; y: number }[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private info!: Phaser.GameObjects.Text;
  private hitHint!: Phaser.GameObjects.Text;
  private count!: Phaser.GameObjects.Text;

  constructor() {
    super('practice');
  }

  create(data: { hero: HeroId; level: PuzzleLevel; nick: string }) {
    zoomCamera(this);
    this.cfg = data;
    this.hero = HEROES[data.hero];
    this.clock = 0; this.zombies = []; this.knocked = 0; this.trying = null; this.nextZombie = LANDING.time + 2;
    this.px = LANDING.x - 22; this.py = LANDING.y + 8; this.facing = { left: true, back: false };
    this.arsenal = newArsenal();
    addWeapon(this.arsenal, this.hero.weapon);

    this.add.image(0, 0, 'bg-dunes').setOrigin(0);
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.attackPressed = attackInput(this, this.keys.SPACE);
    label(this, W / 2, 4, 'HARJOITUS: Kalajoen hiekkasärkät', P.ink, 12);
    this.info = label(this, W / 2, 20, 'Helikopteri tuo sinut särkille...', P.ink, 8);
    // The attack hint is its own framed line, clearly apart from the weapon description above it.
    this.hitHint = label(this, W / 2, 36, ATTACK_HINT, P.ink, 8).setVisible(false);
    this.count = label(this, 6, SHORE + 2, '', P.ink, 8, 0);
    label(this, W / 2, H - 13, 'ENTER: aloita oikea peli      ESC: takaisin valikkoon', P.bone, 8);
    SHORT.forEach((name, i) => label(this, standX(i), STAND_Y + 4, name, P.ink, 6));

    this.tufts = [];
    for (let i = 0; i < 22; i++) this.tufts.push({ x: Phaser.Math.Between(6, W - 6), y: Phaser.Math.Between(SHORE + 14, H - 30) });
    // Rudi and Karri are ragdoll cats with blue eyes. Rudi is a brown colorpoint, Karri is a grey mitted (white paws).
    this.cats = [['Rudi', P.bark, 60, 150], ['Karri', P.storm, 120, 180]].map(([name, points, x, y]) => ({
      mitted: name === 'Karri',
      name: name as string, points: points as number, x: x as number, y: y as number, tx: x as number, ty: y as number,
      speed: 60, sitUntil: 0, left: false, tag: label(this, 0, 0, name as string, P.ink, 7),
    }));

    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('play', this.cfg));
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('menu'));
  }

  update(_: number, deltaMs: number) {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.clock += dt; this.dt = dt;
    const landed = this.clock > LANDING.time;
    this.attack = landed && this.attackPressed() && this.clock >= this.arsenal.swingAt + SWING_TIME;
    if (landed) this.moveHero(dt);
    this.updateZombies(dt);
    updateWeapons(this.arsenal, this);
    this.pickWeapon();
    for (const cat of this.cats) this.moveCat(cat, dt);
    this.info.setText(!landed ? 'Helikopteri tuo sinut särkille...'
      : this.trying ? `Kokeilet: ${WEAPONS[this.trying].name}. ${WEAPONS[this.trying].info}.`
      : 'Kävele kyltin luo, niin saat kokeilla asetta.');
    this.hitHint.setVisible(landed);
    this.count.setText(this.knocked ? `Kaadettu: ${this.knocked}` : '');
    this.draw(landed);
  }

  private moveHero(dt: number) {
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    this.moving = dx !== 0 || dy !== 0;
    if (dx) this.facing = { left: dx < 0, back: false };
    else if (dy) this.facing.back = dy < 0;
    this.px = Phaser.Math.Clamp(this.px + dx * norm * this.hero.speed * dt, FIELD.x0, FIELD.x1);
    this.py = Phaser.Math.Clamp(this.py + dy * norm * this.hero.speed * dt, FIELD.y0, FIELD.y1);
  }

  // Practice zombies rise from the wet sand by the sea. They follow the hero but cannot hurt.
  private updateZombies(dt: number) {
    if (this.clock >= this.nextZombie && this.zombies.length < 3) {
      this.nextZombie = this.clock + 3;
      const type = DUMMIES[Math.floor(Math.random() * DUMMIES.length)];
      this.zombies.push(makeZombie(type, Phaser.Math.Between(30, 200), SHORE + 16, this.clock, false, Math.random));
    }
    for (const z of this.zombies) {
      // They stop a step away, so the hero is never pushed around.
      const far = Math.hypot(z.x - this.px, z.y - this.py) > 16;
      moveZombie(z, far ? this.px : z.x, far ? this.py : z.y, this.clock, dt, FIELD);
    }
  }

  // Walking onto a weapon stand swaps the weapon being tried.
  private pickWeapon() {
    const i = TRY_IDS.findIndex((_, n) => Math.hypot(this.px - standX(n), this.py - STAND_Y) < 10);
    if (i < 0 || TRY_IDS[i] === this.trying) return;
    this.trying = TRY_IDS[i];
    this.arsenal = newArsenal();
    addWeapon(this.arsenal, this.hero.weapon);
    addWeapon(this.arsenal, this.trying);
    this.cameras.main.flash(120, 181, 225, 248);
  }

  private moveCat(cat: Cat, dt: number) {
    if (this.clock < cat.sitUntil) return;
    const dx = cat.tx - cat.x, dy = cat.ty - cat.y, dist = Math.hypot(dx, dy);
    if (dist < 3) { // arrived: sit for a moment, then pick a new place to run to
      cat.sitUntil = this.clock + 0.8 + Math.random() * 2.5;
      cat.tx = Phaser.Math.Between(16, W - 16); cat.ty = Phaser.Math.Between(SHORE + 16, STAND_Y - 14);
      cat.speed = 45 + Math.random() * 60;
      return;
    }
    cat.left = dx < 0;
    cat.x += (dx / dist) * cat.speed * dt; cat.y += (dy / dist) * cat.speed * dt;
  }

  hit(z: Zombie, damage: number) {
    if (z.hp <= 0) return;
    z.hp -= this.clock < z.squashed ? 999 : damage;
    z.flash = this.clock + 0.08;
    this.facing = { left: z.x < this.px, back: false };
    if (z.hp <= 0) { this.zombies = this.zombies.filter((o) => o !== z); this.knocked++; }
  }

  heal() { /* no hearts in practice */ }

  shake(power: number) {
    this.cameras.main.shake(power > 0.01 ? 180 : 70, power);
  }

  private draw(landed: boolean) {
    const p = penFor(this.g.clear()), t = this.clock;
    for (let x = 0; x < W; x += 8) p.rect(x + Math.round(Math.sin(t * 1.5 + x) * 2), SHORE - 1 + Math.round(Math.sin(t + x * 0.3)), 6, 1, P.bone); // foam on the shoreline
    for (const s of this.tufts) drawTuft(p, s.x, s.y, t, P.moss1);
    for (const z of this.zombies) drawTrail(p, z);
    TRY_IDS.forEach((id, i) => this.drawStand(p, standX(i), STAND_Y, WEAPONS[id], id === this.trying));

    // helicopter: comes down for the first seconds, then stays parked with the rotor slowing
    const k = Math.min(1, t / LANDING.time), ease = 1 - (1 - k) * (1 - k);
    const heli = { x: LANDING.x + (1 - ease) * 60, y: LANDING.y - (1 - ease) * 90, rotor: landed ? Math.max(0.15, 1 - (t - LANDING.time) / 4) : 1 };
    if (!landed) for (let i = 0; i < 14; i++) p.rect(LANDING.x - 30 + ((i * 37 + t * 90) % 60), LANDING.y - ((i * 13 + t * 40) % 12), 2, 1, P.bone, 0.7 * k); // sand blown by the rotor

    const things: { y: number; draw: () => void }[] = [
      { y: heli.y, draw: () => drawHelicopter(p, heli.x, heli.y, t, heli.rotor) },
      ...this.zombies.map((z) => ({ y: z.y, draw: () => drawZombie(p, z, t, this.px < z.x) })),
      ...this.cats.map((c) => ({ y: c.y, draw: () => drawCat(p, c.x, c.y, t, { left: c.left, sitting: t < c.sitUntil, points: c.points, mitted: c.mitted }) })),
    ];
    if (landed) things.push({ y: this.py, draw: () => this.drawHero(p) });
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());
    if (landed) drawWeapons(p, this.arsenal, this);
    for (const c of this.cats) c.tag.setPosition(Math.round(c.x), Math.round(c.y) - 24);

    drawPanel(p, 0, H - 16, W, 16, P.ink, P.ink);
    if (landed) { // only a thin black frame around the attack hint, sized from the text so it always fits
      const w = Math.ceil(this.hitHint.width) + 8, h = 12, x = Math.round(W / 2 - w / 2), y = 34;
      p.rect(x, y, w, 1, P.ink); p.rect(x, y + h - 1, w, 1, P.ink); p.rect(x, y, 1, h, P.ink); p.rect(x + w - 1, y, 1, h, P.ink);
    }
  }

  private drawHero(p: Pen) {
    if (isRobotForm(this.arsenal)) return drawCatRobot(p, this.px, this.py, this.clock, robotPose(this.arsenal, this.clock, this.facing.left)); // trying the robot: the hero becomes it
    const swing = (this.clock - this.arsenal.swingAt) / SWING_TIME, attacking = swing < 1, blades = hasBlades(this.arsenal);
    drawCharacter(p, Math.round(this.px), Math.round(this.py), this.hero.look, this.clock, {
      still: !this.moving, left: this.facing.left, back: this.facing.back && !attacking,
      swing: attacking && !blades ? swing : undefined, wave: attacking && blades ? swing : undefined,
      ...gearOf(this.arsenal),
    });
  }

  // A weapon stand: a small wooden post with the weapon's sign on it.
  private drawStand(p: Pen, x: number, y: number, def: WeaponDef, chosen: boolean) {
    ell(p, x, y + 1, 7, 2, P.ink, 0.25);
    figure(p, [B(x - 1, y - 6, 2, 7, P.bark), B(x - 6, y - 16, 12, 10, chosen ? P.ice : P.bark)]);
    p.rect(x - 5, y - 15, 10, 8, P.ink);
    if (def.kind === 'strike') ell(p, x, y - 11, 2, 2, def.color);
    else if (def.kind === 'status') p.rect(x - 2, y - 13, 5, 5, def.color);
    else { p.rect(x, y - 14, 1, 7, def.color); p.rect(x - 3, y - 11, 7, 1, def.color); }
  }
}
