"""Curated layer: raw NDJSON events -> clean rows -> one wide table per day, and the dashboard summary.

Pure functions: no Azure, no pyarrow, easy to test. function_app.py reads and writes the blobs and the Parquet.
Rules (docs/architecture.md, chapter 4):
- every raw line is validated again with rules.event, broken lines are counted and skipped
- the same event sent twice (same session_id and seq) is kept once
- the nickname is dropped: curated data is kept for good, and the session id is enough for analytics
- test sessions are dropped (TEST_SESSION): the dashboard shows real games only
- implausible sessions are dropped (plausible): the game sends events in a known way, a careless script does not
"""
import json
import re
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from itertools import pairwise

import rules

DROPPED = {'nickname'}

# The version of the cleaning rules. Raise it when a rule changes: the nightly run then rebuilds every day
# whose raw data is still there (30 days) and whose curated file was made with an older version.
RULES_VERSION = 4

# Hand-made test sessions use ids like 10000000-0000-4000-8000-000000000042. A real crypto.randomUUID
# matches this by chance with odds of about 1 in 10^12.
TEST_SESSION = re.compile(r'^[0-9a-f]{8}-0000-4000-8000-')

# Days left out of the dashboard. Days before LAUNCH_DAY were development tests. SKIP_DAYS is the cleanup tool:
# if a day ever fills with fake games, add it here and raise RULES_VERSION. The raw data stays as it is.
LAUNCH_DAY: str | None = '2026-11-21'  # first day of real players (UTC); earlier days were tests
SKIP_DAYS: set[str] = set()


def skipped(day: str) -> bool:
    return day in SKIP_DAYS or (LAUNCH_DAY is not None and day < LAUNCH_DAY)


# A zombie appears every 2.2 - 2.8 s (web/src/scenes/PlayScene.ts), so a real game cannot kill faster than that.
# The bound is about twice the spawn rate, so area weapons and the gift zombie never trip it.
KILLS_AT_START = 5
KILLS_PER_SECOND = 1.0


def plausible(events: list[dict]) -> bool:
    """One session's events of one day. The three rules (docs/architecture.md, chapter 4):
    1. it starts with game_started (seq 0): a game cannot end, or anything happen, without a start
    2. seq runs 0, 1, 2, ... without gaps, and time never runs backwards
    3. kills come no faster than zombies appear
    A game that crosses midnight UTC or loses a batch is dropped too. That is rare, and the dashboard can lose it."""
    events = sorted(events, key=lambda e: e['seq'])
    if events[0]['event'] != 'game_started' or events[0]['seq'] != 0:
        return False
    if [e['seq'] for e in events] != list(range(len(events))) or any(a['ts'] > b['ts'] for a, b in pairwise(events)):
        return False
    start = events[0]['ts']
    for e in events:
        kills = e.get('total_kills') if e['event'] == 'zombie_killed' else e.get('kills') if e['event'] == 'game_ended' else None
        if kills is not None and kills > KILLS_AT_START + (e['ts'] - start).total_seconds() * KILLS_PER_SECOND:
            return False
        if e['event'] == 'game_ended' and e['kills'] > KILLS_AT_START + e['duration_s'] * KILLS_PER_SECOND:
            return False
    return True

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


def clean(blobs: Iterable[str]) -> tuple[list[dict], Counter]:
    """Takes the text of the raw blobs of one day. Returns (rows sorted by time, counts of dropped events:
    rejected = broken lines, test = test sessions, implausible = sessions that break a plausible() rule)."""
    rows, seen, dropped = [], set(), Counter()
    for text in blobs:
        for line in text.splitlines():
            try:
                raw = json.loads(line)
                received = _time(raw.pop('received'))
                e = rules.event(raw)
                ts = _time(e['ts'])
            except (ValueError, KeyError, AttributeError, TypeError):  # rules.Invalid is a ValueError
                dropped['rejected'] += 1
                continue
            if TEST_SESSION.match(e['session_id']):
                dropped['test'] += 1
                continue
            key = (e['session_id'], e['seq'])
            if key in seen:
                continue
            seen.add(key)
            rows.append({**{k: v for k, v in e.items() if k not in DROPPED}, 'ts': ts, 'received': received})
    sessions: dict[str, list[dict]] = {}
    for r in rows:
        sessions.setdefault(r['session_id'], []).append(r)
    bad = {sid for sid, events in sessions.items() if not plausible(events)}
    dropped['implausible'] += sum(len(sessions[sid]) for sid in bad)
    rows = [r for r in rows if r['session_id'] not in bad]
    rows.sort(key=lambda r: (r['received'], r['session_id'], r['seq']))
    return rows, dropped


def nicknames(blobs: Iterable[str]) -> set[str]:
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

# Dashboard charts that count one field of one event: name in the summary -> (event, field).
_COUNTS = {'characters': ('game_started', 'character'), 'kills_by_zombie': ('zombie_killed', 'zombie_type'),
           'hits_by_zombie': ('player_hit', 'zombie_type'), 'wheel_weapons': ('wheel_spun', 'weapon'),
           'achievements': ('achievement_unlocked', 'achievement')}


def tally(rows: list[dict], totals: dict | None = None) -> dict:
    """Adds rows (one curated day) to the running totals and returns them. The nightly run calls this once per day
    file, so memory holds one day of rows and these small totals, never the whole history.
    Values that need a median are kept as histograms (value -> how many times)."""
    t = totals or {'days': {}, 'ended': 0, 'won': 0, 'duration_s': Counter(), 'kills': Counter(),
                   'counts': {name: Counter() for name in _COUNTS},
                   'puzzles': {level: {'answered': 0, 'correct': 0, 'time_ms': Counter()} for level in sorted(rules.LEVELS)}}
    for r in rows:
        if r['event'] in ('game_started', 'game_ended'):  # activity counts every game of every season
            day = t['days'].setdefault(r['received'].strftime('%Y-%m-%d'), Counter())
            day['started' if r['event'] == 'game_started' else 'ended'] += 1
            day['won'] += r['event'] == 'game_ended' and r['result'] == 'won'
        # Everything below counts the current season only: the kill limits changed between seasons,
        # so win rates and medians of different seasons do not belong in one number.
        if r['version'].split('.')[0] != str(rules.SEASON):
            continue
        for name, (event, field) in _COUNTS.items():
            if r['event'] == event:
                t['counts'][name][r[field]] += 1
        if r['event'] == 'game_ended':
            t['ended'] += 1
            t['won'] += r['result'] == 'won'
            t['duration_s'][r['duration_s']] += 1
            t['kills'][r['kills']] += 1
        if r['event'] == 'puzzle_answered':
            p = t['puzzles'][r['level']]
            p['answered'] += 1
            p['correct'] += r['correct']
            p['time_ms'][r['time_ms']] += 1
    return t


def _median(histogram: Counter):
    """The median of a histogram, without expanding it into a list of every value."""
    n, seen, low = sum(histogram.values()), 0, None
    for value in sorted(histogram):
        seen += histogram[value]
        if low is None and seen >= (n + 1) // 2:
            low = value  # the lower of the two middle values (the only one when n is odd)
        if seen >= n // 2 + 1:
            return low if low == value else (low + value) / 2
    return None


def summary(totals: dict, players_recent: int | None = None, today: datetime | None = None) -> dict:
    """The small JSON the dashboard reads, from the totals of all curated days (tally) and the number of
    distinct nicknames of the recent days. The event's version is the game version (2.0.0), and its first number is the season."""
    since = ((today or datetime.now(UTC)) - timedelta(days=RECENT_DAYS)).strftime('%Y-%m-%d')
    days = totals['days']
    return {
        'generated': datetime.now(UTC).isoformat(timespec='seconds'),
        'recent_days': RECENT_DAYS,
        'season': rules.SEASON,
        'days': [{'day': d, 'started': c['started'], 'ended': c['ended'], 'won': c['won']} for d, c in sorted(days.items()) if d >= since],
        'players_recent': players_recent,
        'games': {'started': sum(c['started'] for c in days.values()),
                  'started_recent': sum(c['started'] for d, c in days.items() if d >= since),
                  'ended': totals['ended'], 'won': totals['won'],
                  'median_duration_s': _median(totals['duration_s']), 'median_kills': _median(totals['kills'])},
        **{name: dict(counter.most_common()) for name, counter in totals['counts'].items()},
        'puzzles': {level: {'answered': p['answered'], 'correct': p['correct'], 'median_ms': _median(p['time_ms'])}
                    for level, p in totals['puzzles'].items()},
    }
