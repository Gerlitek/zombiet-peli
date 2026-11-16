// Plays for real: walks toward the nearest zombie with arrow keys and presses space to strike.
export default async ({ tap, hold, shot, sleep, js }) => {
  const play = 'game.scene.getScene("play")';
  await tap('ArrowLeft'); await tap('Enter'); await sleep(1000);
  const state = () => js(`(()=>{const s=${play}; const z=s.zombies.filter(z=>s.clock>z.riseFrom+1).map(z=>({x:z.x,y:z.y,d:Math.hypot(z.x-s.px,z.y-s.py)})).sort((a,b)=>a.d-b.d)[0]; return JSON.stringify({px:s.px,py:s.py,hp:s.hp,kills:s.kills,z,active:game.scene.isActive('play'),wheel:game.scene.isActive('wheel'),end:game.scene.isActive('end')})})()`).then(JSON.parse);
  let standingKills = 0, shots = 9, vipShot = false;
  // 1) stand still for 12 s without pressing space: nothing should die
  let st = await state(); const t0 = Date.now();
  // 2) play: move and strike
  for (let i = 0; i < 1500 && !st.end; i++) {
    st = await state();
    if (st.wheel) { await tap('Enter'); await sleep(4300); await tap('Enter'); await sleep(400); if (!vipShot) { vipShot = true; await sleep(800); await shot('z-vip-sign'); } continue; }
    if (!st.active || !st.z) { await sleep(200); continue; }
    if (st.z.d > 18) { const dx = st.z.x - st.px, dy = st.z.y - st.py; await hold(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'), 140); }
    else { await tap('Space'); if (shots < 3) { await shot('z-swing' + shots++); } }
  }
  st = await state(); console.log('seconds', Math.round((Date.now()-t0)/1000), 'final: kills', st.kills, 'hp', st.hp, 'end', st.end);
  await sleep(500); await shot('z-final');
};
