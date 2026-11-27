# Ylläri-Zombit: game design

The idea, story and characters of the game were designed by a child. This document turns them into a playable plan. The principle: the child should recognise the game as their own. *Ylläri-Zombit* means "Surprise Zombies". All text in the game is in Finnish.

The visual concept is in `web/public/konsepti/index.html`, published with animations at https://zombit.gerlitek.fi/konsepti/.

## 1. The idea in one sentence

At night in a rotten landscape, rain gives birth to zombies. A knight fights them, gets into the VIP box after 25 kills and wins the game at 45 kills (20 and 40 in development).

## 2. One game

A game takes 2 to 4 minutes. A short round suits a child, and the wheel of fortune makes every round different.

| Moment | What happens |
|---|---|
| Start | A nickname is drawn (chapter 9), the player picks a character (Knight or Mini Player) and a puzzle level |
| Kills before the VIP limit | The rotten forest. Zombies rise from the rain |
| Kill 25 (20 in development) | The VIP sign turns from red to green, lightning strikes and the player moves to the VIP box. VIP spin |
| VIP kills | The VIP box. Zombies are super strong. After the first VIP kill a lock stone appears with an arrow above it and the text AARREKIVI (treasure stone) below. Solving its puzzles opens the Lightning Cave (optional, chapter 8) |
| Last kill (45, 40 in development) | The last zombie is always the Dark Lord or a Giant. The game is won |
| End screen | Score, time, achievements, leaderboard, a ready-made message |

The kill limits are in one file (`web/src/data/rules.ts`). The switch `RELEASE` selects between development limits (20 and 40, for testing) and release limits (25 and 45). The release limits were lowered step by step after playtests, from a VIP limit of 50 down to 25, because too many kills were needed and the forest felt too long.

Defeat: the hearts run out. The end screen shows the kills and offers a new game.

Score: `kills x 100 + remaining hearts x 50 + time bonus + puzzles`, where the time bonus is `max(0, 300 - seconds)`. Winning adds 500, and an opened lock stone adds 100 to 200 depending on speed. Time spent solving puzzles does not use the game clock. The maximum score is therefore bounded, which makes it easier to spot cheating on the server.

### Story

The T key in the menu opens the story of the game. It is short, about 20 lines, so that a primary school child has the patience to read it. It focuses on the landscape: night, rain, a rotten forest and lightning. Characters and weapons are not described separately. The text scrolls from the bottom of the screen towards the storm clouds and shrinks as it moves away. The text is in `web/src/data/story.ts`, one line per entry, so it is easy to edit.

### Practice on the Kalajoki sand dunes

The H key in the menu starts a practice round before the real game. It takes place on the sand dunes of Kalajoki: dunes, seashore, the low sun of a summer night.

- A helicopter lands on the dunes and drops the player off.
- Zombies rise from the wet sand and follow the player but cannot hurt. There are no hearts.
- Eight signs stand on the sand, one for each wheel weapon. Walking up to a sign lets the player try the weapon, including the Rudi-Karri robot.
- Rudi and Karri, two ragdoll cats, run and sit on the sand with their names above their heads.
- Enter starts the real game with the same character, Esc returns to the menu.

## 3. Controls and player

- Movement: arrow keys or WASD. Touch control (drag anywhere, a virtual stick) is planned for version 2.
- Version 1 needs a keyboard. On a touch device (no mouse, no hover) the page shows the notice "Peli toimii tietokoneella" (the game works on a computer) and a button for those who have a keyboard and want to play anyway.
- Hit: space bar or mouse click, both always work without a setting. One press is one hit on the nearest zombie within range, and the character visibly swings the weapon. Nothing strikes on its own: in the first version the weapons worked automatically, zombies died while the player stood still, and the game was boring.
- Spinning weapons (katanas, nunchaku, laser sword) circle the player, are visible and do damage for 1.6 s after each hit, then fade out. Between hits they are hidden, so they do not seem to act by themselves. They also hit a zombie standing right on top of the player (found in playtesting). Meanwhile the character waves its arms instead of striking.
- The character turns to the walking direction, and towards the zombie when hitting. Zombies turn towards the player.
- Select and continue: Enter.
- Five hearts. A zombie's touch takes one, after which the player is protected for a moment.

| Character | Description | Version |
|---|---|---|
| Knight (Ritari) | Dark helmet, white eyes, light blue armour, black knight's sword. Basic hit with the sword, damage 2 | 1 |
| Mini Player (Minipelaaja) | Small and fast special character, almost twice the knight's speed (120 vs 70). Punches only, damage 1. Heals: every eighth kill gives a heart back (every third was too fast according to testers) | 1 |

## 4. Weapons

A weapon is one row of data: name, wheel (forest or VIP), weight in the draw, damage, cooldown, range and behaviour. There are five behaviours, and they are the only code the weapons need.

| Behaviour | What the code does |
|---|---|
| `strike` | Hits the nearest zombie within range. Parameters: damage, knockback, special effect |
| `orbit` | Blades circle the player and hit what they touch |
| `status` | An effect in the area around the player (freezing) |
| `projectile` | A shot that bounces, or stays in place and pulls |
| `helper` | A companion that moves and attacks on its own |

| Weapon | Wheel | Behaviour | Effect | Version |
|---|---|---|---|---|
| Black sword / fist | basic | strike | Basic hit, always available | 1 |
| Super gloves | forest | strike | The zombie flies far. Damage 3. Every sixth hit gives a heart | 1 |
| 2 mini katanas | forest | orbit | Two circling blades. Every five seconds a whirlwind pushes zombies away | 1 |
| Sledgehammer | forest | strike | Slow (1.5 s between hits). The ground shakes: the blow hits every zombie on the field equally hard, nearby ones fly farther and the others stagger | 1 |
| Nunchaku | forest | orbit | Fast and short spin, damage 1 | 1 |
| Football | forest | projectile | Kicks itself, the ball bounces from zombie to zombie | 2 |
| Toys | forest | helper | A squeaky toy the zombies follow for a while | 2 |
| Cat robot | forest | helper | A companion that bites zombies, damage 1 | 2 |
| Galaxy gun | forest | projectile | The shot becomes a black hole that sucks zombies together | 2 |
| Laser sword | VIP | orbit | Three heads with a crystal in the middle. A blue laser tornado around the player | 1 |
| Blue ice gloves | VIP | status | Freezes nearby zombies into ice cubes for 2 seconds | 1 |
| Squeeze gloves | VIP | strike | The zombie is squeezed flat and helpless for a moment, the next hit kills | 1 |
| Rudi-Karri robot | VIP | strike | The player turns into a robot for a minute, and its laser tail takes down even a distant zombie with one shot. Almost impossible to get | 1 |

All collected weapons are active at the same time. A game has at most two spins (the VIP wheel on entering the box and the basic wheel from the chest in the Lightning Cave), so no separate inventory menu is needed. Getting the same weapon again raises its level (damage + 1).

### Wheel of fortune

- The wheel is a reward, not the main part of the game. The game starts straight in the forest with the basic weapon. The wheel appears only on entering the VIP box and from the chest in the Lightning Cave (earned with puzzles), and the reason is always shown on screen. The spin is short and the colours are calm, so the game world stays in the lead. An earlier version also spun after the third and eighth kill, which felt random and interrupted the game too often.
- A list next to the wheel gives each slice its own colour, the weapon name and one line about what it does. The Rudi-Karri robot has its own box, because it is not an ordinary slice but a thin white line.
- The wheel waits for Enter before spinning, so a child has time to read which weapons are on offer.
- When the wheel stops, it stands still for a moment: the pointer shows the winning slice and its row is highlighted. Then a card below the wheel and the list tells which weapon was won and what it does. The card covers neither, and it stays until the player presses Enter.
- After the wheel and a puzzle there are three calm seconds: no new zombies appear and the player takes no damage. Game messages show for four seconds and queue up if there are several.
- The forest wheel and the VIP wheel are the same code with different data.
- The draw is weighted and done on the client. It has no money value, and nothing can be bought.
- The Rudi-Karri slice is hair-thin. Its chance is shown as the number `0,00000001 %`. The real probability is a separate parameter: 1 in 10 per VIP spin, so the robot appears in about every tenth game. The displayed number is a joke the child wanted, but the real chance must not be impossible. 1 in 500 was tried first, and the robot was never seen.
- Rudi-Karri is a two-headed cat robot: one head is Rudi, the other Karri.
- The player turns into the robot: for 60 seconds the player is the two-headed cat robot, and a hit fires a beam from the laser tail at the nearest zombie up to 80 pixels away. The beam takes down any zombie, even a super strong VIP zombie. The robot is a metal cat seen from the side, with two heads (Rudi and Karri) and a laser tail. The remaining time shows as a bar above the weapon slots. After a minute the robot goes home and the player is the old character again. The robot can be tried the same way in practice. (This replaced a hunting companion.)
- Skills (future idea): version 2 adds skills to the wheel, for example speed, an extra heart and longer protection.

## 5. Zombies

A zombie is one row of data: size, colours, health, speed, weight in the draw and an optional special behaviour. All are drawn with the same body (chapter 10).

| Type | Look | Health | Speed | Special | Version |
|---|---|---|---|---|---|
| Ordinary | Thin, shirt and trousers, closed mouth, glowing eyes | 2 | slow | Basic | 1 |
| Horror zombie (Kauhu-zombi) | Big egg-shaped head, pursed mouth, arms hanging to the ground, hunched | 3 | sneaks | Creeps slowly. When the player is near, pauses for a moment and lunges | 1 |
| Sand zombie | Sand coloured | 3 | medium | Leaves a sand trail that slows the player | 1 |
| Giant zombie | Almost twice the size | 8 | very slow | Super gloves do not send it far | 1 |
| Random zombie | Size, colours and speed drawn every time | 1 to 5 | random | No two alike | 1 |
| Dark Lord (Pimeä lordi) | Black cape, golden spiked crown, green eyes | 6 | fast | Arrives with lightning | 1 |
| Surprise zombie (Ylläri-zombi) | A gift box with a pair of eyes peeking out | 1 | hops | Opens to reveal a random zombie. The game is named after it | 1 |
| New types | In updates | | | One row of data | 2 + |

Only a few carry special weapons: about every eighth zombie has a weapon (bone, stick, umbrella). It reaches farther. When killed, the zombie drops a heart on the ground, which has to be picked up within eight seconds.

In the VIP box the same types are super strong: health x 2, speed x 1.4, size x 1.3 and a green glow.

Spawning: a big raindrop falls from a cloud, a puddle forms on the ground and a zombie rises from it. The player sees the drop early enough to react. At most 8 zombies are alive at once.

## 6. Setting

| Element | In the game |
|---|---|
| Night, dark sky, dark clouds | The top third of the screen is sky, clouds drift slowly |
| Rain | Thin rain all the time, plus big drops that give birth to zombies |
| Lightning hits trees and other things | A strike about every five seconds. A hit tree smoulders for a moment. The screen flashes |
| Rotten moss | Dark green patches on the ground |
| Withered trees | Leafless trees. Characters pass in front of and behind them |
| Dirty water | A murky pond with floating litter. Slows the player |
| Dry grass | Yellowish tufts swaying in the wind |

In version 2 lightning affects the game: a strike on the ground is first shown as a warning mark and stuns the zombies it hits.

## 7. VIP box

The box is a lit platform in the middle of the storm, with a light blue railing. Rain reaches it too, so zombies spawn the same way.

The back board is always visible:

- **Who is the strongest**: top three from the leaderboard and the player's own rank.
- **Achievements**: the badges stay visible. Stored in the browser.
- **Messages**: a ticker below the achievements, a message slides in and stops to be read. Only ready-made messages (`data/messages.ts`), for example "Good game!" or "Watch out for the giant!", no free text.

Without a connection to the API the board shows the best results of the local browser.

Achievements in version 1: First kill, VIP guest, Game won, Not a scratch (win with full hearts), Lightning fast (under 7.5 s per kill: 300 s in development, 600 s in release), Giant slayer, Lord defeater, Puzzle master (lock stone opened), Friend of Rudi-Karri.

Friend group: version 2 adds a group code (for example `KISSA-42`). Players who share a code see their own leaderboard and each other's ready-made messages. Free chat would need moderation and a real-time service, and it does not fit the privacy rules.

## 8. Puzzles and the Lightning Cave

Number decomposition puzzles are the brain teasers of the game: solving them leads to an exciting place.

A decomposition splits a number into parts whose sum is the original number. For example 5 = 2 + 3.

Puzzles exist only in the VIP box. In the forest the player concentrates on learning to fight, and the puzzle is a speciality of the box. The chest in the Lightning Cave gives a spin of the basic wheel, so that the basic weapons (super gloves, katanas, sledgehammer, nunchaku) are also available.

### How it works

1. A lock stone with a glowing number stands on the field. When the player touches it, lightning stops time: zombies and rain freeze.
2. The stone shows a decomposition with a missing part, for example `12 = 7 + ?`.
3. Three big drops with numbers float in the air. The player walks into the right one. The controls stay the same and nothing has to be typed, so this also works on a touch screen.
4. Three correct answers in a row open the stone. The clock is running: a fast solution gives extra points.
5. A wrong answer does not cost a heart. The drop breaks and two remain. If time runs out, the stone closes and the game goes on.

### Levels

The level is chosen on the start screen, and the game remembers it.

| Level | Example | Contents |
|---|---|---|
| Easy | `9 = 4 + ?` | Numbers up to 20, two parts |
| Medium | `74 = 38 + ?` | Numbers up to 100, two parts, crossing tens |
| Hard | `1000 = 640 + 250 + ?` | Numbers up to 1000, three parts |
| Master | `? + ? = 150` | Numbers 100 to 200. The player collects two drops out of five so that the sum matches. The other three are close to the right parts (off by one or ten), so guessing by size does not work. 60 s |

Wrong options are not random but typical mistakes: the right answer plus or minus 1, plus or minus 10, and a forgotten carry.

### Lightning Cave

Behind the stone is the Lightning Cave: a small room where a lightning bolt has frozen into a crystal and lights the walls light blue. There are no zombies. A treasure chest gives:

- one heart back
- an extra spin of the basic wheel.

The cave is optional. The game can be won without it, but the best score requires it.

Puzzle generation and checking are pure logic without Phaser, so they are covered by unit tests.

## 9. Nickname

The nickname is drawn from word lists: adjective, animal and number, for example `Hurja-Kissa-42`. The player can draw a new one as many times as they like. There is no free text.

Reason: a child cannot accidentally type their own name or other personal data, and nothing inappropriate can be written to the leaderboard. The server stores only the list indexes, so no input needs moderation.

## 10. Look

### Window and camera

The logical resolution is 320 x 240 pixels, scaled by whole numbers on screen (2x). The view is tilted: sky and horizon at the top, ground below, where characters move freely in all directions. A character lower on screen is drawn on top of one higher up. Clouds and drops are at the top and the VIP sign in the top right corner.

### Own style: leaf limbs

Limbs are long and leaf shaped, and the characters are lively and lopsided. This is the style of the game:

- A character consists of parts: head, body, two arms, two legs. A limb is a line that is thick in the middle and thin at the ends.
- Movement is computed from a sine wave. Arms swing in wide arcs, the body sways and the head wobbles. No separate animation frames are drawn.
- The whole character has a dark outline.
- A character type is a row of numbers: limb length, hunch, sway, step rate and colours. The horror zombie's wide arcs, hunched posture and wobbling head are exactly these numbers.
- No cubes, and no Minecraft textures, character models or colour world.

### Palette

16 colours. The whole game uses only these.

| Colour | Use | Colour | Use |
|---|---|---|---|
| `#0B0E14` | Outlines | `#16241A` | Ground |
| `#151B2B` | Night sky | `#2C4429` | Rotten moss |
| `#232C44` | Clouds, dirty water | `#5F8F4A` | Zombie skin |
| `#3A4763` | Storm, armour shadow | `#B4D46A` | Zombie eyes, glow |
| `#8FA6C4` | Rain | `#8A7A4A` | Dry grass |
| `#E7E8EA` | Lightning, player eyes, text | `#C9A76A` | Sand, gold |
| `#7CC8F2` | Player, VIP, ice | `#4A3A2A` | Withered trees |
| `#B5E1F8` | Laser, shine | `#D96B6B` | Hearts, danger |

Light blue (`#7CC8F2`) belongs only to the player's side: player, VIP box, ice and laser. Zombies are never light blue, so it is always clear who is who.

### In-game interface

- Top left: hearts and a kill bar with one cell per required kill. The cells for the VIP box and the end of the game are highlighted.
- Top right: a VIP sign that says only VIP. Red until the player gets into the box, then green. The sign does not show the number of kills needed.
- Bottom left: collected weapons as icons.
- Text: drawn at full resolution in the same font as the website (Inter), so it is easy to read. The game canvas has exactly as many device pixels as it covers on screen (`fitCanvas`, `web/src/main.ts`), also in full screen. The camera scales the 320 x 240 world onto it, and the browser neither stretches nor shrinks the canvas. Graphics stay pixelated, text stays sharp.

### The page around the game

The page follows the look of gerlitek.fi: background `#0F1115`, surfaces `#151923` and `#1B2030`, borders `#252D3F`, text `#E7E8EA` and `#A9AFBA`, Inter font, rounded cards. The accent colour is light blue `#7CC8F2`, light shade `#B5E1F8`.

### Sound

Version 2. Rain, thunder and hit sounds are generated with the Web Audio API without audio files. Sound is off by default and started with a button.

## 11. Event schema

Only a nickname and a random session id. No IP addresses or personal data. Every event also has `event`, `ts` (client clock, ISO 8601), `session_id`, `seq` (running number) and `version`.

| Event | Fields |
|---|---|
| `game_started` | nickname, character |
| `wheel_spun` | wheel (forest, vip), weapon, kills |
| `zombie_killed` | zombie_type, weapon, zone, total_kills |
| `player_hit` | zombie_type, zone, hearts_left |
| `vip_entered` | duration_s, hearts_left |
| `puzzle_answered` | level, target, parts, answer, correct, time_ms |
| `cave_entered` | zone, level, duration_s |
| `achievement_unlocked` | achievement |
| `game_ended` | result (won, lost), kills, duration_s, hearts_left, score |

On the Master level `parts` is the first number collected and `answer` the second.

`puzzle_answered` tells the dashboard which puzzles are hard and how quickly they are solved. A game produces about 20 to 40 events. They are sent in batches: on entering the VIP box and at the end of the game.

## 12. Versions

- **Version 1**: everything marked 1 above. Works fully in the browser without the API.
- **Version 1 online**: leaderboard, messages and telemetry through the API ([architecture.md](architecture.md), stages 5 and 6).
- **Version 2**: projectile and helper weapons, skills, group code, touch control, sound, lightning affecting the game.
- **Seasons** (season 2 started on 2026-11-23 in release 2.0.0, when the kill limit dropped to 45 and the top results of season 1 could no longer be beaten). The leaderboard starts empty when the season changes, and old results are kept. Old top scores then do not block the list for years, and two players with the same name stay unlikely. Implementation: the PartitionKey of the `scores` table is the season and the year (`v2-2027`, `season_key` in `api/rules.py`), so a new season or a new year is a new key. The season is one number (`SEASON`, `api/rules.py`) and equals the first number of the game version (`web/package.json`). If the kill limits change, the season changes in the same commit. The leaderboard also starts over every New Year (UTC, 02:00 in Finland), so a season lasts at most a year.
- **Possible further work: forest and VIP box durations on the stats page** (an idea, may or may not happen). Season numbers on the stats page: median time in the forest, median time in the VIP box, and the share of lost games that end in the box. The data is already in the events (`vip_entered`, `game_ended`), so the game needs no change. The purpose is to see from data whether the box is too long before changing the kill limits. The limits were left as they are (25 + 20), because the game should not rush past new players, and a limit change always starts a new season.

### Principles of clarity (from the playtest of 2026-11-16)

The first playtest showed that things happened too fast. These are kept from then on:

- Every important result (weapon from the wheel, correct puzzle, treasure, end of the game) stays on screen until the player presses Enter, or at least 1.5 seconds. The key starts working only after a moment.
- The screen always tells why something happens and what the player got.
- Choices are shown as cards and buttons, not as code-like symbols. The selected one has a light blue border.
- The game world comes first. The wheel of fortune is a reward: calm colours, a short spin, never the first screen of the game.
