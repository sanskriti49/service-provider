# TaskGenie engineering evidence and interview guide

TaskGenie's strongest claim is booking correctness under contention, with payment
and chat recovery. These are bounded guarantees, not a claim of production scale.

## Reproduce the evidence

Use Node 22 and a **disposable PostgreSQL database** with permission to create
schemas and install `btree_gist`. Never point test URLs at the application DB.
Each database suite creates a random schema and deletes only that schema.
Gateways and notifications are fixtures: no money, email or SMS is sent.

```powershell
npm ci --prefix server
npm ci --prefix client
$env:BOOKING_TEST_DATABASE_URL = 'postgresql://postgres:fixture-only@127.0.0.1:5432/taskgenie_test'
$env:CHAT_TEST_DATABASE_URL = $env:BOOKING_TEST_DATABASE_URL
npm run verify:engineering
# Browser tests use Chromium installed by Playwright:
npx --prefix client playwright install chromium
npm run verify:engineering -- --browser
# Alternatively use an installed Chrome for local verification:
$env:TASKGENIE_BROWSER_CHANNEL = 'chrome'
npm run verify:engineering -- --browser
```

The command fails if database URLs are missing, a suite fails, or any selected
test is skipped. `work/engineering-evidence/` contains TAP logs, a verification
manifest and `concurrency.json`. `--output docs/evidence` publishes a snapshot
inside the repository; review it before committing. Revision and dirty-worktree
status identify the source conditions. CI runs the same command with browser
verification and uploads the evidence, including failure logs.

### What is measured

Two rounds issue 50 concurrent loopback HTTP requests against one provider and
one interval: COD and online. The actual JWT middleware, Express routes,
controller, schedule validation, transactions and migrations run against real
PostgreSQL, with a 10-connection pool. Each round asserts:

| Accepted (201) | Conflicts (409) | Unexpected responses | Persisted reservations |
| --- | --- | --- | --- |
| 1 | 49 | 0 | 1 |

Redis admission and the booking rate limiter are deliberately bypassed, so
neither can hide missing database protection. Payment orders and delivery are
stubbed. Timing includes Node scheduling and pool queuing on the test machine.
This is a correctness experiment, not a requests-per-second capacity claim.

### Correctness cases

- Concurrent payment finalization applies one capture; different amounts fail.
- Signed webhook before browser callback and eight repeated webhooks preserve
  one activation and one pair of notification calls in the fixture.
- Late capture after an expired hold, with a replacement booking, records a
  refund intent without stealing the replacement's slot.
- A finalizer starts while a hold is valid, waits on an actual PostgreSQL advisory
  lock, and resumes after expiry: it refunds rather than activates.
- A second regression holds only the booking row (as chat does); expiry is
  evaluated in a separate statement after acquiring that row, not in a projection
  that PostgreSQL may evaluate before its row-lock wait ends.
- Lost refund response reconciles a discovered receipt without a second refund.
- If no receipt can be discovered after a submission timeout, repeated runs leave
  `unknown` and do not blindly submit again. Pending/failed gateway outcomes never
  report the booking as refunded.
- Direct database writes reject invalid times/states, duplicate payment IDs and
  overlapping active reservations.
- Chat authorization, simultaneous retries, missed pushes, reconnect replay,
  bounded read receipts and rollback are exercised with PostgreSQL and Socket.IO.
- Optional browser tests exercise two roles, offline sending, same-UUID retry,
  replay of 55 missed messages across multiple pages, reload, and safe rendering.

## Why both an advisory lock and an exclusion constraint?

The **transaction advisory lock** serializes cooperating operations for one
provider/day, including creation, capture, status transitions and address edits.
Under the lock we check temporary holds, published hours and travel buffers.
Locks live in PostgreSQL and release on commit/rollback, even across API replicas.
The current 32-bit hash can collide and unnecessarily serialize unrelated keys;
collisions reduce concurrency rather than bypass correctness. Redis only rejects
some competing requests earlier; its expiry or outage cannot replace this lock.

The **exclusion constraint** is the last defence for overlapping active intervals,
including writes that bypass the API. It uses half-open `[start,end)` intervals.
It protects `booked`, `confirmed`, `in_progress`, and pending COD rows. It does
**not** enforce working hours, travel buffers, or pending online holds.

An online hold expires with time. An index/constraint predicate cannot safely
change its membership simply because the clock advances, so pending online rows
are excluded from this constraint. They require the application lock/check
protocol. A direct SQL writer can violate that protocol; restrict DB writers and
use the shared service. Activation still meets the exclusion constraint.

Expiry checks use `clock_timestamp()`, not `NOW()`: `NOW()` is fixed at transaction
start, which is wrong after waiting past a hold's deadline. Hold validity is read
after both locks have been acquired, in a separate query. A five-minute hold is
created from the insert-time database clock. The scanner eventually labels stale
rows `expired`; the reservation check stops counting them immediately at expiry.

## How to explain payment recovery

"Browser callbacks, webhooks and the scanner converge on one finalizer. It locks
the provider/day and booking, verifies stored order, currency, amount and capture,
and records the payment ID. A repeated ID is a no-op; a different ID is rejected.
Expired or cancelled intents never reactivate. Their capture and refund intent
commit together. Refund submission happens outside the transaction. An atomic
claim permits one submitter. After a timeout, reconciliation searches by receipt;
an ambiguous result requires review, not another money-moving call."

The receipt is a reconciliation key, **not** a guarantee that the gateway deduplicates
refund requests. Database intent idempotency is not exactly-once network delivery.

## How to explain chat recovery

"Persist first, push after commit. Every send carries a client UUID and the
database uniquely keys booking/sender/UUID. A retry returns the original message;
different text with the same key is rejected. Reconnection pages history after
the last fully synchronized ID, and merges pushes by persisted ID. Live pushes
never advance the replay cursor past unseen history."

The browser has HTTP fallback after a lost Socket.IO acknowledgement and a manual
same-UUID retry after failure. Pending drafts/sends survive panel remount, but are
not a durable browser outbox across page reload. No such promise is made.
Multiple API replicas need a Socket.IO adapter for immediate cross-replica pushes;
the persisted replay/focus refresh still recovers history. See [chat contract](../server/CHAT.md).

## Remaining boundaries

- Real Razorpay test-mode callbacks/webhooks/refunds and EC2 operation require a
  separate deployment exercise. Fixture success is not payment certification.
- Gateway order creation currently happens while the scheduling transaction is
  held, with a timeout. A successful order followed by a DB failure can leave an
  unused gateway order; it does not create a confirmed booking. API booking
  creation itself has no client idempotency key across a lost HTTP response.
- Booking notifications are best effort after commit; no transactional outbox
  couples them to booking state. Redis-backed BullMQ retries can repeat delivery;
  in-memory jobs disappear on restart. No separate durable application DLQ exists.
- Local tests do not prove distributed deployment health or production capacity.
- Existing historical constraints marked `NOT VALID` need an explicit data audit.

See [state machine](STATE_MACHINE.md), [operations](OPERATIONS.md), and
[integrity migration details](BOOKING_INTEGRITY.md).
