const db = require("../config/db");
const cache = require("../utils/cache");
const { sendNotification } = require("../utils/notificationService");

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveProviderId(clientOrPool, idOrCustomId) {
	if (!idOrCustomId) return null;
	const value = String(idOrCustomId).trim();
	let result;
	if (UUID_REGEX.test(value)) {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE id = $1::uuid AND role = 'provider'`,
			[value],
		);
	} else {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE custom_id = $1 AND role = 'provider'`,
			[value],
		);
	}
	return result.rows[0]?.id ?? null;
}

async function createReview(req, res, next) {
	const customerId = req.user.id;
	const { provider_id, booking_id, rating, comment, tags } = req.body;

	const numRating = parseInt(rating, 10);
	if (isNaN(numRating) || numRating < 1 || numRating > 5) {
		return res
			.status(400)
			.json({ error: "Rating must be an integer between 1 and 5" });
	}

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		// Fall back to the booking's provider when the caller omits provider_id,
		// so a review tied to a booking cannot fail on a missing field.
		let targetProviderId = await resolveProviderId(client, provider_id);
		if (!targetProviderId && booking_id && UUID_REGEX.test(booking_id)) {
			const fromBooking = await client.query(
				`SELECT provider_id FROM bookings WHERE booking_id = $1::uuid AND user_id = $2`,
				[booking_id, customerId],
			);
			targetProviderId = fromBooking.rows[0]?.provider_id || null;
		}
		if (!targetProviderId) {
			await client.query("ROLLBACK");
			return res.status(404).json({ error: "Provider not found" });
		}

		if (customerId === targetProviderId) {
			await client.query("ROLLBACK");
			return res
				.status(400)
				.json({ error: "You cannot review your own profile" });
		}

		let validBookingId = null;
		if (booking_id && UUID_REGEX.test(booking_id)) {
			const bCheck = await client.query(
				`SELECT booking_id, user_id, provider_id, status FROM bookings WHERE booking_id = $1::uuid`,
				[booking_id],
			);
			if (bCheck.rows.length > 0) {
				const b = bCheck.rows[0];
				if (b.user_id === customerId) {
					validBookingId = b.booking_id;
				}
			}
		}

		let insertRes;
		if (validBookingId) {
			const existingReview = await client.query(
				`SELECT id FROM reviews WHERE booking_id = $1 AND customer_id = $2`,
				[validBookingId, customerId],
			);

			if (existingReview.rows.length > 0) {
				insertRes = await client.query(
					`UPDATE reviews 
					 SET rating = $1, comment = $2, tags = $3, created_at = NOW() 
					 WHERE id = $4 
					 RETURNING *`,
					[
						numRating,
						comment ? comment.trim() : "",
						JSON.stringify(tags || []),
						existingReview.rows[0].id,
					],
				);
			}
		}

		if (!insertRes) {
			insertRes = await client.query(
				`INSERT INTO reviews (customer_id, provider_id, booking_id, rating, comment, tags)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 RETURNING *`,
				[
					customerId,
					targetProviderId,
					validBookingId,
					numRating,
					comment ? comment.trim() : "",
					JSON.stringify(tags || []),
				],
			);
		}

		const avgRes = await client.query(
			`SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS total_reviews 
			 FROM reviews 
			 WHERE provider_id = $1`,
			[targetProviderId],
		);

		const newRating = parseFloat(avgRes.rows[0]?.avg_rating) || 5.0;
		await client.query(
			`UPDATE providers SET rating = $1 WHERE user_id = $2`,
			[newRating, targetProviderId],
		);

		await client.query("COMMIT");

		try {
			const cRes = await db.query(`SELECT name FROM users WHERE id = $1`, [customerId]);
			const customerName = cRes.rows[0]?.name || "A customer";

			sendNotification({
				userId: targetProviderId,
				title: "New Review Received ⭐",
				message: `${customerName} rated you ${numRating} stars: "${comment ? comment.substring(0, 80) : 'Great service!'}"`,
				type: "review_received",
				data: {
					rating: numRating,
					booking_id: validBookingId,
					customer_name: customerName,
				},
			});
		} catch (notifErr) {
			console.warn("Review notification error:", notifErr);
		}

		cache.delPattern(`reviews_${targetProviderId}`);
		cache.delPattern(`provider_${targetProviderId}`);

		res.status(201).json({
			message: "Review submitted successfully",
			review: insertRes.rows[0],
			updated_provider_rating: newRating,
		});
	} catch (err) {
		await client.query("ROLLBACK");
		console.error("Create review error:", err);
		next(err);
	} finally {
		client.release();
	}
}

async function getProviderReviews(req, res, next) {
	try {
		const { provider_id } = req.params;
		const targetProviderId = await resolveProviderId(db, provider_id);
		if (!targetProviderId) {
			return res.status(404).json({ error: "Provider not found" });
		}

		const cacheKey = `reviews_${targetProviderId}`;
		const cachedData = cache.get(cacheKey);
		if (cachedData) {
			return res.json(cachedData);
		}

		const [reviewsRes, statsRes] = await Promise.all([
			db.query(
				`SELECT r.id, r.rating, r.comment, r.tags, r.created_at, r.booking_id,
				        u.name AS customer_name, u.photo AS customer_photo, u.custom_id AS customer_custom_id,
				        s.name AS service_name, s.slug AS service_slug,
				        b.date AS booking_date
				 FROM reviews r
				 JOIN users u ON u.id = r.customer_id
				 LEFT JOIN bookings b ON b.booking_id = r.booking_id
				 LEFT JOIN services s ON s.id = b.service_id
				 WHERE r.provider_id = $1
				 ORDER BY r.created_at DESC
				 LIMIT 50`,
				[targetProviderId],
			),
			db.query(
				`SELECT 
					COUNT(*) AS total_reviews,
					ROUND(COALESCE(AVG(rating), 5.0)::numeric, 1) AS average_rating,
					COUNT(CASE WHEN rating = 5 THEN 1 END) AS count_5,
					COUNT(CASE WHEN rating = 4 THEN 1 END) AS count_4,
					COUNT(CASE WHEN rating = 3 THEN 1 END) AS count_3,
					COUNT(CASE WHEN rating = 2 THEN 1 END) AS count_2,
					COUNT(CASE WHEN rating = 1 THEN 1 END) AS count_1,
					ROUND((COUNT(CASE WHEN rating >= 4 THEN 1 END)::numeric / GREATEST(COUNT(*), 1)::numeric * 100)) AS satisfaction_rate
				 FROM reviews
				 WHERE provider_id = $1`,
				[targetProviderId],
			),
		]);

		const stats = statsRes.rows[0] || {};
		const total = parseInt(stats.total_reviews, 10) || 0;

		const responsePayload = {
			provider_id: targetProviderId,
			total_reviews: total,
			average_rating: parseFloat(stats.average_rating) || 5.0,
			satisfaction_rate: parseInt(stats.satisfaction_rate, 10) || 100,
			distribution: {
				5: parseInt(stats.count_5, 10) || 0,
				4: parseInt(stats.count_4, 10) || 0,
				3: parseInt(stats.count_3, 10) || 0,
				2: parseInt(stats.count_2, 10) || 0,
				1: parseInt(stats.count_1, 10) || 0,
			},
			reviews: reviewsRes.rows.map((r) => ({
				id: r.id,
				rating: r.rating,
				comment: r.comment,
				tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : [],
				created_at: r.created_at,
				booking_id: r.booking_id,
				booking_date: r.booking_date,
				service_name: r.service_name || "General Service",
				service_slug: r.service_slug,
				customer: {
					name: r.customer_name,
					photo: r.customer_photo,
					custom_id: r.customer_custom_id,
				},
			})),
		};

		cache.set(cacheKey, responsePayload, 120000);
		res.json(responsePayload);
	} catch (err) {
		console.error("Get provider reviews error:", err);
		next(err);
	}
}

async function getMyProviderReviews(req, res, next) {
	try {
		const providerId = req.user.id;
		const { rating, search, sort = "recent", limit = 50, page = 1 } = req.query;

		const statsRes = await db.query(
			`SELECT 
				COUNT(*) AS total_reviews,
				ROUND(COALESCE(AVG(rating), 5.0)::numeric, 1) AS average_rating,
				COUNT(CASE WHEN rating = 5 THEN 1 END) AS count_5,
				COUNT(CASE WHEN rating = 4 THEN 1 END) AS count_4,
				COUNT(CASE WHEN rating = 3 THEN 1 END) AS count_3,
				COUNT(CASE WHEN rating = 2 THEN 1 END) AS count_2,
				COUNT(CASE WHEN rating = 1 THEN 1 END) AS count_1,
				ROUND((COUNT(CASE WHEN rating >= 4 THEN 1 END)::numeric / GREATEST(COUNT(*), 1)::numeric * 100)) AS satisfaction_rate
			 FROM reviews
			 WHERE provider_id = $1`,
			[providerId],
		);

		const stats = statsRes.rows[0] || {};
		const total = parseInt(stats.total_reviews, 10) || 0;

		const params = [providerId];
		const whereClauses = ["r.provider_id = $1"];

		if (rating && rating !== "all") {
			params.push(parseInt(rating, 10));
			whereClauses.push(`r.rating = $${params.length}`);
		}

		if (search && search.trim()) {
			params.push(`%${search.trim().toLowerCase()}%`);
			whereClauses.push(
				`(LOWER(r.comment) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length} OR LOWER(s.name) LIKE $${params.length})`,
			);
		}

		let orderClause = "r.created_at DESC";
		if (sort === "highest") orderClause = "r.rating DESC, r.created_at DESC";
		if (sort === "lowest") orderClause = "r.rating ASC, r.created_at DESC";

		const pageNum = Math.max(1, parseInt(page, 10) || 1);
		const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
		const offset = (pageNum - 1) * limitNum;

		params.push(limitNum, offset);
		const reviewsQuery = `
			SELECT r.id, r.rating, r.comment, r.tags, r.created_at, r.booking_id,
			       u.id AS customer_id, u.name AS customer_name, u.photo AS customer_photo, u.custom_id AS customer_custom_id,
			       s.name AS service_name, s.slug AS service_slug,
			       b.date AS booking_date
			FROM reviews r
			JOIN users u ON u.id = r.customer_id
			LEFT JOIN bookings b ON b.booking_id = r.booking_id
			LEFT JOIN services s ON s.id = b.service_id
			WHERE ${whereClauses.join(" AND ")}
			ORDER BY ${orderClause}
			LIMIT $${params.length - 1} OFFSET $${params.length}
		`;

		const reviewsRes = await db.query(reviewsQuery, params);

		res.json({
			total_reviews: total,
			average_rating: parseFloat(stats.average_rating) || 5.0,
			satisfaction_rate: parseInt(stats.satisfaction_rate, 10) || 100,
			distribution: {
				5: parseInt(stats.count_5, 10) || 0,
				4: parseInt(stats.count_4, 10) || 0,
				3: parseInt(stats.count_3, 10) || 0,
				2: parseInt(stats.count_2, 10) || 0,
				1: parseInt(stats.count_1, 10) || 0,
			},
			reviews: reviewsRes.rows.map((r) => ({
				id: r.id,
				rating: r.rating,
				comment: r.comment,
				tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === "string" ? JSON.parse(r.tags || "[]") : [],
				created_at: r.created_at,
				booking_id: r.booking_id,
				booking_date: r.booking_date,
				service_name: r.service_name || "General Service",
				service_slug: r.service_slug,
				customer: {
					id: r.customer_id,
					name: r.customer_name,
					photo: r.customer_photo,
					custom_id: r.customer_custom_id,
				},
			})),
		});
	} catch (err) {
		console.error("Get my provider reviews error:", err);
		next(err);
	}
}

async function getBookingReview(req, res, next) {
	try {
		const { booking_id } = req.params;
		if (!UUID_REGEX.test(booking_id)) {
			return res.status(400).json({ error: "Invalid booking ID" });
		}

		const result = await db.query(
			`SELECT r.*, u.name as customer_name 
			 FROM reviews r 
			 JOIN users u ON u.id = r.customer_id 
			 WHERE r.booking_id = $1::uuid`,
			[booking_id],
		);

		if (result.rows.length === 0) {
			return res.json({ has_review: false, review: null });
		}

		res.json({ has_review: true, review: result.rows[0] });
	} catch (err) {
		next(err);
	}
}

async function getAllReviews(req, res, next) {
	try {
		const {
			rating,
			service,
			sort = "recent",
			search,
			provider_id,
			limit = 50,
			page = 1,
		} = req.query;

		const numLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
		const offset = Math.max((parseInt(page, 10) || 1) - 1, 0) * numLimit;

		const whereClauses = [];
		const params = [];
		let paramIdx = 1;

		if (rating) {
			const numRating = parseInt(rating, 10);
			if (!isNaN(numRating) && numRating >= 1 && numRating <= 5) {
				whereClauses.push(`r.rating = $${paramIdx++}`);
				params.push(numRating);
			}
		}

		if (service && service !== "all") {
			whereClauses.push(`(s.slug = $${paramIdx} OR s.name ILIKE $${paramIdx})`);
			params.push(service);
			paramIdx++;
		}

		if (provider_id) {
			const resolvedPid = await resolveProviderId(db, provider_id);
			if (resolvedPid) {
				whereClauses.push(`r.provider_id = $${paramIdx++}`);
				params.push(resolvedPid);
			}
		}

		if (search && search.trim()) {
			whereClauses.push(
				`(r.comment ILIKE $${paramIdx} OR u_cust.name ILIKE $${paramIdx} OR u_prov.name ILIKE $${paramIdx} OR s.name ILIKE $${paramIdx})`,
			);
			params.push(`%${search.trim()}%`);
			paramIdx++;
		}

		const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

		let orderSql = "ORDER BY r.created_at DESC";
		if (sort === "highest") {
			orderSql = "ORDER BY r.rating DESC, r.created_at DESC";
		} else if (sort === "lowest") {
			orderSql = "ORDER BY r.rating ASC, r.created_at DESC";
		}

		const countQuery = `
			SELECT 
				COUNT(*) AS total,
				ROUND(COALESCE(AVG(r.rating), 5.0)::numeric, 1) AS avg_rating,
				COUNT(CASE WHEN r.rating = 5 THEN 1 END) AS count_5,
				COUNT(CASE WHEN r.rating = 4 THEN 1 END) AS count_4,
				COUNT(CASE WHEN r.rating = 3 THEN 1 END) AS count_3,
				COUNT(CASE WHEN r.rating = 2 THEN 1 END) AS count_2,
				COUNT(CASE WHEN r.rating = 1 THEN 1 END) AS count_1
			FROM reviews r
			LEFT JOIN bookings b ON b.booking_id = r.booking_id
			LEFT JOIN services s ON s.id = b.service_id
			LEFT JOIN users u_cust ON u_cust.id = r.customer_id
			LEFT JOIN users u_prov ON u_prov.id = r.provider_id
			${whereSql}
		`;

		const reviewsQuery = `
			SELECT 
				r.id, r.rating, r.comment, r.tags, r.created_at, r.booking_id,
				u_cust.id AS customer_id, u_cust.name AS customer_name, u_cust.photo AS customer_photo, u_cust.custom_id AS customer_custom_id,
				u_prov.id AS provider_id, u_prov.name AS provider_name, u_prov.photo AS provider_photo, u_prov.custom_id AS provider_custom_id,
				p.rating AS provider_rating, p.is_verified AS provider_is_verified, p.verification_badge AS provider_badge,
				COALESCE(s.name, 'Home Service') AS service_name,
				COALESCE(s.slug, 'home-service') AS service_slug
			FROM reviews r
			LEFT JOIN bookings b ON b.booking_id = r.booking_id
			LEFT JOIN services s ON s.id = b.service_id
			LEFT JOIN users u_cust ON u_cust.id = r.customer_id
			LEFT JOIN users u_prov ON u_prov.id = r.provider_id
			LEFT JOIN providers p ON p.user_id = r.provider_id
			${whereSql}
			${orderSql}
			LIMIT $${paramIdx++} OFFSET $${paramIdx++}
		`;

		const queryParams = [...params, numLimit, offset];

		const [countRes, reviewsRes] = await Promise.all([
			db.query(countQuery, params),
			db.query(reviewsQuery, queryParams),
		]);

		const stats = countRes.rows[0] || {};
		const total = parseInt(stats.total, 10) || 0;
		const count5 = parseInt(stats.count_5, 10) || 0;
		const count4 = parseInt(stats.count_4, 10) || 0;
		const satisfactionRate = total > 0 ? Math.round(((count5 + count4) / total) * 100) : 98;

		res.json({
			total_reviews: total,
			average_rating: parseFloat(stats.avg_rating) || 5.0,
			satisfaction_rate: satisfactionRate,
			page: parseInt(page, 10) || 1,
			limit: numLimit,
			distribution: {
				5: count5,
				4: count4,
				3: parseInt(stats.count_3, 10) || 0,
				2: parseInt(stats.count_2, 10) || 0,
				1: parseInt(stats.count_1, 10) || 0,
			},
			reviews: reviewsRes.rows.map((r) => ({
				id: r.id,
				rating: r.rating,
				comment: r.comment,
				tags: Array.isArray(r.tags)
					? r.tags
					: typeof r.tags === "string"
						? JSON.parse(r.tags || "[]")
						: [],
				created_at: r.created_at,
				booking_id: r.booking_id,
				service: {
					name: r.service_name,
					slug: r.service_slug,
				},
				customer: {
					id: r.customer_id,
					name: r.customer_name,
					photo: r.customer_photo,
					custom_id: r.customer_custom_id,
				},
				provider: {
					id: r.provider_id,
					name: r.provider_name,
					photo: r.provider_photo,
					custom_id: r.provider_custom_id,
					rating: r.provider_rating,
					is_verified: r.provider_is_verified,
					verification_badge: r.provider_badge,
				},
			})),
		});
	} catch (err) {
		console.error("Get all reviews error:", err);
		next(err);
	}
}

module.exports = {
	createReview,
	getProviderReviews,
	getMyProviderReviews,
	getBookingReview,
	getAllReviews,
};
