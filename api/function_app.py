"""The game API: Azure Functions, Python v2 model. Rules live in rules.py, storage access here."""
import json
import logging
import os
import time
from datetime import UTC, datetime

import azure.functions as func
from azure.core import MatchConditions
from azure.core.exceptions import ResourceExistsError, ResourceModifiedError, ResourceNotFoundError
from azure.data.tables import TableServiceClient, UpdateMode
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

import rules

log = logging.getLogger(__name__)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

DAILY_CAP = 5000  # writes per day, all routes together. Over the cap the API answers 429.
SESSION_BATCHES_PER_MINUTE = 10
GAME_VERSION = 'v1'  # partition key of the score table

_account = os.environ.get('STORAGE_ACCOUNT_NAME', '')
# The user-assigned identity of the Function App. Locally DefaultAzureCredential falls back to `az login`.
_credential = DefaultAzureCredential(managed_identity_client_id=os.environ.get('AZURE_CLIENT_ID'))
_tables = TableServiceClient(f'https://{_account}.table.core.windows.net', credential=_credential)
_blobs = BlobServiceClient(f'https://{_account}.blob.core.windows.net', credential=_credential)

_recent: dict[str, list[float]] = {}  # session id -> batch times. In memory: one instance, so this is enough.


def _reply(status: int, body=None, cache: int = 0) -> func.HttpResponse:
    headers = {'Cache-Control': f'public, max-age={cache}' if cache else 'no-store'}
    return func.HttpResponse(json.dumps(body) if body is not None else '', status_code=status,
                             mimetype='application/json', headers=headers)


def _read_json(req: func.HttpRequest):
    body = req.get_body()
    if len(body) > rules.MAX_BODY_BYTES:
        raise rules.Invalid('body too large')
    try:
        return json.loads(body)
    except ValueError as err:
        raise rules.Invalid('not JSON') from err


def _count_write() -> bool:
    """Adds one to today's counter in the limits table. False when the daily cap is full."""
    limits, today = _tables.get_table_client('limits'), datetime.now(UTC).strftime('%Y-%m-%d')
    for _ in range(3):  # optimistic concurrency: retry if another request changed the row meanwhile
        try:
            row = limits.get_entity('daily', today)
            if row['count'] >= DAILY_CAP:
                return False
            row['count'] += 1
            limits.update_entity(row, mode=UpdateMode.MERGE, etag=row.metadata['etag'], match_condition=MatchConditions.IfNotModified)
            return True
        except ResourceNotFoundError:
            try:
                limits.create_entity({'PartitionKey': 'daily', 'RowKey': today, 'count': 1})
                return True
            except ResourceExistsError:
                continue
        except ResourceModifiedError:
            continue
    return False  # contention that does not settle: refuse, the game goes on offline


def _session_too_busy(sid: str) -> bool:
    now = time.monotonic()
    times = [t for t in _recent.get(sid, []) if now - t < 60]
    if len(times) >= SESSION_BATCHES_PER_MINUTE:
        return True
    _recent[sid] = [*times, now]
    if len(_recent) > 5000:  # the dictionary must not grow without bound
        _recent.clear()
    return False


@app.route(route='events', methods=['POST'])
def post_events(req: func.HttpRequest) -> func.HttpResponse:
    try:
        events = rules.batch(_read_json(req))
    except rules.Invalid as err:
        log.info('events rejected: %s', err)
        return _reply(400)
    sid = events[0]['session_id']
    if _session_too_busy(sid) or not _count_write():
        return _reply(429)
    received = datetime.now(UTC)
    lines = '\n'.join(json.dumps({**e, 'received': received.isoformat()}) for e in events)
    # raw layer: one blob per batch, one line per event, never edited afterwards.
    path = f"events/dt={received:%Y-%m-%d}/{sid}-{events[0]['seq']}.ndjson"
    _blobs.get_blob_client('raw', path).upload_blob(lines, overwrite=True)  # same batch sent twice replaces itself
    return _reply(202)


@app.route(route='scores', methods=['POST'])
def post_score(req: func.HttpRequest) -> func.HttpResponse:
    try:
        s = rules.score(_read_json(req))
    except rules.Invalid as err:
        log.info('score rejected: %s', err)
        return _reply(400)
    if not _count_write():
        return _reply(429)
    try:  # one result per session: the marker row fails if it already exists
        _tables.get_table_client('limits').create_entity({'PartitionKey': 'session', 'RowKey': s['session_id']})
    except ResourceExistsError:
        return _reply(409)
    _tables.get_table_client('scores').create_entity({
        'PartitionKey': GAME_VERSION, 'RowKey': rules.score_row_key(s['score'], s['session_id']),
        'nick': json.dumps(s['nick']), 'score': s['score'], 'kills': s['kills'], 'duration_s': s['duration_s'],
        'hearts': s['hearts'], 'character': s['character'], 'won': s['won'],
        'created': datetime.now(UTC).isoformat()})
    return _reply(201)


@app.route(route='leaderboard', methods=['GET'])
def get_leaderboard(req: func.HttpRequest) -> func.HttpResponse:
    rows = _tables.get_table_client('scores').query_entities(f"PartitionKey eq '{GAME_VERSION}'", results_per_page=10)
    top = []
    for row in rows:  # rows come back in RowKey order, so the first ten are the best ten
        top.append({'nick': json.loads(row['nick']), 'score': row['score'], 'kills': row['kills'], 'won': row['won']})
        if len(top) == 10:
            break
    return _reply(200, top, cache=60)
