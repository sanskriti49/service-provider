# Booking and payment integrity

## Invariants

For reproducible measurements, lock/constraint explanations and interview
boundaries, see [ENGINEERING.md](ENGINEERING.md). The actor transition table is in
[STATE_MACHINE.md](STATE_MACHINE.md); deployment procedures are in [OPERATIONS.md](OPERATIONS.md).

- Booking creation takes a PostgreSQL transaction advisory lock for provider/date before schedule and conflict checks. Redis is an optional fail-fast optimization.
- Duration and price come from the selected service. Providers must be approved, offer the visible service, and publish a working interval. A booking needs 45 minutes lead time; marketplace times use Asia/Kolkata.
- Online bookings retain a five-minute hold. Expired or cancelled intents remain in PostgreSQL; captured late payments request a full refund and never reacquire a slot.
- Callback and webhook finalization share a service, provider/date lock, booking row lock, stored-order binding and unique payment identifiers. Gateway amount, currency and captured state must match. Test keys still require real signatures; there is no simulated-payment bypass.
- Provider transitions are pending -> confirmed/booked -> in_progress -> completed. Arrival and completion use independent codes. Customer cancellation and timed no-show rules remain; completed/cancelled/expired/no_show states cannot be revived. Admin overrides are limited to cancellation.
- Only the owning customer receives codes. Bulk provider/admin lists and status responses use the shared serializer.
- Address changes require coordinates and repeat travel-conflict checks while holding the scheduling lock.
- COD completion records paid; cancellation of unpaid COD does not claim a refund.

## Refunds and recovery

Refund intent insertion and booking cancellation are one database transaction. The intent stores amount in paise, payment ID and a unique request key. No gateway I/O occurs inside a refund database transaction.

The reconciler claims submission through an atomic pending -> submitting update. Only the winner sends the refund. A receipt equal to the intent UUID identifies the gateway result. Gateway processed confirmation produces refunded/partially_refunded; pending/failed outcomes produce refund_pending/refund_failed.

If a submission response is lost, subsequent runs search gateway refunds by receipt. They do **not** submit again when the outcome is uncertain. An intent with unknown/failed state needs reconciliation or operator review in the Razorpay dashboard. There is deliberately no promise of exactly-once network delivery. Do not manually reset unknown to pending without verifying that no refund exists.

Configured API processes reconcile every 30 seconds without overlapping local runs. Atomic claims and booking locks protect multiple API processes. Pending order scans rotate using last_payment_check_at. Offline payments and gateway outages preserve intents for later runs.

Manual recovery:

```powershell
npm run reconcile:payments --prefix server
```

This command contacts the configured payment gateway. Configure RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET and a separate RAZORPAY_WEBHOOK_SECRET. Disable the recurring scanner with PAYMENT_RECONCILIATION_ENABLED=false if operating it separately. Refunds created/processed/failed webhooks trigger authoritative reconciliation too.

## Migration

Existing installations, before starting the updated API:

```powershell
npm run migrate:integrity --prefix server
```

Fresh databases use npm run migrate --prefix server, which includes the integrity migration. PostgreSQL needs the btree_gist extension; PostGIS is optional.

The integrity migration is atomic and repeatable. It retains records and adds exact numeric prices, hold timestamps, foreign keys, allowed-state/time/amount checks, unique payment/order IDs, unique availability intervals and a database exclusion constraint for active/COD reservations. Online pending holds are enforced under the advisory lock because expiration cannot appear in an immutable exclusion predicate.

Duplicate payment IDs, duplicate intervals/reviews, or overlapping active legacy bookings stop the migration. Resolve them explicitly; the migration never deletes them. Historical foreign-key/check constraints are initially NOT VALID: new writes are checked, but old rows still need validation after a data audit. Do not describe historical data as validated merely because the migration succeeded.

```powershell
npm run validate:integrity --prefix server
```

Legacy synthetic orders/payments must be reviewed against gateway records. Reconciliation intentionally refuses fabricated recovery.

## Regression tests

Normal npm test is offline by default. Account, booking and chat database tests opt in explicitly. Account tests create a fresh UUID fixture and delete only their own records; they never select an existing customer.

On a dedicated disposable PostgreSQL database:

```powershell
$env:BOOKING_TEST_DATABASE_URL='postgresql://postgres:password@localhost:5432/taskgenie_test'
node --test server/test/bookingIntegrity.integration.test.js
```

The booking suite creates/removes a unique schema, uses actual controllers and the actual integrity migration, and stubs gateway/notification delivery. It checks races, signatures, ownership, late capture, terminal states, lost refund responses and database rejection of invalid writes. No real payment is made. ACCOUNT_TEST_DATABASE_URL and CHAT_TEST_DATABASE_URL separately enable those suites; account tests require the base schema.

Actual gateway sandbox delivery, deployed secrets and legacy-data validation still require deployment-specific verification.
