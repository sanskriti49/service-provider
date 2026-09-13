# Repair pass — what changed and why

Everything below was verified by running the code: the server against a real
PostgreSQL 16 database, and the client rendered in Chromium via Playwright.

## Backend bugs that returned 500 or blocked a flow

**The whole booking lifecycle was dead.** `PUT /api/bookings/:id/status`
returned 500 on every call: `FOR UPDATE cannot be applied to the nullable side
of an outer join`. The locking query joins `services` with a LEFT JOIN, and
PostgreSQL refuses to lock that. A provider could never confirm, start or
complete a job. Fixed by locking only the bookings row (`FOR UPDATE OF b`).

**Admin approval and KYC were dead.** `PUT /api/admin/providers/:id/status` and
`/kyc` both returned 500: `inconsistent types deduced for parameter $1`. The
same placeholder was used as an assignment target and inside text comparisons,
so no single type could be deduced. Fixed with explicit casts.

**Reviews failed on a missing field.** `POST /api/reviews` 404s with "Provider
not found" when `provider_id` is absent. It now falls back to the provider on
the booking being reviewed.

**The image seeder crashed on every run.** `seeds/seedImages.js` had three
faults: it required `./config/db` from inside `seeds/` (module not found, so
it died on load), it looked for the images in `seeds/seed_images` when they
live in `server/seed_images`, and it read `directoryPath`, a variable that was
never defined. The unused database import was dropped and the paths corrected.
It now finds all 29 images and stops only on absent Cloudinary credentials,
which is the expected behaviour without keys.

## Frontend calls that could never reach the API

Nine calls used bare paths (`/bookings`, `/providers/v1`, `/services/v1`).
The axios instance has no host and the Vite dev proxy only forwards `/api`, so
these hit the dev server and 404. That broke booking creation, payment
verification, availability, booking history, address edits and provider
signup. All rewritten to `/api/...`.

## Performance

The home page took **12.8s** to become interactive and shipped **1.9MB**.

- `index.css` opened with an `@import` of six Google font families. A CSS
  import is render blocking and chains: HTML, CSS bundle, font CSS, font
  files. Moved into `<head>` as a non-blocking stylesheet with preconnect.
- The Google Identity script loaded on every page for two pages that use it,
  and both polled with `setInterval` waiting for it. Now loaded on demand.
- `globe.png` was 1MB. Converted to WebP (360KB) and lazy loaded.
- The hero background was a 3600px PNG. Halved to 1800px: 354KB to 117KB.
- `background-attachment: fixed` on two layouts forced a repaint on every
  scroll frame. Removed.
- 11MB of images and 12MB of fonts sat in `public/`. Only 6 images and 1 font
  were referenced. `public/` went from 23MB to 1.1MB.
- The one self-hosted font shipped as a 163KB OTF. Added a 73KB WOFF2.

Result: **interactive in ~100ms, 525KB transferred.**

## Redundancy removed

- MUI plus Emotion was pulled in for a single `Avatar` showing initials.
  Replaced with a div: `CustomerSettings` went from 93KB to 16KB.
- `sweetalert2` was imported in `AllBookings` and never used:
  102KB to 22KB.
- GSAP was imported by the eagerly loaded `AppLayout` for one fade. Replaced
  with a CSS keyframe, taking GSAP out of the critical path.
- 17 unused dependencies removed, plus `uuid` on the server.
- Two axios setups with different base URLs, and a re-export shim. Collapsed
  to one instance and one shared `API_URL`.
- 6 unreferenced components, ~235 lines of dead CSS, duplicate root
  `vite.config.js` / `eslint.config.js` / `package-lock.json`.
- Two `.sql` migrations that error against the real schema and are superseded
  by `create_tables.js`.

## Design

Removed the pulsating pills and related tells: ping rings behind spinners and
status dots, pulsing status dots on booking rows, a pulsing glow behind the
role cards, a pulsing icon, and the confetti burst on booking success (which
also fired ~100 particles every 250ms). Skeleton loaders that legitimately use
`animate-pulse` were kept.

A "Start Live Chat" button called `alert("Feature coming soon!")`. There is no
chat API, so it now points at the contact form, which works.

## Added

`.env.example` for both halves. Neither existed, and `JWT_SECRET` and the
database settings are required to boot.

## Known gaps, not addressed

- `availability_slots` is seeded with thousands of rows and read by nothing.
  Availability is computed from `provider_master_availability`. The table
  looks like a superseded design; confirm before dropping it.
- `create_tables.js` does not create the `update_provider_average_rating`
  trigger that the deleted `001_provider_services.sql` carried. The
  application already recomputes the rating in `reviewController.js`, so
  behaviour is correct, but the two mechanisms were duplicates.
- 70 ESLint warnings remain, all unused variables and hook dependency hints.
  No errors.
- Payments are Razorpay with placeholder keys; the payment path was not
  exercised against the real gateway.
