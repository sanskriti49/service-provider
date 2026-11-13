# TaskGenie local k6 benchmark

Run only against the disposable `taskgenie_bench` database. These scripts do not use the project's `.env` or cloud credentials. `config.cjs` pins local database/Redis URLs and suppresses dotenv loading. Fixture passwords and JWT signing material are intentionally public, local-only values.

## Reproduce (PowerShell, repository root)

```powershell
npm ci --prefix server
docker compose -f benchmarks/k6/compose.yaml up -d
# Wait until PostgreSQL is ready:
docker exec taskgenie-k6-postgres pg_isready -U taskgenie_bench -d taskgenie_bench
node benchmarks/k6/seed.cjs
# Grafana k6 v2.3.0, official Windows release:
New-Item -ItemType Directory -Force work/tools | Out-Null
Invoke-WebRequest https://github.com/grafana/k6/releases/download/v2.3.0/k6-v2.3.0-windows-amd64.zip -OutFile work/tools/k6.zip
Expand-Archive work/tools/k6.zip -DestinationPath work/tools/k6 -Force
node benchmarks/k6/backend.cjs
```

In another terminal, from the same repository root:

```powershell
node benchmarks/k6/run.cjs
```

To select a subset or retain another run:

```powershell
$env:RESULT_PREFIX='repeat'
$env:MODES='discovery-uncached,availability'
$env:LEVELS='10,50,100,200'
$env:CONFLICTS='false'
node benchmarks/k6/run.cjs
```

`K6_PATH` overrides the executable. Each test is also independently runnable from `benchmarks/k6` with `k6 run -e MODE=booking -e VUS=50 load.js` or `k6 run -e VUS=200 -e RUN_DAY=60 conflicts.js`. Clear the tested future booking dates before repeating a booking or contention test. The runner handles that cleanup and refuses a database without the `_bench` suffix in seeding. Do not reuse these tools with any non-disposable database.

## Reproduce the controlled cache-expiry comparison

Stop the API and restart it before **each** controlled run to guarantee a fresh cache. Use the same settings for both revisions:

```powershell
$env:LEVELS='200'
$env:MODES='discovery-cached'
$env:CONFLICTS='false'
$env:PRIME_EXPIRY='true'
$env:RESULT_PREFIX='controlled-repeat'
node benchmarks/k6/run.cjs
```

This primes the exact query and waits 30 seconds before k6 begins. The cache expires during the 20-second measurement, after the 5-second warm-up. `results/providerController.before.js` preserves the original audited controller, and `results/optimization.patch` records the complete optimization and tests. In a disposable copy of the repository, replace only `server/controllers/providerController.js` with that saved pre-change file to reproduce the before case; restart the API and use a different `RESULT_PREFIX` for the after case. Do not overwrite a working checkout containing unsaved work.

The original complete survey used `node benchmarks/k6/run.cjs` before the optimization. The after matrix used `MODES=discovery-cached`, `RESULT_PREFIX=after-matrix`, `CONFLICTS=false`, with no `PRIME_EXPIRY`. Regenerate the combined tables with `node benchmarks/k6/summarize.cjs`.

## Correctness commands used

```powershell
$env:MATCHING_DATABASE_TEST='1'
$env:BOOKING_TEST_DATABASE_URL='postgresql://taskgenie_bench:local_bench_only@127.0.0.1:5544/taskgenie_bench'
$env:CHAT_TEST_DATABASE_URL=$env:BOOKING_TEST_DATABASE_URL
node --require ./benchmarks/k6/config.cjs --test --test-concurrency=2 server/test/*.test.js
node --require ./benchmarks/k6/config.cjs server/scripts/verifyEngineering.js --output benchmarks/k6/results/correctness
```

All-server run: 178 passed, zero failed/skipped. Focused engineering run: 45 backend and 5 client-state tests passed. The focused run's gateway/email are controlled doubles; its 50-way COD and online contention rounds deliberately disable Redis admission to test PostgreSQL protection.

## Conditions and interpretation

- Single native Windows Node.js API, native Windows k6, Docker Desktop PostgreSQL 15/PostGIS 3.4 and Redis 7. Database limited to 2 CPUs/2 GiB; Redis to 1 CPU/256 MiB. API pool maximum 20. Hardware, versions and revision are saved in `results/*/host.json`; exact seed counts and database indexes in `results/conditions.json`.
- Synthetic 10,000 approved providers (2,000 within 50 km of the query), 200 customers, 10,000 provider-service associations, 70,000 weekly rules, 50,000 completed historical bookings. One service is used to keep comparisons consistent; the fixture is not a production distribution.
- Real Express routing, JWT verification, Joi validation, PostgreSQL queries/transactions/constraints, Redis admission locks, booking and notification inserts. Pre-signed customer/provider JWTs keep login/password hashing outside endpoint measurements.
- `NODE_ENV=test` and `x-test-bypass-ratelimit: 1` bypass the existing 300 requests/15 minutes global and 25 bookings/5 minutes per-IP quotas. This is endpoint capacity, not public deployment throughput. Socket.IO uses its single-process adapter and BullMQ uses the built-in volatile fallback in this mode; no distributed queue durability or multi-replica throughput is claimed.
- Closed-loop constant VUs at 10/50/100/200, no think time, 5 seconds warm-up followed by a fixed 20-second completion-count window. RPS is `measured_requests.count / 20`, excluding warm-up and drain. p50/p95/p99 are k6 `http_req_duration` samples for requests completed inside that window; they exclude connect/block time. Failed HTTP responses remain included in percentiles and have a separately reported failure rate.
- `discovery-uncached`: unique recognized latitude values defeat the actual cache. `discovery-cached`: repeated identical searches exercise the real 45-second L1 cache, including expiry/stampede when it occurs. `availability`: a date/start-time filter bypasses result caching and validates the top 20 providers. All search responses must contain 20 nearby providers; availability results must be marked available.
- `booking`: every iteration inserts a fresh COD reservation for a separate provider/date; no idempotency replay is counted as a successful booking. Both schedule checks, transaction/advisory lock, exclusion constraint and two notification inserts execute. The endpoint returns `pending`, not `confirmed`. Tests use colocated booking coordinates and distinct dates, so external OSRM routing and Razorpay checkout are outside these latency measurements.
- `conflicts`: five timed waves per load, mixing 10:00 and 10:30 starts for the same two-hour service and provider/day. Expected HTTP 409 conflicts are counted separately from unexpected errors. Each winner is confirmed through the real provider-authorized API. SQL then asserts exactly one row and one confirmed winner per wave and zero overlapping active reservations across the database. RPS for these finite bursts is not a sustained capacity measure.
- Normal k6 `http_req_failed` treats HTTP 409 as expected only in the contention requests, using Grafana's documented `expectedStatuses(201,409)`. Custom unexpected-failure metrics and strict winner-count thresholds still catch errors.
- The runner saves JSON summaries, complete console logs, SQL statement execution aggregates and telemetry samples per run. Pool gauges in the initial run are last refreshed by readiness and are not used as live queue-size evidence. SQL timings and actual connection-timeout responses support the capacity diagnosis.
- Keep the host otherwise idle for comparisons. Background applications and other pre-existing Docker containers share this developer laptop; local measurements do not establish production capacity, Internet latency or external payment delivery.

## Source references

[Grafana expected statuses](https://grafana.com/docs/k6/latest/javascript-api/k6-http/expected-statuses/), [summary percentiles](https://grafana.com/docs/k6/latest/get-started/results-output/).
