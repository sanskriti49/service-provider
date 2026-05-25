require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { generateRealSlots } = require("../utils/timeUtils");
const { normalizeEmail } = require("../utils/normalizeEmail");

const providerSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message("Phone must be a valid Indian number (+91 followed by 10 digits)")
		.required(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().required(),
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
		.required(),
	password: Joi.string().min(6).optional(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().optional(),
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

async function createProvider(req, res, next) {
	const { error, value } = providerSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const {
		name,
		email,
		phone,
		password,
		service,
		price,
		price_unit,
		rating,
		availability,
		location,
		photo,
		bio,
	} = value;

	const cleanEmail = normalizeEmail(email);
	const client = await db.connect();

	try {
		await client.query("BEGIN");

		const serviceRow = await client.query(
			"SELECT id FROM services WHERE slug = $1",
			[service],
		);
		if (serviceRow.rows.length === 0) {
			return res.status(400).json({ error: "Invalid service slug" });
		}
		const serviceId = serviceRow.rows[0].id;

		const hashed = await hashIfPresent(password);
		const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nano();

		const userInsert = await client.query(
			`INSERT INTO users (name, email, phone, role, custom_id, password, location, photo, bio)
             VALUES ($1,$2,$3,'provider',$3,$4,$5,$6,$7,$8)
             RETURNING id`,
			[name, cleanEmail, phone, customId, hashed, location, photo, bio],
		);
		const userId = userInsert.rows[0].id;

		await client.query(
			`INSERT INTO providers (user_id, service_id, price, price_unit, rating, availability)
             VALUES ($1,$2,$3,$4,$5,$6)`,
			[
				userId,
				serviceId,
				price,
				price_unit || "fixed",
				rating,
				JSON.stringify(availability || []),
			],
		);

		// If no schedule provided, default to Mon-Sat 10-7
		const masterSchedule = availability || [
			{ day: 1, start: "10:00:00", end: "19:00:00" },
			{ day: 2, start: "10:00:00", end: "19:00:00" },
			{ day: 3, start: "10:00:00", end: "19:00:00" },
			{ day: 4, start: "10:00:00", end: "19:00:00" },
			{ day: 5, start: "10:00:00", end: "19:00:00" },
			{ day: 6, start: "10:00:00", end: "19:00:00" },
		];

		for (const rule of masterSchedule) {
			await client.query(
				`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3, $4)`,
				[userId, rule.day, rule.start, rule.end],
			);
		}

		const realSlots = generateRealSlots(masterSchedule);
		for (const s of realSlots) {
			await client.query(
				`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
                 VALUES ($1, $2, $3, $4)`,
				[userId, s.date, s.start_time, s.end_time],
			);
		}

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
            SELECT 
                users.name, users.photo, users.phone, users.bio, users.location, users.custom_id,
                services.name AS service, services.slug AS service_slug, services.id as service_id,
                providers.price, 
                providers.price_unit, 
                providers.rating, 
                providers.user_id
            FROM providers
            JOIN users ON providers.user_id = users.id
            LEFT JOIN services ON providers.service_id = services.id
        `;

		const params = [];
		if (service) {
			query += " WHERE services.slug = $1";
			params.push(service);
		}

		const result = await db.query(query, params);
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
}

async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;

		const providerRes = await db.query(
			`SELECT 
                users.id, users.name, users.email, users.phone, users.role, users.custom_id, 
                users.location, users.photo, users.bio,
                providers.price, 
                providers.price_unit,
                providers.rating,
                services.name AS service, services.slug AS service_slug, services.id as service_id
             FROM providers
             JOIN users ON users.id = providers.user_id
             LEFT JOIN services ON providers.service_id = services.id
             WHERE users.custom_id = $1`,
			[custom_id],
		);

		if (providerRes.rows.length === 0)
			return res.status(404).json({ error: "Provider not found" });

		const providerId = providerRes.rows[0].id;

		// get Real Availability Read directly from slots table instead of calculating on fly
		const today = new Date();
		const nextMonth = new Date();
		nextMonth.setDate(today.getDate() + 30);

		const slotsRes = await db.query(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, is_booked 
             FROM availability_slots 
             WHERE provider_id = $1 AND date >= $2 AND date <= $3
             ORDER BY date, start_time`,
			[providerId, today, nextMonth],
		);

		const dynamicAvailability = slotsRes.rows.map((slot) => ({
			date: slot.date,
			start_time: slot.start_time.slice(0, 5), // "09:00:00" -> "09:00"
			isBooked: slot.is_booked,
		}));

		res.json({
			message: "Provider fetched",
			provider: {
				...providerRes.rows[0],
				availability: dynamicAvailability,
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
		price,
		price_unit,
		rating,
		availability,
	} = value;

	const client = await db.connect();
	try {
		await client.query("BEGIN");
		const hashed = await hashIfPresent(password);

		await client.query(
			`UPDATE users SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                password = COALESCE($3, password),
                location = COALESCE($4, location),
                photo = COALESCE($5, photo),
                bio = COALESCE($6, bio),
                phone = COALESCE($7, phone)
             WHERE id = $8`,
			[name, email, hashed, location, photo, bio, phone, id],
		);

		let serviceId = null;
		if (service) {
			const s = await client.query("SELECT id FROM services WHERE slug = $1", [
				service,
			]);
			if (s.rows.length === 0)
				return res.status(400).json({ error: "Invalid service slug" });
			serviceId = s.rows[0].id;
		}

		await client.query(
			`UPDATE providers SET
                service_id = COALESCE($1, service_id),
                price = COALESCE($2, price),
                rating = COALESCE($3, rating),
                price_unit = COALESCE($4, price_unit)
             WHERE user_id = $5`,
			[serviceId, price, rating, price_unit, id],
		);

		if (availability) {
			// update Master Intent
			await client.query(
				"DELETE FROM provider_master_availability WHERE provider_id=$1",
				[id],
			);
			for (const s of availability) {
				await client.query(
					`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
                     VALUES ($1, $2, $3, $4)`,
					[id, s.day, s.start, s.end],
				);
			}

			// 2. Regenerate Real Inventory
			await client.query(
				"DELETE FROM availability_slots WHERE provider_id=$1",
				[id],
			);

			const newSlots = generateRealSlots(availability);
			for (const s of newSlots) {
				await client.query(
					`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
                     VALUES ($1, $2, $3, $4)`,
					[id, s.date, s.start_time, s.end_time],
				);
			}

			await client.query(
				`UPDATE providers SET availability = $1 WHERE user_id = $2`,
				[JSON.stringify(availability), id],
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

async function getProviderAvailability(req, res, next) {
	try {
		const { id } = req.params;
		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 14);

		// Directly read from the pre-generated inventory table
		const slotsRes = await db.query(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, start_time, is_booked
             FROM availability_slots
             WHERE provider_id=$1 AND date >= $2 AND date <= $3
             ORDER BY date, start_time`,
			[id, today, nextWeek],
		);

		const dynamicAvailability = slotsRes.rows.map((row) => ({
			date: row.date,
			start_time: row.start_time.slice(0, 5),
			isBooked: row.is_booked,
		}));

		res.json(dynamicAvailability);
	} catch (err) {
		next(err);
	}
}

async function deleteProvider(req, res, next) {
	try {
		const id = req.params.id;
		const result = await db.query("DELETE FROM providers WHERE user_id = $1", [
			id,
		]);
		if (result.rowCount === 0)
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
	deleteProvider,
	getProviderAvailability,
	providerSchema,
	providerUpdateSchema,
};
