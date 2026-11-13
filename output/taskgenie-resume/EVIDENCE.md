# TaskGenie audit and resume evidence — 21 October 2026

Only TaskGenie project wording was rewritten. Udaan and every other section's text and links are unchanged. The user separately approved removing three unmatched list-closing commands and adjusting vertical spacing. Fonts, font sizes, margins and line spacing were preserved.

## Deliverables

- `main.tex`: final editable LaTeX; `main.pdf`: compiled with local pdfLaTeX (TeX Live 2026).
- `validation.json`, `resume-text.txt`, `preview.png`: one-page, text/link and visual verification.
- `provided-original.tex`: normalized copy of the pasted source, including its original list syntax errors. `syntax-repaired-baseline.tex`: approved syntax fixes with original bullets. `wording-only-preserved-format.tex`: the first four-bullet draft at the original two-page spacing, retained for comparison.
- [k6 scripts and commands](../../benchmarks/k6/README.md), [complete actual results](../../benchmarks/k6/results/RESULTS.md), and raw per-run JSON/console/SQL diagnostics in `benchmarks/k6/results/`.

## Four final bullets and their evidence

| Claim | Implementation | Executed evidence |
|---|---|---|
| Booking concurrency | [64-bit lock](C:/Users/sansk/Downloads/service-provider/server/utils/bookingLifecycle.js:59), [exclusion constraint](C:/Users/sansk/Downloads/service-provider/server/migrations/20261011_booking_integrity.sql:42) | [200-user k6 summary](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/baseline/conflicts-200.json), [database invariant](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/baseline/conflicts-200.database.json) |
| Cached discovery performance | [Shared fill](C:/Users/sansk/Downloads/service-provider/server/controllers/providerController.js:452) | [Before](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/controlled-before/discovery-cached-200.json), [after](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/controlled-after/discovery-cached-200.json) |
| Payment integrity | [Verification/finalization/refunds](C:/Users/sansk/Downloads/service-provider/server/services/paymentService.js:4) | [Executed integration tests](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/correctness/backend.tap) |
| Persistent authorized chat | [Chat persistence and cursors](C:/Users/sansk/Downloads/service-provider/server/utils/chatService.js:35) | [Server tests](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/all-server.tap), [client state](C:/Users/sansk/Downloads/service-provider/benchmarks/k6/results/correctness/client-state.tap) |

1. **Prevented overlapping bookings with 64-bit PostgreSQL advisory locks and GiST exclusion constraints; verified zero overlaps in five 200-user k6 contention waves.**

   `server/utils/bookingLifecycle.js:59` defines `pg_advisory_xact_lock(hashtextextended(...,0))` per provider/day; booking creation checks the schedule again inside its transaction (`server/controllers/bookingController.js:124`). `server/migrations/20261011_booking_integrity.sql:42` excludes intersecting `[start,end)` ranges for booked/confirmed/in-progress reservations and pending COD bookings. Online pending holds instead use advisory locking and wall-clock expiry; the exclusion predicate does not cover expiring online holds.

   Actual k6 result: `baseline/conflicts-200.json` records 1,000 creation attempts across five 200-VU waves, 5 successful creations, 995 expected HTTP 409 responses, 5 API-confirmed winners, and zero unexpected failures. `baseline/conflicts-200.database.json` independently asserts one confirmed row per tested day and zero active overlap pairs. 10/50/100-VU levels also passed. Existing PostgreSQL integration tests additionally reject a direct overlapping insert with SQLSTATE `23P01` and exercise 50 concurrent COD/online attempts with Redis admission disabled. Payment gateway calls in those online correctness tests are controlled fixtures.

2. **Coalesced concurrent PostGIS searches to prevent cache stampedes; served 856 cached requests/s at 289 ms p95 with 200 local k6 users over 10,000 synthetic providers.**

   `server/controllers/providerController.js:452` now shares one in-flight database fill for identical undated discovery keys, releases it after success/failure and leaves dated availability reads independent. Three meaningful regression cases cover 100 simultaneous callers, failure/retry, and independent location/date queries. Existing PostGIS `ST_DWithin` selection and GiST index remain unchanged.

   Controlled cache-expiry run, before → after: **504.95 → 855.70 RPS**, **819.22 → 288.67 ms p95**, **5,247.48 → 311.37 ms p99**, **0.9308% → 0% unexpected failures**. Measured completions: 10,099 before (94 server errors), 17,114 after (zero server errors). SQL diagnostics show **106 → 1 discovery SQL executions** during the respective k6 runs. Both use the same 200-VU script, fresh API cache, 30-second cache aging, 5-second warm-up, 20-second measurement, dataset, pool and resource limits. Resume numbers are rounded from the after JSON, not estimated.

   A separate after matrix passed at 10/50/100/200 VUs, with zero unexpected errors at every level. Its 200-VU result was 755.10 RPS / 384.64 ms p95, demonstrating run-to-run variation. The resume cites the controlled comparison and explicitly qualifies **cached**, **local**, and **synthetic**; it does not imply a production capacity guarantee or uncached query speed.

3. **Secured Razorpay checkout with HMAC-SHA256 verification, captured-payment validation, and idempotent finalization; added durable refund intents and reconciliation.**

   `server/services/paymentService.js:4` checks HMAC signatures with `timingSafeEqual`; `:80` verifies checkout ownership and fetches gateway payment state; `:31` locks the booking, validates stored order/INR amount/captured state, and safely recognizes repeated finalization. The raw request bytes are captured by `server/index.js:99` and checked by `server/controllers/bookingController.js:371` for webhooks. Unique order/payment indexes are in the integrity migration. Refund intents are persisted in `booking_refunds` (`:48`); reconciliation matches gateway receipts after uncertain responses before considering another submission (`paymentService.js:107`). Late/expired captures do not reclaim a slot and create a refund intent instead.

   The actual PostgreSQL integration suite passed concurrent capture, forged callback/webhook, missed callback, expired hold and uncertain refund cases. The gateway is simulated in those tests. No live Razorpay capture, webhook delivery or refund settlement was performed; this bullet claims implemented mechanisms.

4. **Built persistent, booking-scoped Socket.IO chat with participant authorization, client message deduplication, and cursor-based replay to recover messages after reconnects.**

   `server/utils/chatService.js:35` authorizes participants and serializes booking writes; `:77` provides cursor history, and `:100` persists sends with `(booking_id,sender_id,client_message_id)` deduplication. `server/migrations/20261010_booking_chat.sql:2` defines storage, the unique key, and history/unread indexes. Socket authentication/expiry and request limits are in `server/utils/socket.js`; `client/src/chat/useConversation.js:50` replays `after` a retained cursor on reconnect and `chatTransport.js` retains the client UUID across safe HTTP fallback. Real PostgreSQL chat integration and client-state tests passed.

   This is persistence/replay and application deduplication. It does not claim guaranteed exactly-once Socket.IO transport delivery or verified multi-replica operation.

## Existing resume claims audited

| Original claim | Verdict and disposition |
|---|---|
| 64-bit advisory locks plus GiST constraints | Confirmed in implementation and database. Wording now states the bounded k6 evidence. A hash reduces collision probability; it is not mathematically collision-free. |
| Zero overlaps across 50 concurrent checkouts | Independently re-executed existing database test: 1 accepted / 49 conflicts / 0 errors / 1 committed per COD and simulated-online round. Replaced by the stronger, actual five-wave 200-VU k6 result. |
| 50 km discovery in approximately 82 ms query time | No retained reproducible benchmark establishes that historical number. Removed. Current endpoint measurements include database, Node processing and HTTP transfer and are not interchangeable with SQL execution time. |
| PostGIS spatial indexing and travel buffers | Confirmed. Discovery uses indexed proximity candidates; availability/booking checks separately enforce service duration, working intervals, lead time and directional travel buffers. Dynamic travel validation is not part of the simple undated search query. |
| Opossum circuit breaker, raw-body HMAC-SHA256 | Confirmed (`bookingController.js:16`, `paymentService.js:4`, webhook handler). Breaker configuration exists; real gateway outage behavior was not benchmarked. |
| SHA-256 hashing prevents duplicate capture and replay attacks | Overbroad. Hashing derives booking IDs for non-UUID idempotency keys. Captured-payment finalization instead relies on ownership, signed identifiers, stored order/amount checks, locks and unique IDs. No general replay-attack prevention claim retained. |
| Socket.IO, Redis pub/sub and BullMQ pipeline | Implemented. Chat persistence, Redis socket adapter/cache invalidation, and queue handlers are separate mechanisms. In-memory fallback is volatile; retained failed BullMQ jobs are not a separately implemented application DLQ. No guaranteed notification-delivery claim retained. |
| Dockerized backend | Confirmed multi-stage Dockerfile, non-root runtime and health check. This test ran the API natively and database/Redis in Docker; a production API image was not deployed. |
| Deployed to AWS EC2 | Not verified from current runtime or code. Sandbox compose/seed/runbooks and Terraform describe deployment intent; they do not prove an EC2 deployment. Removed from TaskGenie bullets. The existing technology heading and links were preserved as instructed. |

## Architecture, APIs and remaining bottlenecks

The actual API is Express/Node.js with a 20-connection PostgreSQL pool; normalized users/providers/services/provider-services tables, weekly availability and date overrides, transactional bookings, refund intents, chat and notifications. GiST geography indexes support spatial candidates; provider/day and customer indexes support schedules and history. NUMERIC prices and integer paise checks support monetary consistency. API mutation routes use JWTs, role/ownership checks and Joi validation; provider management restricts ownership. The public discovery route is **`GET /api/providers/v1`**, booking creation **`POST /api/bookings`**, confirmation **`PUT /api/bookings/:booking_id/status`**, payment verification **`POST /api/bookings/verify-payment`**, and gateway callback **`POST /api/bookings/webhook`**. Redis NX/PX admission with token-safe Lua release is an optimization; PostgreSQL is the booking correctness boundary.

The initial complete survey measured all four throughput workloads at 10/50/100/200 VUs. **Uncached discovery still saturates**: 23.90 RPS / 576.92 ms p95 at 10 VUs, with 5.45% and 36.73% server-error rates at 100/200 VUs. **Dated availability is more expensive**, issuing service/schedule queries for batches of candidates: 100/200-VU survey runs had 29.70%/100% unexpected failures. Database connection-acquisition timeouts are actual HTTP 500 responses, not legitimate booking conflicts. SQL diagnostics and EXPLAIN show 2,000 nearby rows fetched and processed before returning 20. Coalescing fixes identical hot-key fan-out; distinct-location query work and dated fan-out remain unresolved. Further work would require preserving exact radius/ranking/average-price and availability semantics while reducing SQL work, and validating request admission/backpressure.

All booking load levels returned valid new COD reservations with zero measured errors; the 200-VU survey result was 57.80 RPS / 6,682.45 ms p95. These are initial survey values, not a clean before/after booking optimization comparison. Saturated availability handlers can continue after a load generator stops waiting, and background compiler/tool preparation also occurred during the initial survey; use the separate controlled runs for the causal cache comparison. No booking throughput metric is used in the resume.

Source-level operational boundaries: cloud PostgreSQL TLS sets `rejectUnauthorized:false`; `/metrics` is unauthenticated; queue fallback is explicitly volatile; cache-hit discovery returns before setting pagination headers. These prevent broad claims about hardened production infrastructure, durable fallback or universally preserved pagination metadata. They were documented without unrelated code changes. Terraform also declares SQS resources, but that alone does not establish an application SQS delivery pipeline.

## Actual validation and conditions

- **Grafana k6 v2.3.0 actually executed** as a native Windows executable. 26 retained full/controlled/matrix runs, plus separately labeled smoke checks.
- Native Node v22.22.0 API and k6; Docker Desktop Postgres 15.8/PostGIS 3.4, Redis 7. Database 2 CPUs/2 GiB; Redis 1 CPU/256 MiB. Laptop: i5-1135G7, 8 logical processors, approximately 16 GiB RAM. Other existing applications/containers shared the host and were not stopped.
- Seed: 10,000 approved providers, 200 customers, 10,000 service associations, 70,000 weekly availability rules, 50,000 completed historical bookings. 2,000 providers are within the 50 km search. This is a synthetic single-service fixture.
- `NODE_ENV=test` enables the existing per-IP rate-limit bypass; actual JWT/Joi/SQL/Redis locking execute. Socket adapter is single-process and queue fallback is in-memory. No live payment credentials are read. Booking timings use COD and one new provider/date per request with colocated coordinates; OSRM external route latency, login/password hashing, Razorpay, cloud networking and real email delivery are outside the claimed benchmark.
- **178 server tests passed**, zero failures/skips, including opted-in actual PostgreSQL/PostGIS integration. Focused engineering verification also passed 45 backend and 5 client-state checks; these overlap the full server suite and should not be added to it as distinct backend tests.
- PDF verified visually and through extracted text: **1 page, 4 TaskGenie bullets, 8 rendered bullet lines, 8 preserved link destinations**, no replacement characters or content clipping. Source comparison permits exactly the TaskGenie bullet region, three approved syntax removals and three vertical-spacing declarations. No external ATS service was tested.

## Reproduce the PDF

From the repository root with pdfLaTeX and the original packages available:

```powershell
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=output/taskgenie-resume output/taskgenie-resume/main.tex
python output/taskgenie-resume/validate_resume.py
```

The validation script requires PyMuPDF. The bundled Python runtime was used for this run. The app's compiler reported that Windows sandbox setup was incomplete, so the delivered PDF was compiled using an isolated local TinyTeX/pdfLaTeX installation under ignored `work/tools/` instead.
