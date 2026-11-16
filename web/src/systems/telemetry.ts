// Game events for the data pipeline. Schema: docs/game-design.md, chapter 12.
// Until the API exists (phase 6) events are only collected and shown in the dev console.
// Privacy: only a random session id and a generated nickname. No personal data.
// crypto.randomUUID exists only on HTTPS pages (and localhost). The fallback keeps the game running
// if the page is ever opened over plain HTTP, for example before the certificate is ready.
const sessionId = crypto.randomUUID?.() ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const buffer: object[] = [];
let seq = 0;

export function track(event: string, fields: Record<string, string | number | boolean | number[]> = {}) {
  buffer.push({ event, ts: new Date().toISOString(), session_id: sessionId, seq: seq++, version: '0.2.0', ...fields });
}

// Called at natural break points (VIP entry, game end). Later this posts the batch to the API.
export function flush() {
  if (import.meta.env.DEV && buffer.length) console.table(buffer);
  buffer.length = 0;
}
