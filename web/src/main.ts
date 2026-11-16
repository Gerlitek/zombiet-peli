import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { PlayScene } from './scenes/PlayScene';
import { PracticeScene } from './scenes/PracticeScene';
import { StoryScene } from './scenes/StoryScene';
import { WheelScene } from './scenes/WheelScene';
import { PuzzleScene } from './scenes/PuzzleScene';
import { EndScene } from './scenes/EndScene';
import { W, H, ZOOM } from './size';


const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W * ZOOM,
  height: H * ZOOM,
  pixelArt: true,
  backgroundColor: '#0b0e14',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, StoryScene, PracticeScene, PlayScene, WheelScene, PuzzleScene, EndScene],
});

// Development only: lets tests and the browser console reach the running game.
if (import.meta.env.DEV) Object.assign(window, { game });
