# Architecture and decisions

This document records the overall architecture and the reasoning behind it. The goal is a small, readable and cheap system where every choice can be justified. The game itself is described in [game-design.md](game-design.md).

Hard requirement: the game must be as close to free as possible, with no surprise costs. Every new resource is checked against this before it is added (chapter 7).

## 1. Overview

```
Browser
  │  zombit.gerlitek.fi  (static front end: Vite + TypeScript + Phaser 4)
  │
  └─ HTTPS, CORS allows only the game's domain
       │
       ▼
  Azure Functions (Python)                        resource group rg-zombies
    POST /api/events ──────────► Blob  raw/      NDJSON, deleted after 30 days
    POST /api/scores ──────────► Table scores
    GET  /api/leaderboard ◄───── Table scores
    GET  /api/stats ◄─────────── Blob  curated/summary/dashboard.json
    timer, once a day:
        raw/ (JSON) ──► curated/ (Parquet) ──► summary.json
       │
       └─► Application Insights (server telemetry only, daily cap)

GitHub Actions ──(OIDC, no keys)──► Azure      Bicep and API code
GitHub Actions ──(SSH + rsync)────► web host   front end
Owner ──(az, by hand)─────────────► subscription   budget and bootstrap
```

The plan started with a static front end only: the game runs entirely in the browser, so the first stage needed nothing from Azure except the budget. It still works without the API.

## 2. Front end

### Structure

```
web/
  index.html            the page, styled like gerlitek.fi
  src/
    main.ts             Phaser configuration
    art/                palette.ts, pixels.ts (px, ell, limb, figure), character.ts, scenery.ts
    data/               zombies.ts, weapons.ts, wheels.ts, achievements.ts, nicknames.ts, messages.ts
    logic/              spawn.ts, wheel.ts, score.ts, puzzle.ts, achievements.ts
    systems/            weather.ts, spawner.ts, weapons.ts, telemetry.ts, storage.ts
    scenes/             Boot, Menu, Play, Wheel, Puzzle, Cave, End
  public/fonts/         pixel font and Inter, served from our own server
```

Three rules keep the code explainable:

1. **Content is data.** A zombie, weapon, wheel or achievement is a row in `data/`. A new zombie needs no new code.
2. **Rules are pure functions.** `logic/` does not import Phaser. Random draws take the random number generator as a parameter, so they can be tested (Vitest) without a browser.
3. **One game scene for two areas.** `PlayScene` receives the area (forest, VIP) as configuration. The wheel, the puzzle and the cave are separate scenes that start on top of the game and pause it.

### Graphics without image files

Characters are drawn by code from parts on every frame (see [game-design.md](game-design.md), chapter 10, and `web/public/konsepti/index.html`). The drawing functions of the concept page use a single operation, "fill a rectangle", so they move unchanged to a Phaser `Graphics` object. The background (ground, moss, distant trees) is drawn once into a texture.

Risk: about 10 characters x 250 rectangles per frame. That is little for WebGL, but it is measured on a slow device as soon as the game runs. Fallback: pre-render each character's walk cycle into textures at startup.

### State in the browser

- `localStorage`: nickname (word list indexes), achievements, own best results, puzzle level, sound setting.
- `sessionStorage`: random session id (`crypto.randomUUID()`), new in every tab.
- No cookies, no third-party scripts, no external fonts.

### Telemetry in the front end

`systems/telemetry.ts` offers one function, `track(event)`. It buffers events and sends the batch with `navigator.sendBeacon` when the player enters the VIP box, when the game ends and when the page is closed. The game never waits for the network: if the API does not answer, the game goes on and the boards show local results.

## 3. API

Azure Functions, Python, v2 programming model (decorators, one `function_app.py`). Folder `api/`.

| Route | Task | Limits |
|---|---|---|
| `POST /api/events` | Receives a batch of events and writes it to the raw layer | at most 50 events and 16 kB |
| `POST /api/scores` | Saves a result | one result per session |
| `GET /api/leaderboard` | Top 10 | cached 60 s |
| `GET /api/stats` | Ready-made JSON for the dashboard | cached 1 h |
| timer `curate` | raw -> curated -> summary | once a day |

Not built: routes for ready-made messages (`/api/messages`). The game shows its messages from a local list (`web/src/data/messages.ts`). The empty table `messages` is reserved for them.

### Validation

Every field is checked against a list of allowed values (event name, zombie type, weapon, message id, nickname indexes). No field accepts free text. Unknown fields are rejected. A result gets a plausibility check: kills 0 to 45 (the winning limit, `WIN_KILLS`), score at most the maximum of the formula, duration at least 20 s for a win.

Accepted risk: a result can still be forged, because the game runs in the browser. The stake is a toy leaderboard, so the check is enough. A row can be deleted by hand.

### Rate limiting

Functions has no ready-made rate limit, so it is built in three layers:

1. **At most one instance** (see chapter 7). Limits concurrency and the bill.
2. **Per-session limit in memory**: at most 10 batches per minute per `session_id`.
3. **Daily cap**: a counter in Table Storage (for example 5,000 writes per day). When the cap is full, the API answers 429 and the game goes on offline.

The IP address is neither used for limiting nor stored anywhere. The price: an attacker can change the session id, and then only the daily cap stops them. That is acceptable, because the cap limits the costs.

### Authentication

The API is public and anonymous, because the game has no login. CORS allows only the game's domain. CORS is not a security control (it restricts only browsers), so the real protection is validation and limits.

The Function App uses the storage account with a managed identity. There are no connection strings or keys, and shared key access on the storage account is off (`allowSharedKeyAccess: false`).

## 4. Data

### Table Storage

| Table | PartitionKey | RowKey | Fields |
|---|---|---|---|
| `scores` | season and year, e.g. `v2-2027` (`season_key`, `api/rules.py`) | zero-padded `(999999 - score)` + `_` + session_id | nick (indexes), score, kills, duration_s, hearts, character, created |
| `messages` (reserved, not in use) | `all` | reversed timestamp + `_` + session_id | nick, message_id |
| `limits` | `daily` (writes), `requests` (all requests), `session` (one result per session) | date or session_id | count |

Table Storage cannot sort. Rows always come back in RowKey order, so a reversed score in the key makes the query "first 10 rows" the leaderboard itself. The same trick with a reversed timestamp gives the newest messages. The key is designed for the query.

**Seasons.** The leaderboard starts over every New Year (UTC) and whenever `SEASON` is raised, because the partition key changes and a new partition is empty. Nothing is deleted. Results written before yearly seasons are in the partition `v2`, which is the 2026 season. Size is not the reason: checked on 2026-11-27, the tables held 146 rows and 32 kB after nine days, and even a full daily cap every day for a year stays under a gigabyte. The query reads the first ten rows of one partition, so its speed does not depend on the row count. The season on the stats page is only the first number of the game version, so its numbers do not start over at New Year.

### Blob Storage: layers

```
raw/events/dt=2026-11-16/<session_id>-<batch number>.ndjson     as received, 30 days
curated/events/dt=2026-11-16/events.parquet                     validated, typed, deduplicated
curated/summary/dashboard.json                                  ready-made aggregate for the dashboard
```

- **raw**: one blob per batch, one line per event. The API adds a server timestamp. Nothing is edited, so the layer can always be processed again.
- **curated**: the timer function `curate_events` (`api/function_app.py`, every night at 02:30 UTC) processes each past day that lacks a curated file. After a stop it catches up on the missed days, and a rerun changes nothing. The logic is in `api/curate.py` with its tests:
  - Every line is validated again (`rules.event`), duplicates are removed by the key `session_id + seq`, types are enforced, and the result is written as one wide Parquet table per day (`pyarrow`, columns that do not belong to an event type are empty).
  - The nickname is left out, because curated data is kept permanently.
  - Test sessions (ids of the form `xxxxxxxx-0000-4000-8000-…`) are left out, so the dashboard shows only real games.
  - Plausibility rules (`plausible`) reject a whole session if 1) it does not start with `game_started`, 2) sequence numbers jump or time runs backwards, or 3) kills come faster than zombies appear (the limit is about twice the spawn rate). The rules stop a careless forgery, not a careful one: the game runs in the browser, so full prevention does not exist.
  - Cleanup: `SKIP_DAYS` and `LAUNCH_DAY` clear a day from the statistics when the version is raised. Raw data stays as it is.
  - The rule version (`RULES_VERSION`) is stored in the Parquet file metadata. When a rule changes, the version is raised, and the nightly job redoes the days whose raw data still exists.
- **Memory**: the nightly run reads one day at a time. The summary is built from running totals (`curate.tally`): each day's Parquet file is read, added to the totals and dropped, and medians come from histograms (value -> count). Raw blobs are read one at a time too. Memory therefore holds one day of rows, not the whole history (before 2026-11-27 it held every row of every day, which would have run out of the 512 MB within about a year). Every day file is still downloaded each night, which keeps the run stateless: a few hundred small reads a year. `pyarrow` is imported only inside the timer function, so HTTP requests do not load it. The module stays in the process until the idle instance shuts down. If memory approaches 512 MB, lower HTTP concurrency from 16 to 8 (chapter 10).
- **dashboard.json**: computed every night.
  - Total games for all time, the daily chart and the games of the last 30 days.
  - The number of distinct player names in 30 days is computed from the raw layer, where names live only 30 days, and only the number is stored. It is indicative: drawing a new name or using another device shows up as a new player.
  - All other numbers come from the current season only (the first number of the event's `version` field is the season), because the kill limits changed between seasons, so win rates and medians are not comparable. The Parquet files still contain every season.
  - Season numbers: median duration and kills, characters, kills and hits by zombie type, wheel weapons, achievements, correct puzzle answers and median solving time per level.
- Partitioning `dt=YYYY-MM-DD` is Hive style, so the same files can later be read with DuckDB, Spark or Fabric without changes.

A lifecycle rule deletes the raw layer after 30 days. Curated data stays. It contains no personal data.

### Dashboard

A static page in the front end (`web/tilastot/index.html`, path `/tilastot/`, logic in `web/src/stats.ts`). Chart.js is an npm package and is served from our own server through the build, so the CSP does not change. The page reads `GET /api/stats`, which returns the nightly `dashboard.json` as it is (cached 1 h, 404 before the first run). The page runs no queries of its own. The numbers of every chart are also shown as a table. In development mode, `/tilastot/?demo` draws made-up numbers (`stats-demo.ts`, not in the build).

## 5. Infrastructure as code

```
infra/
  budget.bicep          subscription level, by hand
  guardrails.bicep      subscription level, by hand: Azure Policy and cost anomaly alert (chapter 7)
  bootstrap.bicep       subscription level, by hand: resource group, identities, roles
  register-providers.sh subscription level, by hand: registers resource providers (list read from guardrails.bicep)
  main.bicep            resource group level: combines the modules. Run by azd and CI
  main.parameters.json  parameters for azd
  modules/
    monitoring.bicep    Log Analytics + Application Insights, daily cap
    storage.bicep       account, raw and curated containers, tables, lifecycle rule
    api.bicep           Functions plan and Function App
```

### Two levels, two permission levels

| | `budget.bicep`, `guardrails.bicep`, `bootstrap.bicep` | `main.bicep` |
|---|---|---|
| Level | subscription | resource group |
| Run by | owner, by hand, rarely | GitHub Actions and `azd` |
| Contents | budget, policies, anomaly alert, provider registration, resource group, two managed identities, role assignments | everything else |

**Resource providers.** In a new subscription, services are not registered, and creating a resource fails with the misleading error `SubscriptionNotFound` (found in the policy test on 2026-11-17). Bicep cannot register providers, and the CI identity has no right to do it at subscription level. So the owner runs `infra/register-providers.sh` before bootstrap and every time a new service is added to the allowed types in `guardrails.bicep`. The script reads the namespaces from the same list, so allowed types and registered providers stay in step.

`bootstrap.bicep` creates:

- the resource group `rg-zombies`
- the identity `id-zombies-github` with a federated credential for the GitHub environment `production` only (subject `repo:Gerlitek@263029107/zombiet-peli@1461639455:environment:production`, GitHub's immutable id format). Pull requests have no access to Azure. Role: Contributor, scoped to `rg-zombies` only.
- the identity `id-zombies-api` for the Function App. Roles in the resource group: Storage Blob Data Contributor, Storage Table Data Contributor, Monitoring Metrics Publisher and a custom role that allows only the action `Microsoft.Web/sites/stop/action` (the cost brake). Stopping used to rely on the Website Contributor role, but that also allowed publishing code, changing settings and reading publishing credentials. After the switch, the old assignment is removed once by hand: `az role assignment delete --assignee <principalId of id-zombies-api> --role "Website Contributor" -g rg-zombies`.

Reasoning: creating role assignments needs stronger rights than Contributor. When they are made by hand in bootstrap, the CI identity never gets the right to grant rights. OIDC uses a user-assigned managed identity instead of an app registration, so everything stays in Bicep and no separate Entra ID permissions are needed.

### azd

`azure.yaml` in the root holds one service: `api` (`host: function`, `language: python`, `project: ./api`). `azd provision` runs `infra/main.bicep`, `azd deploy` packages and publishes the API. The front end is not in `azure.yaml`. `azd` finds the target by the tag `azd-service-name: api`, which Bicep sets on the Function App.

### Names and region

Resource names are in English with abbreviations: `rg-zombies`, `func-zombies-<hash>`, `stzombies<hash>`, `log-zombies`, `appi-zombies`. The hash is `uniqueString(resourceGroup().id)`. Region: `swedencentral` (check Flex Consumption availability before use, alternative `northeurope`).

## 6. CI/CD

Three workflows, each triggered only by changes in its own folder.

| Workflow | Pull request | Merge to main |
|---|---|---|
| `web.yml` | type check, Vitest, build | the same + approval and rsync to the web host |
| `infra.yml` | `az bicep build` and linter, no Azure login | `what-if`, approval, deployment to the resource group |
| `api.yml` | ruff, pytest | the same + approval and code deployment to the Function App |

- Repository: `github.com/Gerlitek/zombiet-peli`. The federated credential subject uses GitHub's numeric ids (owner and repository), because new repositories get an immutable subject by default (found on 2026-11-18, when login failed with the name format). Renaming does not break the login, and a released name cannot be taken over. If the repository is deleted and recreated, the ids change and `bootstrap.bicep` must be run again.
- GitHub Actions in a private repository is free within the monthly quota (2,000 min per month). Workflows run only on changes in their own folder, so the quota is not wasted.
- Azure login: `azure/login` with OIDC as the identity `id-zombies-github`. The repository holds only three identifiers (client id, tenant id, subscription id), no secrets.
- A deployment from main goes through the GitHub environment `production`, which requires a manual approval. The federated credential accepts only this environment, so only a run approved by the owner gets an Azure token. `what-if` runs in the same job before the deployment. The approval covers the whole job, so the owner reads `what-if` locally before starting the run, and the pipeline's `what-if` stays in the log.
- Status on 2026-11-18: the repository is public and the environment `production` exists (owner as required reviewer, runs allowed only from `main`). The federated credential subject is set: `environment:production`. All three deployments are started by hand (`workflow_dispatch`, `main` only) and use the environment, including `web.yml` (2026-11-19).
- The owner is the only reviewer, so the gate is not a two-person control but a stop before the run gets an Azure token or an SSH key.
- Actions are pinned to a commit SHA, because a tag can be moved to point at other code. Dependabot (`.github/dependabot.yml`) opens pull requests for new versions every month.
- The front end is published to a shared web host (Apache) with rsync over SSH.
- The SSH key is the `production` environment secret `DEPLOY_SSH_KEY`, so only an approved run gets it. The server user name is the variable `DEPLOY_USER`. The key is made for this purpose only, and on the server it is restricted to the game's folder (`command=` restriction in `authorized_keys`, rsync only).
- The pipeline is built first with `az` commands. `azd pipeline config` will be tried later for comparison.

## 7. Costs and limits

The budget `Zombies` (5 USD per month, alerts at 50, 80 and 100 % of actual and 100 % of forecast cost) is active. The billing account also has a 1 USD budget.

**A budget stops nothing.** It sends email, and cost data arrives with a delay of 8 to 24 hours. A forecast alert also needs about a week of history. That is why every resource has its own hard limit:

| Resource | Limit | Why |
|---|---|---|
| Function App | at most 1 instance, 0 always ready, 512 MB memory | The largest single cost risk. Always ready instances are not part of the free grant |
| API | maximum request size, daily cap, validation | Limits executions and storage writes |
| Application Insights | daily cap 0.1 GB, sampling, 30 days retention | Log volume is the most common surprise bill in Azure |
| Storage | LRS, no versioning, raw deleted after 30 days | Data stays in megabytes |
| Everything | no Event Hubs, Stream Analytics, Data Factory, Synapse or Fabric | Fixed price or a high minimum |

On top of the budget:

- **Azure Policy for the whole subscription** (`guardrails.bicep`, free). Two deny rules:
  - *Allowed resource types*: only the planned types (storage account, Functions plan and Function App, managed identity, Log Analytics, Application Insights, alerts). Virtual machines, AKS, databases, IP addresses and everything else are denied.
  - *Expensive settings*: even allowed types only in their cheapest form. Functions plan only Flex Consumption (`FC1`). Function App at most 1 instance, at most 512 MB, no always ready instances. Storage account only `Standard_LRS`. Log Analytics only `PerGB2018` with a daily cap of exactly 0.1 GB (an equality condition, because a `less`/`greater` comparison fails with a type conflict when the field is an integer such as -1 for unlimited; found on 2026-11-18, the policy failed safely and blocked the deployment).
  - The policy is at subscription level, so the CI identity (Contributor on the resource group only) cannot change it. A new resource type is added to the policy first and to Bicep after that.
- **Cost anomaly alert** (`guardrails.bicep`, Cost Management, free). It notices a sudden change faster than the percentage limit of a monthly budget. The alert has an end date (2031-11-18, `anomalyEnd`) and must be renewed before it.
- **Automatic stop**, built at the same time as the Function App, not later. The API keeps two daily counters in the `limits` table: writes (`DAILY_CAP`, 5,000) and all requests (`REQUEST_CAP`, 50,000). The request counter is saved every 100 requests, so a restart does not reset it (it used to live only in memory, and an instance crashed with large requests reset the cap). The host rejects bodies over 32 kB (`FUNCTIONS_REQUEST_BODY_SIZE_LIMIT`) before the code runs. When a counter passes its cap, the API shuts itself down (the managed identity may only stop it). If the owner starts the API again the same day, it answers 429 until midnight UTC unless the counter row is deleted. This does not depend on the delay in cost data. The game keeps working offline, and the owner restarts the API by hand.
- **Manual emergency brake**: `az functionapp stop`.

**Cold start** (one instance, 0 always ready, HTTP concurrency 16). Measured on 2026-11-20 after about 4.5 hours idle: the first `/api/leaderboard` took 3.1 s, the second 0.16 s, both 200. A measurement on 2026-11-19 right after publishing gave about 30 s, most likely the first start of the new code package. The game calls `warmUp()` at startup and waits up to 45 s for an answer (`web/src/systems/api.ts`), so the player sees neither.

Cost when nobody plays: nothing fixed. The plan has no resource with a monthly fee or minimum charge. The price list is checked before every new resource to confirm this still holds.

Estimated cost in normal use: under 0.10 USD per month. Functions stays within the free grant (Flex Consumption: 250,000 executions and 100,000 GB-s per month), and storage costs fractions of a cent. The worst case under continuous abuse is, thanks to the automatic stop, one daily cap worth of executions, so cents. Prices and grants are checked in the price list before use.

The static front end alone does not use Azure at all.

### Cost check 2026-11-16

Subscription state checked with `az` commands: no resources or resource groups, the budget `Zombies` (5 USD per month) in force, and Defender for Cloud not in use (the `Microsoft.Security` provider not registered). At that point the subscription could not generate costs.

Azure has no hard spending cap for a pay-as-you-go subscription. A large bill is therefore prevented with these rules, each checked before anything is created:

| Risk | Rule | Where it is enforced |
|---|---|---|
| Flood of API calls | At most 1 instance, 0 always ready, API shuts itself down when the daily cap is exceeded | `api.bicep`, API code and its tests (`api/tests/test_caps.py`) |
| Log volume | Daily cap 0.1 GB in both Log Analytics and Application Insights, 30 days retention, sampling. Log level `Warning` (`api/host.json`), except request rows (`Host.Results`) and the summary of the curated job. HTTP logs of the Azure SDK at warning level only (`function_app.py`) | `monitoring.bicep`, `host.json` |
| Storage | LRS, no versioning, no SFTP (hourly price), no hierarchical namespace, raw deleted after 30 days, maximum request size 16 kB | `storage.bicep` |
| Paid security plans | Defender for Storage and Defender for App Service stay off. The portal offers them, do not accept | `az security pricing list` before and after rollout |
| Wrong resource by accident (also one created by AI) | Azure Policy on the whole subscription: only the planned resource types in their cheapest settings. Free | `guardrails.bicep` |
| Leaked CI credential | Federated credential only for the environment `production` with manual approval. No stored secrets | `bootstrap.bicep`, GitHub environment |
| Owner account takeover | Strong MFA | Account settings |
| Expensive extra services | No API Management, Front Door, Application Gateway, NAT gateway, private endpoints, Premium plan or static IP | Policy, `what-if` before every infrastructure deployment |
| Forgotten resources | Everything in one resource group. `az group delete` removes it all at once | Resource group layout |
| GitHub Actions | Account spending limit 0 USD: when minutes run out, runs stop and no bill follows | GitHub: Settings, Billing |
| Web host | Fixed monthly price, traffic not billed separately | Provider contract |

Worst realistic case after these: a troublemaker fills the daily cap, the API shuts down, and the cost is cents. The largest remaining risk is not an attacker but an own mistake, a resource created with the wrong setting. Policy, `what-if` and the budget alert stand against it.

### Residual risk (2026-11-17)

A pay-as-you-go subscription has no hard spending cap, so protection is layered:

1. **No Azure before it is needed.** The first stage ran on the web host without Azure. Until the API was built, the subscription held only the budget and free protections.
2. **Policy**: nobody but the owner can create expensive resources, not even by accident.
3. **Hard limits in resources**: one 512 MB instance, the API shuts itself down when the daily cap is exceeded, a daily log cap.
4. **Alerts**: budget and anomaly alert. Delayed by 8 to 24 hours, so only a safety net.

Worst cases after the layers (prices to be checked in the price list):

| Case | Estimate |
|---|---|
| Normal use | under 0.10 USD per month |
| Flood of calls, automatic stop works | cents |
| Flood of calls, stop fails, one instance fully loaded all month | about 30 USD (0.5 GB x 2.6 million s, free grant subtracted) |
| Logs | cap 0.1 GB per day, so at most about 3 GB per month, which fits in the monthly free allowance of Log Analytics |
| Owner account taken over | unlimited. Prevention: MFA. Emergency brakes: `az group delete --name rg-zombies`, cancelling the subscription, an Azure support request at once |

Status on 2026-11-20: the counters and the stop trigger are covered by unit tests, but the stop has not been tested in production under load. Test plan: set a low `REQUEST_CAP` app setting, send requests past the cap, the API must stop, and Cost Management should show zero the next day.

## 8. Privacy

Players may be children.

- Only a generated nickname (word list indexes) and a random session id are stored. There is no free text anywhere, so personal data cannot end up in the data by accident.
- No IP addresses: the API neither reads nor stores them.
- Application Insights: server telemetry only. The browser gets no Application Insights script. The service masks the IP address by default (`0.0.0.0`) but derives a location (city, country) from it first. The setting `DisableIpMasking` is not turned on. The city and country stay in the request rows for 30 days (decided 2026-11-27: left as it is, because a city alone identifies nobody, and removing it would need a new resource type, a data collection rule with a transformation).
- No cookies, no third-party analytics, no external fonts or scripts.
- The page has a short privacy notice in plain language: what is stored and why.

## 9. Stages

| Stage | Contents |
|---|---|
| 1 | Budget and tools. `guardrails.bicep` is run before stage 3 |
| 2 | Game playable locally: graphics engine, player, zombies, weapons, wheel, VIP, puzzles |
| 3 | Publishing to the web host: `web.yml`, SSH key, subdomain |
| 4 | `bootstrap.bicep`, OIDC, `infra.yml`, an empty `main.bicep` through the pipeline |
| 5 | Storage, Function App, score table and messages, `azd` into use, `api.yml` |
| 6 | Telemetry, raw and curated layers, Application Insights |
| 7 | Dashboard |

All stages are in production since release 1.0.0 (see [CHANGELOG.md](../CHANGELOG.md)).

Stage 2 was split into small steps that could be shown one at a time:

1. `art/`: palette, drawing functions and the character from the concept page into Phaser. The knight moves in the forest.
2. Zombies from data, spawning from a raindrop, basic hit, hearts, winning at the kill limit.
3. Weapon behaviours `strike`, `orbit`, `status` and the wheel of fortune.
4. VIP box, back board, achievements, end screen.
5. Puzzles, lock stone and Lightning Cave.
6. Vitest tests for `logic/`, finishing touches.

## 10. Risks

| Risk | Mitigation |
|---|---|
| More content than there is time for | Data-driven content, versions bounded in [game-design.md](game-design.md), stage 2 in small steps |
| Graphics drawn by code are slow | Measure early, fallback to pre-rendered textures |
| The owner cannot explain the code | Three rules (chapter 2), small files, every step walked through |
| Children and user input | No free text anywhere: generated nickname, ready-made messages |
| Costs | Hard limits in resources (chapter 7), budget and anomaly alert |
| Forged results | Plausibility check, residual risk accepted |
| Trademarks and Minecraft association | Own leaf-limb style, the Dark Lord as an original character |
| Secrets in the repository | OIDC, SSH key only as a GitHub secret, email addresses as parameters |
| Linux Consumption is retired | Flex Consumption from the start (chapter 11) |
| Surprise costs | No fixed-price resources, hard limits, automatic stop (chapter 7) |
| Out of memory when many play at once | One instance, 512 MB, HTTP concurrency 16 (`infra/modules/api.bicep`). Measured on 2026-11-19: Private Bytes 387 MB on average and 435 MB at most (395 MB at most before concurrency was raised), 73 requests without errors. If memory approaches 512 MB or 503 errors appear, lower the value from 16 to for example 8. Check: `AppPerformanceCounters` (`Name == 'Private Bytes'`) and `AppRequests` in the workspace `log-zombies` |

## 11. Decisions (approved 2026-11-16)

1. **Flex Consumption instead of Consumption.** Python requires Linux, and Linux Consumption is retired on 30 September 2028. Python 3.12 is its last supported version. Flex Consumption is the successor Microsoft recommends: the same pay-per-use, a free grant, and the maximum instance count can be set to 1.
2. **Generated nickname instead of free text.** Removes moderation and personal data risk.
3. **OIDC with a managed identity** instead of an app registration, with roles in `bootstrap.bicep`.
4. **Rate limit without the IP address**: session limit and daily cap.
5. **Real odds of the Rudi-Karri robot**: 1 in 10 per VIP spin. The original 1 in 500 proved too rare in playtesting.
6. **The mini player and the puzzles belong to version 1.**
7. **Camera angle**: a tilted view with the sky at the top.
8. **Subdomain**: `zombit.gerlitek.fi`, confirmed 2026-11-17.

### Added 2026-11-17

9. **Policy at subscription level rather than resource group level**, in its own file `guardrails.bicep`. It also blocks resources created in other resource groups and is in force before the resource group exists.
10. **Policy limits settings too**, not only types. A type restriction alone would allow, for example, a Premium plan or 100 instances.
11. **No Azure access from pull requests.** `what-if` moves to the deployment job before the manual approval. The price: the effect of a change is visible only after merging, before approval.
