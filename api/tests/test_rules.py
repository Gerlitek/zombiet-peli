import pytest

import rules

SID = '123e4567-e89b-42d3-a456-426614174000'


def ev(**over):
    base = {'event': 'zombie_killed', 'ts': '2026-11-19T10:00:00.000Z', 'session_id': SID, 'seq': 1, 'version': '0.2.0',
            'zombie_type': 'normal', 'weapon': 'sword', 'zone': 'forest', 'total_kills': 3}
    return {**base, **over}


def result(**over):
    base = {'session_id': SID, 'nick': [1, 2, 42], 'score': 1200, 'kills': 10, 'duration_s': 90, 'hearts': 3, 'character': 'knight', 'won': False}
    return {**base, **over}


def test_valid_event_passes():
    assert rules.event(ev())['zombie_type'] == 'normal'


@pytest.mark.parametrize('bad', [
    ev(zombie_type='dragon'),           # not in the allowed list
    ev(total_kills=101),                # over the bound
    ev(total_kills=True),               # bool is not an integer here
    ev(extra='x'),                      # unknown field
    ev(ts='yesterday'),                 # not a timestamp
    ev(session_id='<script>'),          # not a session id
    ev(event='format_disk'),            # unknown event
])
def test_bad_event_is_rejected(bad):
    with pytest.raises(rules.Invalid):
        rules.event(bad)


def test_missing_field_is_rejected():
    e = ev()
    del e['weapon']
    with pytest.raises(rules.Invalid):
        rules.event(e)


def test_nickname_text_has_no_free_text():
    ok = {'event': 'game_started', 'ts': '2026-11-19T10:00:00Z', 'session_id': SID, 'seq': 0, 'version': '0.2.0',
          'nickname': 'Hurja-Kissa-42', 'character': 'mini'}
    assert rules.event(ok)
    with pytest.raises(rules.Invalid):
        rules.event({**ok, 'nickname': 'Matti Meikäläinen 1'})


def test_batch_limits():
    assert len(rules.batch({'events': [ev(seq=i) for i in range(50)]})) == 50
    for bad in ({'events': []}, {'events': [ev()] * 51}, {'events': [ev()], 'x': 1}, [ev()],
                {'events': [ev(), ev(session_id='s-abc-def')]}):
        with pytest.raises(rules.Invalid):
            rules.batch(bad)


def test_valid_score_passes():
    assert rules.score(result())['score'] == 1200


@pytest.mark.parametrize('bad', [
    result(score=99999),                 # over the maximum
    result(score=5000, kills=10),        # more than the formula allows
    result(won=True, duration_s=5),      # won too fast
    result(nick=[99, 0, 1]),             # word index out of range
    result(nick=[0, 0, 0]),              # the number starts at 1
    result(character='dragon'),
    result(hearts=6),
])
def test_bad_score_is_rejected(bad):
    with pytest.raises(rules.Invalid):
        rules.score(bad)


def test_best_score_sorts_first():
    keys = [rules.score_row_key(p, SID) for p in (100, 5000, 750)]
    assert min(keys) == rules.score_row_key(5000, SID)
