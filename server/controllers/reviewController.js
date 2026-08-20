const db = require("../config/db");
const cache = require("../utils/cache");

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

/**
 * Creates a review & rating for a provider
 */
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

		const targetProviderId = await resolveProviderId(client, provider_id);
		if (!targetProviderId) {
			await client.query("ROLLBACK");
			return res.status(404).json({ error: "Provider not found" });
		}

		// Prevent reviewing yourself
		if (customerId === targetProviderId) {
			await client.query("ROLLBACK");
			return res
				.status(400)
				.json({ error: "You cannot review your own profile" });
		}

		// If booking_id provided, check booking ownership
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

		// If booking already reviewed, update existing review instead of duplicate
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

		// Recalculate average rating for provider
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

		// Invalidate cache
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

/**
 * Gets reviews and rating statistics for a provider
 */
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
				        u.name AS customer_name, u.photo AS customer_photo, u.custom_id AS customer_custom_id
				 FROM reviews r
				 JOIN users u ON u.id = r.customer_id
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
					COUNT(CASE WHEN rating = 1 THEN 1 END) AS count_1
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
				customer: {
					name: r.customer_name,
					photo: r.customer_photo,
					custom_id: r.customer_custom_id,
				},
			})),
		};

		cache.set(cacheKey, responsePayload, 120000); // 2 min cache
		res.json(responsePayload);
	} catch (err) {
		console.error("Get provider reviews error:", err);
		next(err);
	}
}

/**
 * Checks if a specific booking has a review
 */
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

module.exports = {
	createReview,
	getProviderReviews,
	getBookingReview,
};
