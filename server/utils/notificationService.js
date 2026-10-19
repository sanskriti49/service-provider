const db = require("../config/db");
const { emitToUser } = require("./socket");

function emitNotification(notification) {
	if (notification && notification.user_id) {
		try {
			emitToUser(notification.user_id, "notification:new", notification);
		} catch (err) {
			console.warn("WebSocket notification emit notice:", err.message);
		}
	}
}

async function sendNotification(
	{ userId, title, message, type = "system", data = {} },
	clientOrDb = db,
	options = {},
) {
	if (!userId || !title || !message) {
		console.warn("sendNotification called with missing parameters:", { userId, title });
		return null;
	}

	try {
		const targetDb = clientOrDb || db;
		const isTransactional = Boolean(clientOrDb && clientOrDb !== db);
		const result = await targetDb.query(
			`INSERT INTO notifications (user_id, title, message, type, data, is_read)
			 VALUES ($1, $2, $3, $4, $5, false)
			 RETURNING id, user_id, title, message, type, data, is_read, created_at`,
			[userId, title, message, type, JSON.stringify(data)],
		);

		const notification = result.rows[0];

		// If operating within an uncommitted transaction, do not emit over socket yet.
		// Caller will emit after COMMIT succeeds to prevent broadcasting phantom notifications.
		if (!isTransactional && !options.skipSocket) {
			emitNotification(notification);
		}

		return notification;
	} catch (err) {
		console.error("Failed to send notification:", err);
		return null;
	}
}

module.exports = {
	sendNotification,
	emitNotification,
};
