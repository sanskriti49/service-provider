# Sandbox deployment and recovery

This runbook describes operating the existing single API deployment. A Dockerfile
or Terraform plan does not prove that EC2, TLS, backup or real gateway delivery has
been exercised. Record those separately after an actual sandbox drill.

## Configuration and access

Use `server/.env.example` as the inventory. Keep `.env` out of Git and images
(the Docker ignore files exclude it). Inject runtime values via a secret manager
or a restricted environment file outside the checkout. Do not paste secrets,
JWTs, OTPs, addresses or payment payloads into screenshots or reports.

Required: PostgreSQL settings and a strong random `JWT_SECRET`. For online
payments set Razorpay **test-mode** key ID/secret plus a separate webhook secret;
subscribe the dashboard webhook to `/api/bookings/webhook`. Signature verification
uses the exact raw JSON bytes before parsing. Use HTTPS for gateway callbacks.
Email, cloud storage and Redis have their own configuration; blank values do not
prove those integrations work. Set `CLIENT_URL`/`FRONTEND_URL` explicitly.

Use an EC2 IAM role for AWS access rather than long-lived access keys. Keep
PostgreSQL/Redis and `/metrics` private. Restrict inbound access to HTTPS and
administrative access to an approved route. The current local compose file exposes
DB/Redis/LocalStack ports and uses test credentials: it is a local emulator setup,
not the production security configuration. Do not deploy it unchanged publicly.

The current DB connector disables certificate verification for its cloud SSL mode.
Do not claim verified database TLS from that setting. Before a public deployment,
configure the provider's CA verification and test it with that database. Current
CORS also accepts Vercel subdomains and local/private origins; restrict deployment
origins if you require a strict public origin allowlist. JWT authorization remains
the access boundary; CORS is not authorization.

## Migrate before starting the API

Take a backup, stop booking writers, and confirm the target environment. Existing DB:

```powershell
npm run migrate:integrity --prefix server
npm run migrate:chat --prefix server
```

Fresh DB uses `npm run migrate --prefix server` and `npm run migrate:chat --prefix
server`. The integrity migration requires `btree_gist`; do not delete conflicting
legacy records to force it through. Resolve overlaps/duplicate payment IDs with
an explicit audit. Migration success checks new writes but does not validate every
historical row. After reviewing historical issues:

```powershell
npm run validate:integrity --prefix server
```

For a sandbox API image, from the repository root:

```powershell
docker build -t taskgenie-api:sandbox ./server
# Create /secure/taskgenie-api.env outside the repository on the deployment host.
docker run -d --name taskgenie-api --restart unless-stopped --env-file /secure/taskgenie-api.env -p 127.0.0.1:5000:5000 taskgenie-api:sandbox
```

Put an HTTPS reverse proxy in front of loopback port 5000. The API Dockerfile sets
`PORT=5000` and runs as `node`; its health check uses liveness. A custom port must
also update the container health check. Never put payment secrets in Vite's public
`VITE_*` variables. The browser's API URL is public and should use the HTTPS API.

## Probes and logs

- `/health/live`: process responds; it does not check dependencies.
- `/health/ready`: PostgreSQL SELECT with a two-second query timeout, plus the
  pool's connection-acquisition timeout. Returns 503 if the DB check fails. Error
  responses omit driver details. Queue fallback is reported as `volatile-fallback`
  rather than pretending the queue is durable.
- `eventQueue.engine=bullmq`: Redis-backed mode is configured; this is not an
  end-to-end delivery check. Counts are process counters, not a complete Redis
  backlog or payment-worker health check.
- `/health`: compatibility process probe; use `/health/ready` for DB readiness.
- `/metrics`: HTTP latency/status, booking transitions, pool and queue counters.
  Keep it accessible only to the monitoring network.

Inspect logs with `docker logs --since 15m taskgenie-api`. Watch 5xx/conflict
rates, DB pool waits, reconciliation failures and queue retries. Payment provider
error messages may include external identifiers; restrict log access and retention.
Do not interpret a green liveness probe as proof that payment reconciliation works.

## Payment/refund incident procedure

1. Read booking/order/payment identifiers from authorized tools. Compare gateway
   test dashboard status, stored booking state, and `booking_refunds` intent.
2. Correct credentials/connectivity first. The API scanner runs every 30 seconds
   when configured and locally avoids overlapping runs; DB locks/claims protect
   concurrent processes. If scheduling it separately, disable the API scanner with
   `PAYMENT_RECONCILIATION_ENABLED=false`.
3. `npm run reconcile:payments --prefix server` contacts the configured gateway
   and can submit pending refunds. It is an operational command, not an offline
   test. Confirm test/live environment before running it.
4. For `submitting`/`unknown`, search the gateway by intent receipt UUID and
   payment ID. Reconcile a discovered result. **Never reset unknown to pending or
   call refund again solely because an HTTP response was lost.**
5. A failed refund is not automatically resubmitted. Review it in the gateway
   dashboard with the configured account. Record resolution and reconcile.

Read-only inspection, through a restricted PostgreSQL session:

```sql
SELECT state, count(*) FROM booking_refunds GROUP BY state;
SELECT id, booking_id, state, gateway_refund_id, updated_at
FROM booking_refunds WHERE state IN ('submitting','unknown','failed')
ORDER BY updated_at;
```

If Redis is unavailable, booking DB correctness remains enforced. Notification
fallback is volatile; restart can lose pending jobs. There is no transactional
notification outbox and no separate application DLQ. Do not promise lossless
notifications or re-run external sends without considering duplicates.

## Backup and restore drill

Use PostgreSQL client tools compatible with the server. Supply PGHOST, PGPORT,
PGDATABASE, PGUSER and a restricted `.pgpass`/PGPASSFILE outside Git. Avoid passwords
in CLI arguments. In PowerShell, verify every native command's exit code:

```powershell
$taskgenieBackup = Join-Path $env:TEMP ('taskgenie-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump')
pg_dump --format=custom --no-owner --no-acl --file "$taskgenieBackup"
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
pg_restore --list "$taskgenieBackup"
if ($LASTEXITCODE -ne 0) { throw 'Archive validation failed' }
# Use a new, isolated database name; do not restore over the application DB.
createdb taskgenie_restore_drill
if ($LASTEXITCODE -ne 0) { throw 'Restore DB creation failed' }
pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname taskgenie_restore_drill "$taskgenieBackup"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
```

Listing an archive is not a restore test. After restore, compare row counts,
payment identifiers, constraints and a read-only booking/chat sample with the
source. To test the restored API, use a separate environment with payment scanner
disabled and no email, storage or payment credentials. A restored database alone
does not restore Redis jobs or S3/Cloudinary assets. Back up assets independently;
encrypt and restrict backups because they contain personal data.

The evidence tests do not back up or restore your application data. Record a
deployment restore drill separately before claiming tested disaster recovery.

## Rollback and sandbox verification record

Keep the previous image and a verified backup. The integrity migration adds
columns/constraints without deleting records; an older writer may no longer meet
the stricter constraints. Validate compatibility before switching images. Do not
drop constraints blindly to make rollback work. Stop reconciliation/writers before
restoring a snapshot and reconcile any gateway events occurring since the backup.

Record commit/image, environment, migration result, readiness, browser booking and
chat check, signed real test-mode payment/webhook/refund results, and backup/restore
duration. Mark each untested item **not verified**. The current local evidence
does not certify EC2 deployment or real payment delivery.
