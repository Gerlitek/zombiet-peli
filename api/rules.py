"""Validation rules for the game API. Pure functions: no Azure, no I/O, easy to test.

Every field is checked against a list of allowed values. There is no free text anywhere,
unknown fields are rejected, and numbers have hard bounds (docs/architecture.md, chapter 3).
"""
import re
from datetime import datetime

MAX_BATCH = 50
MAX_BODY_BYTES = 16 * 1024

ZOMBIES = {'normal', 'kauhu', 'sand', 'giant', 'random', 'lord', 'gift'}
WEAPONS = {'sword', 'fist', 'gloves', 'katanas', 'hammer', 'nunchaku', 'laser', 'ice', 'squeeze', 'rudikarri'}
ACHIEVEMENTS = {'first', 'vip', 'won', 'flawless', 'fast', 'giant', 'lord', 'puzzle', 'rudikarri'}
HEROES = {'knight', 'mini'}
ZONES = {'forest', 'vip'}
LEVELS = {'easy', 'medium', 'hard', 'master'}
MAX_PUZZLE = 1000  # the hard level goes up to 1000 (web/src/logic/puzzle.ts)
NICK_SIZES = (12, 12, 99)  # adjectives, animals, number: the word lists are on the front

# Kills, score and hearts are bounded by the game rules (web/src/data/rules.ts, logic/score.ts).
# The season of the score table and the dashboard. It is also the major version of the game (web/package.json):
# when a rule change makes old results incomparable (for example the kill limits), raise both and start a new season.
SEASON = 2
WIN_KILLS = 45  # the kills needed to win (WIN_AT in web/src/data/rules.ts): a result of this season cannot have more
# The bound of the events stays wide: curate.py validates old raw lines again with these rules,
# and season 1 had games of 80 kills. A tighter bound would drop them when a day is rebuilt.
MAX_KILLS = 100
MAX_SCORE = MAX_KILLS * 100 + 5 * 50 + 300 + 500 + 200
MIN_WIN_SECONDS = 20


class Invalid(ValueError):
    """The request breaks a rule. The message goes to the log, never to the client."""


def _int(v, lo, hi):
    if type(v) is not int or not lo <= v <= hi:  # bool is an int subclass, so test the exact type
        raise Invalid(f'integer out of range {lo}..{hi}')
    return v


def _one_of(v, allowed):
    if v not in allowed:
        raise Invalid('value not in the allowed list')
    return v


def session_id(v):
    """A UUID from crypto.randomUUID, or the fallback id the front makes on plain HTTP."""
    if isinstance(v, str) and re.fullmatch(r'[0-9a-f-]{36}|s-[0-9a-z]{1,12}-[0-9a-z]{1,8}', v):
        return v
    raise Invalid('bad session id')


def nick(v):
    if not (isinstance(v, list) and len(v) == 3):
        raise Invalid('nick must be three indexes')
    return [_int(n, 1 if i == 2 else 0, size if i == 2 else size - 1) for i, (n, size) in enumerate(zip(v, NICK_SIZES))]


def _nickname_text(v):
    # The front sends the generated nickname text, e.g. "Hurja-Kissa-42". Only letters, hyphens and digits.
    if not (isinstance(v, str) and re.fullmatch(r'[A-Za-zÅÄÖåäö]{1,12}-[A-Za-zÅÄÖåäö]{1,12}-\d{2}', v)):
        raise Invalid('bad nickname')
    return v


# Per event: field -> checker. Common fields are checked separately.
_COMMON = {'event', 'ts', 'session_id', 'seq', 'version'}
_EVENTS = {
    'game_started': {'nickname': _nickname_text, 'character': lambda v: _one_of(v, HEROES)},
    'wheel_spun': {'wheel': lambda v: _one_of(v, ZONES), 'weapon': lambda v: _one_of(v, WEAPONS), 'kills': lambda v: _int(v, 0, MAX_KILLS)},
    'zombie_killed': {'zombie_type': lambda v: _one_of(v, ZOMBIES), 'weapon': lambda v: _one_of(v, WEAPONS),
                      'zone': lambda v: _one_of(v, ZONES), 'total_kills': lambda v: _int(v, 0, MAX_KILLS)},
    'player_hit': {'zombie_type': lambda v: _one_of(v, ZOMBIES), 'zone': lambda v: _one_of(v, ZONES), 'hearts_left': lambda v: _int(v, 0, 5)},
    'vip_entered': {'duration_s': lambda v: _int(v, 0, 7200), 'hearts_left': lambda v: _int(v, 0, 5)},
    'puzzle_answered': {'level': lambda v: _one_of(v, LEVELS), 'target': lambda v: _int(v, 0, MAX_PUZZLE), 'parts': lambda v: _int_list(v),
                        'answer': lambda v: _int(v, 0, MAX_PUZZLE), 'correct': lambda v: _bool(v), 'time_ms': lambda v: _int(v, 0, 600000)},
    'cave_entered': {'zone': lambda v: _one_of(v, ZONES), 'level': lambda v: _one_of(v, LEVELS), 'duration_s': lambda v: _int(v, 0, 7200)},
    'achievement_unlocked': {'achievement': lambda v: _one_of(v, ACHIEVEMENTS)},
    'game_ended': {'result': lambda v: _one_of(v, {'won', 'lost'}), 'kills': lambda v: _int(v, 0, MAX_KILLS),
                   'duration_s': lambda v: _int(v, 0, 7200), 'hearts_left': lambda v: _int(v, 0, 5), 'score': lambda v: _int(v, 0, MAX_SCORE)},
}


def _bool(v):
    if type(v) is not bool:
        raise Invalid('boolean expected')
    return v


def _int_list(v):
    if not (isinstance(v, list) and len(v) <= 10):
        raise Invalid('list of integers expected')
    return [_int(n, 0, MAX_PUZZLE) for n in v]


def event(e):
    """Returns a clean copy of one event or raises Invalid."""
    if not isinstance(e, dict):
        raise Invalid('event must be an object')
    spec = _EVENTS.get(e.get('event'))
    if spec is None:
        raise Invalid('unknown event')
    if set(e) - _COMMON - set(spec) or set(spec) - set(e):
        raise Invalid('unknown or missing fields')
    try:
        datetime.fromisoformat(str(e['ts']))
    except ValueError as err:
        raise Invalid('bad timestamp') from err
    if not (isinstance(e['version'], str) and re.fullmatch(r'\d{1,3}\.\d{1,3}\.\d{1,3}', e['version'])):
        raise Invalid('bad version')
    out = {'event': e['event'], 'ts': e['ts'], 'session_id': session_id(e['session_id']),
           'seq': _int(e['seq'], 0, 100000), 'version': e['version']}
    out.update({k: check(e[k]) for k, check in spec.items()})
    return out


def batch(body):
    """Validates {"events": [...]}: at most 50 events, all from the same session."""
    if not (isinstance(body, dict) and set(body) == {'events'} and isinstance(body['events'], list)):
        raise Invalid('body must be {"events": [...]}')
    events = [event(e) for e in body['events'][:MAX_BATCH + 1]]
    if not 1 <= len(events) <= MAX_BATCH:
        raise Invalid('1 - 50 events per batch')
    if len({e['session_id'] for e in events}) != 1:
        raise Invalid('one session per batch')
    return events


def score(body):
    """Validates a result and checks that it is plausible (the game runs in the browser, so this is a sanity check)."""
    fields = {'session_id', 'nick', 'score', 'kills', 'duration_s', 'hearts', 'character', 'won'}
    if not (isinstance(body, dict) and set(body) == fields):
        raise Invalid('unknown or missing fields')
    out = {'session_id': session_id(body['session_id']), 'nick': nick(body['nick']),
           'score': _int(body['score'], 0, MAX_SCORE), 'kills': _int(body['kills'], 0, WIN_KILLS),
           'duration_s': _int(body['duration_s'], 0, 7200), 'hearts': _int(body['hearts'], 0, 5),
           'character': _one_of(body['character'], HEROES), 'won': _bool(body['won'])}
    if out['score'] > out['kills'] * 100 + out['hearts'] * 50 + 300 + 500 + 200:
        raise Invalid('score is higher than the formula allows')
    if out['won'] and out['duration_s'] < MIN_WIN_SECONDS:
        raise Invalid('won too fast')
    return out


# Rows written before the yearly seasons (2026-11) live in the partition 'v2'. They are the 2026 season.
_OLD_SEASON_KEYS = {'v2-2026': 'v2'}


def season_key(now: datetime) -> str:
    """The partition of the score table: the season and the year (UTC), for example v2-2027.
    A new key is an empty leaderboard, so the board starts over every New Year and whenever SEASON is raised.
    Nothing is deleted: the old rows stay in their own partitions."""
    key = f'v{SEASON}-{now.year}'
    return _OLD_SEASON_KEYS.get(key, key)


def score_row_key(points, sid):
    """Table Storage returns rows in RowKey order, so the key is built to make the best score come first."""
    return f'{999999 - points:06d}_{sid}'
