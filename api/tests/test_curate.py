import io
import json
from datetime import UTC, datetime

import pyarrow as pa
import pyarrow.parquet as pq
import pytest

import curate
import rules

SID = '123e4567-e89b-42d3-a456-426614174000'
DAY = '2026-11-19'


def ev(event, seq, second=0, sid=SID, day=DAY, **fields):
    """One raw line: an event `second` seconds after 10:00 on `day`."""
    base = {'event': event, 'ts': f'{day}T10:{second // 60:02d}:{second % 60:02d}Z', 'session_id': sid, 'seq': seq,
            'version': '0.2.0', 'received': f'{day}T10:30:00+00:00'}
    return json.dumps({**base, **fields})


def start(sid=SID, day=DAY, nick='Hurja-Kissa-42'):
    return ev('game_started', 0, 0, sid, day, nickname=nick, character='knight')


def kill(seq, second, total, sid=SID, zombie='normal'):
    return ev('zombie_killed', seq, second, sid, zombie_type=zombie, weapon='sword', zone='forest', total_kills=total)


def end(seq, second, kills, result='won', sid=SID):
    return ev('game_ended', seq, second, sid, result=result, kills=kills, duration_s=second, hearts_left=2, score=kills * 100)


def game(sid=SID):
    """A plausible short game: start, two kills, end."""
    return '\n'.join([start(sid), kill(1, 10, 1, sid), kill(2, 15, 2, sid, 'giant'), end(3, 60, 2, sid=sid)])


def test_every_event_field_has_a_column():
    fields = {f for spec in rules._EVENTS.values() for f in spec} - curate.DROPPED
    assert fields <= set(curate.COLUMNS)


def test_a_plausible_game_is_kept_whole():
    rows, dropped = curate.clean([game()])
    assert [r['seq'] for r in rows] == [0, 1, 2, 3] and sum(dropped.values()) == 0


def test_duplicates_are_kept_once():
    rows, dropped = curate.clean([game(), game()])  # the same batch sent twice
    assert len(rows) == 4 and sum(dropped.values()) == 0


def test_broken_lines_are_counted_and_skipped():
    rows, dropped = curate.clean([game(), 'not json', kill(4, 70, 3, zombie='dragon')])
    assert len(rows) == 4 and dropped['rejected'] == 2


def test_test_sessions_are_dropped():
    rows, dropped = curate.clean([game(), game('10000000-0000-4000-8000-000000000042')])
    assert {r['session_id'] for r in rows} == {SID} and dropped['test'] == 4


@pytest.mark.parametrize('lines', [
    [kill(1, 10, 1), end(2, 60, 1)],                       # rule 1: no start
    [start(), kill(1, 10, 1), end(3, 60, 1)],              # rule 2: seq jumps from 1 to 3
    [start(), kill(1, 30, 1), kill(2, 20, 2)],             # rule 2: time runs backwards
    [start(), kill(1, 10, 40)],                            # rule 3: 40 kills in 10 seconds
    [start(), end(1, 10, 30)],                             # rule 3: game_ended claims 30 kills in 10 s
])
def test_implausible_sessions_are_dropped(lines):
    rows, dropped = curate.clean(['\n'.join(lines), game('123e4567-e89b-42d3-a456-426614174001')])
    assert {r['session_id'] for r in rows} == {'123e4567-e89b-42d3-a456-426614174001'}
    assert dropped['implausible'] == len(lines)


def test_a_fast_but_possible_game_is_kept():
    rows, _ = curate.clean(['\n'.join([start(), kill(1, 100, 100), end(2, 100, 100)])])  # 100 kills in 100 s
    assert len(rows) == 3


def test_nickname_is_dropped():
    rows, _ = curate.clean([game()])
    assert 'nickname' not in rows[0]


def test_columns_fill_missing_fields_with_none():
    rows, _ = curate.clean([game()])
    cols = curate.columns(rows)
    assert set(cols) == set(curate.COLUMNS) and cols['zombie_type'][1] == 'normal' and cols['score'][0] is None
    assert cols['ts'][0].tzinfo is not None


def test_summary_counts_games_and_puzzles():
    puzzle = ev('puzzle_answered', 4, 70, level='easy', target=12, parts=[7], answer=5, correct=True, time_ms=4000)
    rows, _ = curate.clean([game() + '\n' + puzzle])
    s = curate.summary(rows, players_recent=1, today=datetime(2026, 11, 20, tzinfo=UTC))
    assert s['games'] == {'started': 1, 'started_recent': 1, 'ended': 1, 'won': 1, 'median_duration_s': 60, 'median_kills': 2}
    assert s['days'] == [{'day': DAY, 'started': 1, 'ended': 1, 'won': 1}]
    assert s['puzzles']['easy'] == {'answered': 1, 'correct': 1, 'median_ms': 4000}
    assert s['kills_by_zombie'] == {'normal': 1, 'giant': 1} and s['players_recent'] == 1
    json.dumps(s)  # must be plain JSON


def test_summary_of_nothing():
    s = curate.summary([])
    assert s['games']['ended'] == 0 and s['days'] == []


def test_days_chart_covers_recent_days_and_totals_all_time():
    old = start('123e4567-e89b-42d3-a456-426614174001', '2026-09-01')
    rows, _ = curate.clean([old, start()])
    s = curate.summary(rows, today=datetime(2026, 11, 20, tzinfo=UTC))
    assert [d['day'] for d in s['days']] == [DAY]
    assert s['games']['started'] == 2 and s['games']['started_recent'] == 1


def test_nicknames_counts_real_players_once():
    other = '123e4567-e89b-42d3-a456-426614174009'
    blobs = [start(), start(), start(other, nick='Ovela-Susi-07'),
             start('10000000-0000-4000-8000-000000000042', nick='Rohkea-Ilves-01'), 'not json']
    assert curate.nicknames(['\n'.join(blobs)]) == {'Hurja-Kissa-42', 'Ovela-Susi-07'}


def test_parquet_round_trip_keeps_the_summary():
    rows, _ = curate.clean([game()])
    out = io.BytesIO()
    pq.write_table(pa.Table.from_pydict(curate.columns(rows), schema=curate.arrow_schema(pa)), out)
    back = pq.read_table(io.BytesIO(out.getvalue())).to_pylist()
    assert curate.summary(back)['kills_by_zombie'] == curate.summary(rows)['kills_by_zombie'] == {'normal': 1, 'giant': 1}
