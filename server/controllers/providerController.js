require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { normalizeEmail } = require("../utils/normalizeEmail");
const { getPriceDetails } = require("../utils/pricing");
const {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	calculateMatchScore,
	getBatchedTravelDurations,
} = require("../utils/geoUtils");

const {
	generateRealSlots,
	timeToMinutes,
	minutesToTime,
} = require("../utils/timeUtils");

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

const providerSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message("Phone must be a valid Indian number (+91 followed by 10 digits)")
		.optional(),
	location: Joi.string().optional(),
	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
	photo: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).allow("").optional(),
	service: Joi.string().required(),
	services: Joi.array()
		.items(
			Joi.object({
				slug: Joi.string().required(),
				price: Joi.number().min(0).required(),
			}),
		)
		.optional(),
	price: Joi.number().min(0).optional(),
	price_unit: Joi.string().optional().default("fixed"),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.array()
		.items(
			Joi.object({
				day: Joi.number().min(0).max(6).required(),
				start: Joi.string().required(),
				end: Joi.string().required(),
			}),
		)
		.optional(),
});

const providerUpdateSchema = Joi.object({
	name: Joi.string().min(3).max(100).optional(),
	email: Joi.string().email().optional(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)",
		)
		.optional(),
	password: Joi.string().min(6).optional(),
	location: Joi.string().optional(),
	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
	photo: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().optional(),
	service_id: Joi.string().uuid().optional(),
	price: Joi.number().min(0).optional(),
	price_unit: Joi.string().optional(),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.array().optional(),
});

// Timezone-safe Local YYYY-MM-DD Date Formatter
function localDateStr(dt) {
	const year = dt.getFullYear();
	const month = String(dt.getMonth() + 1).padStart(2, "0");
	const day = String(dt.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

async function insertSlots(client, userId, schedule) {
	await client.query(
		"DELETE FROM provider_master_availability WHERE provider_id = $1",
		[userId],
	);

	// Deduplicate schedule rules by day, start, end
	const seenRules = new Set();
	const uniqueSchedule = [];
	for (const rule of schedule) {
		const key = `${rule.day}_${rule.start}_${rule.end}`;
		if (!seenRules.has(key)) {
			seenRules.add(key);
			uniqueSchedule.push(rule);
		}
	}

	for (const rule of uniqueSchedule) {
		await client.query(
			`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (provider_id, day_of_week, start_time, end_time) DO NOTHING`,
			[userId, rule.day, rule.start, rule.end],
		);
	}

	await client.query("DELETE FROM availability_slots WHERE provider_id = $1", [
		userId,
	]);

	for (const s of generateRealSlots(uniqueSchedule)) {
		let cleanDateStr;
		if (s.date instanceof Date) {
			cleanDateStr = localDateStr(s.date);
		} else {
			cleanDateStr = String(s.date).substring(0, 10);
		}

		await client.query(
			`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
             VALUES ($1,$2::date,$3,$4)`,
			[userId, cleanDateStr, s.start_time, s.end_time],
		);
	}
}

async function createProvider(req, res, next) {
	const { error, value } = providerSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const {
		name,
		email,
		phone,
		password,
		service,
		services: extraServices,
		price,
		price_unit,
		rating,
		availability,
		location,
		lat,
		lng,
		photo,
		bio,
	} = value;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const sRow = await client.query("SELECT id FROM services WHERE slug=$1", [
			service,
		]);
		if (!sRow.rows.length)
			return res
				.status(400)
				.json({ error: `Unknown service slug: ${service}` });
		const serviceId = sRow.rows[0].id;

		const hashed = await hashIfPresent(password || "Password123!");
		const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nano();

		const userInsert = await client.query(
			`INSERT INTO users (name, email, phone, role, custom_id, password, location, lat, lng, photo, bio)
             VALUES ($1,$2,$3,'provider',$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
			[
				name,
				normalizeEmail(email),
				phone,
				customId,
				hashed,
				location,
				lat || null,
				lng || null,
				photo,
				bio,
			],
		);
		const userId = userInsert.rows[0].id;

		await client.query(
			`INSERT INTO providers (user_id, rating, availability)
             VALUES ($1,$2,$3)`,
			[userId, rating ?? null, JSON.stringify(availability ?? [])],
		);

		await client.query(
			`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
             VALUES ($1,$2,$3,$4,TRUE)
             ON CONFLICT (provider_id, service_id) 
             DO NOTHING`,
			[userId, serviceId, price ?? 0, price_unit ?? "fixed"],
		);

		for (const svc of extraServices ?? []) {
			const r = await client.query("SELECT id FROM services WHERE slug=$1", [
				svc.slug,
			]);
			if (!r.rows.length) continue;
			await client.query(
				`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
                 VALUES ($1,$2,$3,'fixed',TRUE)
                 ON CONFLICT (provider_id, service_id) 
                 DO UPDATE 
                 SET price=EXCLUDED.price`,
				[userId, r.rows[0].id, svc.price],
			);
		}

		await insertSlots(client, userId, availability ?? []);
		await client.query("COMMIT");
		res.status(201).json({
			message: "Provider created successfully",
			user_id: userId,
			custom_id: customId,
		});
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

/**
 * Enhanced marketplace provider search with geolocation matching, proximity ranking, and filters
 */
async function getProviders(req, res, next) {
	try {
		const { service, lat, lng, radius, sort_by, min_rating, max_price } =
			req.query;

		const userLat = parseFloat(lat);
		const userLng = parseFloat(lng);
		const hasUserCoords = !isNaN(userLat) && !isNaN(userLng);
		const searchRadiusKm = parseFloat(radius) || 50;

		let query = `
            SELECT DISTINCT ON (u.id)
                   u.name, u.photo, u.phone, u.bio, u.location, u.custom_id,
                   u.lat, u.lng,
                   s.name AS service, s.slug AS service_slug, s.id AS service_id,
                   ps.price, ps.price_unit, 
                   COALESCE(p.rating, 4.5) AS rating, p.user_id, p.availability
            FROM providers p
            JOIN users u ON p.user_id = u.id
            JOIN provider_services ps ON ps.provider_id = p.user_id AND ps.is_visible = TRUE
            JOIN services s ON s.id = ps.service_id
        `;
		const params = [];
		const whereClauses = [];

		if (service) {
			params.push(service);
			whereClauses.push(`s.slug = $${params.length}`);
		}

		if (min_rating) {
			params.push(parseFloat(min_rating));
			whereClauses.push(`COALESCE(p.rating, 0) >= $${params.length}`);
		}

		if (max_price) {
			params.push(parseFloat(max_price));
			whereClauses.push(`ps.price <= $${params.length}`);
		}

		if (whereClauses.length > 0) {
			query += " WHERE " + whereClauses.join(" AND ");
		}

		query += " ORDER BY u.id, ps.created_at ASC";

		const result = await db.query(query, params);
		let providers = result.rows;

		// Average price in requested result set for score normalization
		const avgPrice =
			providers.length > 0
				? providers.reduce((acc, p) => acc + (parseFloat(p.price) || 0), 0) /
					providers.length
				: 500;

		// Calculate geolocation distance, estimated transit time, and composite match score
		providers = providers.map((p) => {
			const pLat = parseFloat(p.lat);
			const pLng = parseFloat(p.lng);
			const hasProviderCoords = !isNaN(pLat) && !isNaN(pLng);

			let distanceKm = null;
			let travelTimeMins = null;

			if (hasUserCoords && hasProviderCoords) {
				distanceKm = calculateHaversineDistance(userLat, userLng, pLat, pLng);
				travelTimeMins = estimateTravelTimeMinutes(distanceKm);
			}

			const matchScore = calculateMatchScore({
				distanceKm,
				maxRadiusKm: searchRadiusKm,
				rating: parseFloat(p.rating) || 4.5,
				price: parseFloat(p.price) || 0,
				avgPrice,
				hasAvailableSlots: true,
			});

			return {
				...p,
				distance_km: distanceKm,
				travel_time_mins: travelTimeMins,
				match_score: matchScore,
				is_nearby: distanceKm != null ? distanceKm <= searchRadiusKm : true,
			};
		});

		// Filter by radius if requested and coordinates exist
		if (hasUserCoords && radius) {
			providers = providers.filter((p) => p.is_nearby);
		}

		// Sorting logic
		const sortMode = sort_by || (hasUserCoords ? "recommended" : "rating");

		providers.sort((a, b) => {
			if (sortMode === "distance") {
				if (a.distance_km == null && b.distance_km == null) return 0;
				if (a.distance_km == null) return 1;
				if (b.distance_km == null) return -1;
				return a.distance_km - b.distance_km;
			}
			if (sortMode === "price_asc") {
				return parseFloat(a.price) - parseFloat(b.price);
			}
			if (sortMode === "price_desc") {
				return parseFloat(b.price) - parseFloat(a.price);
			}
			if (sortMode === "rating") {
				return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
			}
			// Default "recommended": Highest match_score first, then distance, then rating
			if (b.match_score !== a.match_score) {
				return b.match_score - a.match_score;
			}
			if (a.distance_km != null && b.distance_km != null) {
				return a.distance_km - b.distance_km;
			}
			return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
		});

		res.json(providers);
	} catch (err) {
		console.error("Fetch marketplace providers error:", err.message);
		next(err);
	}
}

/**
 * Dedicated Geolocation Matching Endpoint
 * GET /api/providers/v1/match?service=...&lat=...&lng=...&radius=...
 */
async function matchProviders(req, res, next) {
	return getProviders(req, res, next);
}

async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;
		const providerId = await resolveProviderId(db, custom_id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const providerRes = await db.query(
			`SELECT u.id, u.name, u.email, u.phone, u.role, u.custom_id,
                    u.location, u.lat, u.lng, u.photo, u.bio,
                    COALESCE(p.rating, 5.0) AS rating, p.availability,
                    ps.price, ps.price_unit, 
                    s.name AS service, s.slug AS service_slug, s.id AS service_id
             FROM providers p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
             LEFT JOIN services s ON s.id=ps.service_id
             WHERE u.id = $1
             LIMIT 1`,
			[providerId],
		);
		if (!providerRes.rows.length)
			return res.status(404).json({ error: "Provider not found" });

		const provider = providerRes.rows[0];

		// Query provider_master_availability table for the true active schedule
		const masterRes = await db.query(
			`SELECT day_of_week AS day, 
                    TO_CHAR(start_time, 'HH24:MI') AS start, 
                    TO_CHAR(end_time, 'HH24:MI') AS end
             FROM provider_master_availability
             WHERE provider_id = $1
             ORDER BY day_of_week ASC`,
			[provider.id],
		);

		let weeklyAvailability = [];
		if (masterRes.rows.length > 0) {
			weeklyAvailability = masterRes.rows.map((r) => ({
				day: Number(r.day),
				start: r.start,
				end: r.end,
			}));
		} else if (provider.availability) {
			if (typeof provider.availability === "string") {
				try {
					weeklyAvailability = JSON.parse(provider.availability);
				} catch (e) {
					weeklyAvailability = [];
				}
			} else if (Array.isArray(provider.availability)) {
				weeklyAvailability = provider.availability;
			}
		}

		const servicesRes = await db.query(
			`SELECT s.id, s.name, s.slug, s.description, s.image_url,
                    ps.price, ps.price_unit, ps.is_visible
             FROM provider_services ps
             JOIN services s ON s.id = ps.service_id
             WHERE ps.provider_id = $1`,
			[provider.id],
		);

		const slotsRes = await db.query(
			`SELECT 
                TO_CHAR(date,'YYYY-MM-DD') AS date_str,
                TO_CHAR(start_time, 'HH24:MI') AS start_time,
                TO_CHAR(end_time, 'HH24:MI') AS end_time,
                is_booked
             FROM availability_slots
             WHERE provider_id=$1 
                    AND date >= CURRENT_DATE 
                    AND date <= CURRENT_DATE + INTERVAL '30 days'
             ORDER BY date, start_time`,
			[provider.id],
		);

		res.json({
			message: "Provider fetched",
			provider: {
				...provider,
				availability: weeklyAvailability,
				slots: slotsRes.rows.map((s) => ({
					date: s.date_str,
					start_time: s.start_time,
					end_time: s.end_time,
					start: s.start_time,
					end: s.end_time,
					isBooked: s.is_booked,
				})),
				services: servicesRes.rows,
			},
		});
	} catch (err) {
		next(err);
	}
}

async function updateProvider(req, res, next) {
	const { error, value } = providerUpdateSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const id = req.params.id;
	const {
		name,
		email,
		phone,
		password,
		location,
		lat,
		lng,
		photo,
		bio,
		service,
		service_id: bodyServiceId,
		price,
		price_unit,
		rating,
		availability,
	} = value;

	const providerId = await resolveProviderId(db, id);
	if (!providerId) return res.status(404).json({ error: "Provider not found" });

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const hashed = await hashIfPresent(password);
		await client.query(
			`UPDATE users SET
                name=COALESCE($1,name), email=COALESCE($2,email), password=COALESCE($3,password),
                location=COALESCE($4,location), photo=COALESCE($5,photo), bio=COALESCE($6,bio), phone=COALESCE($7,phone),
                lat=COALESCE($8,lat), lng=COALESCE($9,lng)
             WHERE id=$10`,
			[name, email, hashed, location, photo, bio, phone, lat, lng, providerId],
		);

		let serviceId = bodyServiceId ?? null;
		if (!serviceId && service) {
			const s = await client.query("SELECT id FROM services WHERE slug=$1", [
				service,
			]);
			if (!s.rows.length)
				return res
					.status(400)
					.json({ error: `Unknown service slug: ${service}` });
			serviceId = s.rows[0].id;
		}

		if (serviceId) {
			await client.query(
				`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
                 VALUES ($1, $2, $3, $4, TRUE)
                 ON CONFLICT (provider_id, service_id)
                 DO UPDATE SET 
                    price = COALESCE(EXCLUDED.price, provider_services.price), 
                    price_unit = COALESCE(EXCLUDED.price_unit, provider_services.price_unit)`,
				[providerId, serviceId, price ?? 0, price_unit ?? "fixed"],
			);
		}

		if (availability) {
			const parsedAvailability =
				typeof availability === "string"
					? JSON.parse(availability)
					: availability;

			await insertSlots(client, providerId, parsedAvailability);
			await client.query(
				`UPDATE providers SET availability=$1 WHERE user_id=$2`,
				[JSON.stringify(parsedAvailability), providerId],
			);
		}

		await client.query("COMMIT");
		res.json({ message: "Provider updated successfully" });
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function getProviderServices(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const result = await db.query(
			`SELECT s.id, s.name, s.slug, s.description, s.image_url,
                    ps.price, ps.price_unit, ps.is_visible
             FROM provider_services ps
             JOIN services s ON s.id = ps.service_id
             WHERE ps.provider_id = $1
             ORDER BY ps.created_at ASC`,
			[providerId],
		);
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
}

async function addProviderService(req, res, next) {
	const { slug, price, description, price_unit, availability } = req.body;

	if (!slug || price == null)
		return res.status(400).json({ error: "slug and price are required" });

	const parsedPrice = parseFloat(price);
	if (isNaN(parsedPrice) || parsedPrice < 0)
		return res
			.status(400)
			.json({ error: "price must be a non-negative number" });

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const providerId = await resolveProviderId(client, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		await client.query(
			`INSERT INTO providers (user_id, rating, availability)
             VALUES ($1, NULL, '[]')
             ON CONFLICT (user_id) DO NOTHING`,
			[providerId],
		);

		const sRow = await client.query("SELECT id FROM services WHERE slug=$1", [
			slug,
		]);
		if (!sRow.rows.length)
			return res.status(400).json({ error: `Unknown service slug: ${slug}` });
		const serviceId = sRow.rows[0].id;

		const result = await client.query(
			`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible, slug, description)
             VALUES ($1, $2, $3, COALESCE($4, 'fixed'), TRUE, $5, $6)
             ON CONFLICT (provider_id, service_id)
             DO UPDATE SET 
                price = EXCLUDED.price, 
                price_unit = COALESCE(EXCLUDED.price_unit, provider_services.price_unit),
                is_visible = TRUE,
                slug = COALESCE(EXCLUDED.slug, provider_services.slug),
                description = COALESCE(EXCLUDED.description, provider_services.description)
             RETURNING *`,
			[
				providerId,
				serviceId,
				parsedPrice,
				price_unit || null,
				slug,
				description ?? null,
			],
		);

		if (availability && Array.isArray(availability.days)) {
			const customSchedule = availability.days.map((day) => ({
				day: Number(day),
				start: availability.startTime || "09:00:00",
				end: availability.endTime || "18:00:00",
			}));

			await insertSlots(client, providerId, customSchedule);
		}

		await client.query("COMMIT");
		res
			.status(201)
			.json({ message: "Service added successfully", data: result.rows[0] });
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function removeProviderService(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const result = await db.query(
			`DELETE FROM provider_services WHERE provider_id=$1 AND service_id=$2::uuid`,
			[providerId, req.params.service_id],
		);
		if (!result.rowCount)
			return res
				.status(404)
				.json({ error: "Service not found on this provider" });
		res.json({ message: "Service removed" });
	} catch (err) {
		next(err);
	}
}

async function toggleServiceVisibility(req, res, next) {
	try {
		const { is_visible } = req.body;
		if (typeof is_visible !== "boolean")
			return res.status(400).json({ error: "is_visible must be a boolean" });

		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const result = await db.query(
			`UPDATE provider_services SET is_visible=$1
             WHERE provider_id=$2 AND service_id=$3::uuid RETURNING *`,
			[is_visible, providerId, req.params.service_id],
		);
		if (!result.rowCount)
			return res
				.status(404)
				.json({ error: "Service not found on this provider" });

		res.json({
			message: is_visible ? "Service is now live" : "Service paused",
			data: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

/**
 * Calculates provider availability taking into account:
 * - Master availability schedule
 * - Provider date exceptions (leave days & overrides)
 * - Confirmed, booked, in_progress, and active pending bookings
 * - Service slot duration and buffer
 * - Fast geolocation transit buffers between adjacent jobs
 */
async function getProviderAvailability(req, res, next) {
	try {
		const providerIdParam = req.params.id;
		const providerIdValue = await resolveProviderId(db, providerIdParam);
		if (!providerIdValue)
			return res.status(404).json({ error: "Provider not found" });

		const customerLat = parseFloat(req.query.lat);
		const customerLng = parseFloat(req.query.lng);
		const hasCoords = !isNaN(customerLat) && !isNaN(customerLng);

		const serviceParam = req.query.service || req.query.service_id;

		// Current local time setup
		const now = new Date();
		const todayStr = localDateStr(now);
		const nowMinutes = now.getHours() * 60 + now.getMinutes();

		// Local date extraction from query string or server time
		const fromStr = req.query.from || todayStr;
		const [year, month, day] = fromStr.split("-").map(Number);
		const from = new Date(year, month - 1, day, 0, 0, 0, 0);
		const days = Math.min(parseInt(req.query.days || "14", 10), 30);

		const endDate = new Date(from);
		endDate.setDate(from.getDate() + days - 1);
		const endDateStr = localDateStr(endDate);

		// Queries executed in parallel
		let serviceQuery = `
			SELECT s.name, s.slug, ps.price, ps.price_unit 
			FROM provider_services ps 
			JOIN services s ON s.id = ps.service_id 
			WHERE ps.provider_id=$1
		`;
		const serviceQueryParams = [providerIdValue];

		if (serviceParam) {
			serviceQuery += ` AND (s.slug = $2 OR s.id::text = $2) LIMIT 1`;
			serviceQueryParams.push(serviceParam);
		} else {
			serviceQuery += ` LIMIT 1`;
		}

		const [masterRes, providerServiceRes, exceptionsRes, bookingsRes] =
			await Promise.all([
				db.query(
					`SELECT day_of_week, 
                            TO_CHAR(start_time, 'HH24:MI') AS start_time, 
                            TO_CHAR(end_time, 'HH24:MI') AS end_time 
                     FROM provider_master_availability 
                     WHERE provider_id=$1`,
					[providerIdValue],
				),
				db.query(serviceQuery, serviceQueryParams),
				db.query(
					`SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date_str, is_available, override_slots
                     FROM provider_date_exceptions
                     WHERE provider_id = $1 AND date BETWEEN $2::date AND $3::date`,
					[providerIdValue, fromStr, endDateStr],
				),
				db.query(
					`SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date_str, 
                            TO_CHAR(start_time, 'HH24:MI') AS start_time, 
                            TO_CHAR(end_time, 'HH24:MI') AS end_time,
                            latitude, longitude, status
                     FROM bookings
                     WHERE provider_id = $1 AND date BETWEEN $2::date AND $3::date 
                     AND (
                         status IN ('booked', 'confirmed', 'in_progress')
                         OR (status = 'pending' AND created_at > NOW() - INTERVAL '15 minutes')
                     )`,
					[providerIdValue, fromStr, endDateStr],
				),
			]);

		if (masterRes.rows.length === 0) {
			return res.json({ provider_id: providerIdValue, availability: [] });
		}

		const serviceName = providerServiceRes.rows[0]?.name || "default";
		const serviceConfig = getPriceDetails(serviceName);
		const SLOT_DURATION = serviceConfig.slotDuration || 60;
		const DEFAULT_BUFFER = serviceConfig.buffer || 20;

		const masterMap = {};
		for (const row of masterRes.rows) {
			const d = parseInt(row.day_of_week, 10);
			masterMap[d] = masterMap[d] || [];
			masterMap[d].push({ start: row.start_time, end: row.end_time });
		}

		const exceptionsMap = {};
		for (const ex of exceptionsRes.rows) {
			exceptionsMap[ex.date_str] = ex;
		}

		const bookingsMap = {};
		for (const b of bookingsRes.rows) {
			bookingsMap[b.date_str] = bookingsMap[b.date_str] || [];
			bookingsMap[b.date_str].push(b);
		}

		const results = [];

		for (let i = 0; i < days; i++) {
			const dt = new Date(from);
			dt.setDate(from.getDate() + i);
			const dateStr = localDateStr(dt);
			const dow = dt.getDay();

			// 1. If date is in the past, return empty slots
			if (dateStr < todayStr) {
				results.push({ date: dateStr, free_slots: [] });
				continue;
			}

			// 2. Check for Date Exceptions
			const exception = exceptionsMap[dateStr];
			if (exception && !exception.is_available) {
				// Provider took off on this specific date
				results.push({ date: dateStr, free_slots: [] });
				continue;
			}

			let workingIntervals = [];
			if (exception && exception.is_available && exception.override_slots) {
				const rawOverrides = Array.isArray(exception.override_slots)
					? exception.override_slots
					: [];
				workingIntervals = rawOverrides.map((s) => ({
					start: (s.start || s.start_time || "").slice(0, 5),
					end: (s.end || s.end_time || "").slice(0, 5),
				}));
			} else {
				workingIntervals = masterMap[dow] || [];
			}

			if (workingIntervals.length === 0) {
				results.push({ date: dateStr, free_slots: [] });
				continue;
			}

			const bookedJobs = bookingsMap[dateStr] || [];

			// Compute transit times for all booked jobs on this day in batch
			const travelTimes = new Map();
			if (hasCoords && bookedJobs.length > 0) {
				const jobCoords = [];
				const validIndices = [];
				for (let j = 0; j < bookedJobs.length; j++) {
					const job = bookedJobs[j];
					if (job.latitude && job.longitude) {
						jobCoords.push([
							parseFloat(job.longitude),
							parseFloat(job.latitude),
						]);
						validIndices.push(j);
					}
				}

				if (jobCoords.length > 0) {
					const durations = await getBatchedTravelDurations(
						[customerLng, customerLat],
						jobCoords,
					);
					durations.forEach((dur, idx) => {
						travelTimes.set(validIndices[idx], dur);
					});
				}
			}

			const freeChunks = [];

			for (const interval of workingIntervals) {
				let sTime = timeToMinutes(interval.start);
				const eTime = timeToMinutes(interval.end);

				while (sTime + SLOT_DURATION <= eTime) {
					const currentSlotStart = sTime;
					const currentSlotEnd = sTime + SLOT_DURATION;

					// If today, skip slots that start at or before current time + 15 min buffer
					if (dateStr === todayStr && currentSlotStart <= nowMinutes + 15) {
						sTime += SLOT_DURATION;
						continue;
					}

					let slotValid = true;

					for (let j = 0; j < bookedJobs.length; j++) {
						const job = bookedJobs[j];
						const jobStart = timeToMinutes(job.start_time);
						const jobEnd = timeToMinutes(job.end_time);

						// Direct Overlap check
						if (!(currentSlotEnd <= jobStart || currentSlotStart >= jobEnd)) {
							slotValid = false;
							break;
						}

						// Transit buffer check for adjacent jobs
						let bufferBefore = DEFAULT_BUFFER;
						let bufferAfter = DEFAULT_BUFFER;

						if (travelTimes.has(j)) {
							const realTravelTime = travelTimes.get(j);
							if (
								jobEnd <= currentSlotStart &&
								currentSlotStart - jobEnd < 120
							) {
								bufferBefore = realTravelTime + 5;
							}
							if (
								currentSlotEnd <= jobStart &&
								jobStart - currentSlotEnd < 120
							) {
								bufferAfter = realTravelTime + 5;
							}
						}

						if (
							jobEnd <= currentSlotStart &&
							currentSlotStart - jobEnd < bufferBefore
						) {
							slotValid = false;
							break;
						}
						if (
							currentSlotEnd <= jobStart &&
							jobStart - currentSlotEnd < bufferAfter
						) {
							slotValid = false;
							break;
						}
					}

					if (slotValid) {
						const startFormatted = minutesToTime(currentSlotStart);
						const endFormatted = minutesToTime(currentSlotEnd);
						freeChunks.push({
							start: startFormatted,
							end: endFormatted,
							start_time: startFormatted,
							end_time: endFormatted,
							isBooked: false,
							is_booked: false,
						});
					}

					sTime += SLOT_DURATION;
				}
			}

			results.push({ date: dateStr, free_slots: freeChunks });
		}

		res.json({ provider_id: providerIdValue, availability: results });
	} catch (err) {
		console.error("Get availability error:", err);
		next(err);
	}
}

async function deleteProvider(req, res, next) {
	try {
		const providerId = await resolveProviderId(db, req.params.id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const r = await db.query("DELETE FROM providers WHERE user_id=$1", [
			providerId,
		]);
		if (!r.rowCount)
			return res.status(404).json({ error: "No provider found" });
		res.json({ message: "Provider deleted successfully" });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	createProvider,
	getProviders,
	matchProviders,
	getProviderById,
	updateProvider,
	getProviderServices,
	addProviderService,
	removeProviderService,
	toggleServiceVisibility,
	deleteProvider,
	getProviderAvailability,
};
