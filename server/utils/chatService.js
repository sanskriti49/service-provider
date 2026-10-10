const db = require("../config/db");

class ChatError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value, name) {
	if (typeof value !== "string" || !uuidPattern.test(value)) {
		throw new ChatError(400, "INVALID_INPUT", `${name} must be a UUID`);
	}
	return value.toLowerCase();
}

function messageId(value, name) {
	if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
		throw new ChatError(400, "INVALID_INPUT", `${name} must be a positive bigint string`);
	}
	return value;
}

function errorPayload(err) {
	if (!(err instanceof ChatError)) console.error("Chat operation failed:", err.code || err.name);
	return { code: err instanceof ChatError ? err.code : "INTERNAL_ERROR",
		message: err instanceof ChatError ? err.message : "Chat temporarily unavailable. Please retry.",
		status: err instanceof ChatError ? err.status : 500 };
}

// Serialize writes per booking so committed message IDs are safe reconnect cursors.
// The same lock also prevents concurrent deletion/reassignment during authorization.
async function withBooking(userId, bookingId, action) {
	userId = uuid(userId, "userId");
	bookingId = uuid(bookingId, "bookingId");
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		const { rows } = await client.query(`SELECT b.booking_id, b.user_id, b.provider_id
			FROM bookings b WHERE b.booking_id = $1
			AND ($2 = b.user_id OR $2 = b.provider_id)
			AND EXISTS (SELECT 1 FROM users WHERE id = $2)
			FOR UPDATE OF b`, [bookingId, userId]);
		if (!rows.length) throw new ChatError(404, "CONVERSATION_NOT_FOUND", "Conversation not found");
		const result = await action(client, rows[0], userId);
		await client.query("COMMIT");
		return { result, booking: rows[0] };
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		throw err;
	} finally {
		client.release();
	}
}

function publish(booking, event, payload) {
	// Existing authenticated user rooms reach every device without client-chosen rooms.
	// Persistence is authoritative if the process exits before this best-effort delivery.
	const { emitToUser } = require("./socket");
	for (const id of new Set([booking.user_id, booking.provider_id])) emitToUser(id, event, payload);
}

async function summary(client, bookingId, userId) {
	const { rows } = await client.query(`SELECT
		COUNT(*) FILTER (WHERE sender_id <> $2 AND read_at IS NULL)::int AS unread_count,
		MAX(id)::text AS last_message_id,
		MAX(id) FILTER (WHERE sender_id <> $2 AND read_at IS NOT NULL)::text AS last_read_message_id,
		MAX(id) FILTER (WHERE sender_id = $2 AND read_at IS NOT NULL)::text AS peer_last_read_message_id,
		MAX(read_at) FILTER (WHERE sender_id <> $2) AS last_read_at,
		MAX(read_at) FILTER (WHERE sender_id = $2) AS peer_last_read_at
		FROM chat_messages WHERE booking_id = $1`, [bookingId, userId]);
	return rows[0];
}

async function history(userId, bookingId, options = {}) {
	if (!options || typeof options !== "object") throw new ChatError(400, "INVALID_INPUT", "Invalid history options");
	const { before, after } = options;
	if (before !== undefined && after !== undefined) throw new ChatError(400, "INVALID_INPUT", "Use before or after, not both");
	const cursor = before !== undefined ? messageId(before, "before") : after !== undefined ? messageId(after, "after") : null;
	const limit = options.limit === undefined ? 50 : Number(options.limit);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ChatError(400, "INVALID_INPUT", "limit must be 1-100");
	const ascending = after !== undefined;
	const { result } = await withBooking(userId, bookingId, async (client, booking, actor) => {
		const { rows } = await client.query(`SELECT * FROM chat_messages WHERE booking_id = $1
			${cursor ? `AND id ${ascending ? ">" : "<"} $3` : ""}
			ORDER BY id ${ascending ? "ASC" : "DESC"} LIMIT $2`,
			cursor ? [booking.booking_id, limit + 1, cursor] : [booking.booking_id, limit + 1]);
		const has_more = rows.length > limit;
		const messages = rows.slice(0, limit);
		const next_cursor = has_more ? messages[messages.length - 1].id : null;
		if (!ascending) messages.reverse();
		return { booking_id: booking.booking_id, messages, has_more, next_cursor,
			...await summary(client, booking.booking_id, actor) };
	});
	return result;
}

async function send(userId, bookingId, input = {}) {
	const clientMessageId = uuid(input?.clientMessageId, "clientMessageId");
	if (typeof input?.body !== "string" || input.body.includes("\0") || !input.body.trim() || input.body.length > 4000) {
		throw new ChatError(400, "INVALID_INPUT", "body must contain 1-4000 characters of text without NUL");
	}
	const body = input.body.trim();
	const { result, booking } = await withBooking(userId, bookingId, async (client, booking, actor) => {
		const inserted = await client.query(`INSERT INTO chat_messages (booking_id, sender_id, client_message_id, body)
			VALUES ($1, $2, $3, $4) ON CONFLICT (booking_id, sender_id, client_message_id) DO NOTHING RETURNING *`,
			[booking.booking_id, actor, clientMessageId, body]);
		if (inserted.rows.length) return { message: inserted.rows[0], duplicate: false };
		const existing = await client.query(`SELECT * FROM chat_messages
			WHERE booking_id = $1 AND sender_id = $2 AND client_message_id = $3`, [booking.booking_id, actor, clientMessageId]);
		if (existing.rows[0].body !== body) throw new ChatError(409, "IDEMPOTENCY_CONFLICT", "clientMessageId already used for different text");
		return { message: existing.rows[0], duplicate: true };
	});
	if (!result.duplicate) publish(booking, "chat:message", result.message);
	return result;
}

async function markRead(userId, bookingId, input = {}) {
	const throughId = messageId(input?.throughMessageId, "throughMessageId");
	const { result, booking } = await withBooking(userId, bookingId, async (client, booking, actor) => {
		const target = await client.query("SELECT id FROM chat_messages WHERE booking_id = $1 AND id = $2", [booking.booking_id, throughId]);
		if (!target.rows.length) throw new ChatError(400, "INVALID_INPUT", "throughMessageId must belong to this conversation");
		const updated = await client.query(`UPDATE chat_messages SET read_at = clock_timestamp()
			WHERE booking_id = $1 AND id <= $2 AND sender_id <> $3 AND read_at IS NULL RETURNING id`, [booking.booking_id, throughId, actor]);
		return { booking_id: booking.booking_id, reader_id: actor, through_message_id: throughId,
			updated_count: updated.rowCount, ...await summary(client, booking.booking_id, actor) };
	});
	// Includes persisted read watermark, even on retries and out-of-order read requests.
	publish(booking, "chat:read", result);
	return result;
}

async function unread(userId) {
	userId = uuid(userId, "userId");
	const { rows } = await db.query(`SELECT b.booking_id, COUNT(*)::int AS unread_count
		FROM bookings b JOIN chat_messages m ON m.booking_id = b.booking_id
		WHERE (b.user_id = $1 OR b.provider_id = $1) AND m.sender_id <> $1 AND m.read_at IS NULL
		AND EXISTS (SELECT 1 FROM users WHERE id = $1)
		GROUP BY b.booking_id ORDER BY b.booking_id`, [userId]);
	return { conversations: rows, total_unread: rows.reduce((sum, row) => sum + row.unread_count, 0) };
}

module.exports = { ChatError, uuid, errorPayload, history, send, markRead, unread };
