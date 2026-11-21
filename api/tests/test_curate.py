import json

import curate
import rules

SID = '123e4567-e89b-42d3-a456-426614174000'
REC = '2026-11-19T10:00:05+00:00'


def line(**over):
    base = {'event': 'zombie_killed', 'ts': '2026-11-19T10:00:00.000Z', 'session_id': SID, 'seq': 1, 'version': '0.2.0',
            'zombie_type': 'normal', 'weapon': 'sword', 'zone': 'forest', 'total_kills': 3, 'received': REC}
    return json.dumps({**base, **over})


def test_every_event_field_has_a_column():
    fields = {f for spec in rules._EVENTS.values() for f in spec} - curate.DROPPED
    assert fields <= set(curate.COLUMNS)


def test_duplicates_are_kept_once():
    rows, rejected, _ = curate.clean([line(), line()])  # the same batch sent twice
    assert len(rows) == 1 and rejected == 0


def test_broken_lines_are_counted_and_skipped():
    rows, rejected, _ = curate.clean(['not json', line(zombie_type='dragon'), line(received='x'), line(seq=2)])
    assert [r['seq'] for r in rows] == [2] and rejected == 3


def test_test_sessions_are_dropped():
    test_sid = '10000000-0000-4000-8000-000000000042'
    rows, rejected, test = curate.clean([line(), line(session_id=test_sid), line(session_id=test_sid, seq=2)])
    assert [r['session_id'] for r in rows] == [SID] and rejected == 0 and test == 2


def test_nickname_is_dropped():
    start = {'event': 'game_started', 'ts': '2026-11-19T10:00:00Z', 'session_id': SID, 'seq': 0, 'version': '0.2.0',
             'nickname': 'Hurja-Kissa-42', 'character': 'knight', 'received': REC}
    rows, rejected, _ = curate.clean([json.dumps(start)])
    assert rejected == 0 and 'nickname' not in rows[0]


def test_columns_fill_missing_fields_with_none():
    rows, *_ = curate.clean([line()])
    cols = curate.columns(rows)
    assert set(cols) == set(curate.COLUMNS) and cols['zombie_type'] == ['normal'] and cols['score'] == [None]
    assert cols['ts'][0].tzinfo is not None


def test_summary_counts_games_and_puzzles():
    ended = {'event': 'game_ended', 'ts': '2026-11-19T10:05:00Z', 'session_id': SID, 'seq': 3, 'version': '0.2.0',
             'result': 'won', 'kills': 40, 'duration_s': 200, 'hearts_left': 2, 'score': 4000, 'received': REC}
    puzzle = {'event': 'puzzle_answered', 'ts': '2026-11-19T10:03:00Z', 'session_id': SID, 'seq': 2, 'version': '0.2.0',
              'level': 'easy', 'target': 12, 'parts': [7], 'answer': 5, 'correct': True, 'time_ms': 4000, 'received': REC}
    rows, *_ = curate.clean([line(), json.dumps(puzzle), json.dumps(ended)])
    s = curate.summary(rows)
    assert s['games'] == {'ended': 1, 'won': 1, 'median_duration_s': 200, 'median_kills': 40}
    assert s['days'] == [{'day': '2026-11-19', 'started': 0, 'ended': 1, 'won': 1}]
    assert s['puzzles']['easy'] == {'answered': 1, 'correct': 1, 'median_ms': 4000}
    assert s['kills_by_zombie'] == {'normal': 1}
    json.dumps(s)  # must be plain JSON


def test_summary_of_nothing():
    s = curate.summary([])
    assert s['games']['ended'] == 0 and s['days'] == []


def test_parquet_round_trip_keeps_the_summary():
    import io

    import pyarrow as pa
    import pyarrow.parquet as pq

    rows, *_ = curate.clean([line(), line(seq=2, zombie_type='giant')])
    out = io.BytesIO()
    pq.write_table(pa.Table.from_pydict(curate.columns(rows), schema=curate.arrow_schema(pa)), out)
    back = pq.read_table(io.BytesIO(out.getvalue())).to_pylist()
    assert curate.summary(back)['kills_by_zombie'] == curate.summary(rows)['kills_by_zombie'] == {'normal': 1, 'giant': 1}
