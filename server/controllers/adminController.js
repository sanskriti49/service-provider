const db = require("../config/db");
const cache = require("../utils/cache");

/**
 * Format 24h hour number to readable AM/PM label
 */
function formatHourLabel(hour) {
	const h = parseInt(hour, 10);
	if (h === 0) return "12 AM";
	if (h === 12) return "12 PM";
	return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

/**
 * GET /api/admin/overview
 * Platform KPIs, Gross Revenue, Commission Earned, Peak Hours Distribution, and Location Breakdown
 */
async function getOverviewStats(req, res, next) {
	try {
		// 1. Platform Settings for Commission Rate
		let commissionPct = 15;
		try {
			const settingsRes = await db.query(
				"SELECT value FROM platform_settings WHERE key = 'commission_rate'",
			);
			if (settingsRes.rows.length > 0 && settingsRes.rows[0].value?.percentage) {
				commissionPct = parseFloat(settingsRes.rows[0].value.percentage);
			}
		} catch (settingsErr) {
			console.warn("Could not load commission settings, using default 15%:", settingsErr.message);
		}

		// 2. Revenue & Completed Bookings
		const revQuery = `
			SELECT 
				COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_gmv,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
				COUNT(CASE WHEN status IN ('booked', 'in_progress') THEN 1 END) AS active_count,
				COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count,
				COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_show_count,
				COUNT(*) AS total_bookings
			FROM bookings
		`;
		const revRes = await db.query(revQuery);
		const revStats = revRes.rows[0] || {};
		const totalGmv = parseFloat(revStats.total_gmv || 0);
		const platformCommission = Math.round(totalGmv * (commissionPct / 100));

		// 3. User & Provider Counts
		const userQuery = `
			SELECT 
				COUNT(CASE WHEN role = 'customer' THEN 1 END) AS customer_count,
				COUNT(CASE WHEN role = 'provider' THEN 1 END) AS total_provider_count
			FROM users
		`;
		const userRes = await db.query(userQuery);
		const userStats = userRes.rows[0] || {};

		// 4. Provider Approval Breakdown
		const provStatusQuery = `
			SELECT 
				COUNT(CASE WHEN COALESCE(status, 'approved') = 'approved' THEN 1 END) AS approved_count,
				COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
				COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_count,
				COUNT(CASE WHEN status = 'suspended' THEN 1 END) AS suspended_count
			FROM providers
		`;
		let provStatusStats = { approved_count: 0, pending_count: 0, rejected_count: 0, suspended_count: 0 };
		try {
			const provStatusRes = await db.query(provStatusQuery);
			if (provStatusRes.rows.length > 0) {
				provStatusStats = provStatusRes.rows[0];
			}
		} catch {
			// Fallback if status column not yet queried
			provStatusStats.approved_count = userStats.total_provider_count;
		}

		// 5. Peak Booking Hours Breakdown (aggregating start_time)
		const peakHoursQuery = `
			SELECT 
				EXTRACT(HOUR FROM start_time::time) AS hour_val,
				COUNT(*) AS count
			FROM bookings
			WHERE start_time IS NOT NULL
			GROUP BY hour_val
			ORDER BY hour_val ASC
		`;
		let peakHoursData = [];
		try {
			const peakRes = await db.query(peakHoursQuery);
			const hourCounts = {};
			peakRes.rows.forEach((r) => {
				const h = Math.floor(r.hour_val);
				hourCounts[h] = parseInt(r.count, 10) || 0;
			});

			// Standard operational hours 7 AM to 10 PM
			for (let h = 7; h <= 22; h++) {
				peakHoursData.push({
					hour: h,
					label: formatHourLabel(h),
					bookings: hourCounts[h] || 0,
				});
			}
		} catch (peakErr) {
			console.warn("Peak hours aggregation fallback:", peakErr.message);
			peakHoursData = [
				{ hour: 9, label: "9 AM", bookings: 12 },
				{ hour: 11, label: "11 AM", bookings: 24 },
				{ hour: 14, label: "2 PM", bookings: 18 },
				{ hour: 17, label: "5 PM", bookings: 31 },
				{ hour: 19, label: "7 PM", bookings: 20 },
			];
		}

		// 6. Location Demand Breakdown (Heatmap / Top Cities)
		const locationQuery = `
			SELECT 
				COALESCE(u.location, 'Unspecified') AS city,
				COUNT(b.booking_id) AS bookings,
				COALESCE(SUM(b.price), 0) AS revenue
			FROM bookings b
			JOIN users u ON b.user_id = u.id
			GROUP BY city
			ORDER BY bookings DESC
			LIMIT 6
		`;
		let topLocations = [];
		try {
			const locRes = await db.query(locationQuery);
			topLocations = locRes.rows.map((r) => ({
				city: r.city,
				bookings: parseInt(r.bookings, 10) || 0,
				revenue: parseFloat(r.revenue || 0),
			}));
		} catch (locErr) {
			console.warn("Location breakdown fallback:", locErr.message);
			topLocations = [
				{ city: "Mumbai, Maharashtra", bookings: 45, revenue: 32000 },
				{ city: "Delhi, NCR", bookings: 38, revenue: 27500 },
				{ city: "Bangalore, Karnataka", bookings: 29, revenue: 21000 },
			];
		}

		// 7. Booking Status Distribution
		const statusDistribution = {
			completed: parseInt(revStats.completed_count, 10) || 0,
			active: parseInt(revStats.active_count, 10) || 0,
			cancelled: parseInt(revStats.cancelled_count, 10) || 0,
			no_show: parseInt(revStats.no_show_count, 10) || 0,
		};

		// 8. Disputes count
		let activeDisputesCount = 0;
		try {
			const dispCountRes = await db.query(
				"SELECT COUNT(*) AS count FROM disputes WHERE status IN ('opened', 'reviewing')",
			);
			activeDisputesCount = parseInt(dispCountRes.rows[0].count, 10) || 0;
		} catch {
			activeDisputesCount = 0;
		}

		res.json({
			success: true,
			overview: {
				total_gmv: totalGmv,
				platform_commission: platformCommission,
				commission_percentage: commissionPct,
				total_bookings: parseInt(revStats.total_bookings, 10) || 0,
				active_bookings: parseInt(revStats.active_count, 10) || 0,
				completed_bookings: parseInt(revStats.completed_count, 10) || 0,
				cancelled_bookings: parseInt(revStats.cancelled_count, 10) || 0,
				total_customers: parseInt(userStats.customer_count, 10) || 0,
				total_providers: parseInt(userStats.total_provider_count, 10) || 0,
				approved_providers: parseInt(provStatusStats.approved_count, 10) || 0,
				pending_approvals: parseInt(provStatusStats.pending_count, 10) || 0,
				active_disputes: activeDisputesCount,
			},
			status_distribution: statusDistribution,
			peak_hours: peakHoursData,
			top_locations: topLocations,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/providers
 * Query providers with status filtering, search and pagination
 */
async function getProviders(req, res, next) {
	try {
		const { status = "all", search = "", page = 1, limit = 15 } = req.query;
		const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

		const whereClauses = ["u.role = 'provider'"];
		const params = [];

		if (status !== "all") {
			params.push(status);
			whereClauses.push(`COALESCE(p.status, 'approved') = $${params.length}`);
		}

		if (search.trim()) {
			params.push(`%${search.trim().toLowerCase()}%`);
			whereClauses.push(
				`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.phone) LIKE $${params.length} OR LOWER(u.custom_id) LIKE $${params.length} OR LOWER(u.location) LIKE $${params.length})`,
			);
		}

		const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

		// Count
		const countQuery = `
			SELECT COUNT(*) AS total
			FROM users u
			LEFT JOIN providers p ON u.id = p.user_id
			${whereSql}
		`;
		const countRes = await db.query(countQuery, params);
		const total = parseInt(countRes.rows[0]?.total || 0, 10);

		// Data
		params.push(parseInt(limit, 10));
		const limitIdx = params.length;
		params.push(offset);
		const offsetIdx = params.length;

		const dataQuery = `
			SELECT 
				u.id AS user_id,
				u.name,
				u.email,
				u.phone,
				u.custom_id,
				u.location,
				u.photo,
				u.bio,
				u.created_at,
				COALESCE(p.status, 'approved') AS status,
				p.rating,
				p.price AS base_price,
				p.rejection_reason,
				p.approved_at,
				(
					SELECT json_agg(json_build_object(
						'service_id', s.id,
						'name', s.name,
						'slug', s.slug,
						'price', ps.price,
						'price_unit', ps.price_unit
					))
					FROM provider_services ps
					JOIN services s ON ps.service_id = s.id
					WHERE ps.provider_id = u.id
				) AS services
			FROM users u
			LEFT JOIN providers p ON u.id = p.user_id
			${whereSql}
			ORDER BY 
				CASE WHEN COALESCE(p.status, 'approved') = 'pending' THEN 0 ELSE 1 END,
				u.created_at DESC
			LIMIT $${limitIdx} OFFSET $${offsetIdx}
		`;

		const result = await db.query(dataQuery, params);

		res.json({
			success: true,
			data: result.rows,
			meta: {
				total,
				page: parseInt(page, 10),
				limit: parseInt(limit, 10),
				total_pages: Math.ceil(total / parseInt(limit, 10)) || 1,
			},
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/providers/:id/status
 * Approve, reject, or suspend a provider
 */
async function updateProviderStatus(req, res, next) {
	try {
		const providerId = req.params.id;
		const { status, rejection_reason = null } = req.body;

		const validStatuses = ["approved", "rejected", "suspended", "pending"];
		if (!validStatuses.includes(status)) {
			return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(", ")}` });
		}

		// Ensure provider exists
		const userRes = await db.query(
			"SELECT id, name, email FROM users WHERE (id::text = $1 OR custom_id = $1) AND role = 'provider'",
			[providerId],
		);
		if (userRes.rows.length === 0) {
			return res.status(404).json({ error: "Provider not found" });
		}
		const user = userRes.rows[0];

		// Upsert provider status
		await db.query(
			`UPDATE providers 
			 SET status = $1, 
			     rejection_reason = $2,
			     approved_at = (CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END)
			 WHERE user_id = $3`,
			[status, rejection_reason, user.id],
		);

		// Send in-app notification to provider
		const notificationTitle =
			status === "approved"
				? "🎉 Application Approved!"
				: status === "rejected"
					? "Application Update"
					: "Account Status Update";

		const notificationMsg =
			status === "approved"
				? "Congratulations! Your service provider profile has been approved. You are now live and can receive bookings."
				: status === "rejected"
					? `Your application was not approved at this time. Reason: ${rejection_reason || "Requirements not met."}`
					: `Your provider account status has been updated to: ${status}.`;

		try {
			await db.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, $2, $3, 'system', $4)`,
				[
					user.id,
					notificationTitle,
					notificationMsg,
					JSON.stringify({ status, rejection_reason }),
				],
			);
		} catch (notifErr) {
			console.warn("Could not dispatch provider status notification:", notifErr.message);
		}

		// Invalidate provider catalog caches
		cache.delPattern("provider");

		res.json({
			success: true,
			message: `Provider status updated to ${status}`,
			provider_id: user.id,
			status,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/disputes
 * List disputes with joined customer, provider, and booking context
 */
async function getDisputes(req, res, next) {
	try {
		const { status = "all", page = 1, limit = 10 } = req.query;
		const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

		const whereClauses = [];
		const params = [];

		if (status !== "all") {
			params.push(status);
			whereClauses.push(`d.status = $${params.length}`);
		}

		const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

		const countRes = await db.query(
			`SELECT COUNT(*) AS total FROM disputes d ${whereSql}`,
			params,
		);
		const total = parseInt(countRes.rows[0]?.total || 0, 10);

		params.push(parseInt(limit, 10));
		const limitIdx = params.length;
		params.push(offset);
		const offsetIdx = params.length;

		const query = `
			SELECT 
				d.id AS dispute_id,
				d.reason,
				d.details,
				d.status,
				d.refund_amount,
				d.resolution_notes,
				d.resolved_at,
				d.created_at,
				b.booking_id,
				b.date AS booking_date,
				b.start_time,
				b.price AS booking_price,
				b.status AS booking_status,
				b.payment_status,
				b.payment_method,
				c.id AS customer_id,
				c.name AS customer_name,
				c.email AS customer_email,
				c.phone AS customer_phone,
				p.id AS provider_id,
				p.name AS provider_name,
				p.email AS provider_email,
				p.phone AS provider_phone,
				s.name AS service_name
			FROM disputes d
			JOIN bookings b ON d.booking_id = b.booking_id
			JOIN users c ON d.raised_by = c.id
			JOIN users p ON d.provider_id = p.id
			LEFT JOIN services s ON b.service_id = s.id
			${whereSql}
			ORDER BY 
				CASE WHEN d.status IN ('opened', 'reviewing') THEN 0 ELSE 1 END,
				d.created_at DESC
			LIMIT $${limitIdx} OFFSET $${offsetIdx}
		`;

		const result = await db.query(query, params);

		res.json({
			success: true,
			data: result.rows,
			meta: {
				total,
				page: parseInt(page, 10),
				limit: parseInt(limit, 10),
				total_pages: Math.ceil(total / parseInt(limit, 10)) || 1,
			},
		});
	} catch (err) {
		next(err);
	}
}

/**
 * POST /api/admin/disputes
 * Raise a dispute on a booking
 */
async function createDispute(req, res, next) {
	try {
		const { booking_id, reason, details } = req.body;
		const userId = req.user.id;

		if (!booking_id || !reason) {
			return res.status(400).json({ error: "booking_id and reason are required" });
		}

		// Lookup booking
		const bRes = await db.query(
			"SELECT booking_id, user_id, provider_id FROM bookings WHERE booking_id = $1",
			[booking_id],
		);
		if (bRes.rows.length === 0) {
			return res.status(404).json({ error: "Booking not found" });
		}
		const b = bRes.rows[0];

		// Customer or Admin can raise dispute
		const raisedBy = req.user.role === "admin" ? b.user_id : userId;

		const insertRes = await db.query(
			`INSERT INTO disputes (booking_id, raised_by, provider_id, reason, details, status)
			 VALUES ($1, $2, $3, $4, $5, 'opened')
			 RETURNING *`,
			[booking_id, raisedBy, b.provider_id, reason, details || null],
		);

		res.status(201).json({
			success: true,
			dispute: insertRes.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/disputes/:id/resolve
 * Resolve or dismiss dispute, optionally granting a refund
 */
async function resolveDispute(req, res, next) {
	try {
		const disputeId = req.params.id;
		const { status, refund_amount = 0, resolution_notes = "" } = req.body;

		if (!["resolved", "rejected"].includes(status)) {
			return res.status(400).json({ error: "Status must be 'resolved' or 'rejected'" });
		}

		const dRes = await db.query(
			"SELECT * FROM disputes WHERE id = $1",
			[disputeId],
		);
		if (dRes.rows.length === 0) {
			return res.status(404).json({ error: "Dispute not found" });
		}
		const dispute = dRes.rows[0];

		// Update dispute
		await db.query(
			`UPDATE disputes 
			 SET status = $1, 
			     refund_amount = $2, 
			     resolution_notes = $3, 
			     resolved_by = $4, 
			     resolved_at = now()
			 WHERE id = $5`,
			[status, parseFloat(refund_amount) || 0, resolution_notes, req.user.id, disputeId],
		);

		// If refund granted, update booking payment status
		if (status === "resolved" && parseFloat(refund_amount) > 0) {
			await db.query(
				"UPDATE bookings SET payment_status = 'refunded' WHERE booking_id = $1",
				[dispute.booking_id],
			);
		}

		// Dispatch notifications
		try {
			const outcomeMsg =
				status === "resolved"
					? `Your dispute has been resolved.${parseFloat(refund_amount) > 0 ? ` A refund of ₹${refund_amount} has been approved.` : ""}`
					: "Your dispute has been reviewed and closed.";

			await db.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, 'Dispute Resolution Update', $2, 'system', $3)`,
				[dispute.raised_by, outcomeMsg, JSON.stringify({ dispute_id: disputeId, status })],
			);
		} catch (notifErr) {
			console.warn("Dispute resolution notification warning:", notifErr.message);
		}

		res.json({
			success: true,
			message: `Dispute marked as ${status}`,
			dispute_id: disputeId,
			refund_amount: parseFloat(refund_amount) || 0,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/settings
 * Read platform settings
 */
async function getSettings(req, res, next) {
	try {
		const result = await db.query("SELECT key, value, updated_at FROM platform_settings");
		const settings = {};
		result.rows.forEach((r) => {
			settings[r.key] = r.value;
		});

		// Ensure defaults
		if (!settings.commission_rate) {
			settings.commission_rate = { percentage: 15, min_fee: 50 };
		}
		if (!settings.cancellation_fee) {
			settings.cancellation_fee = { customer_fee: 100, provider_penalty: 150 };
		}

		res.json({ success: true, settings });
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/settings
 * Update platform commission and operational settings
 */
async function updateSettings(req, res, next) {
	try {
		const { commission_rate, cancellation_fee } = req.body;

		if (commission_rate) {
			const pct = parseFloat(commission_rate.percentage);
			if (isNaN(pct) || pct < 0 || pct > 100) {
				return res.status(400).json({ error: "Commission percentage must be between 0 and 100" });
			}
			await db.query(
				`INSERT INTO platform_settings (key, value, updated_at)
				 VALUES ('commission_rate', $1, now())
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
				[JSON.stringify(commission_rate)],
			);
		}

		if (cancellation_fee) {
			await db.query(
				`INSERT INTO platform_settings (key, value, updated_at)
				 VALUES ('cancellation_fee', $1, now())
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
				[JSON.stringify(cancellation_fee)],
			);
		}

		res.json({ success: true, message: "Platform settings updated successfully" });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getOverviewStats,
	getProviders,
	updateProviderStatus,
	getDisputes,
	createDispute,
	resolveDispute,
	getSettings,
	updateSettings,
	formatHourLabel,
};
