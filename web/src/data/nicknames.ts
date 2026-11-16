import { Rand, randInt } from '../logic/random';

// Nicknames are generated, never typed: a child cannot enter a real name, and nothing needs moderation.
const ADJECTIVES = ['Hurja', 'Märkä', 'Nopea', 'Ovela', 'Hiljainen', 'Rohkea', 'Villi', 'Sininen', 'Jäinen', 'Salainen', 'Iloinen', 'Sitkeä'];
const ANIMALS = ['Kissa', 'Susi', 'Pöllö', 'Ilves', 'Kettu', 'Karhu', 'Haukka', 'Mäyrä', 'Siili', 'Hirvi', 'Lohi', 'Orava'];

export type Nick = [number, number, number];

export const rollNick = (rand: Rand): Nick => [randInt(rand, 0, ADJECTIVES.length - 1), randInt(rand, 0, ANIMALS.length - 1), randInt(rand, 1, 99)];
export const nickText = ([a, b, n]: Nick) => `${ADJECTIVES[a % ADJECTIVES.length]}-${ANIMALS[b % ANIMALS.length]}-${String(n).padStart(2, '0')}`;
