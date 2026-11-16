// Reproduce: stone -> three puzzles -> cave -> walk to the chest with real keys -> Enter -> wheel -> back to game
export default async ({ tap, hold, shot, sleep, js }) => {
  const play = 'game.scene.getScene("play")', puz = 'game.scene.getScene("puzzle")';
  const scenes = () => js(`JSON.stringify(game.scene.getScenes(true).map(s=>s.scene.key))`);
  await tap('Enter'); await sleep(1000);
  await js(`(()=>{const s=${play}; s.stone.open=true; s.px=160; s.py=144;})()`); await sleep(600);
  for (let r = 0; r < 3; r++) { await js(`(()=>{const s=${puz}; const i=s.puzzle.choices.indexOf(s.puzzle.answer); s.pos={x:[96,160,224][i], y:158};})()`); await sleep(2200); }
  console.log('in cave:', await js(`${puz}.phase`), await scenes());
  await sleep(1700); await hold('ArrowUp', 1900); await sleep(300);
  console.log('after walking up:', await js(`${puz}.phase`), await js(`JSON.stringify(${puz}.pos)`));
  await shot('c1-chest'); await sleep(1800); await tap('Enter'); await sleep(700);
  console.log('after enter:', await scenes()); await shot('c2-after'); await sleep(3500); await shot('c3-card');
  await tap('Enter'); await sleep(1200); await tap('Enter'); await sleep(800);
  console.log('back:', await scenes(), 'hp', await js(`${play}.hp`)); await shot('c4-back');
};
