# Provider discovery and booking locations

Discovery keeps its existing array response. With a valid customer coordinate pair it enforces a default 50 km radius, configurable through `PROVIDER_SEARCH_RADIUS_KM`. Explicit radii must be between 1 and 500 km. Empty results never relax the radius, service, price or rating filters. The page offers an explicit expansion to 100 km and a radius selector.

PostGIS selects candidates using spherical geography distance; JavaScript applies the same full-precision Haversine model for final eligibility and ranking. Only display labels are rounded. Without a confirmed spatial schema and coordinate-sync trigger, discovery uses the strict JavaScript path. Providers without coordinates can appear when browsing without a customer location, with unknown distance; they cannot satisfy a nearby search.

The frontend carries a separate `serviceLocation` object (`address`, `lat`, `lng`, `source`). Provider coordinates never supply a customer location. Address changes invalidate coordinates, address-search results require explicit selection, and saved addresses without coordinates must be confirmed before the UI can submit a booking. The selected service and radius survive in the booking URL. The UI sends the selected radius to availability and booking; the backend rechecks geographic eligibility after an address change.

Availability and final booking validation share working-hours, date-exception, duration and directional travel-buffer rules. Dates use Asia/Kolkata. Travel time never reduces a service's minimum buffer and has no 120-minute cutoff. OSRM failures or unreachable routes fail with a retryable 503 rather than generating bookable slots. Successful directional route results are cached for 60 seconds; `OSRM_URL` can point to a configured routing service. Provider onboarding and profile updates require an explicit service-base confirmation in the UI.

Booking and availability APIs require valid customer coordinates. Omitting the radius applies the 50 km default; internal scheduling calls enforce it too. Date-specific discovery also requires coordinates. The selected radius is stored in `bookings.search_radius_km` and is reused for subsequent address edits and payment finalization. An active booking with an unknown location blocks travel verification for that date instead of silently receiving a minimum buffer. A captured payment that cannot pass the location/travel check is recorded and enters the existing idempotent refund flow. Existing database locks, transactions and overlap constraints remain authoritative at submission.

Run `npm run migrate:locations --prefix server` before deploying the backend. The repeatable migration stores the radius, validates the 1–500 km range, and promotes user/booking coordinate fields from `real` to double precision so later checks retain the submitted point at radius boundaries. Existing rows receive 50 km and existing coordinate values are retained. It is included in the normal fresh-database migration and has been applied to the currently configured database.

## Legacy locations

`npm run audit:locations --prefix server` performs a read-only audit. Its output identifies records by ID and includes no private addresses or coordinates. The current audit found two providers without a service-base coordinate pair and 26 historical bookings without service coordinates; none of those bookings is upcoming. The providers have no matching saved address from which coordinates could safely be recovered. They remain excluded from nearby matching until their owners confirm a base through Provider Settings. Past booking locations are retained as historical unknowns.

For a missing location on an upcoming booking, the owning customer can submit `confirm_location: true` to the existing address endpoint with the **unchanged address** and confirmed `latitude`/`longitude`, even after the normal ten-minute edit window. Ownership, active status, future start time, stored radius and travel conflicts are checked under the existing locks. This exception cannot move the address, change a terminal booking or bypass another unpositioned job.

Administrators can batch confirmed repairs with `node server/scripts/locationIntegrity.js --apply owner-confirmed-manifest.json`. Each entry requires `kind` (`provider`, `booking`, `address`), `id`, the exact `expected_address` (provider base label for providers), numeric `latitude`/`longitude`, and `confirmed: true`. Never derive this file from an automatic first geocoding result. Repairs retain the existing labels, check for stale data, acquire schedule/row locks, validate affected active bookings, and commit together or roll back together. Batching handles multiple unpositioned jobs on one date. Historical booking locations are not rewritten by this tool.

```json
[{"kind":"provider","id":"<provider user UUID>","expected_address":"<existing base label>","latitude":19.076,"longitude":72.8777,"confirmed":true}]
```

## Checks

Verified on 2026-10-14: 131 backend tests and 30 client tests passed, plus the configured-database SQL check, the discovery/booking/address-edit browser flow, and live browser geocoding. The one backend skip was the configured-database check, which was then run separately and passed. Live directional routing succeeded. The production frontend build passed; focused frontend lint had zero errors and 14 existing warnings. Evidence is saved in `work/location-verification/verification.json` with the individual logs and a private-data-free location audit. Gateway, email and push delivery were controlled fixtures; no real payment was charged.

- `npm test` runs the unit/regression suites.
- PowerShell: `$env:MATCHING_DATABASE_TEST='1'; node --test server/test/providerMatching.integration.test.js` checks the configured database inside a read-only transaction, including spatial/fallback equivalence and final validation of advertised slots. It never creates bookings or changes schema.
- PowerShell: `$env:MATCHING_BROWSER_TEST='1'; $env:TASKGENIE_BROWSER_CHANNEL='msedge'; node --test client/test/matching.browser.cjs` exercises the actual React discovery and booking pages with controlled API/geocoding fixtures. It checks explicit radius expansion, customer/provider coordinate isolation, address changes, final request payloads and availability failures. No application booking is persisted.
- PowerShell: `$env:LOCATION_SERVICES_LIVE_TEST='1'; $env:TASKGENIE_BROWSER_CHANNEL='msedge'; node --test client/test/locationServices.browser.cjs` checks real geocoding search and reverse lookup from a browser origin using a public landmark. It makes no application booking or payment.
- With disposable PostgreSQL URLs in `BOOKING_TEST_DATABASE_URL`, `CHAT_TEST_DATABASE_URL` and `ACCOUNT_TEST_DATABASE_URL`, the full backend suite exercises actual persistence, locks, constraints, travel validation, confirmed repairs and payment/refund fixtures. Never point these tests at the application database. The current run used a newly created local database that was removed afterward. Both 50-request contention rounds produced one accepted booking, 49 conflicts and zero unexpected errors.

Live public-landmark geocoding (including browser search/reverse lookup) and directional OSRM routing succeeded. Geocoding has an eight-second timeout and stale-response cancellation; successful routing retains its short cache. External service availability can change. Changes in bookings between displaying and reserving a slot can still cause a legitimate conflict; the backend always validates again under the existing schedule lock. Payment integration uses a controlled gateway and makes no real charge.

## Changed files

| File | Purpose |
|---|---|
| [LOCATION_MATCHING.md](LOCATION_MATCHING.md) | Behavior, compatibility limits and verification commands. |
| [client/src/api/axiosInstance.js](client/src/api/axiosInstance.js) | Discovery cache invalidation after relevant mutations. |
| [client/src/dashboards/customer/BookingPage.jsx](client/src/dashboards/customer/BookingPage.jsx) | Separate customer location, confirmed address changes and correct service/radius availability requests. |
| [client/src/dashboards/customer/BookingSuccess.jsx](client/src/dashboards/customer/BookingSuccess.jsx) | Guarded address lookup, explicit candidate selection and coordinate-safe edits. |
| [client/src/dashboards/customer/SavedAddressesModal.jsx](client/src/dashboards/customer/SavedAddressesModal.jsx) | Zero coordinates, stale-coordinate clearing and guarded location requests. |
| [client/src/dashboards/provider/ProviderSettings.jsx](client/src/dashboards/provider/ProviderSettings.jsx) | Explicit service-base confirmation and coordinate updates. |
| [client/src/pages/ApplyProvider.jsx](client/src/pages/ApplyProvider.jsx) | Confirmed service-base coordinates during onboarding. |
| [client/src/pages/ServiceDetails.jsx](client/src/pages/ServiceDetails.jsx) | Strict radius controls, honest empty states, selected-location handoff and fresh availability. |
| [client/src/ui/CustomerServiceLocation.jsx](client/src/ui/CustomerServiceLocation.jsx) | Saved/manual service-address selection with explicit geocoding confirmation. |
| [client/src/ui/ReviewModal.jsx](client/src/ui/ReviewModal.jsx) | Discovery/review cache invalidation after reviews. |
| [client/src/ui/ServiceBaseLocation.jsx](client/src/ui/ServiceBaseLocation.jsx) | GPS/map/coordinate confirmation for the provider service base. |
| [client/src/utils/apiCache.js](client/src/utils/apiCache.js) | Scoped cache invalidation. |
| [client/src/utils/serviceLocation.js](client/src/utils/serviceLocation.js) | Customer-only initialization, coordinate validation, request guards, cache keys and India dates. |
| [client/test/apiCache.test.js](client/test/apiCache.test.js) | Regression or integration coverage for the location and matching fixes. |
| [client/test/matching.browser.cjs](client/test/matching.browser.cjs) | Regression or integration coverage for the location and matching fixes. |
| [client/test/locationServices.browser.cjs](client/test/locationServices.browser.cjs) | Opt-in live geocoding search and reverse lookup from a browser. |
| [client/test/serviceLocation.test.js](client/test/serviceLocation.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/controllers/accountController.js](server/controllers/accountController.js) | Coordinate-pair validation, zero-coordinate storage and address-change invalidation. |
| [server/controllers/bookingController.js](server/controllers/bookingController.js) | Paired customer coordinates and selected-radius validation contract. |
| [server/controllers/providerController.js](server/controllers/providerController.js) | Strict discovery, validated parameters, spatial capability detection and shared availability. |
| [server/controllers/reviewController.js](server/controllers/reviewController.js) | Discovery cache invalidation after rating changes. |
| [server/controllers/usersController.js](server/controllers/usersController.js) | No automatic city-centre geocoding; changed locations clear coordinates and discovery caches. |
| [server/services/bookingSchedule.js](server/services/bookingSchedule.js) | Shared schedules, directional buffers, India dates and final radius rechecks. |
| [server/services/paymentService.js](server/services/paymentService.js) | Revalidate locations before activating captured bookings; refund unsafe reservations. |
| [server/migrations/20261014_booking_search_radius.sql](server/migrations/20261014_booking_search_radius.sql) | Persist radius, retain coordinate precision and preserve affected triggers. |
| [server/migrations/migrate_booking_location.js](server/migrations/migrate_booking_location.js) | Transactional, repeatable radius migration. |
| [server/migrations/create_tables.js](server/migrations/create_tables.js) | Include the location migration in fresh database setup. |
| [server/package.json](server/package.json) | Location migration and audit commands. |
| [server/scripts/locationIntegrity.js](server/scripts/locationIntegrity.js) | Read-only legacy audit and transactional owner-confirmed batch repairs. |
| [server/test/bookingIntegrity.integration.test.js](server/test/bookingIntegrity.integration.test.js) | Actual database persistence, repairs, refunds and contention coverage. |
| [server/test/bookingPaymentFlow.test.js](server/test/bookingPaymentFlow.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/bookingSchedule.test.js](server/test/bookingSchedule.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/locationIntegrity.test.js](server/test/locationIntegrity.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/providerMatching.integration.test.js](server/test/providerMatching.integration.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/providerMatching.test.js](server/test/providerMatching.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/providerOnboarding.test.js](server/test/providerOnboarding.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/test/routing.test.js](server/test/routing.test.js) | Regression or integration coverage for the location and matching fixes. |
| [server/utils/geoUtils.js](server/utils/geoUtils.js) | Full precision, truthful scoring and verified directional routing. |
| [server/utils/location.js](server/utils/location.js) | Shared backend coordinate/date/radius/filter schemas. |
