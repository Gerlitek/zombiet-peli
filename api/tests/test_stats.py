"""GET /api/stats: passes the nightly summary through, 404 before the first run."""
import azure.functions as func
from azure.core.exceptions import ResourceNotFoundError

import function_app as fa


class Blob:
    def __init__(self, body):
        self.body = body

    def download_blob(self):
        if self.body is None:
            raise ResourceNotFoundError('missing')
        return self

    def readall(self):
        return self.body


def call(monkeypatch, body):
    monkeypatch.setattr(fa, '_over_request_cap', lambda: False)
    monkeypatch.setattr(fa._blobs, 'get_blob_client', lambda container, name: Blob(body))
    req = func.HttpRequest('GET', '/api/stats', body=b'')
    return fa.get_stats.build().get_user_function()(req)


def test_returns_the_summary_with_an_hour_of_cache(monkeypatch):
    res = call(monkeypatch, b'{"games": {"ended": 3}}')
    assert res.status_code == 200
    assert res.get_body() == b'{"games": {"ended": 3}}'
    assert res.headers['Cache-Control'] == 'public, max-age=3600'


def test_404_before_the_first_nightly_run(monkeypatch):
    assert call(monkeypatch, None).status_code == 404
