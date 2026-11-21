// The numbers that set the length of the game.
// The child wants the VIP box to be hard to reach: 40 kills in the released game (50 felt too long, 2026-11-21).
// While developing, the limits are lower so that the whole game can be tested quickly (2026-11-17).
// RELEASE is the switch: set it to true and push, and the CI deploy takes the released limits to the server.
export const RELEASE = true;

export const VIP_AT = RELEASE ? 40 : 20; // kills needed to enter the VIP box
export const WIN_AT = VIP_AT * 2; // kills needed to finish the game: the VIP box is the second half
export const FAST_WIN = WIN_AT * 7.5; // seconds: finishing faster gives the "Salamannopea" achievement. 150 s for 20 kills, scaled to the kill limit
