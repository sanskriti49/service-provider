# KYC and support: local verification and rollout notes

This work has not been validated against a production storage account or real identity documents. Do not treat it as approval to collect real documents.

## Provider applications and document storage

Provider applicants create or sign in to a provider account before uploading and submitting. An application draft is kept in the current tab during the sign-in transition; passwords, document numbers and file references are not saved in that draft. Browsers do not retain a selected file across sign-in, so the applicant must select it again. Aadhaar and driving-licence submissions require front and back; trade certificates require the front. Existing KYC resubmissions also support the types exposed by the KYC form.

The server accepts PDF, PNG, JPEG and WEBP up to 5 MB after checking file signatures. A successful authenticated upload returns a generated private reference, not a public URL. The application and KYC submission verify that the required references belong to the provider and exist in the configured store. Downloads go through the authenticated endpoint and check the current front/back references on every request. Signature checks do not detect malware or validate the whole file.

KYC storage is local-only for synthetic development data. Remote KYC storage is intentionally disabled, including when legacy S3 settings are present. The adapter has a small `put`/`exists`/`read` contract for a future separately reviewed private provider; there is currently no working S3-compatible implementation or provider configuration.

* To run the backend directly on a developer machine, create a private directory outside the application repository and set `NODE_ENV=development` or `test`, `KYC_STORAGE_DRIVER=local`, and `KYC_PRIVATE_DIRECTORY` to its absolute path. Limit access using your operating system's account and directory permissions. On Windows, for example, use a folder under your own profile, not the repository. Use synthetic documents only.
* `docker compose -f docker-compose.local.yml up --build` configures local KYC in the API container automatically, alongside local PostgreSQL, Redis and Mailpit. It uses a private in-memory temporary directory for synthetic files. Those files are not durable and can disappear when the container stops or restarts, while database references remain. Resubmit synthetic documents after that happens. The Compose configuration was validated, but running it depends on Docker being available.
* On Render or with `NODE_ENV=production`, local KYC storage is rejected, even if `KYC_STORAGE_DRIVER=local` is accidentally supplied. Uploads return a clear unavailable message. Do not use Render's ephemeral filesystem as document storage. No KYC storage setting or AWS credentials are needed on Render while KYC is disabled.

Local login and registration still use Cloudflare Turnstile and the frontend may load third-party resources. The automated integration tests create synthetic accounts directly in a disposable local database; the browser test mocks authentication. They do not prove that the entire interactive sign-in flow works offline. Do not bypass production authentication to test locally.

If storage is absent or fails, uploads and reviews fail closed. Cloudinary, public URLs and data-URI fallbacks are not used for new KYC uploads. Existing public/local/S3/data-URI records are preserved, but legacy references are not exposed by the new viewer and must be assessed and migrated or resubmitted through a separately reviewed process. The application blocks its legacy KYC static directory; that does not revoke external Cloudinary or S3 links.

## Migrations and review

Take an appropriate recovery point and inspect the target database before any live migration. For an existing installation, `npm run migrate:kyc` adds version, reviewer, review-history and KYC-specific rejection fields; `npm run migrate:support-idempotency` adds ticket retry fields. Both are included in the full migration. Apply the schema before running the new application. No existing rows or documents are rewritten by these migrations.

Application approval and KYC verification are separate. New submissions start in the existing `pending` state, representing pending review; accounts with no submission are shown as `not_submitted`. An admin's verify/reject decision includes the submission version. A stale decision is rejected; a resubmission increments the version and clears the current verification. Decisions and reviewer IDs are recorded in `kyc_review_events`. Legacy version-zero submissions must be resubmitted into private storage before this review path can verify them. KYC rejection text is separate from provider application rejection text.

## Support tickets

Guest tickets require `JWT_SECRET` and issue a ticket-scoped token valid for 30 days. Missing secrets disable guest ticket creation safely. Previous non-expiring guest tokens and token-bearing query links are no longer accepted. Guests must save their ticket number and token; the current browser tab also retains the token through refresh, but closing the tab or using another device requires the saved token. There is no automated expired-token recovery flow yet.

The web forms send idempotency keys, retaining a hash and key in tab-scoped storage while a request is unresolved. An unchanged retry can recover the same ticket or reply; different details require a new key. A reply and reopening a closed ticket are written atomically. Legacy clients that omit the key do not receive this retry guarantee. The ticket is stored in PostgreSQL even if an in-app notification insert fails; such notifications are best effort and are not currently retried through the outbox. Email delivery is not implemented for tickets and no email promise is made.

## Tests

From `server`, run `node --test test/kycStorage.test.js test/providerOnboarding.test.js test/supportModeration.test.js test/ticketAccess.test.js` for local storage and support unit checks. The opt-in integration tests require a **fresh disposable local** database named `taskgenie_kyc_test` or `taskgenie_kyc_test_<number>`, already migrated, and an isolated PostgreSQL port. Set `KYC_INTEGRATION_TEST=1`, `KYC_TEST_PORT`, and optionally `KYC_TEST_DB_NAME`, then run `node --test test/kyc.integration.test.js test/support.integration.test.js` from `server`. These tests create synthetic users and records; they must never target an existing or production database. The KYC test uses a temporary local private directory; the remote-disabled test intercepts the SDK boundary and verifies that it makes no requests.

From `client`, set `SUPPORT_KYC_BROWSER_TEST=1` and, if installed Chrome is used, `TASKGENIE_BROWSER_CHANNEL=chrome`, then run `node --test test/kycSupport.browser.cjs`. Requests and documents in this browser test are fixtures. No production deployment, real cloud storage, real email or real identity data has been tested.

For a fresh isolated integration database on Windows PowerShell, start Docker Desktop first. These commands create a new local-only container and database; do not reuse an existing database. Pick a different container name or unused loopback port if either is already in use. The image must be present locally or Docker must be able to pull it.

```powershell
docker run -d --name taskgenie-kyc-isolated -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55943:5432 postgis/postgis:15-3.4-alpine
docker exec taskgenie-kyc-isolated pg_isready -U postgres
# Wait until it reports accepting connections, then create the dedicated database.
docker exec taskgenie-kyc-isolated createdb -U postgres taskgenie_kyc_test_1
cd C:\Users\sansk\Downloads\service-provider\server
$env:NODE_ENV='test'
$env:DATABASE_URL=''
$env:DB_HOST='127.0.0.1'; $env:DB_PORT='55943'; $env:DB_USER='postgres'; $env:DB_PASSWORD=''; $env:DB_NAME='taskgenie_kyc_test_1'
$env:DB_SSL_MODE='disable'; $env:DB_SSL_CA_FILE=''; $env:PGSSLMODE=''
$env:JWT_SECRET='synthetic-local-test-only'; $env:REDIS_URL=''
node migrations/create_tables.js
if ($LASTEXITCODE -ne 0) { throw 'Migration failed; do not run integration tests.' }
$env:KYC_INTEGRATION_TEST='1'; $env:KYC_TEST_PORT='55943'; $env:KYC_TEST_DB_NAME='taskgenie_kyc_test_1'
node --test test/kyc.integration.test.js test/support.integration.test.js
```

The KYC integration test inserts fixed fixture identifiers, so use a new disposable database for a repeat run. These commands do not delete the container or its data. Stop and clean up only the test resources you have positively identified and no longer need.

## External services and possible charges

The code does not provision services or guarantee account costs. Check your actual Render, Neon, Redis and third-party plans and usage separately. Do not paste environment values into issue reports.

* KYC: `KYC_STORAGE_DRIVER` and `KYC_PRIVATE_DIRECTORY` configure synthetic local storage only. `KYC_PRIVATE_S3_BUCKET` and `AWS_REGION` no longer activate KYC; remote KYC is disabled.
* PostgreSQL: `DATABASE_URL`, or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (and `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` fallbacks), plus `DB_SSL_MODE`, optional `DB_SSL_CA_FILE`, `PG_BOUNCER`, `DB_POOL_MIN` and `DB_POOL_MAX`. Neon or another hosted database can have plan-dependent limits or charges. Use local PostGIS for local testing.
* Redis: `REDIS_URL`, or `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`; hosted Redis usage and plans can have limits or charges. Use local Redis for local testing.
* Profile photos, not KYC: `AWS_REGION`, `AWS_S3_BUCKET` or `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_ENDPOINT_URL_S3` or `S3_ENDPOINT`, `S3_PUBLIC_URL` or `R2_PUBLIC_URL`, and `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. A profile-photo upload can call the configured external service and incur usage charges. If no provider is configured, the legacy profile-image code uses local public uploads, which are not durable on Render.
* Payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PAYMENT_RECONCILIATION_ENABLED`, and frontend `VITE_RAZORPAY_KEY_ID`. Payment operations and startup reconciliation contact Razorpay when enabled. Test keys are different from live keys; do not use live payments for tests.
* Email: `EMAIL_USER`, `EMAIL_PASS`, and development-only `SMTP_HOST`, `SMTP_PORT`. Authentication and queued booking emails can contact an SMTP service. Mailpit captures development mail locally. Support tickets do not send email. The separate contact form uses EmailJS and can send externally; its current identifiers are configured in code.
* Login and verification: `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY`. Google and Cloudflare calls are external; plan terms and limits are provider-specific. `VITE_API_URL` can point the frontend to a remote API. Some location searches call OpenStreetMap Nominatim directly. Routing calculations use `OSRM_URL` or a public OSRM endpoint; another legacy helper uses a public endpoint directly. Those requests transmit location data to the endpoint.

The local Compose file uses an internal service network, local fixture credentials, local Mailpit and disabled payment reconciliation. It does not establish that the Render deployment, frontend contact form or all browser-loaded resources are offline.
