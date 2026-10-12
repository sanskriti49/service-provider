# Local verification snapshot

Run on 12 October 2026, Windows, Node 22.22.0, PostgreSQL 18.4 and installed Chrome.
`verification.json` records the base Git revision, dirty-worktree flag and a SHA-256
fingerprint of the listed implementation/test sources. Changes were uncommitted.

- Backend: 37 reported tests passed.
- Client message state: 5 tests passed.
- Browser: 8 reported tests passed, including the parent integration test.
- All selected suites: zero failures and zero skips.
- Contention: each 50-request COD/online round produced 1 accepted response,
  49 conflicts, zero unexpected responses, and 1 persisted reservation.

See `concurrency.json` for workload, measured timings and fixture boundaries;
`backend.tap`, `client-state.tap` and `browser.tap` retain actual test output.
The timings are a local contention experiment, not production throughput.
Gateway and notification delivery are stubbed. Browser tests use actual chat SQL,
HTTP/Socket.IO and React with fixture dashboard data. These files contain synthetic
IDs only, not application customer records or payment credentials.

Default `npm test` also passed: 63 backend and 21 client tests, with 2 database tests
and the account integration suite opted out in that default run. The dedicated
engineering command above separately enabled booking/chat DB verification.
`npm run build` passed. GitHub Actions configuration is included but has not been
executed on GitHub in this local session.

Regenerate rather than treating this dated snapshot as future verification:
`npm run verify:engineering -- --browser --output docs/evidence` with the disposable
database variables described in [the guide](../ENGINEERING.md).
