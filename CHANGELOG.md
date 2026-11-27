# Changelog

Releases are on GitHub: https://github.com/Gerlitek/zombiet-peli/releases

## Unreleased

- The leaderboard starts over every New Year (UTC). Old results are kept.
- The nightly statistics run reads one day at a time, so its memory use no longer grows with the history.
- API dependencies are pinned to exact versions.
- The automatic stop over the daily cap was tested in production and works.

## 2.0.0 (2026-11-23)

- Season 2: the leaderboard starts empty, because the kill limits have come down (80 → 50 → 45) and the old top results could no longer be beaten. Season 1 results are kept.
- The server accepts at most 45 kills in a result.
- Stats page: game counts from all games, other numbers from season 2 only.
- Events carry the real game version (previously always 0.2.0). The first number of the version is the season.
- Fix: the blow that ends the game can no longer record kills over the winning limit.

## 1.3.0 (2026-11-23)

- Shorter game: 25 kills to enter the VIP box, 45 kills to win.
- New page `/tietoa/`: introduces the game, how it came to be, the wheel of fortune and the puzzles, with screenshots.

## 1.2.0 (2026-11-23)

- The game is sharp in full screen. The game canvas has exactly as many pixels as it covers on screen, so the browser neither stretches nor shrinks it.
- The canvas is resized when full screen starts or ends or the window size changes. Texts are redrawn at the new resolution.
- The text of the start banner is centred in its box and no longer touches the bottom edge.

## 1.1.0 (2026-11-22)

- Shorter game: 30 kills to enter the VIP box, 50 kills to win.
- The game starts in full screen from the menu.
- Fixed the vertical position of text in boxes: y is the top of the capital letters.

## 1.0.0 (2026-11-21)

- First release: game, leaderboard, telemetry and stats page at https://zombit.gerlitek.fi.
