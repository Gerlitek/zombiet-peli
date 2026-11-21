"""Curated layer: raw NDJSON events -> clean rows -> one wide table per day, and the dashboard summary.

Pure functions: no Azure, no pyarrow, easy to test. function_app.py reads and writes the blobs and the Parquet.
Rules (docs/architecture.md, chapter 4):
- every raw line is validated again with rules.event, broken lines are counted and skipped
- the same event sent twice (same session_id and seq) is kept once
- the nickname is dropped: curated data is kept for good, and the session id is enough for analytics
- test sessions are dropped (TEST_SESSION): the dashboard shows real games only
"""
import json
import re
from collections import Counter
from datetime import UTC, datetime, timedelta
from statistics import median

import rules

DROPPED = {'nickname'}

# The version of the cleaning rules. Raise it when a rule changes: the nightly run then rebuilds every day
# whose raw data is still there (30 days) and whose curated file was made with an older version.
RULES_VERSION = 2

# Hand-made test sessions use ids like 10000000-0000-4000-8000-000000000042. A real crypto.randomUUID
# matches this by chance with odds of about 1 in 10^12.
TEST_SESSION = re.compile(r'^[0-9a-f]{8}-0000-4000-8000-')

# Column name -> type. Event fields come from rules._EVENTS, so a new event field needs a column here too
# (test_every_event_field_has_a_column checks it).
COLUMNS = {
    'event': 'string', 'ts': 'timestamp', 'received': 'timestamp', 'session_id': 'string', 'seq': 'int', 'version': 'string',
    'character': 'string', 'wheel': 'string', 'weapon': 'string', 'kills': 'int', 'zombie_type': 'string', 'zone': 'string',
    'total_kills': 'int', 'hearts_left': 'int', 'duration_s': 'int', 'level': 'string', 'target': 'int', 'parts': 'int_list',
    'answer': 'int', 'correct': 'bool', 'time_ms': 'int', 'achievement': 'string', 'result': 'string', 'score': 'int',
}


def arrow_schema(pa):
    """The Parquet schema. pyarrow is passed in, so this module does not import it."""
    kinds = {'string': pa.string(), 'int': pa.int32(), 'bool': pa.bool_(), 'int_list': pa.list_(pa.int32()),
             'timestamp': pa.timestamp('ms', tz='UTC')}
    return pa.schema([(name, kinds[kind]) for name, kind in COLUMNS.items()])


def _time(text: str) -> datetime:
    t = datetime.fromisoformat(text)
    return t if t.tzinfo else t.replace(tzinfo=UTC)


def clean(blobs: list[str]) -> tuple[list[dict], int, int]:
    """Takes the text of the raw blobs of one day. Returns (rows sorted by time, rejected lines, test lines)."""
    rows, seen, rejected, test = [], set(), 0, 0
    for text in blobs:
        for line in text.splitlines():
            try:
                raw = json.loads(line)
                received = _time(raw.pop('received'))
                e = rules.event(raw)
                ts = _time(e['ts'])
            except (ValueError, KeyError, AttributeError, TypeError):  # rules.Invalid is a ValueError
                rejected += 1
                continue
            if TEST_SESSION.match(e['session_id']):
                test += 1
                continue
            key = (e['session_id'], e['seq'])
            if key in seen:
                continue
            seen.add(key)
            rows.append({**{k: v for k, v in e.items() if k not in DROPPED}, 'ts': ts, 'received': received})
    rows.sort(key=lambda r: (r['received'], r['session_id'], r['seq']))
    return rows, rejected, test


def nicknames(blobs: list[str]) -> set[str]:
    """Distinct nicknames in raw blobs (game_started lines of real sessions). Only the count leaves this function:
    the nicknames themselves are never written to the curated layer, which is kept for good."""
    names = set()
    for text in blobs:
        for line in text.splitlines():
            try:
                raw = json.loads(line)
                raw.pop('received', None)
                e = rules.event(raw)
            except (ValueError, KeyError, AttributeError, TypeError):
                continue
            if e['event'] == 'game_started' and not TEST_SESSION.match(e['session_id']):
                names.add(e['nickname'])
    return names


def columns(rows: list[dict]) -> dict[str, list]:
    """Rows -> one list per column, None where the event has no such field (the shape pyarrow wants)."""
    return {name: [r.get(name) for r in rows] for name in COLUMNS}


RECENT_DAYS = 30  # the daily chart and the player count cover this many days, everything else all time


def summary(rows: list[dict], players_recent: int | None = None, today: datetime | None = None) -> dict:
    """The small JSON the dashboard reads. Rows of all curated days, and the distinct nicknames of the recent days."""
    since = ((today or datetime.now(UTC)) - timedelta(days=RECENT_DAYS)).strftime('%Y-%m-%d')
    ended = [r for r in rows if r['event'] == 'game_ended']
    puzzles = [r for r in rows if r['event'] == 'puzzle_answered']
    days: dict[str, Counter] = {}
    for r in rows:
        if r['event'] in ('game_started', 'game_ended'):
            day = days.setdefault(r['received'].strftime('%Y-%m-%d'), Counter())
            day['started' if r['event'] == 'game_started' else 'ended'] += 1
            day['won'] += r['event'] == 'game_ended' and r['result'] == 'won'

    def count(event: str, field: str) -> dict:
        return dict(Counter(r[field] for r in rows if r['event'] == event).most_common())

    def per_level(level: str) -> dict:
        own = [p for p in puzzles if p['level'] == level]
        return {'answered': len(own), 'correct': sum(p['correct'] for p in own),
                'median_ms': median(p['time_ms'] for p in own) if own else None}

    return {
        'generated': datetime.now(UTC).isoformat(timespec='seconds'),
        'recent_days': RECENT_DAYS,
        'days': [{'day': d, 'started': c['started'], 'ended': c['ended'], 'won': c['won']} for d, c in sorted(days.items()) if d >= since],
        'players_recent': players_recent,
        'games': {'started': sum(c['started'] for c in days.values()),
                  'started_recent': sum(c['started'] for d, c in days.items() if d >= since),
                  'ended': len(ended), 'won': sum(r['result'] == 'won' for r in ended),
                  'median_duration_s': median(r['duration_s'] for r in ended) if ended else None,
                  'median_kills': median(r['kills'] for r in ended) if ended else None},
        'characters': count('game_started', 'character'),
        'kills_by_zombie': count('zombie_killed', 'zombie_type'),
        'hits_by_zombie': count('player_hit', 'zombie_type'),
        'wheel_weapons': count('wheel_spun', 'weapon'),
        'achievements': count('achievement_unlocked', 'achievement'),
        'puzzles': {level: per_level(level) for level in sorted(rules.LEVELS)},
    }
