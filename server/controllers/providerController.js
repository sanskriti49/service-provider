require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { normalizeEmail } = require("../utils/normalizeEmail");
const { getOSRMDurationMatrix } = require("../utils/osrmHelper");
const { getPriceDetails } = require("../utils/pricing");

const {
	generateRealSlots,
	timeToMinutes,
	minutesToTime,
} = require("../utils/timeUtils");

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveProviderId(clientOrPool, idOrCustomId) {
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
	for (const rule of schedule) {
		await client.query(
			`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
             VALUES ($1,$2,$3,$4)`,
			[userId, rule.day, rule.start, rule.end],
		);
	}
	await client.query("DELETE FROM availability_slots WHERE provider_id = $1", [
		userId,
	]);
	for (const s of generateRealSlots(schedule)) {
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

		const hashed = await hashIfPresent(password);
		const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nano();

		const userInsert = await client.query(
			`INSERT INTO users (name, email, phone, role, custom_id, password, location, photo, bio)
             VALUES ($1,$2,$3,'provider',$4,$5,$6,$7,$8) RETURNING id`,
			[
				name,
				normalizeEmail(email),
				phone,
				customId,
				hashed,
				location,
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

async function getProviders(req, res, next) {
	try {
		const { service } = req.query;
		let query = `
            SELECT DISTINCT ON (u.id)
                   u.name, u.photo, u.phone, u.bio, u.location, u.custom_id,
                   s.name AS service, s.slug AS service_slug, s.id AS service_id,
                   ps.price, ps.price_unit, 
                   p.rating, p.user_id, p.availability
            FROM providers p
            JOIN users u ON p.user_id = u.id
            JOIN provider_services ps ON ps.provider_id = p.user_id AND ps.is_visible = TRUE
            JOIN services s ON s.id = ps.service_id
        `;
		const params = [];
		if (service) {
			query += " WHERE s.slug = $1 AND ps.is_visible = true";
			params.push(service);
		}
		query += " ORDER BY u.id, ps.created_at ASC";

		const result = await db.query(query, params);
		res.json(result.rows);
	} catch (err) {
		console.error("Fetch marketplace providers error:", err.message);
		next(err);
	}
}

// async function getProviderById(req, res, next) {
// 	try {
// 		const { custom_id } = req.params;
// 		const providerId = await resolveProviderId(db, custom_id);
// 		if (!providerId)
// 			return res.status(404).json({ error: "Provider not found" });

// 		const providerRes = await db.query(
// 			`SELECT u.id, u.name, u.email, u.phone, u.role, u.custom_id,
//                     u.location, u.photo, u.bio,
//                     p.rating, p.availability,
//                     ps.price, ps.price_unit,
//                     s.name AS service, s.slug AS service_slug, s.id AS service_id
//              FROM providers p
//              JOIN users u ON u.id = p.user_id
//              LEFT JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
//              LEFT JOIN services s ON s.id=ps.service_id
//              WHERE u.custom_id = $1
//              LIMIT 1`,
// 			[providerId],
// 		);
// 		if (!providerRes.rows.length)
// 			return res.status(404).json({ error: "Provider not found" });

// 		const provider = providerRes.rows[0];

// 		let weeklyAvailability = provider.availability;
// 		if (typeof weeklyAvailability === "string") {
// 			try {
// 				weeklyAvailability = JSON.parse(weeklyAvailability);
// 			} catch (e) {
// 				weeklyAvailability = [];
// 			}
// 		}

// 		const servicesRes = await db.query(
// 			`SELECT s.id, s.name, s.slug, s.description, s.image_url,
//                     ps.price, ps.price_unit, ps.is_visible
//              FROM provider_services ps
//              JOIN services s ON s.id = ps.service_id
//              WHERE ps.provider_id = $1`,
// 			[provider.id],
// 		);

// 		const slotsRes = await db.query(
// 			`SELECT
//                 TO_CHAR(date,'YYYY-MM-DD') AS date_str,
//                 TO_CHAR(start_time, 'HH24:MI') AS start_time,
//                 TO_CHAR(end_time, 'HH24:MI') AS end_time,
//                 is_booked
//              FROM availability_slots
//              WHERE provider_id=$1
//                     AND date >= CURRENT_DATE
//                     AND date <= CURRENT_DATE + INTERVAL '30 days'
//              ORDER BY date, start_time`,
// 			[provider.id],
// 		);

// 		res.json({
// 			message: "Provider fetched",
// 			provider: {
// 				...provider,
// 				services: servicesRes.rows,
// 				availability: weeklyAvailability || [],
// 				slots: slotsRes.rows.map((s) => ({
// 					date: s.date_str,
// 					start_time: s.start_time,
// 					end_time: s.end_time,
// 					isBooked: s.is_booked,
// 				})),
// 				services: servicesRes.rows,
// 			},
// 		});
// 	} catch (err) {
// 		next(err);
// 	}
// }
async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;
		// Resolve whether custom_id is a UUID or custom string ID
		const providerId = await resolveProviderId(db, custom_id);
		if (!providerId)
			return res.status(404).json({ error: "Provider not found" });

		const providerRes = await db.query(
			`SELECT u.id, u.name, u.email, u.phone, u.role, u.custom_id,
                    u.location, u.photo, u.bio,
                    p.rating, p.availability,
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

		// 1. Query provider_master_availability table for the true active schedule
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
				availability: weeklyAvailability, // Clean [{ day: 1, start: '10:00', end: '19:00' }]
				slots: slotsRes.rows.map((s) => ({
					date: s.date_str,
					start_time: s.start_time,
					end_time: s.end_time,
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
                location=COALESCE($4,location), photo=COALESCE($5,photo), bio=COALESCE($6,bio), phone=COALESCE($7,phone)
             WHERE id=$8`,
			[name, email, hashed, location, photo, bio, phone, providerId],
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
				start: availability.startTime,
				end: availability.endTime,
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

async function getProviderAvailability(req, res, next) {
	try {
		let providerId = req.params.id;
		const providerIdValue = await resolveProviderId(db, providerId);
		if (!providerIdValue)
			return res.status(404).json({ error: "Provider not found" });

		const customerLat = parseFloat(req.query.lat);
		const customerLng = parseFloat(req.query.lng);
		const hasCoords = !isNaN(customerLat) && !isNaN(customerLng);

		// Current local time setup
		const now = new Date();
		const todayStr = localDateStr(now);
		const nowMinutes = now.getHours() * 60 + now.getMinutes();

		// Local date extraction from query string or server time
		const fromStr = req.query.from || todayStr;
		const [year, month, day] = fromStr.split("-").map(Number);
		const from = new Date(year, month - 1, day, 0, 0, 0, 0);
		const days = Math.min(parseInt(req.query.days || "7", 10), 30);

		const [masterRes, providerServiceRes] = await Promise.all([
			db.query(
				`SELECT day_of_week, TO_CHAR(start_time, 'HH24:MI') AS start_time, TO_CHAR(end_time, 'HH24:MI') AS end_time 
                      FROM provider_master_availability WHERE provider_id=$1`,
				[providerIdValue],
			),
			db.query(
				`SELECT s.name FROM provider_services ps JOIN services s ON s.id = ps.service_id WHERE ps.provider_id=$1 LIMIT 1`,
				[providerIdValue],
			),
		]);

		if (masterRes.rows.length === 0 || providerServiceRes.rows.length === 0) {
			return res.json([]);
		}

		const serviceName = providerServiceRes.rows[0].name;
		const serviceConfig = getPriceDetails(serviceName);
		const SLOT_DURATION = serviceConfig.slotDuration || 60;
		const DEFAULT_BUFFER = serviceConfig.buffer || 30;

		const endDate = new Date(from);
		endDate.setDate(from.getDate() + days - 1);
		const endDateStr = localDateStr(endDate);

		const bookingsRes = await db.query(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, 
                    TO_CHAR(start_time, 'HH24:MI') AS start_time, 
                    TO_CHAR(end_time, 'HH24:MI') AS end_time,
                    latitude, longitude
             FROM bookings
             WHERE provider_id = $1 AND date BETWEEN $2::date AND $3::date 
             AND status IN ('booked', 'confirmed', 'in_progress')`,
			[providerIdValue, fromStr, endDateStr],
		);

		const masterMap = {};
		for (const row of masterRes.rows) {
			const d = parseInt(row.day_of_week, 10);
			masterMap[d] = masterMap[d] || [];
			masterMap[d].push({ start: row.start_time, end: row.end_time });
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
			const dow = dt.getDay(); // Local day-of-week integer (0 = Sun, 1 = Mon, 2 = Tue)

			// 1. If date is in the past, return empty slots
			if (dateStr < todayStr) {
				results.push({ date: dateStr, free_slots: [] });
				continue;
			}

			const templ = masterMap[dow] || [];
			const bookedJobs = bookingsMap[dateStr] || [];

			const travelTimes = new Map();
			if (hasCoords && bookedJobs.length > 0) {
				for (let j = 0; j < bookedJobs.length; j++) {
					const job = bookedJobs[j];
					if (job.latitude && job.longitude) {
						const coords = [
							[customerLng, customerLat],
							[parseFloat(job.longitude), parseFloat(job.latitude)],
						];
						const matrix = await getOSRMDurationMatrix(coords);
						if (matrix && matrix[0] && matrix[0][1] != null) {
							travelTimes.set(j, matrix[0][1]);
						}
					}
				}
			}

			let freeChunks = [];

			for (const slot of templ) {
				let sTime = timeToMinutes(slot.start);
				const eTime = timeToMinutes(slot.end);

				while (sTime + SLOT_DURATION <= eTime) {
					const currentSlotStart = sTime;
					const currentSlotEnd = sTime + SLOT_DURATION;

					// 2. If checking today, skip slots that start at or before current time
					if (dateStr === todayStr && currentSlotStart <= nowMinutes) {
						sTime += SLOT_DURATION;
						continue;
					}

					let slotValid = true;

					for (let j = 0; j < bookedJobs.length; j++) {
						const job = bookedJobs[j];
						const jobStart = timeToMinutes(job.start_time);
						const jobEnd = timeToMinutes(job.end_time);

						if (!(currentSlotEnd <= jobStart || currentSlotStart >= jobEnd)) {
							slotValid = false;
							break;
						}

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
						freeChunks.push({
							start: minutesToTime(currentSlotStart),
							end: minutesToTime(currentSlotEnd),
							isBooked: false,
						});
					}

					sTime += SLOT_DURATION;
				}
			}

			results.push({ date: dateStr, free_slots: freeChunks });
		}

		res.json({ provider_id: providerIdValue, availability: results });
	} catch (err) {
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
	getProviderById,
	updateProvider,
	getProviderServices,
	addProviderService,
	removeProviderService,
	toggleServiceVisibility,
	deleteProvider,
	getProviderAvailability,
};
