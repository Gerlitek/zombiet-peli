// Game events for the data pipeline. Schema: docs/game-design.md, chapter 12.
// Events are batched and sent to the API (systems/api.ts). In dev they are also shown in the console.
import { sendEvents } from './api';

// Privacy: only a random session id and a generated nickname. No personal data.
// crypto.randomUUID exists only on HTTPS pages (and localhost). The fallback keeps the game running
// if the page is ever opened over plain HTTP, for example before the certificate is ready.
const newId = () => crypto.randomUUID?.() ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const MAX_BATCH = 50; // the API accepts at most 50 events per request
const buffer: object[] = [];
let sessionId = newId();
let seq = 0;

export const currentSession = () => sessionId;

// One session per game: the API takes one result per session, and a new game must not continue the old numbering.
export function startSession() {
  flush();
  sessionId = newId();
  seq = 0;
}

export function track(event: string, fields: Record<string, string | number | boolean | number[]> = {}) {
  buffer.push({ event, ts: new Date().toISOString(), session_id: sessionId, seq: seq++, version: '0.2.0', ...fields });
}

// Called at natural break points (VIP entry, game end, leaving the page). Sends and forgets: the game never waits.
export function flush() {
  if (import.meta.env.DEV && buffer.length) console.table(buffer);
  while (buffer.length) void sendEvents(buffer.splice(0, MAX_BATCH));
}

addEventListener('pagehide', flush);
