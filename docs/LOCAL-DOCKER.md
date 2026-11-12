# Local Docker stack

This stack uses synthetic local credentials and isolated PostgreSQL and Redis
volumes. It does not read the application's existing `.env` files into the
containers. The API and data services use an internal Docker network; the
frontend and mail viewer also use an edge network for loopback port publishing.
Online payments are unconfigured,
and the development SMTP transport sends to the local Mailpit container. Use
only synthetic data. This setup is for local development.

From the repository root, with Docker running:

```powershell
docker compose -p taskgenie-local -f docker-compose.local.yml up -d --build
docker compose -p taskgenie-local -f docker-compose.local.yml ps --all
docker compose -p taskgenie-local -f docker-compose.local.yml logs --tail=100 migrate api
```

Open `http://localhost:18080` for the application and
`http://localhost:18025` for captured email. PostgreSQL must become healthy
before the one-shot migration runs. It includes the notification outbox schema.
The API starts after migration succeeds and Redis is healthy. The frontend waits
for API readiness. To rerun the migration deliberately after a schema update:

```powershell
docker compose -p taskgenie-local -f docker-compose.local.yml run --rm migrate
```

To exercise a cash-on-delivery booking, cancellation, and email dispatch through
Nginx and the worker, run the following from PowerShell. Each run adds synthetic
users, a service, a booking, and captured emails to the local stack.

```powershell
Get-Content -Raw scripts/local-smoke.cjs | docker compose -p taskgenie-local -f docker-compose.local.yml exec -T api node
```

The Mailpit inbox and fixture database contain test data. Payment gateway, S3,
and browser interactions are outside this smoke test.

Check individual services and recent logs:

```powershell
docker compose -p taskgenie-local -f docker-compose.local.yml exec postgres pg_isready -h 127.0.0.1 -U taskgenie_local -d taskgenie_local
docker compose -p taskgenie-local -f docker-compose.local.yml exec redis redis-cli ping
docker compose -p taskgenie-local -f docker-compose.local.yml exec api wget -qO- http://127.0.0.1:5000/health/live
docker compose -p taskgenie-local -f docker-compose.local.yml exec api wget -qO- http://127.0.0.1:5000/health/ready
docker compose -p taskgenie-local -f docker-compose.local.yml logs --tail=100 postgres redis api
```

If the database is unavailable, check its health and migration logs first. If
Redis is unavailable, inspect the queue state in the readiness response and the
API and Redis logs. `waiting-for-redis` indicates delayed queue dispatch. A
running container has started a process. Liveness checks whether the API process
responds. Readiness checks the database and outbox, and reports queue state.
An end-to-end check must also exercise a real request and any required worker.

To restart or stop the stack while retaining its named volumes:

```powershell
docker compose -p taskgenie-local -f docker-compose.local.yml restart api
docker compose -p taskgenie-local -f docker-compose.local.yml stop
```

Use `up -d` to start it again. Existing volumes retain PostgreSQL and Redis data.
The fixture passwords and SMTP configuration are separate from any existing
deployment. The SMTP override is ignored in production mode.
