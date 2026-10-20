const db = require("../config/db");
const { ensureSupportTable } = require("../routes/supportRoutes");
const { ensureChatReportsTable } = require("../utils/chatService");
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

		// 9. Open support tickets count
		let openSupportTicketsCount = 0;
		try {
			await ensureSupportTable();
			const stRes = await db.query(
				"SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open', 'in_progress')"
			);
			openSupportTicketsCount = parseInt(stRes.rows[0].count, 10) || 0;
		} catch {
			openSupportTicketsCount = 0;
		}

		// 10. Pending chat reports count
		let pendingChatReportsCount = 0;
		try {
			await ensureChatReportsTable(db);
			const crRes = await db.query(
				"SELECT COUNT(*) AS count FROM chat_reports WHERE status IN ('pending', 'investigating')"
			);
			pendingChatReportsCount = parseInt(crRes.rows[0].count, 10) || 0;
		} catch {
			pendingChatReportsCount = 0;
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
				open_support_tickets: openSupportTicketsCount,
				pending_chat_reports: pendingChatReportsCount,
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
				(SELECT MIN(ps.price) FROM provider_services ps WHERE ps.provider_id = u.id) AS base_price,
				p.rejection_reason,
				p.approved_at,
				p.kyc_doc_type,
				p.kyc_doc_number,
				p.kyc_doc_front,
				p.kyc_doc_back,
				COALESCE(p.kyc_status, 'pending') AS kyc_status,
				COALESCE(p.is_verified, false) AS is_verified,
				p.verification_badge,
				p.verified_at,
				p.kyc_submitted_at,
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

		// Upsert provider status & sync KYC verification if approved
		await db.query(
			`UPDATE providers 
			 SET status = $1::varchar,
			     rejection_reason = $2,
			     approved_at = (CASE WHEN $1::text = 'approved' THEN now() ELSE approved_at END),
			     kyc_status = (CASE WHEN $1::text = 'approved' THEN 'verified' WHEN $1::text = 'rejected' THEN 'rejected' ELSE kyc_status END),
			     is_verified = (CASE WHEN $1::text = 'approved' THEN TRUE WHEN $1::text IN ('rejected', 'suspended') THEN FALSE ELSE is_verified END),
			     verification_badge = (CASE WHEN $1::text = 'approved' THEN 'verified_pro' ELSE verification_badge END),
			     verified_at = (CASE WHEN $1::text = 'approved' THEN now() ELSE verified_at END)
			 WHERE user_id = $3`,
			[status, rejection_reason, user.id],
		);

		// Send in-app notification to provider
		const notificationTitle =
			status === "approved"
				? "🎉 Application Approved & Verified!"
				: status === "rejected"
					? "Application Update"
					: "Account Status Update";

		const notificationMsg =
			status === "approved"
				? "Congratulations! Your service provider profile and identity documents have been approved. You now hold the Gold 'Verified Pro' badge and can receive bookings."
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
 * PUT /api/admin/providers/:id/kyc
 * Explicitly verify or reject a provider's KYC documents & toggle Verified Pro badge
 */
async function updateProviderKyc(req, res, next) {
	try {
		const providerId = req.params.id;
		const { kyc_status, rejection_reason = null } = req.body;

		const validKycStatuses = ["verified", "rejected", "pending"];
		if (!validKycStatuses.includes(kyc_status)) {
			return res.status(400).json({ error: `Invalid kyc_status. Allowed: ${validKycStatuses.join(", ")}` });
		}

		const userRes = await db.query(
			"SELECT id, name, email FROM users WHERE (id::text = $1 OR custom_id = $1) AND role = 'provider'",
			[providerId],
		);
		if (userRes.rows.length === 0) {
			return res.status(404).json({ error: "Provider not found" });
		}
		const user = userRes.rows[0];

		const isVerified = kyc_status === "verified";
		const badge = isVerified ? "verified_pro" : null;

		await db.query(
			`UPDATE providers
			 SET kyc_status = $1::varchar,
			     is_verified = $2::boolean,
			     verification_badge = $3,
			     verified_at = (CASE WHEN $2::boolean THEN now() ELSE NULL END),
			     rejection_reason = (CASE WHEN $1::text = 'rejected' THEN $4 ELSE rejection_reason END)
			 WHERE user_id = $5`,
			[kyc_status, isVerified, badge, rejection_reason, user.id],
		);

		const title = isVerified ? "🎖️ Verified Pro Badge Awarded!" : "KYC Document Verification Update";
		const msg = isVerified
			? "Congratulations! Your identity & background check documents have been verified. You have been awarded the Gold 'Verified Pro' badge!"
			: `Your KYC verification was not approved. Reason: ${rejection_reason || "Documents could not be verified."}`;

		try {
			await db.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, $2, $3, 'system', $4)`,
				[user.id, title, msg, JSON.stringify({ kyc_status, is_verified: isVerified })],
			);
		} catch (notifErr) {
			console.warn("Could not dispatch KYC status notification:", notifErr.message);
		}

		cache.delPattern("provider");

		res.json({
			success: true,
			message: `Provider KYC updated to ${kyc_status}`,
			provider_id: user.id,
			kyc_status,
			is_verified: isVerified,
			verification_badge: badge,
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
    const { BookingError, lockBooking } = require("../utils/bookingLifecycle");
    const { paymentService } = require("./bookingController");
    const amount = Number(req.body.refund_amount || 0);
    if (!["resolved", "rejected"].includes(req.body.status) || !Number.isFinite(amount) || amount < 0 || !/^\d+(?:\.\d{1,2})?$/.test(String(req.body.refund_amount || 0)) || (req.body.status === "rejected" && amount > 0)) return res.status(400).json({ error: "Invalid dispute status or refund amount" });
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const found = await client.query("SELECT booking_id FROM disputes WHERE id=$1", [req.params.id]);
        if (!found.rows.length) throw new BookingError(404, "Dispute not found");
        const booking = await lockBooking(client, found.rows[0].booking_id);
        const locked = await client.query("SELECT * FROM disputes WHERE id=$1 FOR UPDATE", [req.params.id]);
        const dispute = locked.rows[0];
        if (!["opened", "reviewing"].includes(dispute.status)) throw new BookingError(409, "Dispute already resolved");
        if (amount > 0) {
            await paymentService.requestRefund(client, booking, Math.round(amount * 100), `dispute:${dispute.id}`);
            await client.query("UPDATE bookings SET status=CASE WHEN status IN ('pending','booked','confirmed','in_progress') THEN 'cancelled' ELSE status END, updated_at=NOW() WHERE booking_id=$1", [booking.booking_id]);
        }
        await client.query("UPDATE disputes SET status=$1,refund_amount=$2,resolution_notes=$3,resolved_by=$4,resolved_at=NOW() WHERE id=$5", [req.body.status, amount, req.body.resolution_notes || "", req.user.id, dispute.id]);
        await client.query("COMMIT");
        res.json({ success: true, message: "Dispute resolved; any refund is pending gateway confirmation", refund_pending: amount > 0 });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (error.status) return res.status(error.status).json({ error: error.message });
        next(error);
    } finally { client.release(); }
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


/**
 * GET /api/admin/admins
 * List administrators for ticket/moderation assignment
 */
async function getAdmins(req, res, next) {
	try {
		const resUsers = await db.query(
			"SELECT id, name, email, photo FROM users WHERE role = 'admin' ORDER BY name ASC"
		);
		res.json({ success: true, admins: resUsers.rows });
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/support/tickets
 * Work queue: list support tickets with ownership, priority, and reply counts
 */
async function getSupportTickets(req, res, next) {
	try {
		await ensureSupportTable();
		const {
			status = "all",
			priority = "all",
			category = "all",
			assigned_to = "all",
			search = "",
			page = 1,
			limit = 20,
		} = req.query;

		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
		const offset = (pageNum - 1) * limitNum;

		const conditions = [];
		const values = [];

		if (status && status !== "all") {
			values.push(status);
			conditions.push(`st.status = $${values.length}`);
		}
		if (priority && priority !== "all") {
			values.push(priority);
			conditions.push(`st.priority = $${values.length}`);
		}
		if (category && category !== "all") {
			values.push(category);
			conditions.push(`st.category = $${values.length}`);
		}
		if (assigned_to && assigned_to !== "all") {
			if (assigned_to === "unassigned") {
				conditions.push("st.assigned_to IS NULL");
			} else if (assigned_to === "me") {
				values.push(req.user.id);
				conditions.push(`st.assigned_to = $${values.length}`);
			} else {
				values.push(assigned_to);
				conditions.push(`st.assigned_to = $${values.length}`);
			}
		}
		if (search && search.trim()) {
			values.push(`%${search.trim().toLowerCase()}%`);
			conditions.push(
				`(LOWER(st.ticket_number) LIKE $${values.length} OR LOWER(st.name) LIKE $${values.length} OR LOWER(st.email) LIKE $${values.length} OR LOWER(st.subject) LIKE $${values.length} OR LOWER(st.message) LIKE $${values.length})`
			);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const countRes = await db.query(
			`SELECT COUNT(*) AS total FROM support_tickets st ${whereClause}`,
			values
		);
		const total = parseInt(countRes.rows[0].total, 10) || 0;

		const countsRes = await db.query(`
			SELECT 
				COUNT(*) AS all_count,
				COUNT(CASE WHEN status = 'open' THEN 1 END) AS open_count,
				COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS in_progress_count,
				COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved_count,
				COUNT(CASE WHEN status = 'closed' THEN 1 END) AS closed_count,
				COUNT(CASE WHEN assigned_to IS NULL AND status IN ('open', 'in_progress') THEN 1 END) AS unassigned_count
			FROM support_tickets
		`);
		const counts = {
			all: parseInt(countsRes.rows[0].all_count, 10) || 0,
			open: parseInt(countsRes.rows[0].open_count, 10) || 0,
			in_progress: parseInt(countsRes.rows[0].in_progress_count, 10) || 0,
			resolved: parseInt(countsRes.rows[0].resolved_count, 10) || 0,
			closed: parseInt(countsRes.rows[0].closed_count, 10) || 0,
			unassigned: parseInt(countsRes.rows[0].unassigned_count, 10) || 0,
		};

		const dataValues = [...values, limitNum, offset];
		const dataQuery = `
			SELECT 
				st.*,
				au.name AS assigned_to_name,
				au.email AS assigned_to_email,
				ru.name AS resolved_by_name,
				(SELECT COUNT(*) FROM support_ticket_replies WHERE ticket_id = st.id) AS reply_count
			FROM support_tickets st
			LEFT JOIN users au ON st.assigned_to = au.id
			LEFT JOIN users ru ON st.resolved_by = ru.id
			${whereClause}
			ORDER BY 
				CASE WHEN st.status = 'open' THEN 1 WHEN st.status = 'in_progress' THEN 2 ELSE 3 END,
				CASE WHEN st.priority = 'urgent' THEN 1 WHEN st.priority = 'high' THEN 2 ELSE 3 END,
				st.created_at DESC
			LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
		`;
		const dataRes = await db.query(dataQuery, dataValues);

		res.json({
			success: true,
			tickets: dataRes.rows,
			counts,
			pagination: {
				total,
				page: pageNum,
				limit: limitNum,
				pages: Math.ceil(total / limitNum) || 1,
			},
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/support/tickets/:id
 * Detailed ticket view with conversation thread (public & internal replies)
 */
async function getSupportTicketById(req, res, next) {
	try {
		await ensureSupportTable();
		const { id } = req.params;
		let query;
		let val;
		if (/^\d+$/.test(id)) {
			query = `
				SELECT st.*, au.name AS assigned_to_name, au.email AS assigned_to_email, ru.name AS resolved_by_name
				FROM support_tickets st
				LEFT JOIN users au ON st.assigned_to = au.id
				LEFT JOIN users ru ON st.resolved_by = ru.id
				WHERE st.id = $1
			`;
			val = [parseInt(id, 10)];
		} else {
			query = `
				SELECT st.*, au.name AS assigned_to_name, au.email AS assigned_to_email, ru.name AS resolved_by_name
				FROM support_tickets st
				LEFT JOIN users au ON st.assigned_to = au.id
				LEFT JOIN users ru ON st.resolved_by = ru.id
				WHERE st.ticket_number = $1
			`;
			val = [id];
		}

		const ticketRes = await db.query(query, val);
		if (!ticketRes.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketRes.rows[0];

		const repliesRes = await db.query(
			`SELECT r.*, u.photo AS sender_photo, u.role AS sender_user_role
			 FROM support_ticket_replies r
			 LEFT JOIN users u ON r.sender_id = u.id
			 WHERE r.ticket_id = $1
			 ORDER BY r.created_at ASC`,
			[ticket.id]
		);

		res.json({
			success: true,
			ticket,
			replies: repliesRes.rows,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/support/tickets/:id/assign
 * Set ownership / assign ticket to an administrator
 */
async function assignSupportTicket(req, res, next) {
	try {
		await ensureSupportTable();
		const { id } = req.params;
		let { assigned_to } = req.body;

		if (assigned_to === "me") {
			assigned_to = req.user.id;
		} else if (assigned_to === "" || assigned_to === null || assigned_to === "unassigned") {
			assigned_to = null;
		}

		let assigneeName = "Unassigned";
		if (assigned_to) {
			const adminCheck = await db.query(
				"SELECT id, name, email FROM users WHERE id = $1 AND role = 'admin'",
				[assigned_to]
			);
			if (!adminCheck.rows.length) {
				return res.status(400).json({ error: "Tickets can only be assigned to administrator staff." });
			}
			assigneeName = adminCheck.rows[0].name;
		}

		const ticketCheck = await db.query(
			/^\d+$/.test(id)
				? "SELECT * FROM support_tickets WHERE id = $1"
				: "SELECT * FROM support_tickets WHERE ticket_number = $1",
			[/^\d+$/.test(id) ? parseInt(id, 10) : id]
		);
		if (!ticketCheck.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketCheck.rows[0];

		const newStatus = assigned_to && ticket.status === "open" ? "in_progress" : ticket.status;

		await db.query(
			`UPDATE support_tickets
			 SET assigned_to = $1, status = $2, updated_at = NOW()
			 WHERE id = $3`,
			[assigned_to, newStatus, ticket.id]
		);

		await db.query(
			`INSERT INTO support_ticket_replies (ticket_id, sender_id, sender_name, sender_role, message, is_internal)
			 VALUES ($1, $2, $3, 'admin', $4, true)`,
			[
				ticket.id,
				req.user.id,
				req.user.name || "Admin Staff",
				`Ticket assigned to ${assigneeName} by ${req.user.name || "Admin"}.`,
			]
		);

		const fullTicketRes = await db.query(
			`SELECT st.*, au.name AS assigned_to_name, au.email AS assigned_to_email, ru.name AS resolved_by_name
			 FROM support_tickets st
			 LEFT JOIN users au ON st.assigned_to = au.id
			 LEFT JOIN users ru ON st.resolved_by = ru.id
			 WHERE st.id = $1`,
			[ticket.id]
		);

		res.json({
			success: true,
			ticket: fullTicketRes.rows[0],
			message: `Ticket assigned to ${assigneeName}`,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * POST /api/admin/support/tickets/:id/replies
 */
async function replySupportTicket(req, res, next) {
	try {
		await ensureSupportTable();
		const { id } = req.params;
		const { message, is_internal = false, status } = req.body;

		if (!message || typeof message !== "string" || !message.trim()) {
			return res.status(400).json({ error: "Reply message cannot be empty" });
		}

		const ticketCheck = await db.query(
			/^\d+$/.test(id)
				? "SELECT * FROM support_tickets WHERE id = $1"
				: "SELECT * FROM support_tickets WHERE ticket_number = $1",
			[/^\d+$/.test(id) ? parseInt(id, 10) : id]
		);
		if (!ticketCheck.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketCheck.rows[0];

		const insertReply = await db.query(
			`INSERT INTO support_ticket_replies (ticket_id, sender_id, sender_name, sender_role, message, is_internal)
			 VALUES ($1, $2, $3, 'admin', $4, $5)
			 RETURNING *`,
			[
				ticket.id,
				req.user.id,
				req.user.name || "Support Staff",
				message.trim(),
				Boolean(is_internal),
			]
		);

		let updatedTicket = ticket;
		if (status && ["open", "in_progress", "resolved", "closed"].includes(status)) {
			const isResolving = status === "resolved" || status === "closed";
			const upRes = await db.query(
				`UPDATE support_tickets
				 SET status = $1,
				     resolved_at = (CASE WHEN $2 THEN NOW() ELSE resolved_at END),
				     resolved_by = (CASE WHEN $2 THEN $3 ELSE resolved_by END),
				     updated_at = NOW()
				 WHERE id = $4
				 RETURNING *`,
				[status, isResolving, req.user.id, ticket.id]
			);
			updatedTicket = upRes.rows[0];
		} else {
			await db.query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [ticket.id]);
		}

		if (!is_internal && ticket.user_id) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'support', $4)`,
					[
						ticket.user_id,
						"💬 Support Ticket Response",
						`Support staff replied to ticket #${ticket.ticket_number}: "${ticket.subject}"`,
						JSON.stringify({ ticket_number: ticket.ticket_number, ticket_id: ticket.id }),
					]
				);
			} catch (notifErr) {
				console.warn("Could not dispatch customer ticket reply notification:", notifErr.message);
			}
		}

		res.json({
			success: true,
			reply: insertReply.rows[0],
			ticket: updatedTicket,
			message: is_internal ? "Internal note added" : "Reply sent to customer",
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/support/tickets/:id/resolve
 * Track resolution with notes, timestamp, and resolver ID
 */
async function resolveSupportTicket(req, res, next) {
	try {
		await ensureSupportTable();
		const { id } = req.params;
		const { status = "resolved", resolution_notes = "" } = req.body;

		if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
			return res.status(400).json({ error: "Invalid status" });
		}

		const ticketCheck = await db.query(
			/^\d+$/.test(id)
				? "SELECT * FROM support_tickets WHERE id = $1"
				: "SELECT * FROM support_tickets WHERE ticket_number = $1",
			[/^\d+$/.test(id) ? parseInt(id, 10) : id]
		);
		if (!ticketCheck.rows.length) {
			return res.status(404).json({ error: "Support ticket not found" });
		}
		const ticket = ticketCheck.rows[0];

		const isResolved = status === "resolved" || status === "closed";

		const updateRes = await db.query(
			`UPDATE support_tickets
			 SET status = $1,
			     resolution_notes = COALESCE($2, resolution_notes),
			     resolved_at = (CASE WHEN $3 THEN NOW() ELSE NULL END),
			     resolved_by = (CASE WHEN $3 THEN $4 ELSE NULL END),
			     updated_at = NOW()
			 WHERE id = $5
			 RETURNING *`,
			[status, resolution_notes.trim() || null, isResolved, req.user.id, ticket.id]
		);

		const logMsg = isResolved
			? `Ticket marked as ${status} by ${req.user.name || "Admin"}.${resolution_notes ? ` Resolution notes: ${resolution_notes.trim()}` : ""}`
			: `Ticket reopened to ${status} by ${req.user.name || "Admin"}.`;

		await db.query(
			`INSERT INTO support_ticket_replies (ticket_id, sender_id, sender_name, sender_role, message, is_internal)
			 VALUES ($1, $2, $3, 'admin', $4, true)`,
			[ticket.id, req.user.id, req.user.name || "Admin", logMsg]
		);

		if (isResolved && ticket.user_id) {
			try {
				await db.query(
					`INSERT INTO notifications (user_id, title, message, type, data)
					 VALUES ($1, $2, $3, 'support', $4)`,
					[
						ticket.user_id,
						"✅ Support Ticket Resolved",
						`Your support ticket #${ticket.ticket_number} has been marked as ${status}.${resolution_notes ? ` Notes: ${resolution_notes}` : ""}`,
						JSON.stringify({ ticket_number: ticket.ticket_number, status }),
					]
				);
			} catch (notifErr) {
				console.warn("Could not dispatch ticket resolution notification:", notifErr.message);
			}
		}

		res.json({
			success: true,
			ticket: updateRes.rows[0],
			message: `Ticket successfully updated to ${status}`,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/moderation/reports
 * Surface chat reports with reporter/reported users, reasons, and ownership
 */
async function getModerationReports(req, res, next) {
	try {
		await ensureChatReportsTable(db);
		const {
			status = "all",
			reason = "all",
			assigned_to = "all",
			search = "",
			page = 1,
			limit = 20,
		} = req.query;

		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
		const offset = (pageNum - 1) * limitNum;

		const conditions = [];
		const values = [];

		if (status && status !== "all") {
			values.push(status);
			conditions.push(`cr.status = $${values.length}`);
		}
		if (reason && reason !== "all") {
			values.push(reason);
			conditions.push(`cr.reason = $${values.length}`);
		}
		if (assigned_to && assigned_to !== "all") {
			if (assigned_to === "unassigned") {
				conditions.push("cr.assigned_to IS NULL");
			} else if (assigned_to === "me") {
				values.push(req.user.id);
				conditions.push(`cr.assigned_to = $${values.length}`);
			} else {
				values.push(assigned_to);
				conditions.push(`cr.assigned_to = $${values.length}`);
			}
		}
		if (search && search.trim()) {
			values.push(`%${search.trim().toLowerCase()}%`);
			conditions.push(
				`(LOWER(cr.reason) LIKE $${values.length} OR LOWER(COALESCE(cr.details, '')) LIKE $${values.length} OR LOWER(rep.name) LIKE $${values.length} OR LOWER(rep.email) LIKE $${values.length} OR LOWER(tar.name) LIKE $${values.length} OR LOWER(tar.email) LIKE $${values.length} OR LOWER(cr.booking_id::text) LIKE $${values.length})`
			);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const countRes = await db.query(
			`SELECT COUNT(*) AS total
			 FROM chat_reports cr
			 JOIN users rep ON cr.reporter_id = rep.id
			 JOIN users tar ON cr.reported_user_id = tar.id
			 ${whereClause}`,
			values
		);
		const total = parseInt(countRes.rows[0].total, 10) || 0;

		const countsRes = await db.query(`
			SELECT 
				COUNT(*) AS all_count,
				COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
				COUNT(CASE WHEN status = 'investigating' THEN 1 END) AS investigating_count,
				COUNT(CASE WHEN status = 'actioned' THEN 1 END) AS actioned_count,
				COUNT(CASE WHEN status = 'dismissed' THEN 1 END) AS dismissed_count,
				COUNT(CASE WHEN assigned_to IS NULL AND status IN ('pending', 'investigating') THEN 1 END) AS unassigned_count
			FROM chat_reports
		`);
		const counts = {
			all: parseInt(countsRes.rows[0].all_count, 10) || 0,
			pending: parseInt(countsRes.rows[0].pending_count, 10) || 0,
			investigating: parseInt(countsRes.rows[0].investigating_count, 10) || 0,
			actioned: parseInt(countsRes.rows[0].actioned_count, 10) || 0,
			dismissed: parseInt(countsRes.rows[0].dismissed_count, 10) || 0,
			unassigned: parseInt(countsRes.rows[0].unassigned_count, 10) || 0,
		};

		const dataValues = [...values, limitNum, offset];
		const dataQuery = `
			SELECT 
				cr.*,
				rep.name AS reporter_name,
				rep.email AS reporter_email,
				rep.role AS reporter_role,
				tar.name AS reported_name,
				tar.email AS reported_email,
				tar.role AS reported_role,
				tar.custom_id AS reported_custom_id,
				b.status AS booking_status,
				b.price AS booking_price,
				au.name AS assigned_to_name,
				au.email AS assigned_to_email,
				ru.name AS resolved_by_name
			FROM chat_reports cr
			JOIN users rep ON cr.reporter_id = rep.id
			JOIN users tar ON cr.reported_user_id = tar.id
			LEFT JOIN bookings b ON cr.booking_id = b.booking_id
			LEFT JOIN users au ON cr.assigned_to = au.id
			LEFT JOIN users ru ON cr.resolved_by = ru.id
			${whereClause}
			ORDER BY 
				CASE WHEN cr.status = 'pending' THEN 1 WHEN cr.status = 'investigating' THEN 2 ELSE 3 END,
				cr.created_at DESC
			LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}
		`;
		const dataRes = await db.query(dataQuery, dataValues);

		res.json({
			success: true,
			reports: dataRes.rows,
			counts,
			pagination: {
				total,
				page: pageNum,
				limit: limitNum,
				pages: Math.ceil(total / limitNum) || 1,
			},
		});
	} catch (err) {
		next(err);
	}
}

/**
 * GET /api/admin/moderation/reports/:id
 * Retrieve report details and surrounding chat context
 */
async function getModerationReportById(req, res, next) {
	try {
		await ensureChatReportsTable(db);
		const { id } = req.params;

		const repRes = await db.query(
			`SELECT 
				cr.*,
				rep.name AS reporter_name,
				rep.email AS reporter_email,
				rep.role AS reporter_role,
				tar.name AS reported_name,
				tar.email AS reported_email,
				tar.role AS reported_role,
				tar.custom_id AS reported_custom_id,
				p.status AS reported_provider_status,
				b.status AS booking_status,
				b.price AS booking_price,
				b.service_id,
				s.name AS service_name,
				au.name AS assigned_to_name,
				au.email AS assigned_to_email,
				ru.name AS resolved_by_name
			FROM chat_reports cr
			JOIN users rep ON cr.reporter_id = rep.id
			JOIN users tar ON cr.reported_user_id = tar.id
			LEFT JOIN providers p ON tar.id = p.user_id
			LEFT JOIN bookings b ON cr.booking_id = b.booking_id
			LEFT JOIN services s ON b.service_id = s.id
			LEFT JOIN users au ON cr.assigned_to = au.id
			LEFT JOIN users ru ON cr.resolved_by = ru.id
			WHERE cr.id = $1`,
			[id]
		);

		if (!repRes.rows.length) {
			return res.status(404).json({ error: "Moderation report not found" });
		}
		const report = repRes.rows[0];

		let chatMessages = [];
		try {
			if (report.message_id) {
				const mid = String(report.message_id);
				const chatRes = await db.query(
					`(SELECT cm.id, cm.booking_id, cm.sender_id, cm.body, cm.body AS message, cm.created_at, cm.read_at,
					         u.name AS sender_name, u.role AS sender_role
					  FROM chat_messages cm
					  JOIN users u ON cm.sender_id = u.id
					  WHERE cm.booking_id = $1 AND cm.id <= $2
					  ORDER BY cm.id DESC
					  LIMIT 35)
					 UNION ALL
					 (SELECT cm.id, cm.booking_id, cm.sender_id, cm.body, cm.body AS message, cm.created_at, cm.read_at,
					         u.name AS sender_name, u.role AS sender_role
					  FROM chat_messages cm
					  JOIN users u ON cm.sender_id = u.id
					  WHERE cm.booking_id = $1 AND cm.id > $2
					  ORDER BY cm.id ASC
					  LIMIT 35)
					 ORDER BY id ASC`,
					[report.booking_id, mid]
				);
				chatMessages = chatRes.rows;
			} else {
				const chatRes = await db.query(
					`SELECT cm.id, cm.booking_id, cm.sender_id, cm.body, cm.body AS message, cm.created_at, cm.read_at,
					        u.name AS sender_name, u.role AS sender_role
					 FROM (
					     SELECT * FROM chat_messages
					     WHERE booking_id = $1
					     ORDER BY id DESC
					     LIMIT 80
					 ) cm
					 JOIN users u ON cm.sender_id = u.id
					 ORDER BY cm.id ASC`,
					[report.booking_id]
				);
				chatMessages = chatRes.rows;
			}
		} catch (chatErr) {
			console.warn("Could not load chat messages for report context:", chatErr.message);
		}

		res.json({
			success: true,
			report,
			messages: chatMessages,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/moderation/reports/:id/assign
 * Set ownership / assign report to investigator
 */
async function assignModerationReport(req, res, next) {
	try {
		await ensureChatReportsTable(db);
		const { id } = req.params;
		let { assigned_to } = req.body;

		if (assigned_to === "me") {
			assigned_to = req.user.id;
		} else if (assigned_to === "" || assigned_to === null || assigned_to === "unassigned") {
			assigned_to = null;
		}

		let assigneeName = "Unassigned";
		if (assigned_to) {
			const adminCheck = await db.query(
				"SELECT id, name, email FROM users WHERE id = $1 AND role = 'admin'",
				[assigned_to]
			);
			if (!adminCheck.rows.length) {
				return res.status(400).json({ error: "Moderation reports can only be assigned to administrator staff." });
			}
			assigneeName = adminCheck.rows[0].name;
		}

		const reportCheck = await db.query("SELECT * FROM chat_reports WHERE id = $1", [id]);
		if (!reportCheck.rows.length) {
			return res.status(404).json({ error: "Moderation report not found" });
		}
		const report = reportCheck.rows[0];

		const newStatus = assigned_to && report.status === "pending" ? "investigating" : report.status;

		await db.query(
			`UPDATE chat_reports
			 SET assigned_to = $1, status = $2, updated_at = NOW()
			 WHERE id = $3`,
			[assigned_to, newStatus, id]
		);

		const fullReportRes = await db.query(
			`SELECT cr.*,
			        rep.name AS reporter_name, rep.email AS reporter_email, rep.role AS reporter_role,
			        tar.name AS reported_name, tar.email AS reported_email, tar.role AS reported_role,
			        tar.custom_id AS reported_custom_id,
			        au.name AS assigned_to_name, au.email AS assigned_to_email
			 FROM chat_reports cr
			 JOIN users rep ON cr.reporter_id = rep.id
			 JOIN users tar ON cr.reported_user_id = tar.id
			 LEFT JOIN users au ON cr.assigned_to = au.id
			 WHERE cr.id = $1`,
			[id]
		);

		res.json({
			success: true,
			report: fullReportRes.rows[0],
			message: `Report assigned to ${assigneeName}`,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * PUT /api/admin/moderation/reports/:id/resolve
 */
async function resolveModerationReport(req, res, next) {
	try {
		await ensureChatReportsTable(db);
		const { id } = req.params;
		const { status, action_taken, resolution_notes } = req.body;

		if (!["pending", "investigating", "actioned", "dismissed"].includes(status)) {
			return res.status(400).json({ error: "Invalid report status" });
		}

		const isResolved = status === "actioned" || status === "dismissed";

		const updateRes = await db.query(
			`UPDATE chat_reports
			 SET status = $1,
			     action_taken = COALESCE($2, action_taken),
			     resolution_notes = COALESCE($3, resolution_notes),
			     resolved_at = (CASE WHEN $4 THEN NOW() ELSE NULL END),
			     resolved_by = (CASE WHEN $4 THEN $5 ELSE NULL END),
			     updated_at = NOW()
			 WHERE id = $6
			 RETURNING *`,
			[status, action_taken || null, resolution_notes || null, isResolved, req.user.id, id]
		);

		if (!updateRes.rows.length) {
			return res.status(404).json({ error: "Moderation report not found" });
		}

		res.json({
			success: true,
			report: updateRes.rows[0],
			message: `Report status updated to ${status}`,
		});
	} catch (err) {
		next(err);
	}
}

/**
 * POST /api/admin/moderation/reports/:id/action
 * Execute a moderation action (warn user, suspend provider, dismiss)
 */
async function actionModerationReport(req, res, next) {
	let client;
	try {
		await ensureChatReportsTable(db);
		const { id } = req.params;
		const { action, warning_message, notes } = req.body;

		const allowedActions = ["warn", "suspend", "dismiss", "custom"];
		if (!action || !allowedActions.includes(action)) {
			return res.status(400).json({
				error: `Invalid moderation action. Must be one of: ${allowedActions.join(", ")}`,
			});
		}

		client = await db.connect();
		await client.query("BEGIN");

		// Lock report row to prevent concurrent duplicate actions
		const repRes = await client.query(
			`SELECT cr.*,
			        rep.name AS reporter_name, rep.email AS reporter_email, rep.role AS reporter_role,
			        tar.name AS reported_name, tar.email AS reported_email, tar.role AS reported_role,
			        tar.custom_id AS reported_custom_id
			 FROM chat_reports cr
			 JOIN users rep ON cr.reporter_id = rep.id
			 JOIN users tar ON cr.reported_user_id = tar.id
			 WHERE cr.id = $1
			 FOR UPDATE OF cr`,
			[id]
		);
		if (!repRes.rows.length) {
			await client.query("ROLLBACK");
			return res.status(404).json({ error: "Moderation report not found" });
		}
		const report = repRes.rows[0];

		// Guard repeated actions
		if (["actioned", "dismissed"].includes(report.status)) {
			await client.query("ROLLBACK");
			return res.status(409).json({
				error: `Report has already been ${report.status} (action: ${report.action_taken || "N/A"}). Reopening required to re-action.`,
			});
		}

		let actionDescription = "";

		if (action === "warn") {
			const warnText =
				warning_message?.trim() ||
				"A safety report was filed regarding your recent chat conduct. Please adhere to community guidelines to prevent account restrictions.";
			await client.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, $2, $3, 'system', $4)`,
				[
					report.reported_user_id,
					"⚠️ Trust & Safety Warning",
					warnText,
					JSON.stringify({ report_id: id, reason: report.reason }),
				]
			);
			actionDescription = `Official warning issued to user: "${warnText.slice(0, 100)}..."`;
		} else if (action === "suspend") {
			// Verify that reported user is actually an existing provider
			const provCheck = await client.query(
				"SELECT user_id, status FROM providers WHERE user_id = $1 FOR UPDATE",
				[report.reported_user_id]
			);
			if (!provCheck.rows.length) {
				await client.query("ROLLBACK");
				return res.status(400).json({
					error: "Cannot suspend: Reported user is not a registered service provider.",
				});
			}

			await client.query(
				"UPDATE providers SET status = 'suspended' WHERE user_id = $1",
				[report.reported_user_id]
			);
			await client.query(
				`INSERT INTO notifications (user_id, title, message, type, data)
				 VALUES ($1, $2, $3, 'system', $4)`,
				[
					report.reported_user_id,
					"⛔ Account Suspended",
					"Your provider account has been temporarily suspended due to Trust & Safety policy violations.",
					JSON.stringify({ report_id: id }),
				]
			);
			actionDescription = "Reported provider suspended for policy violation.";
		} else if (action === "dismiss") {
			actionDescription = "Report dismissed after investigation (no policy violation found).";
		} else {
			actionDescription = notes?.trim() || "Moderation action recorded.";
		}

		const newStatus = action === "dismiss" ? "dismissed" : "actioned";

		const updateRes = await client.query(
			`UPDATE chat_reports
			 SET status = $1,
			     action_taken = $2,
			     resolution_notes = COALESCE($3, resolution_notes),
			     resolved_at = NOW(),
			     resolved_by = $4,
			     updated_at = NOW()
			 WHERE id = $5
			 RETURNING *`,
			[newStatus, actionDescription, notes?.trim() || null, req.user.id, id]
		);

		await client.query("COMMIT");

		if (action === "suspend") {
			try {
				cache.delPattern("provider");
			} catch (cErr) {
				console.warn("Could not invalidate provider cache:", cErr.message);
			}
		}

		const fullReport = {
			...report,
			...updateRes.rows[0],
			resolved_by_name: req.user.name || "Administrator",
		};

		res.json({
			success: true,
			report: fullReport,
			action_taken: actionDescription,
			message: `Report successfully resolved with action: ${action}`,
		});
	} catch (err) {
		if (client) await client.query("ROLLBACK").catch(() => {});
		next(err);
	} finally {
		if (client) client.release();
	}
}

module.exports = {
	getOverviewStats,
	getProviders,
	updateProviderStatus,
	updateProviderKyc,
	getDisputes,
	createDispute,
	resolveDispute,
	getSettings,
	updateSettings,
	formatHourLabel,
	getAdmins,
	getSupportTickets,
	getSupportTicketById,
	assignSupportTicket,
	replySupportTicket,
	resolveSupportTicket,
	getModerationReports,
	getModerationReportById,
	assignModerationReport,
	resolveModerationReport,
	actionModerationReport,
};
