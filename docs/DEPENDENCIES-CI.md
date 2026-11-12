# Dependency and CI practices

Use Node.js 22 for development and CI. The API image also uses Node 22; the
frontend image currently builds with Node 20. Each package boundary has its own
manifest and lockfile. Review and commit a manifest together with its matching
lockfile. Lockfiles record dependency versions, sources and integrity hashes;
they do not establish that a package is trustworthy or that the source account
was uncompromised.

For a fresh local checkout, inspect the lockfile changes and security notices,
then install each boundary without automatic lifecycle scripts:

```powershell
npm ci --ignore-scripts
npm ci --prefix server --ignore-scripts
npm ci --prefix client --ignore-scripts
```

The tested Node 22 Windows install and Linux container builds work with scripts
disabled on their tested architectures. Other platforms may need a reviewed
native build or an explicitly run package-specific installation step. Inspect
the affected package's version, source, integrity and lifecycle scripts first.
Do not pass credentials to an untrusted installation or run a package's script
just to silence an error. `npm audit` checks known advisories, not every malware
campaign. Investigate unexpected registry URLs, install hooks, new maintainers,
recent package releases and provenance independently. If an affected malicious
package was installed, isolate the host and preserve evidence before taking
recovery actions; follow the incident guidance for persistence and credentials.

The Axios maintainer identified malicious `axios` 1.14.1 and 0.30.4 with
`plain-crypto-js` 4.2.1 in the March 2026 compromise. The current lockfiles
were checked for those versions, and against the published August 2026 Keyv
campaign list and OSV malware entries on 12 November 2026. These checks are a
snapshot, not proof of the safety of past installs or future package releases.
[Axios postmortem](https://github.com/axios/axios/issues/10636) ·
[Keyv campaign advisory](https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2026-009/)

The engineering workflow uses a standard GitHub-hosted Linux runner, Node 22,
SHA-pinned official actions, read-only contents permission and no repository
secrets. The job runs only while the repository is public. This avoids starting
hosted compute if its visibility changes to private; verify current GitHub billing
terms before changing that guard. No deployment runs. The service containers and
TLS fixture use synthetic credentials. GitHub's workflow itself still needs a
run after the changes are committed and pushed.

The workflow installs with `--ignore-scripts`, audits all three boundaries,
runs targeted backend tests, frontend tests, lint and build, then runs real
PostgreSQL/PostGIS, Redis/outbox, TLS, booking and browser checks. It also builds
both Docker images without npm lifecycle scripts. Required integration fixture
variables are checked with `REQUIRE_INTEGRATION_TESTS=1`; absent required
fixtures cause failure. The migration test creates and removes uniquely named
test databases, and the outbox test removes its own test schema and queue. Use
only dedicated disposable fixture servers with no real data.

To run the key tests locally, provide dedicated loopback fixture URLs for
`MIGRATION_TEST_POSTGIS_URL`, `MIGRATION_TEST_PLAIN_URL`,
`OUTBOX_TEST_DATABASE_URL`, `OUTBOX_TEST_REDIS_URL`,
`BOOKING_TEST_DATABASE_URL`, and `CHAT_TEST_DATABASE_URL`. The migration fixture
URLs must refer to `taskgenie_migration_test`. Set `DATABASE_URL` to the fixture
PostGIS URL, `DB_SSL_MODE=disable`, `NODE_ENV=test`, and
`REQUIRE_INTEGRATION_TESTS=1`. Then run:

```powershell
node --test server/test/migrationRunner.integration.test.js server/test/notificationOutbox.integration.test.js
npm run verify:engineering -- --browser
```

For example, the following PowerShell commands create dedicated disposable
fixtures with synthetic credentials and no persistent database volumes. Use
different container names if these names already exist; never substitute a
container holding application data. Docker, OpenSSL and a Playwright Chromium
installation are required for the complete set of tests.

```powershell
docker run -d --rm --name tg-test-postgis --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=fixture-only -e POSTGRES_DB=taskgenie_migration_test -p 127.0.0.1::5432 postgis/postgis:15-3.4-alpine
docker run -d --rm --name tg-test-plain --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=fixture-only -e POSTGRES_DB=taskgenie_migration_test -p 127.0.0.1::5432 postgres:16-alpine
docker run -d --rm --name tg-test-redis --tmpfs /data -p 127.0.0.1::6379 redis:7-alpine
docker run -d --rm --name tg-test-tls --label taskgenie.tls-fixture=true --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=fixture-only -e POSTGRES_DB=taskgenie_tls_test -p 127.0.0.1::5432 postgres:16-alpine
# Wait for each PostgreSQL server to report accepting connections before testing.
docker exec tg-test-postgis pg_isready -U postgres
docker exec tg-test-plain pg_isready -U postgres
docker exec tg-test-tls pg_isready -U postgres
docker exec tg-test-redis redis-cli ping
$postgisPort = (docker port tg-test-postgis 5432/tcp).Split(':')[-1]
$plainPort = (docker port tg-test-plain 5432/tcp).Split(':')[-1]
$redisPort = (docker port tg-test-redis 6379/tcp).Split(':')[-1]
$tlsPort = (docker port tg-test-tls 5432/tcp).Split(':')[-1]
$postgisUrl = "postgresql://postgres:fixture-only@127.0.0.1:${postgisPort}/taskgenie_migration_test"
$env:DATABASE_URL = $postgisUrl
$env:BOOKING_TEST_DATABASE_URL = $postgisUrl
$env:CHAT_TEST_DATABASE_URL = $postgisUrl
$env:MIGRATION_TEST_POSTGIS_URL = $postgisUrl
$env:OUTBOX_TEST_DATABASE_URL = $postgisUrl
$env:MIGRATION_TEST_PLAIN_URL = "postgresql://postgres:fixture-only@127.0.0.1:${plainPort}/taskgenie_migration_test"
$env:OUTBOX_TEST_REDIS_URL = "redis://127.0.0.1:${redisPort}"
$env:TLS_TEST_CONTAINER = 'tg-test-tls'
$env:TLS_TEST_DATABASE_URL = "postgresql://postgres:fixture-only@127.0.0.1:${tlsPort}/taskgenie_tls_test"
$env:DB_SSL_MODE = 'disable'; $env:NODE_ENV = 'test'; $env:REQUIRE_INTEGRATION_TESTS = '1'
node client/node_modules/playwright/cli.js install chromium
node --test server/test/postgresTls.integration.test.js server/test/migrationRunner.integration.test.js server/test/notificationOutbox.integration.test.js
npm run verify:engineering -- --browser
```

These fixtures are temporary: stopping their containers removes their test data.
They do not interact with the regular Compose database or its volumes.

The PostgreSQL TLS test additionally requires a dedicated Docker container
labelled `taskgenie.tls-fixture=true`, bound to loopback, with a database named
`taskgenie_tls_test`. Set `TLS_TEST_CONTAINER` and `TLS_TEST_DATABASE_URL`, then
run `node --test server/test/postgresTls.integration.test.js`. The test changes
TLS settings only after checking the label and mapped port. It uses temporary
test certificates. Never target an existing application database or container.

For install failures, check Node and npm versions, registry access, lockfile
consistency, the exact missing platform binary and package integrity. Check the
package's official release notes before changing versions; do not use
`npm audit fix --force` as a substitute for compatibility testing. Real AWS
IAM, S3, deployed HTTPS, payment gateways and external email remain unverified
by this workflow.
