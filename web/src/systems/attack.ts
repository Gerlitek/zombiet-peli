import Phaser from 'phaser';

// The player attacks with the space bar or a mouse click, whichever is handier. Both always work.
export const ATTACK_HINT = 'Lyö VÄLILYÖNNILLÄ tai KLIKKAA';

// Returns a function that tells, once per frame, whether an attack was just pressed.
// One press or one click = one attack: holding the key or the button does nothing more.
export function attackInput(scene: Phaser.Scene, space: Phaser.Input.Keyboard.Key): () => boolean {
  let clicked = false;
  scene.input.on('pointerdown', () => (clicked = true)); // listeners are removed when the scene shuts down
  return () => {
    const hit = Phaser.Input.Keyboard.JustDown(space) || clicked;
    clicked = false;
    return hit;
  };
}
