const db = require("../config/db");
const { emitToUser } = require("./socket");

async function sendNotification({ userId, title, message, type = "system", data = {} }) {
	if (!userId || !title || !message) {
		console.warn("sendNotification called with missing parameters:", { userId, title });
		return null;
	}

	try {
		const result = await db.query(
			`INSERT INTO notifications (user_id, title, message, type, data, is_read)
			 VALUES ($1, $2, $3, $4, $5, false)
			 RETURNING id, user_id, title, message, type, data, is_read, created_at`,
			[userId, title, message, type, JSON.stringify(data)],
		);

		const notification = result.rows[0];

		emitToUser(userId, "notification:new", notification);

		return notification;
	} catch (err) {
		console.error("Failed to send notification:", err);
		return null;
	}
}

module.exports = {
	sendNotification,
};
