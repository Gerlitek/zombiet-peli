// Ready-made messages for the ticker on the VIP box's back board (game-design.md, chapter 7).
// Only fixed messages, never free text: nothing a player types is ever shown to others.
// Version 2 can fetch the same kind of list through the API (the table `messages` already exists).
// Keep each message under about 28 characters: the ticker is 126 px wide (TICKER in PlayScene).
export const MESSAGES = [
  'Zombit ovat supervahvoja!',
  'Hyvä peli!',
  'Varokaa jättiä!',
  'Pimeä lordi on liikkeellä...',
  'Muista väistää!',
  'Moukari tärähtää!',
  'Ylläri-zombi yllättää!',
  'Aarrekivi avaa Salamaluolan',
  'Sade tuo lisää zombeja',
  'Rudi-Karri on jossain...',
];
