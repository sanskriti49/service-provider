const db = require("../config/db");

const getCustomerDashboardStats = async (req, res) => {
	const userId = req.user.id;

	try {
		const [statsRes, upcomingRes, historyRes] = await Promise.all([
			// 1. Get Stats (Total Spent & Count of completed jobs)
			db.query(
				`
                SELECT 
                    COALESCE(SUM(CASE WHEN status='completed' THEN price ELSE 0 END), 0) as total_spent,
                    COUNT(CASE WHEN status='completed' THEN 1 END) as total_completed
                FROM bookings
                WHERE user_id=$1`,
				[userId]
			),

			// 2. Get ONE next upcoming booking (For the "Upcoming" card)
			db.query(
				`
                SELECT b.booking_id, b.date, b.start_time, s.name AS service_name, u.name AS provider_name, u.photo AS provider_photo
                FROM bookings b
                JOIN services s ON s.id=b.service_id
                JOIN users u ON u.id=b.provider_id
                WHERE b.user_id=$1 AND b.date>=NOW() AND b.status!='cancelled'
                ORDER BY b.date ASC
                LIMIT 1`,
				[userId]
			),

			db.query(
				`SELECT COUNT(*) AS active_count
                FROM bookings b
                WHERE user_id=$1 AND date>=NOW() AND status != 'cancelled'
                `,
				[userId]
			),
		]);

		const stats = statsRes.rows[0];
		const nextBooking = upcomingRes.rows[0] || null;
		const activeCount = parseInt(historyRes.rows[0].active_count);

		res.json({
			stats: {
				total_spent: stats.total_spent,
				total_completed: stats.total_completed,
				active_tasks: activeCount,
			},
			next_booking: nextBooking,
		});
	} catch (err) {
		console.error("Dashboard Error:", err);
		res.status(500).json({ message: "Server error loading dashboard" });
	}
};
module.exports = { getCustomerDashboardStats };
