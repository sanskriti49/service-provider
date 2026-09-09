const db = require("../config/db");

async function getNotifications(req, res, next) {
	try {
		const userId = req.user.id;
		const limit = parseInt(req.query.limit, 10) || 50;

		const [listRes, countRes] = await Promise.all([
			db.query(
				`SELECT id, title, message, type, data, is_read, created_at
				 FROM notifications
				 WHERE user_id = $1
				 ORDER BY created_at DESC
				 LIMIT $2`,
				[userId, limit],
			),
			db.query(
				`SELECT COUNT(*) AS unread_count
				 FROM notifications
				 WHERE user_id = $1 AND is_read = false`,
				[userId],
			),
		]);

		res.json({
			unread_count: parseInt(countRes.rows[0]?.unread_count, 10) || 0,
			notifications: listRes.rows.map((row) => ({
				...row,
				data: typeof row.data === "string" ? JSON.parse(row.data) : (row.data || {}),
			})),
		});
	} catch (err) {
		console.error("Get notifications error:", err);
		next(err);
	}
}

async function markAsRead(req, res, next) {
	try {
		const userId = req.user.id;
		const { id } = req.params;

		const result = await db.query(
			`UPDATE notifications
			 SET is_read = true
			 WHERE id = $1 AND user_id = $2
			 RETURNING id, is_read`,
			[id, userId],
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: "Notification not found" });
		}

		res.json({ message: "Notification marked as read", notification: result.rows[0] });
	} catch (err) {
		console.error("Mark notification read error:", err);
		next(err);
	}
}

async function markAllAsRead(req, res, next) {
	try {
		const userId = req.user.id;

		await db.query(
			`UPDATE notifications
			 SET is_read = true
			 WHERE user_id = $1 AND is_read = false`,
			[userId],
		);

		res.json({ message: "All notifications marked as read" });
	} catch (err) {
		console.error("Mark all read error:", err);
		next(err);
	}
}

async function deleteNotification(req, res, next) {
	try {
		const userId = req.user.id;
		const { id } = req.params;

		await db.query(
			`DELETE FROM notifications
			 WHERE id = $1 AND user_id = $2`,
			[id, userId],
		);

		res.json({ message: "Notification deleted" });
	} catch (err) {
		console.error("Delete notification error:", err);
		next(err);
	}
}

async function clearReadNotifications(req, res, next) {
	try {
		const userId = req.user.id;

		await db.query(
			`DELETE FROM notifications
			 WHERE user_id = $1 AND is_read = true`,
			[userId],
		);

		res.json({ message: "Read notifications cleared" });
	} catch (err) {
		console.error("Clear notifications error:", err);
		next(err);
	}
}

module.exports = {
	getNotifications,
	markAsRead,
	markAllAsRead,
	deleteNotification,
	clearReadNotifications,
};
