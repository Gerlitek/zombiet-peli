// The game's connection to the API (api/function_app.py). The game never waits for the network:
// every call gives up after a few seconds and returns null on any failure (offline, 429 when the
// daily cap is full, 404 when the app is stopped). The caller then falls back to local data.
import { Nick } from '../data/nicknames';

// The address is public. In dev (npm run dev) there is no API, and CORS allows only the game's own domain anyway.
const API_URL: string = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? 'https://func-zombies-6254ydxyfcbzi.azurewebsites.net' : '');
const TIMEOUT_MS = 4000;

export interface BoardEntry { nick: Nick; score: number; kills: number; won: boolean }

export interface ScoreBody {
  session_id: string; nick: Nick; score: number; kills: number; duration_s: number; hearts: number; character: string; won: boolean;
}

// text/plain keeps the request "simple" for CORS, so the browser sends no preflight request first.
// keepalive lets the last batch leave even when the page is closing.
function post(path: string, body: object): Promise<Response | null> {
  if (!API_URL) return Promise.resolve(null);
  return fetch(`${API_URL}${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain' }, keepalive: true, signal: AbortSignal.timeout(TIMEOUT_MS) })
    .catch(() => null);
}

export async function sendEvents(events: object[]): Promise<void> {
  await post('/api/events', { events });
}

// Top ten, best first. null means "the board is not available".
export async function fetchLeaderboard(): Promise<BoardEntry[] | null> {
  if (!API_URL) return null;
  try {
    // no-store: right after a game the answer must include that game, not the browser's 60 s copy.
    const res = await fetch(`${API_URL}/api/leaderboard`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Sends the result, then fetches the board. A failed send does not hide the board.
export async function submitScore(body: ScoreBody): Promise<BoardEntry[] | null> {
  await post('/api/scores', body);
  return fetchLeaderboard();
}
