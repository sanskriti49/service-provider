const db = require("../config/db");

const getProviderEarningsSummary = async (req, res) => {
	const providerId = req.user.id;

	try {
		const query = `
            SELECT 
                -- All-time completed earnings
                COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_earnings,
                
                -- Pending payouts (Escrow holds for active jobs)
                COALESCE(SUM(CASE WHEN payment_status = 'paid' AND status IN ('pending', 'confirmed', 'in_progress') THEN price ELSE 0 END), 0) AS pending_payout,
                
                -- Total jobs completed
                COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_jobs,
                
                -- Earnings from current calendar month
                COALESCE(SUM(CASE WHEN status = 'completed' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE) THEN price ELSE 0 END), 0) AS this_month,
                
                -- Earnings from last calendar month
                COALESCE(SUM(CASE WHEN status = 'completed' AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month') THEN price ELSE 0 END), 0) AS last_month
            FROM bookings
            WHERE provider_id = $1;
        `;

		const result = await db.query(query, [providerId]);
		const stats = result.rows[0];

		const total_earnings = parseFloat(stats.total_earnings);
		const pending_payout = parseFloat(stats.pending_payout);
		const this_month = parseFloat(stats.this_month);
		const last_month = parseFloat(stats.last_month);
		const completed_jobs = parseInt(stats.completed_jobs) || 0;

		let growth_pct = 0;
		if (last_month > 0) {
			growth_pct = Math.round(((this_month - last_month) / last_month) * 100);
		} else if (this_month > 0) {
			growth_pct = 100;
		}

		res.json({
			total_earnings,
			this_month,
			last_month,
			pending_payout,
			completed_jobs,
			growth_pct,
		});
	} catch (err) {
		console.error("Provider Earnings Summary Error:", err);
		res
			.status(500)
			.json({ error: "Server error parsing earnings summary statistics" });
	}
};

const getProviderMonthlyChartData = async (req, res) => {
	const providerId = req.user.id;

	try {
		// sums completed earnings grouped by month for the last 6 calendar months
		const query = `
            SELECT 
                to_char(date, 'Mon') AS label,
                SUM(price)::float AS amount,
                date_trunc('month', date) AS month_order
            FROM bookings
            WHERE provider_id = $1 AND status = 'completed' AND date >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY label, month_order
            ORDER BY month_order ASC;
        `;

		const result = await db.query(query, [providerId]);
		res.json(result.rows);
	} catch (err) {
		console.error("Monthly Chart Analytics Error:", err);
		res
			.status(500)
			.json({ error: "Server error compiling chart breakdown data" });
	}
};

const getProviderTransactionsList = async (req, res) => {
	const providerId = req.user.id;
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 8;
	const offset = (page - 1) * limit;

	try {
		const countQuery = `
            SELECT COUNT(*) FROM bookings 
            WHERE provider_id = $1 AND payment_status = 'paid';
        `;

		const dataQuery = `
            SELECT 
                b.booking_id,
                b.date,
                b.price AS amount,
                b.status,
                CASE WHEN b.status = 'cancelled' THEN 'deduction' ELSE 'credit' END AS type,
                s.name AS service_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.provider_id = $1 AND b.payment_status = 'paid'
            ORDER BY b.date DESC, b.updated_at DESC
            LIMIT $2 OFFSET $3;
        `;

		const [countRes, dataRes] = await Promise.all([
			db.query(countQuery, [providerId]),
			db.query(dataQuery, [providerId, limit, offset]),
		]);

		const totalItems = parseInt(countRes.rows[0].count) || 0;
		const totalPages = Math.ceil(totalItems / limit);

		res.json({
			meta: {
				current_page: page,
				items_per_page: limit,
				total_items: totalItems,
				total_pages: totalPages,
				has_next_page: page < totalPages,
			},
			data: dataRes.rows,
		});
	} catch (err) {
		console.error("Transactions Pagination Error:", err);
		res.status(500).json({
			error: "Server error retrieving paginated transactional ledger",
		});
	}
};

module.exports = {
	getProviderEarningsSummary,
	getProviderMonthlyChartData,
	getProviderTransactionsList,
};
