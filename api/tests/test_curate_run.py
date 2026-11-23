"""curate_events end to end, with in-memory containers in place of Blob Storage."""
import json
from types import SimpleNamespace

import function_app as fa

TEST_SID = '10000000-0000-4000-8000-000000000001'
REAL_SID = '123e4567-e89b-42d3-a456-426614174000'


class Container:
    def __init__(self, blobs=None):
        self.blobs = dict(blobs or {})  # name -> (bytes, metadata or None, as Azure returns it)

    def list_blob_names(self, name_starts_with=''):
        return [n for n in self.blobs if n.startswith(name_starts_with)]

    def list_blobs(self, name_starts_with='', include=None):
        return [SimpleNamespace(name=n, metadata=m) for n, (_, m) in self.blobs.items() if n.startswith(name_starts_with)]

    def download_blob(self, name):
        return SimpleNamespace(readall=lambda: self.blobs[name][0])

    def upload_blob(self, name, data, overwrite=False, metadata=None):
        self.blobs[name] = (data.encode() if isinstance(data, str) else data, metadata)


def event(sid, seq):
    return json.dumps({'event': 'game_started', 'ts': '2026-11-19T10:00:00Z', 'session_id': sid, 'seq': seq,
                       'version': '2.0.0', 'nickname': 'Hurja-Kissa-42', 'character': 'knight', 'received': '2026-11-19T10:00:01+00:00'})


def run(monkeypatch, curated_blobs, launch_day=None):
    monkeypatch.setattr(fa.curate, 'LAUNCH_DAY', launch_day)  # these tests use 2026-11-19, before the real launch day
    raw = Container({'events/dt=2026-11-19/a-0.ndjson': ('\n'.join([event(REAL_SID, 0), event(TEST_SID, 0)]).encode(), None)})
    curated = Container(curated_blobs)
    monkeypatch.setattr(fa._blobs, 'get_container_client', lambda name: raw if name == 'raw' else curated)
    fa.curate_events.build().get_user_function()(None)
    return curated


def test_old_file_without_metadata_is_rebuilt_without_test_sessions(monkeypatch):
    curated = run(monkeypatch, {'events/dt=2026-11-19/events.parquet': (b'old', None)})  # no metadata: None, not {}
    assert curated.blobs['events/dt=2026-11-19/events.parquet'][1] == {'rules': str(fa.curate.RULES_VERSION)}
    summary = json.loads(curated.blobs['summary/dashboard.json'][0])
    assert summary['characters'] == {'knight': 1}  # the test session is gone


def test_current_file_is_left_alone(monkeypatch):
    current = {'rules': str(fa.curate.RULES_VERSION)}
    raw_file = run(monkeypatch, {})  # first build a valid file
    parquet = raw_file.blobs['events/dt=2026-11-19/events.parquet'][0]
    curated = run(monkeypatch, {'events/dt=2026-11-19/events.parquet': (parquet, current)})
    assert curated.blobs['events/dt=2026-11-19/events.parquet'] == (parquet, current)


def test_a_skipped_day_is_emptied(monkeypatch):
    monkeypatch.setattr(fa.curate, 'SKIP_DAYS', {'2026-11-19'})
    curated = run(monkeypatch, {})
    summary = json.loads(curated.blobs['summary/dashboard.json'][0])
    assert summary['games']['started'] == 0 and summary['players_recent'] == 0


def test_days_before_the_launch_day_are_left_out(monkeypatch):
    kept = json.loads(run(monkeypatch, {}).blobs['summary/dashboard.json'][0])
    left_out = json.loads(run(monkeypatch, {}, launch_day='2026-11-20').blobs['summary/dashboard.json'][0])
    assert kept['games']['started'] == 1 and left_out['games']['started'] == 0
