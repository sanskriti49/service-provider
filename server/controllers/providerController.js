require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { generateAvailability } = require("../utils/generateAvailability");
const { generateDailySlots } = require("../utils/timeUtils");
const { normalizeEmail } = require("../utils/normalizeEmail");

const providerSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)"
		)
		.required(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().required(),
	price: Joi.number().min(0).optional(),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.object().optional(),
});

const providerUpdateSchema = Joi.object({
	name: Joi.string().min(3).max(100).optional(),
	email: Joi.string().email().optional(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)"
		)
		.required(),
	password: Joi.string().min(6).optional(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	service: Joi.string().optional(),
	price: Joi.number().min(0).optional(),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.object().optional(),
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
			[service]
		);

		if (serviceRow.rows.length === 0) {
			return res.status(400).json({ error: "Invalid service slug" });
		}

		const serviceId = serviceRow.rows[0].id;

		// insert user
		const hashed = await hashIfPresent(password);
		const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nano();

		const userInsert = await client.query(
			`INSERT INTO users (name, email, phone, role, custom_id, password, location, photo, bio)
             VALUES ($1,$2,$3,'provider',$3,$4,$5,$6,$7,$8)
             RETURNING id`,
			[name, cleanEmail, phone, customId, hashed, location, photo, bio]
		);

		const userId = userInsert.rows[0].id;

		// insert provider record
		await client.query(
			`INSERT INTO providers (user_id, service_id, price, rating, availability)
             VALUES ($1,$2,$3,$4,$5)`,
			[userId, serviceId, price, rating, availability]
		);

		const defaultSchedule = [
			{ day: 0, start: "10:00:00", end: "19:00:00" }, // Sunday
			{ day: 1, start: "10:00:00", end: "19:00:00" }, // Monday
			{ day: 2, start: "10:00:00", end: "19:00:00" }, // Tuesday
			{ day: 3, start: "10:00:00", end: "19:00:00" }, // Wednesday
			{ day: 4, start: "10:00:00", end: "19:00:00" }, // Thursday
			{ day: 5, start: "10:00:00", end: "19:00:00" }, // Friday
			{ day: 6, start: "10:00:00", end: "19:00:00" }, // Saturday
		];

		// create availability slots
		for (const schedule of defaultSchedule) {
			await client.query(
				`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
				VALUES ($1,$2,$3,$4)`,
				[userId, schedule.day, schedule.start, schedule.end]
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
                users.name,
                users.photo,
				users.phone,
                users.bio,
                users.location,
                users.custom_id,
                services.name AS service,
                services.slug AS service_slug,
				services.id as service_id,
                providers.price,
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

		//const freshAvailability = generateAvailability();

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
                users.id,
                users.name,
                users.email,
				users.phone,
                users.role,
                users.custom_id,
                users.location,
                users.photo,
                users.bio,
                providers.price,
                providers.rating,
                services.name AS service,
                services.slug AS service_slug,
				services.id as service_id
             FROM providers
             JOIN users ON users.id = providers.user_id
             LEFT JOIN services ON providers.service_id = services.id
             WHERE users.custom_id = $1`,
			[custom_id]
		);

		if (providerRes.rows.length === 0)
			return res.status(404).json({ error: "Provider not found" });

		const provider = providerRes.rows[0];
		const providerId = providerRes.rows[0].id;

		const masterRes = await db.query(
			`SELECT day_of_week, start_time, end_time
			FROM provider_master_availability
			WHERE provider_id=$1`,
			[providerId]
		);

		const scheduleMap = {};
		masterRes.rows.forEach((row) => {
			scheduleMap[row.day_of_week] = {
				start: row.start_time,
				end: row.end_time,
			};
		});

		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 7);

		const bookingsRes = await db.query(
			`SELECT TO_CHAR(DATE,'YYYY-MM-DD') as date, start_time
			FROM bookings
			WHERE provider_id=$1
			AND date >= $2::date
			AND date <= $3::date
			AND status='booked'`,
			[providerId, today, nextWeek]
		);

		const bookedSet = new Set();
		bookingsRes.rows.forEach((b) => {
			bookedSet.add(`${b.date}_${b.start_time}`);
		});

		const dynamicAvailability = [];

		for (let i = 0; i < 7; i++) {
			const dateObj = new Date();
			dateObj.setDate(today.getDate() + i);

			const dateStr = dateObj.toISOString().split("T")[0];
			const dayOfWeek = dateObj.getDay();

			const workHours = scheduleMap[dayOfWeek];
			if (workHours) {
				const dailySlots = generateDailySlots(
					workHours.start,
					workHours.end,
					60
				);
				dailySlots.forEach((time) => {
					const timeKey = time.length === 5 ? `${time}:00` : time;
					const isBooked = bookedSet.has(`${dateStr}_${timeKey}`);

					dynamicAvailability.push({
						date: dateStr,
						start_time: timeKey,
						isBooked: isBooked,
					});
				});
			}
		}

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
		rating,
		availability,
	} = value;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const hashed = await hashIfPresent(password);

		// Update user
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
			[name, email, hashed, location, photo, bio, phone, id]
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

		// Update provider
		await client.query(
			`UPDATE providers SET
                service_id = COALESCE($1, service_id),
                price = COALESCE($2, price),
                rating = COALESCE($3, rating)
             WHERE user_id = $4`,
			[serviceId, price, rating, id]
		);

		if (availability) {
			await client.query(
				"DELETE FROM availability_slots WHERE provider_id=$1",
				[id]
			);

			const newSlots = generateAvailability();
			for (const s of newSlots) {
				await client.query(
					`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
                     VALUES ($1,$2,$3,$4)`,
					[id, s.date, s.start_time, s.end_time]
				);
			}
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

const addMinutes = (timeStr, minutesToAdd) => {
	const [hours, minutes] = timeStr.split(":").map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	date.setMinutes(date.getMinutes() + minutesToAdd);
	return date.toTimeString().split(" ")[0]; // returns "HH:MM:SS"
};

async function getProviderAvailability(req, res, next) {
	try {
		const { id } = req.params;

		const providerId = id;

		const masterRes = await db.query(
			`SELECT day_of_week, start_time, end_time
             FROM provider_master_availability
             WHERE provider_id=$1`,
			[providerId]
		);
		if (masterRes.rows.length === 0) {
			return res.json([]);
		}

		const scheduleMap = {};
		masterRes.rows.forEach((row) => {
			scheduleMap[row.day_of_week] = {
				start: row.start_time,
				end: row.end_time,
			};
		});

		// fetch bookings for next 7 days
		const today = new Date();
		const nextWeek = new Date();
		nextWeek.setDate(today.getDate() + 7);

		const bookingsRes = await db.query(
			`SELECT TO_CHAR(DATE,'YYYY-MM-DD') as date, start_time
             FROM bookings
             WHERE provider_id=$1
             AND date >= $2::date
             AND date <= $3::date
             AND status='booked'`,
			[providerId, today, nextWeek]
		);

		const bookedSet = new Set();
		bookingsRes.rows.forEach((b) => {
			const dateStr = b.date;
			const startTime = b.start_time;

			bookedSet.add(`${b.date}_${b.start_time}`);
			const bufferAfter = addMinutes(startTime, 60);
			bookedSet.add(`${dateStr}_${bufferAfter}`);

			const bufferBefore = addMinutes(startTime, -60);
			bookedSet.add(`${dateStr}_${bufferBefore}`);
		});

		const dynamicAvailability = [];
		const { generateDailySlots } = require("../utils/timeUtils");

		for (let i = 0; i < 7; i++) {
			const dateObj = new Date();
			dateObj.setDate(today.getDate() + i);

			const dateStr = dateObj.toISOString().split("T")[0];
			const dayOfWeek = dateObj.getDay();

			const workHours = scheduleMap[dayOfWeek];
			if (workHours) {
				const dailySlots = generateDailySlots(
					workHours.start,
					workHours.end,
					60
				);
				dailySlots.forEach((time) => {
					const timeKey = time.length === 5 ? `${time}:00` : time;
					const isBooked = bookedSet.has(`${dateStr}_${timeKey}`);

					dynamicAvailability.push({
						date: dateStr,
						start_time: timeKey,
						isBooked: isBooked,
					});
				});
			}
		}

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
