"""The cost brakes in function_app.py, with an in-memory stand-in for the limits table."""
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError

import function_app as fa


class Row(dict):
    @property
    def metadata(self):
        return {'etag': '*'}


class FakeLimits:
    def __init__(self):
        self.rows = {}

    def get_entity(self, pk, rk):
        if (pk, rk) not in self.rows:
            raise ResourceNotFoundError('missing')
        return Row(self.rows[(pk, rk)])

    def create_entity(self, e):
        key = (e['PartitionKey'], e['RowKey'])
        if key in self.rows:
            raise ResourceExistsError('exists')
        self.rows[key] = dict(e)

    def update_entity(self, row, **_):
        self.rows[(row['PartitionKey'], row['RowKey'])] = dict(row)


def setup(monkeypatch, request_cap=250, daily_cap=3):
    limits, stops = FakeLimits(), []
    monkeypatch.setattr(fa._tables, 'get_table_client', lambda name: limits)
    monkeypatch.setattr(fa, '_stop_self', lambda: stops.append(1))
    monkeypatch.setattr(fa, 'REQUEST_CAP', request_cap)
    monkeypatch.setattr(fa, 'DAILY_CAP', daily_cap)
    fa._requests.update(day='', unsaved=0, saved=0)
    return limits, stops


def test_request_cap_survives_a_restart(monkeypatch):
    _, stops = setup(monkeypatch)
    assert not any(fa._over_request_cap() for _ in range(200))  # 200 saved in the table
    fa._requests.update(unsaved=0, saved=0)  # restart: memory is lost, the table is not
    results = [fa._over_request_cap() for _ in range(100)]  # the save brings the total to 300 > 250
    assert results[-1] and stops == [1]


def test_request_cap_stops_only_once(monkeypatch):
    _, stops = setup(monkeypatch)
    for _ in range(600):
        fa._over_request_cap()
    assert stops == [1]


def test_daily_write_cap(monkeypatch):
    _, stops = setup(monkeypatch)
    assert [fa._count_write() for _ in range(5)] == [True, True, True, False, False]
    assert stops == [1]
