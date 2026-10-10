# Booking chat frontend

`src/chat/` contains the shared booking chat panel, styles, session/unread context,
conversation hook, transport, and message reconciliation helpers. `main.jsx` mounts
the session under the existing AuthProvider. Customer/provider booking lists,
dashboard overview cards, and detail sheets use the same ChatButton. Existing
booking actions, notification events, phone links and OTP flows are unchanged.

The existing Socket.IO singleton and authenticated Axios client are reused. No
dependencies, environment variables or additional backend changes are required.
The backend must include the chat routes/migration described in `server/CHAT.md`.
Start/restart it normally, then start the Vite client.

## Behavior

- Each panel is scoped to a booking. The backend authorizes every request; local
  participant checks are only a convenience, never the security boundary.
- Sent history persists in PostgreSQL. Drafts and pending sends are kept in memory
  per booking while navigating or closing/reopening chat; they clear on page reload,
  sign-out or account/token change. Message text is never inserted as HTML.
- Socket pushes update both participants. History replay, unread reconciliation
  and read watermarks refresh on reconnect, focus, and once a minute while visible.
  Missed history is replayed through all pages before advancing its cursor.
- Stable UUIDs reconcile optimistic messages with pushes, acknowledgements and
  retries. A timed-out socket request falls back to HTTP with the same UUID.
  Failed messages retain their text and an explicit Retry action.
- Read receipts are sent only while the document is focused/visible and the panel
  is at the latest messages. Reading older history does not force-scroll on arrival;
  a New messages button returns to the newest message.
- The panel traps keyboard focus, restores it on close, supports Escape, announces
  arrivals, respects reduced motion and uses the mobile visual viewport for the
  on-screen keyboard. Desktop Enter sends; Shift+Enter adds a line. On touch
  devices Enter adds a line; the visible send button submits.

## Verification

- `npm --prefix client test`: message reconciliation, exact bigint ordering,
  idempotent merges, receipt preservation and existing frontend unit tests.
- `npm --prefix client run build`: production bundle.
- From `client`, `npx eslint src/chat src/main.jsx src/utils/socket.js`.
- Optional real-browser integration: set `CHAT_TEST_DATABASE_URL` to a dedicated
  PostgreSQL test instance and make Playwright available on `NODE_PATH`, then run
  `node --test client/test/chat.browser.cjs` from the repository root. Chrome must
  be installed. The test starts its own Vite on port 5188 and a random API port,
  creates/removes an isolated database schema, and uses the real backend chat
  service/routes/Socket.IO implementation. Only dashboard/profile responses are
  fixtures. It never seeds or edits application accounts or bookings. Screenshots
  are saved to the system temporary directory under `taskgenie-chat-ui`.

Live multi-instance delivery retains the backend's existing shared-adapter
requirement; this frontend does not change deployment topology.
