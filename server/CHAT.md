# Booking chat backend contract

Each existing or new booking is automatically a separate conversation, identified by
its `booking_id`. Only its `user_id` and `provider_id` can access it, regardless of
claimed role; there is no admin bypass. Chat is available in every booking status,
including cancelled/completed. Deleting a booking deletes its messages. Chat does
not modify booking status, payments, OTPs, phone contact or notifications.

## Deployment

- Run `npm --prefix server run migrate:chat` against the intended database before
  starting the updated server. This adds `chat_messages` and its indexes only.
  It is transactional and repeatable, with no data backfill. Fresh installations
  also get the table through the existing `npm --prefix server run migrate`.
- No added dependencies or environment variables. Existing PostgreSQL settings,
  `JWT_SECRET`, Socket.IO endpoint and CORS settings are reused. Socket auth now
  requires the configured secret (no default-secret fallback), checks the user
  exists, and disconnects when the token expires.
- Live delivery uses the existing in-process Socket.IO user rooms. Run one API
  process for live delivery. Multiple API instances would require a shared
  Socket.IO adapter before rollout; persistence and history already use PostgreSQL.

## HTTP (Authorization: Bearer JWT)

| Method and path | Input | Response |
| --- | --- | --- |
| `GET /api/chat/:bookingId/messages` | Optional `limit=1..100` (default 50), `before=<id>` **or** `after=<id>` | History and current conversation summary |
| `POST /api/chat/:bookingId/messages` | `{ "clientMessageId": "UUID", "body": "text" }` | `{ message, duplicate }` (200, including retry) |
| `POST /api/chat/:bookingId/read` | `{ "throughMessageId": "123" }` | Receipt and current reader summary |
| `POST /api/chat/:bookingId/report` | `{ "reason": "text", "details"?: "text", "messageId"?: "123" }` | `{ success: true, report, message }` |
| `GET /api/chat/unread` | None | `{ conversations: [{ booking_id, unread_count }], total_unread }`; only nonzero conversations |

Message:
```json
{
  "id": "123",
  "booking_id": "UUID",
  "sender_id": "UUID",
  "client_message_id": "UUID",
  "body": "Hello",
  "created_at": "2026-10-10T12:00:00.000Z",
  "read_at": null
}
```

IDs of messages/cursors are **decimal strings**, not JS numbers (PostgreSQL bigint).
Booking, sender and client message IDs are UUIDs. Text is trimmed, nonempty, at most
4000 JS string characters, and cannot contain NUL. Render it as plain text. Sender,
timestamps and read state are always server-controlled. Reuse the same client UUID
when retrying the same send; a different body with that UUID returns 409. The UUID
is scoped to `(booking_id, sender_id)`, so independent participants cannot collide.

History response:
```text
{ booking_id, messages, has_more, next_cursor,
  unread_count, last_message_id,
  last_read_message_id, peer_last_read_message_id,
  last_read_at, peer_last_read_at }
```
Messages are always returned oldest first. Without a cursor, fetches the latest
page. `before` fetches the preceding page; `after` fetches the next oldest page of
newer messages. When `has_more`, use `next_cursor` in the same direction. History
does **not** mark anything read. Summary watermarks cover the entire conversation,
not just the returned page; missing timestamps/watermarks are null.

Read requests mark only incoming messages up to the given ID, which must exist
in this booking. Later incoming messages remain unread. Existing read timestamps
never change. Response adds `reader_id`, `through_message_id`, `updated_count` to
the history summary fields (without `messages`, `has_more`, `next_cursor`).
`last_read_message_id` is the reader's persisted incoming-message watermark;
`peer_last_read_message_id` is the peer's watermark for this reader's sent messages.
Use the persisted watermark, not the requested `through_message_id`, for receipts.

Chat errors: `{ error: { code, message, status } }`. Statuses: 400 invalid input,
404 missing or inaccessible conversation (same response), 409 idempotency conflict,
500 retryable server/database error. HTTP authentication retains the existing
middleware's 401 `{ error: "..." }` format; the existing global API limiter uses
its existing 429 response. HTTP responses disable caching.

## Socket.IO (existing default namespace and `/socket.io` path)

Connect with `auth: { token: JWT }`. Authorization header and the existing legacy
query-token format remain supported; prefer `auth` to avoid tokens in URLs.
Invalid handshakes emit `connect_error`. No client-selected room or recipient is
accepted: the server delivers privately to both participants' authenticated user
rooms, including all their connected devices. No join event is necessary.

Every request uses one acknowledgement callback:
`{ ok: true, data: <HTTP response> }` or `{ ok: false, error: { code, message, status } }`.

| Client event | Payload |
| --- | --- |
| `chat:history` | `{ bookingId, limit?, before?, after? }` |
| `chat:send` | `{ bookingId, clientMessageId, body }` |
| `chat:read` | `{ bookingId, throughMessageId }` |
| `chat:unread` | `{}` |
| `chat:report` | `{ bookingId, reason, details?, messageId? }` |

Server events:
- `chat:message`: the persisted message (emitted after a new send commits, whether
  sent over HTTP or Socket.IO; not emitted for duplicate retries).
- `chat:read`: the receipt response; counts and watermarks are relative to
  `reader_id`, even when the peer receives the event. Refresh your own counts as needed.
- `chat:error`: `{ code, message, status }` for requests without acknowledgements
  or token expiry. Refresh the token and explicitly reconnect after expiry.
- Existing `notification:new` delivery remains unchanged.

Socket requests are limited to 120/minute and 5 in flight per connection, returning
`RATE_LIMITED`/429. HTTP requests retain the existing global limiter.

## Reconnection and synchronization

Register listeners before connecting. Deduplicate all responses/pushes by message
`id`; merge receipts monotonically so delayed events do not clear a read timestamp.
Keep a client UUID with each pending send and retry that UUID after timeout or
reconnection. A lost acknowledgement can mean the message already committed.

On every connection/reconnection, fetch `chat:unread` and `chat:history` for the
open booking, using `after` with the last fully synchronized message ID; page
until `has_more` is false. With no saved cursor, fetch the latest page and use
`before` for older history. Merge pushes received during replay. Do not advance a
replay cursor from a live push or the summary's `last_message_id` while pages are
still missing. Refetch summary watermarks to recover missed read receipts. Refresh
on focus or periodically as well: a committed DB write can outlive the process
before its push is emitted. This is durable history plus best-effort live delivery,
consistent with [Socket.IO's delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

## Validation

`node --test server/test/chat.test.js` runs input validation; database/socket tests
are skipped unless `CHAT_TEST_DATABASE_URL` is explicitly set to a test PostgreSQL
URL. Install the existing client dependencies for the Socket.IO test client.
Integration tests create and remove their own random schema, exercise actual SQL,
HTTP and Socket.IO clients, and never use application users/bookings as fixtures.
For PowerShell:
```powershell
$env:CHAT_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/postgres'
node --test server/test/chat.test.js
```
