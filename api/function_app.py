"""The game API: Azure Functions, Python v2 model. Rules live in rules.py, storage access here."""
import io
import json
import logging
import os
import time
import urllib.request
from datetime import UTC, datetime, timedelta

import azure.functions as func
from azure.core import MatchConditions
from azure.core.exceptions import ResourceExistsError, ResourceModifiedError, ResourceNotFoundError
from azure.data.tables import TableServiceClient, UpdateMode
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

import curate
import rules

log = logging.getLogger(__name__)
# The Azure SDK logs every HTTP request and response at INFO. That fills Application Insights (ingestion is billed
# above the free amount) and says nothing new, so only its warnings and errors are kept.
logging.getLogger('azure').setLevel(logging.WARNING)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Both caps can be lowered with app settings, so the cost brake can be tested without thousands of requests.
DAILY_CAP = int(os.environ.get('DAILY_CAP', '5000'))  # writes per day, all routes together. Over the cap the API answers 429 and stops itself.
REQUEST_CAP = int(os.environ.get('REQUEST_CAP', '50000'))  # requests per day, valid or not: bounds the executions bill.
# The request counter is saved to the limits table every 100 requests, so a restart loses at most 100.
# Saving on every request would double the storage calls; a crash or restart must not reset the cap.
REQUEST_SAVE_EVERY = 100
SESSION_BATCHES_PER_MINUTE = 10
GAME_VERSION = 'v1'  # partition key of the score table

_account = os.environ.get('STORAGE_ACCOUNT_NAME', '')
# The user-assigned identity of the Function App. Locally DefaultAzureCredential falls back to `az login`.
_credential = DefaultAzureCredential(managed_identity_client_id=os.environ.get('AZURE_CLIENT_ID'))
_tables = TableServiceClient(f'https://{_account}.table.core.windows.net', credential=_credential)
_blobs = BlobServiceClient(f'https://{_account}.blob.core.windows.net', credential=_credential)

_requests = {'day': '', 'unsaved': 0, 'saved': 0}  # saved: today's total in the table when this instance last wrote it
_recent: dict[str, list[float]] = {}  # session id -> batch times. In memory: one instance, so this is enough.


def _reply(status: int, body=None, cache: int = 0) -> func.HttpResponse:
    headers = {'Cache-Control': f'public, max-age={cache}' if cache else 'no-store'}
    return func.HttpResponse(json.dumps(body) if body is not None else '', status_code=status,
                             mimetype='application/json', headers=headers)


def _stop_self() -> None:
    """Cost brake: stops this Function App through the Azure management API (the identity has the role from bootstrap).
    The owner starts it again by hand: az functionapp start. Without SELF_RESOURCE_ID (local run) nothing happens."""
    resource = os.environ.get('SELF_RESOURCE_ID')
    if not resource:
        return
    log.error('daily cap reached, stopping the Function App')
    try:
        token = _credential.get_token('https://management.azure.com/.default').token
        stop = urllib.request.Request(f'https://management.azure.com{resource}/stop?api-version=2024-04-01', method='POST',
                                      headers={'Authorization': f'Bearer {token}', 'Content-Length': '0'})
        urllib.request.urlopen(stop, timeout=10).close()
    except Exception:
        log.exception('could not stop the Function App')


def _add_to_counter(partition: str, n: int) -> int | None:
    """Adds n to today's row in the limits table and returns the new total. None if the row keeps changing under us."""
    limits, today = _tables.get_table_client('limits'), datetime.now(UTC).strftime('%Y-%m-%d')
    for _ in range(3):  # optimistic concurrency: retry if another request changed the row meanwhile
        try:
            row = limits.get_entity(partition, today)
            row['count'] += n
            limits.update_entity(row, mode=UpdateMode.MERGE, etag=row.metadata['etag'], match_condition=MatchConditions.IfNotModified)
            return row['count']
        except ResourceNotFoundError:
            try:
                limits.create_entity({'PartitionKey': partition, 'RowKey': today, 'count': n})
                return n
            except ResourceExistsError:
                continue
        except ResourceModifiedError:
            continue
    return None


def _over_request_cap() -> bool:
    today = datetime.now(UTC).strftime('%Y-%m-%d')
    if _requests['day'] != today:
        _requests.update(day=today, unsaved=0, saved=0)
    _requests['unsaved'] += 1
    if _requests['unsaved'] >= REQUEST_SAVE_EVERY:
        total = _add_to_counter('requests', _requests['unsaved'])
        if total is not None:  # on contention the requests stay unsaved and go with the next save
            if total - _requests['unsaved'] <= REQUEST_CAP < total:  # this save crossed the cap: stop once
                _stop_self()
            _requests.update(unsaved=0, saved=total)
    return _requests['saved'] + _requests['unsaved'] > REQUEST_CAP


def _read_json(req: func.HttpRequest):
    body = req.get_body()  # the host refuses bodies over FUNCTIONS_REQUEST_BODY_SIZE_LIMIT before this runs
    if len(body) > rules.MAX_BODY_BYTES:
        raise rules.Invalid('body too large')
    try:
        return json.loads(body)
    except ValueError as err:
        raise rules.Invalid('not JSON') from err


def _count_write() -> bool:
    """Adds one to today's write counter. False when the daily cap is full."""
    total = _add_to_counter('daily', 1)
    if total is None:
        return False  # contention that does not settle: refuse, the game goes on offline
    if total == DAILY_CAP + 1:  # first refusal of the day: stop once
        _stop_self()
    return total <= DAILY_CAP


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
    if _over_request_cap():
        return _reply(429)
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
    if _over_request_cap():
        return _reply(429)
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
    if _over_request_cap():
        return _reply(429)
    rows = _tables.get_table_client('scores').query_entities(f"PartitionKey eq '{GAME_VERSION}'", results_per_page=10)
    top = []
    for row in rows:  # rows come back in RowKey order, so the first ten are the best ten
        top.append({'nick': json.loads(row['nick']), 'score': row['score'], 'kills': row['kills'], 'won': row['won']})
        if len(top) == 10:
            break
    return _reply(200, top, cache=60)


@app.route(route='stats', methods=['GET'])
def get_stats(req: func.HttpRequest) -> func.HttpResponse:
    """The dashboard: the summary the nightly run wrote. 404 until the first run."""
    if _over_request_cap():
        return _reply(429)
    try:
        body = _blobs.get_blob_client('curated', 'summary/dashboard.json').download_blob().readall()
    except ResourceNotFoundError:
        return _reply(404)
    # Changes once a night, so browsers may keep it for an hour.
    return func.HttpResponse(body, status_code=200, mimetype='application/json',
                             headers={'Cache-Control': 'public, max-age=3600'})


# Curated layer (docs/architecture.md, chapter 4). Once a night, when hardly anyone plays: pyarrow needs memory,
# and the instance (512 MB) is shared with the game's requests.
@app.timer_trigger(schedule='0 30 2 * * *', arg_name='timer')
def curate_events(timer: func.TimerRequest) -> None:
    import pyarrow as pa  # imported here, not at the top: the HTTP functions never load it
    import pyarrow.parquet as pq

    raw, curated = _blobs.get_container_client('raw'), _blobs.get_container_client('curated')
    today = datetime.now(UTC).strftime('%Y-%m-%d')

    def day(name: str) -> str:  # 'events/dt=2026-11-20/...' -> '2026-11-20'
        return name.split('/')[1][3:]

    # Every past day whose curated file is missing or made with older rules (curate.RULES_VERSION).
    # Catches up after a stop, and running twice changes nothing. Days whose raw data has expired keep their file.
    done = {day(b.name): (b.metadata or {}).get('rules') for b in curated.list_blobs(name_starts_with='events/dt=', include=['metadata'])}
    todo = sorted({day(n) for n in raw.list_blob_names(name_starts_with='events/dt=')})
    schema = curate.arrow_schema(pa)
    for d in todo:
        if d >= today or done.get(d) == str(curate.RULES_VERSION):
            continue
        blobs = [] if curate.skipped(d) else [raw.download_blob(n).readall().decode() for n in raw.list_blob_names(name_starts_with=f'events/dt={d}/')]
        rows, dropped = ([], {'rejected': 0, 'test': 0, 'implausible': 0}) if curate.skipped(d) else curate.clean(blobs)
        out = pa.BufferOutputStream()
        pq.write_table(pa.Table.from_pydict(curate.columns(rows), schema=schema), out)
        curated.upload_blob(f'events/dt={d}/events.parquet', out.getvalue().to_pybytes(), overwrite=True,
                            metadata={'rules': str(curate.RULES_VERSION)})
        log.info('curated %s: %d events, dropped %d rejected, %d test, %d implausible', d, len(rows),
                 dropped['rejected'], dropped['test'], dropped['implausible'])

    rows = []
    for name in curated.list_blob_names(name_starts_with='events/dt='):
        rows += pq.read_table(io.BytesIO(curated.download_blob(name).readall())).to_pylist()
    # Distinct players of the recent days, from raw (kept 30 days): only the count is stored.
    since = (datetime.now(UTC) - timedelta(days=curate.RECENT_DAYS)).strftime('%Y-%m-%d')
    recent = [raw.download_blob(n).readall().decode() for n in raw.list_blob_names(name_starts_with='events/dt=') if since <= day(n) < today and not curate.skipped(day(n))]
    summary = curate.summary(rows, players_recent=len(curate.nicknames(recent)))
    curated.upload_blob('summary/dashboard.json', json.dumps(summary), overwrite=True)

