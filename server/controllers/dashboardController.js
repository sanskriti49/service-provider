const db = require("../config/db");

// ── Customer Dashboard Stats ───────────────────────────────────────────────────
const getCustomerDashboardStats = async (req, res) => {
	const userId = req.user.id;

	try {
		const [statsRes, upcomingRes, historyRes] = await Promise.all([
			db.query(
				`SELECT 
                    COALESCE(SUM(CASE WHEN status='completed' THEN price ELSE 0 END), 0) as total_spent,
                    COUNT(CASE WHEN status='completed' THEN 1 END) as total_completed
                FROM bookings
                WHERE user_id=$1`,
				[userId],
			),
			db.query(
				`SELECT b.booking_id, b.date, b.start_time, s.name AS service_name, u.name AS provider_name, u.photo AS provider_photo
                FROM bookings b
                JOIN services s ON s.id=b.service_id
                JOIN users u ON u.id=b.provider_id
                WHERE b.user_id=$1 AND b.date>=NOW() AND b.status!='cancelled'
                ORDER BY b.date ASC
                LIMIT 1`,
				[userId],
			),
			db.query(
				`SELECT COUNT(*) AS active_count
                FROM bookings b
                WHERE user_id=$1 AND date>=NOW() AND status != 'cancelled'`,
				[userId],
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
		console.error("Customer Dashboard Error:", err);
		res.status(500).json({ message: "Server error loading dashboard" });
	}
};

// ── Provider Dashboard Stats (Added Fix) ───────────────────────────────────────
const getProviderDashboardStats = async (req, res) => {
	// Read the ID parameter passed from the frontend request parameter string
	const providerId = req.params.id;

	try {
		const [metricsRes, ratingRes] = await Promise.all([
			// Query 1: Calculate core booking aggregations for this provider
			db.query(
				`SELECT 
                    COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_earnings,
                    COUNT(CASE WHEN status IN ('pending', 'confirmed', 'in_progress') THEN 1 END) AS active_jobs,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_jobs,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_jobs,
                    COUNT(DISTINCT user_id) AS total_customers
                 FROM bookings 
                 WHERE provider_id = $1`,
				[providerId],
			),
			// Query 2: Get the provider's rating directly from the providers table
			db.query(`SELECT rating FROM providers WHERE user_id = $1`, [providerId]),
		]);

		const metrics = metricsRes.rows[0];
		const providerRow = ratingRes.rows[0];

		// Format the payload structure to exactly match what ProviderDashboard.jsx expects
		res.json({
			stats: {
				total_earnings: parseFloat(metrics.total_earnings),
				active_jobs: parseInt(metrics.active_jobs) || 0,
				completed_jobs: parseInt(metrics.completed_jobs) || 0,
				pending_jobs: parseInt(metrics.pending_jobs) || 0,
				total_customers: parseInt(metrics.total_customers) || 0,
				avg_rating: providerRow?.rating ? parseFloat(providerRow.rating) : null,
			},
			pending_notifications: parseInt(metrics.pending_jobs) || 0, // Highlights pending actions
		});
	} catch (err) {
		console.error("Provider Dashboard Metrics Error:", err);
		res.status(500).json({ error: "Server error loading provider statistics" });
	}
};

module.exports = {
	getCustomerDashboardStats,
	getProviderDashboardStats,
};
