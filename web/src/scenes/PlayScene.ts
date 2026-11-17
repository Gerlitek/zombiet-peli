import Phaser from 'phaser';
import { W, H } from '../size';
import { drawCharacter } from '../art/character';
import { P, css } from '../art/palette';
import { B, Pen, ell, figure } from '../art/pixels';
import { BOARD, HORIZON, drawDrop, drawHeart, drawPanel, drawTree, drawTuft } from '../art/scenery';
import { fit, label, penFor, zoomCamera } from '../art/ui';
import { ACHIEVEMENTS, AchievementId } from '../data/achievements';
import { HEROES, HeroDef, HeroId } from '../data/characters';
import { FAST_WIN, VIP_AT, WIN_AT } from '../data/rules';
import { WEAPONS, WeaponDef, WeaponId } from '../data/weapons';
import { ZombieType, spawnWeights } from '../data/zombies';
import { PuzzleLevel } from '../logic/puzzle';
import { pickWeighted } from '../logic/random';
import { score } from '../logic/score';
import { WheelName } from '../logic/wheel';
import { addBest, load, unlock } from '../systems/storage';
import { flush, track } from '../systems/telemetry';
import { ATTACK_HINT, attackInput } from '../systems/attack';
import { Arsenal, Combat, SWING_TIME, addWeapon, drawWeapons, gearOf, hasBlades, newArsenal, updateWeapons } from '../systems/weapons';
import { Tree, Weather } from '../systems/weather';
import { Field, RISE_TIME, Zombie, drawTrail, drawZombie, isRising, makeZombie, moveZombie } from '../systems/zombies';

const STONE_AT = VIP_AT + 1; // the lock stone and its decomposition puzzles are only in the VIP box: it appears after this many kills
const MAX_ALIVE = 8;
const MAX_HP = 5;
const MESSAGE_TIME = 4;  // seconds a message stays on screen
const NOTE_TIME = 1.8;   // achievements are only short notes: they must not cover the game
const CALM_TIME = 3;     // seconds without new zombies or damage after the wheel or a puzzle
const DROP_TIME = 1.2, PUDDLE_TIME = 1; // rain drop falls, puddle grows, then the zombie rises
const FIELD: Field = { x0: 10, x1: W - 10, y0: HORIZON + 18, y1: H - 6 };
const VIP_SIGN = { x: 284, w: 31 }; // the sign in the top right corner: red = locked, green = open
const STONE = { x: 160, y: 140 }; // its label sits below it: above it is the message banner of the VIP box

type Zone = 'forest' | 'vip';
interface Spawn { x: number; y: number; at: number; type: ZombieType; born: boolean }
interface Drawable { y: number; draw: () => void }

// One scene for both zones. State is plain data, and everything is redrawn every frame from that data.
export class PlayScene extends Phaser.Scene implements Combat {
  // Combat interface: what the weapons need
  clock = 0;
  dt = 0;
  attack = false;
  private attackPressed!: () => boolean;
  px = W / 2; py = 160;
  zombies: Zombie[] = [];

  private hero!: HeroDef;
  private nick = '';
  private level: PuzzleLevel = 'easy';
  private zone: Zone = 'forest';
  private hp = MAX_HP;
  private kills = 0;
  private invulnerableUntil = 0;
  private moving = false;
  private facing = { left: false, back: false }; // the hero turns the way it walks
  private arsenal: Arsenal = newArsenal();
  private spawns: Spawn[] = [];
  private nextSpawn = 0;
  private trees: Tree[] = [];
  private tufts: { x: number; y: number }[] = [];
  private weather!: Weather;
  private stone: { open: boolean; used: boolean } = { open: false, used: false };
  private puzzleBonus = 0;
  private wasHit = false;
  private earned: AchievementId[] = [];
  private pending: (() => void)[] = []; // overlays to open at the start of the next frame
  private ended = false;
  private badges = 0; // achievements shown on the VIP board

  private bg!: Phaser.GameObjects.Image;
  private g!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private banner!: Phaser.GameObjects.Text;
  private bannerUntil = 0;
  private messages: { text: string; time: number }[] = []; // shown one at a time
  private stoneTag!: Phaser.GameObjects.Text;
  private vipSign!: Phaser.GameObjects.Text;
  private board: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('play');
  }

  create(data: { hero: HeroId; level: PuzzleLevel; nick: string }) {
    zoomCamera(this);
    this.hero = HEROES[data.hero];
    this.nick = data.nick;
    this.level = data.level;
    this.clock = 0; this.px = W / 2; this.py = 160; this.zombies = []; this.spawns = [];
    this.hp = MAX_HP; this.kills = 0; this.invulnerableUntil = 0; this.nextSpawn = 1.5;
    this.arsenal = newArsenal(); this.puzzleBonus = 0; this.wasHit = false;
    this.earned = []; this.pending = []; this.board = []; this.bannerUntil = 0; this.messages = []; this.ended = false;
    addWeapon(this.arsenal, this.hero.weapon);

    this.bg = this.add.image(0, 0, 'bg-forest').setOrigin(0);
    this.g = this.add.graphics();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.attackPressed = attackInput(this, this.keys.SPACE);
    this.banner = label(this, W / 2, HORIZON + 22, '', P.iceL);
    this.vipSign = label(this, VIP_SIGN.x + VIP_SIGN.w / 2, 6, 'VIP', P.hurt);
    this.stoneTag = label(this, STONE.x, STONE.y + 4, 'AARREKIVI', P.iceL, 8).setVisible(false);
    this.input.keyboard!.once('keydown-ESC', () => { flush(); this.scene.start('menu'); }); // Esc: back to the start screen
    this.weather = new Weather(W, H);
    this.enterZone('forest');

    track('game_started', { nickname: this.nick, character: data.hero });
    this.say(`Zombit nousevat sateesta. ${ATTACK_HINT}!`);
  }

  update(_: number, deltaMs: number) {
    if (this.ended) return;
    if (this.pending.length) return this.pending.shift()!();
    const dt = Math.min(deltaMs, 50) / 1000; // clamp so a slow frame cannot teleport anything
    this.clock += dt;
    this.dt = dt;
    // One press or click = one attack. Holding the key down does nothing more.
    this.attack = this.attackPressed() && this.clock >= this.arsenal.swingAt + SWING_TIME;
    this.movePlayer(dt);
    this.updateSpawns();
    for (const z of this.zombies) moveZombie(z, this.px, this.py, this.clock, dt, FIELD);
    updateWeapons(this.arsenal, this);
    this.touchDamage();
    this.touchStone();
    this.weather.update(this.clock, dt, this.trees);
    this.draw();
  }

  // ---------- zones ----------

  private enterZone(zone: Zone) {
    this.zone = zone;
    this.zombies = []; this.spawns = [];
    this.stone = { open: false, used: false };
    this.bg.setTexture(`bg-${zone}`);
    const vip = zone === 'vip';
    this.trees = vip ? [] : [[42, 118, 34], [262, 104, 30], [300, 176, 40], [18, 226, 44]].map(([x, y, h], i) => ({ x, y, h, seed: i + 1, burnUntil: 0 }));
    this.tufts = [];
    if (!vip) for (let i = 0; i < 26; i++) this.tufts.push({ x: Phaser.Math.Between(4, W - 4), y: Phaser.Math.Between(HORIZON + 12, H - 4) });
    this.vipSign.setColor(css(vip ? P.sick : P.hurt)); // the sign is red until the VIP box opens, then green
    if (vip) this.showBoard();
  }

  // The back board of the VIP box: who is strongest and the achievements stay visible.
  private showBoard() {
    const saved = load(), x = BOARD.x + 8, y = BOARD.y + 5;
    this.badges = saved.achievements.length;
    this.board.push(label(this, x, y, 'VAHVIN', P.iceL, 10, 0));
    const best = saved.best.length ? saved.best : [{ nick: this.nick, score: 0 }];
    best.forEach((b, i) => this.board.push(label(this, x, y + 12 + i * 10, `${i + 1} ${b.nick} ${b.score}`, i ? P.rain : P.bone, 8, 0)));
    this.board.push(label(this, x + 150, y, 'SAAVUTUKSET', P.iceL, 10, 0));
    this.board.push(label(this, x + 150, y + 30, 'Zombit ovat supervahvoja!', P.rain, 8, 0));
    for (const t of this.board) t.setDepth(1);
  }

  // ---------- player ----------

  private movePlayer(dt: number) {
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    const norm = dx && dy ? Math.SQRT1_2 : 1;
    this.moving = dx !== 0 || dy !== 0;
    if (dx) this.facing = { left: dx < 0, back: false };
    else if (dy) this.facing.back = dy < 0; // walking up shows the back, walking down the face
    this.px = Phaser.Math.Clamp(this.px + dx * norm * this.hero.speed * dt, FIELD.x0, FIELD.x1);
    this.py = Phaser.Math.Clamp(this.py + dy * norm * this.hero.speed * dt, FIELD.y0, FIELD.y1);
  }

  private touchDamage() {
    if (this.clock < this.invulnerableUntil) return;
    const z = this.zombies.find((o) => !isRising(o, this.clock) && this.clock > o.frozen && this.clock > o.squashed && Math.hypot(o.x - this.px, o.y - this.py) < (o.armed ? 13 : 9));
    if (!z) return;
    this.hp--;
    this.wasHit = true;
    this.invulnerableUntil = this.clock + 1;
    this.cameras.main.shake(100, 0.01);
    track('player_hit', { zombie_type: z.type, zone: this.zone, hearts_left: this.hp });
    if (this.hp <= 0) this.end(false);
  }

  // A quiet moment after an overlay closes: time to read the message and find the hero again.
  private calm() {
    this.invulnerableUntil = this.clock + CALM_TIME;
    this.nextSpawn = Math.max(this.nextSpawn, this.clock + CALM_TIME);
  }

  heal() {
    this.hp = Math.min(MAX_HP, this.hp + 1);
  }

  shake() {
    this.cameras.main.shake(120, 0.008);
  }

  // ---------- zombies ----------

  // Rain makes zombies: a big drop falls, a puddle grows, a zombie rises from it.
  private updateSpawns() {
    if (this.clock >= this.nextSpawn) {
      this.nextSpawn = this.clock + (this.zone === 'vip' ? 2.2 : 2.8);
      // Pick a spot that is not right next to the player. Try a few times so a spawn is never skipped by bad luck.
      let x = 0, y = 0, far = false;
      for (let i = 0; i < 10 && !far; i++) {
        x = Phaser.Math.Between(FIELD.x0 + 8, FIELD.x1 - 8); y = Phaser.Math.Between(FIELD.y0 + 6, FIELD.y1 - 4);
        far = Math.hypot(x - this.px, y - this.py) > 60;
      }
      // The last kill is always a boss: when one kill is missing, only a single Dark Lord or Giant comes.
      const last = this.kills === WIN_AT - 1;
      const room = last ? this.zombies.length + this.spawns.length === 0 : this.zombies.length + this.spawns.length < MAX_ALIVE;
      if (far && room) {
        const type: ZombieType = last ? (Math.random() < 0.5 ? 'lord' : 'giant') : pickWeighted(spawnWeights(), Math.random);
        this.spawns.push({ x, y, at: this.clock, type, born: false });
      }
    }
    for (const s of this.spawns) {
      if (!s.born && this.clock >= s.at + DROP_TIME + PUDDLE_TIME) {
        s.born = true;
        this.zombies.push(makeZombie(s.type, s.x, s.y, this.clock, this.zone === 'vip', Math.random));
      }
    }
    this.spawns = this.spawns.filter((s) => this.clock < s.at + DROP_TIME + PUDDLE_TIME + RISE_TIME + 0.4);
  }

  hit(z: Zombie, damage: number, weapon: WeaponId) {
    // Ignore zombies that are no longer in the game. Without this, one hammer blow that opens the VIP box
    // would go on to hit the forest zombies that were just cleared away, and count them as kills.
    if (z.hp <= 0 || !this.zombies.includes(z)) return;
    if (WEAPONS[weapon].kind === 'strike') this.facing = { left: z.x < this.px, back: false }; // turn toward the zombie that is hit
    z.hp -= this.clock < z.squashed ? 999 : damage;
    z.flash = this.clock + 0.08;
    if (z.hp <= 0) this.kill(z, weapon);
  }

  private kill(z: Zombie, weapon: WeaponId) {
    this.zombies = this.zombies.filter((o) => o !== z);
    if (z.trait === 'gift') { // surprise: the box opens into another zombie, no kill yet
      let type: ZombieType = 'gift';
      while (type === 'gift') type = pickWeighted(spawnWeights(), Math.random);
      const inside = makeZombie(type, z.x, z.y, this.clock - RISE_TIME, z.vip, Math.random);
      inside.stun = this.clock + 0.6;
      this.zombies.push(inside);
      return this.say('Ylläri!');
    }
    this.kills++;
    track('zombie_killed', { zombie_type: z.type, weapon, zone: this.zone, total_kills: this.kills });
    if (z.armed || (this.hero.healEvery && this.kills % this.hero.healEvery === 0)) this.heal();
    this.achieve('first');
    if (z.type === 'giant') this.achieve('giant');
    if (z.type === 'lord') this.achieve('lord');

    if (this.kills >= WIN_AT) return this.end(true);
    if (this.kills === VIP_AT) {
      track('vip_entered', { duration_s: Math.floor(this.clock), hearts_left: this.hp });
      flush();
      this.achieve('vip');
      this.enterZone('vip');
      this.hp = MAX_HP; // the VIP box is a reward: hearts are refilled, because the second half is the hard one
      this.say('VIP-AITIO! Sydämet täyttyivät. Zombit ovat supervahvoja.');
      this.cameras.main.flash(300, 181, 225, 248);
      this.pending.push(() => this.openWheel('vip', 'Pääsit VIP-aitioon! Palkinto: parempi ase'));
    }
    if (this.kills === WIN_AT - 1) { // the others flee, so the last one really is the boss
      this.zombies = []; this.spawns = [];
      this.nextSpawn = this.clock + 1.5;
      this.say('Viimeinen zombi saapuu!');
      this.cameras.main.flash(250, 181, 225, 248);
    }
    if (this.kills === STONE_AT && !this.stone.used) { this.stone.open = true; this.say('Aarrekivi ilmestyi! Ratkaise sen arvoitukset, niin pääset aarteelle.'); }
  }

  // ---------- overlays: wheel, lock stone ----------

  // The wheel is a reward, never the first thing in the game: VIP entry and the two cave chests. The reason is always shown.
  private openWheel(wheel: WheelName, reason: string) {
    this.scene.pause();
    this.scene.launch('wheel', {
      wheel, reason,
      done: (id: WeaponId) => {
        addWeapon(this.arsenal, id);
        track('wheel_spun', { wheel, weapon: id, kills: this.kills });
        if (id === 'rudikarri') this.achieve('rudikarri');
        const level = this.arsenal.level[id]!;
        this.say(level > 1 ? `${WEAPONS[id].name} vahvistui tasolle ${level}` : `Uusi ase: ${WEAPONS[id].name}. ${WEAPONS[id].info}`);
        this.calm();
      },
    });
  }

  private touchStone() {
    if (!this.stone.open || Math.hypot(this.px - STONE.x, this.py - STONE.y - 4) > 14) return;
    this.stone = { open: false, used: true };
    const zone = this.zone, level = this.level;
    this.scene.pause();
    this.scene.launch('puzzle', {
      level, look: this.hero.look, speed: this.hero.speed,
      done: (bonus: number) => {
        this.calm();
        if (!bonus) return this.say('Aarrekivi sulkeutui');
        this.puzzleBonus += bonus;
        this.heal();
        track('cave_entered', { zone, level, duration_s: Math.floor(this.clock) });
        this.achieve('puzzle');
        // The chest gives a spin of the basic wheel. That is the only way to get the basic weapons in the game.
        this.pending.push(() => this.openWheel('forest', 'Salamaluolan aarre: lisäpyöräytys'));
      },
    });
  }

  // ---------- end, achievements, messages ----------

  private end(won: boolean) {
    if (this.ended) return;
    this.ended = true;
    if (won) {
      this.achieve('won');
      if (!this.wasHit) this.achieve('flawless');
      if (this.clock < FAST_WIN) this.achieve('fast');
    }
    const result = { kills: this.kills, hearts: Math.max(0, this.hp), seconds: this.clock, won, puzzleBonus: this.puzzleBonus };
    const points = score(result);
    addBest(this.nick, points);
    track('game_ended', { result: won ? 'won' : 'lost', kills: this.kills, duration_s: Math.floor(this.clock), hearts_left: result.hearts, score: points });
    flush();
    this.scene.start('end', { won, kills: this.kills, seconds: this.clock, score: points, earned: this.earned, nick: this.nick });
  }

  private achieve(id: AchievementId) {
    if (!unlock(id)) return;
    this.earned.push(id);
    this.badges++;
    track('achievement_unlocked', { achievement: id });
    this.say(`Saavutus: ${ACHIEVEMENTS[id]}`, NOTE_TIME);
  }

  private say(text: string, time = MESSAGE_TIME) {
    this.messages.push({ text, time });
  }

  // ---------- drawing ----------

  private draw() {
    const p = penFor(this.g.clear()), t = this.clock, vip = this.zone === 'vip';
    if (!vip) this.weather.drawSky(p, t);
    for (const s of this.tufts) drawTuft(p, s.x, s.y, t);
    for (const s of this.spawns) { // puddles
      const k = Phaser.Math.Clamp((t - s.at - DROP_TIME) / PUDDLE_TIME, 0, 1);
      if (k > 0) { ell(p, s.x, s.y, Math.round(3 + k * 9), Math.round(1 + k * 3), P.storm); ell(p, s.x, s.y, Math.round(1 + k * 6), Math.round(k * 2), P.rain); }
    }
    for (const z of this.zombies) drawTrail(p, z);

    // Things lower on the screen are drawn later, so they cover things behind them.
    const things: Drawable[] = [
      ...this.trees.map((tr) => ({ y: tr.y, draw: () => drawTree(p, tr.x, tr.y, tr.h, tr.seed, t < tr.burnUntil, t) })),
      ...this.zombies.map((z) => ({ y: z.y, draw: () => drawZombie(p, z, t, this.px < z.x) })),
      { y: this.py, draw: () => this.drawPlayer(p) },
    ];
    if (this.stone.open) things.push({ y: STONE.y, draw: () => this.drawStone(p) });
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());

    drawWeapons(p, this.arsenal, this);
    for (const s of this.spawns) { // falling drops
      const k = (t - s.at) / DROP_TIME;
      if (k < 1) drawDrop(p, s.x + (1 - k) * 10, 24 + k * (s.y - 28), 5);
    }
    this.weather.drawFront(p, t);
    this.drawHud(p);
    if (t >= this.bannerUntil && this.messages.length) {
      const next = this.messages.shift()!;
      fit(this.banner.setText(next.text), W - 24);
      this.bannerUntil = t + next.time;
    }
    // In the forest messages sit in the sky, off the play area. In the VIP box the board is there, so they sit below it.
    // Set every frame: a message that is still showing when the zone changes must move too.
    this.banner.setY(this.zone === 'vip' ? HORIZON + 22 : 26);
    const show = t < this.bannerUntil;
    this.banner.setVisible(show);
    this.stoneTag.setVisible(this.stone.open);
    const bw = Math.round(this.banner.displayWidth);
    if (show) drawPanel(p, Math.round(W / 2 - bw / 2) - 6, this.banner.y - 3, bw + 12, 18, P.ice);
  }

  private drawPlayer(p: Pen) {
    const blink = this.clock < this.invulnerableUntil && Math.floor(this.clock * 12) % 2 === 0;
    const swing = (this.clock - this.arsenal.swingAt) / SWING_TIME, attacking = swing < 1;
    const blades = hasBlades(this.arsenal); // with blades around, the hero waves the arms instead of striking
    drawCharacter(p, Math.round(this.px), Math.round(this.py), this.hero.look, this.clock, {
      still: !this.moving, alpha: blink ? 0.35 : 1, left: this.facing.left, back: this.facing.back && !attacking,
      swing: attacking && !blades ? swing : undefined, wave: attacking && blades ? swing : undefined,
      ...gearOf(this.arsenal),
    });
  }

  private drawStone(p: Pen) {
    const { x, y } = STONE, glow = 0.5 + Math.sin(this.clock * 3) * 0.5, bob = Math.round(Math.sin(this.clock * 5) * 2);
    ell(p, x, y - 6, 22, 16, P.ice, 0.12 + glow * 0.14);
    // bouncing arrow above the stone so it cannot be missed
    p.rect(x - 1, y - 32 + bob, 3, 5, P.iceL); p.rect(x - 3, y - 27 + bob, 7, 1, P.iceL); p.rect(x - 2, y - 26 + bob, 5, 1, P.iceL); p.rect(x - 1, y - 25 + bob, 3, 1, P.iceL); p.rect(x, y - 24 + bob, 1, 1, P.iceL);
    figure(p, [B(x - 8, y - 16, 16, 16, P.storm), B(x - 6, y - 19, 12, 4, P.storm)]);
    p.rect(x - 5, y - 13, 10, 10, P.ink);
    p.rect(x - 1, y - 11, 3, 1, P.ice); p.rect(x + 1, y - 10, 1, 2, P.ice); p.rect(x, y - 8, 1, 2, P.ice); p.rect(x, y - 5, 1, 1, P.ice); // "?"
  }

  // One box per kill while the boxes fit (up to 40 kills). With more kills, a solid bar of the same width.
  // The light marks show the VIP box and the end.
  private drawKillBar(p: Pen) {
    if (WIN_AT <= 40) {
      for (let i = 0; i < WIN_AT; i++) {
        p.rect(5 + i * 5, 14, 4, 5, i === VIP_AT - 1 || i === WIN_AT - 1 ? P.iceL : P.storm);
        p.rect(6 + i * 5, 15, 2, 3, i < this.kills ? P.ice : P.ink);
      }
      return;
    }
    const w = 199, at = (n: number) => Math.round((n / WIN_AT) * (w - 2));
    drawPanel(p, 5, 14, w, 5, P.storm);
    p.rect(6, 15, at(Math.min(this.kills, WIN_AT)), 3, P.ice);
    p.rect(5 + at(VIP_AT), 13, 1, 7, P.iceL);
    p.rect(4 + w, 13, 1, 7, P.iceL);
  }

  private drawHud(p: Pen) {
    for (let i = 0; i < MAX_HP; i++) drawHeart(p, 5 + i * 7, 5, i < this.hp ? P.hurt : P.storm);
    this.drawKillBar(p);
    const vip = this.zone === 'vip';
    drawPanel(p, VIP_SIGN.x, 4, VIP_SIGN.w, 13, vip ? P.sick : P.hurt);
    // weapon slots: circle = strike, cross = orbit, square = status
    (Object.keys(this.arsenal.level) as WeaponId[]).forEach((id, i) => {
      const def: WeaponDef = WEAPONS[id], x = 5 + i * 15, y = 222;
      drawPanel(p, x, y, 13, 13, P.ice);
      if (def.kind === 'strike') ell(p, x + 6, y + 6, 3, 3, def.color);
      else if (def.kind === 'status') p.rect(x + 3, y + 3, 7, 7, def.color);
      else { p.rect(x + 6, y + 2, 1, 9, def.color); p.rect(x + 2, y + 6, 9, 1, def.color); }
      for (let l = 1; l < this.arsenal.level[id]!; l++) p.rect(x + 1 + l * 2, y + 11, 1, 1, P.sand);
    });
    if (vip) { // achievement badges on the back board
      const have = this.badges, total = Object.keys(ACHIEVEMENTS).length;
      for (let i = 0; i < total; i++) drawPanel(p, BOARD.x + 158 + i * 13, BOARD.y + 18, 11, 11, i < have ? P.sand : P.storm, i < have ? P.cloud : P.ink);
    }
  }
}
