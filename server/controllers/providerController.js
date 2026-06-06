require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { normalizeEmail } = require("../utils/normalizeEmail");

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

function localDateStr(dt) {
	return [
		dt.getFullYear(),
		String(dt.getMonth() + 1).padStart(2, "0"),
		String(dt.getDate()).padStart(2, "0"),
	].join("-");
}

// Mon-Sat 10:00-19:00  (day 0 = Sunday, skipped)
const DEFAULT_SCHEDULE = [1, 2, 3, 4, 5, 6].map((day) => ({
	day,
	start: "10:00",
	end: "19:00",
}));

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
		const cleanDateStr =
			s.date instanceof Date
				? s.date.toISOString().slice(0, 10)
				: String(s.date).substring(0, 10);

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
			`INSERT INTO providers (user_id, service_id, slug, description, price, rating, availability, price_unit)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
			[
				userId,
				serviceId,
				customId,
				bio ?? null,
				price ?? 0,
				rating ?? null,
				JSON.stringify(availability ?? []),
				price_unit ?? "fixed",
			],
		);

		await client.query(
			`INSERT INTO provider_services (provider_id, service_id, price, price_unit, is_visible)
             VALUES ($1,$2,$3,$4,TRUE)
             ON CONFLICT (provider_id, service_id) DO NOTHING`,
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
                 ON CONFLICT (provider_id, service_id) DO UPDATE SET price=EXCLUDED.price`,
				[userId, r.rows[0].id, svc.price],
			);
		}

		await insertSlots(client, userId, availability ?? DEFAULT_SCHEDULE);
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
                   p.rating, p.user_id
            FROM providers p
            JOIN users u ON p.user_id = u.id
            JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
            JOIN services s ON s.id = ps.service_id
        `;
		const params = [];
		if (service) {
			query += " WHERE s.slug = $1";
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

async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;
		const providerRes = await db.query(
			`SELECT u.id, u.name, u.email, u.phone, u.role, u.custom_id,
                    u.location, u.photo, u.bio,
                    p.rating,
                    ps.price, ps.price_unit, 
                    s.name AS service, s.slug AS service_slug, s.id AS service_id
             FROM providers p
             JOIN users u ON u.id = p.user_id
             LEFT JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
             LEFT JOIN services s ON s.id=ps.service_id
             WHERE u.custom_id = $1
             LIMIT 1`,
			[custom_id],
		);
		if (!providerRes.rows.length)
			return res.status(404).json({ error: "Provider not found" });

		const provider = providerRes.rows[0];

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
				services: servicesRes.rows,
				// availability: slotsRes.rows.map((s) => ({
				// 	date: s.date_str,
				// 	start_time: s.start_time.slice(0, 5),
				// 	end_time: s.end_time.slice(0, 5),
				// 	isBooked: s.is_booked,
				// })),
				availability: slotsRes.rows.map((s) => ({
					date: s.date_str,
					start_time: s.start_time,
					end_time: s.end_time,
					isBooked: s.is_booked,
				})),
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
			await insertSlots(client, providerId, availability);
			await client.query(
				`UPDATE providers SET availability=$1 WHERE user_id=$2`,
				[JSON.stringify(availability), providerId],
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
	const { slug, price, description, price_unit } = req.body;

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
		const providerId = await resolveProviderId(db, req.params.id);

		if (!providerId) {
			return res.status(404).json({ error: "Provider not found" });
		}

		const r = await db.query(
			`SELECT 
				TO_CHAR(date,'YYYY-MM-DD') AS date,
				TO_CHAR(start_time, 'HH24:MI') AS start_time,
				TO_CHAR(end_time, 'HH24:MI') AS end_time,
				is_booked
			 FROM availability_slots
			 WHERE provider_id = $1
			   AND date >= CURRENT_DATE
			   AND date <= CURRENT_DATE + INTERVAL '14 days'
			   AND is_booked = false
			 ORDER BY date, start_time`,
			[providerId],
		);

		if (r.rows.length > 0) {
			return res.json(
				r.rows.map((row) => ({
					date: row.date,
					start_time: row.start_time,
					end_time: row.end_time,
					isBooked: row.is_booked,
				})),
			);
		}

		const masterRes = await db.query(
			`SELECT 
				day_of_week,
				TO_CHAR(start_time, 'HH24:MI') AS start_time,
				TO_CHAR(end_time, 'HH24:MI') AS end_time
			 FROM provider_master_availability
			 WHERE provider_id = $1`,
			[providerId],
		);

		const schedule = masterRes.rows.length
			? masterRes.rows.map((r) => ({
					day: Number(r.day_of_week),
					start: r.start_time,
					end: r.end_time,
				}))
			: DEFAULT_SCHEDULE;

		const masterMap = {};

		for (const rule of schedule) {
			masterMap[rule.day] = masterMap[rule.day] || [];
			masterMap[rule.day].push({
				start: rule.start,
				end: rule.end,
			});
		}

		const slots = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const SLOT_DURATION = 120;
		const BUFFER = 60;

		for (let i = 0; i < 14; i++) {
			const dt = new Date(today);
			dt.setDate(today.getDate() + i);

			const dow = dt.getDay();
			const dateStr = localDateStr(dt);
			const templ = masterMap[dow] || [];

			for (const slot of templ) {
				let s = timeToMinutes(slot.start);
				const e = timeToMinutes(slot.end);

				while (s + SLOT_DURATION <= e) {
					slots.push({
						date: dateStr,
						start_time: minutesToTime(s),
						end_time: minutesToTime(s + SLOT_DURATION),
						isBooked: false,
					});

					s += SLOT_DURATION + BUFFER;
				}
			}
		}

		return res.json(slots);
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
