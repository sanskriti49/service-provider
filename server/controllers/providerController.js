require("dotenv").config({ path: "../.env" });
const { customAlphabet } = require("nanoid");
const Joi = require("joi");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const { generateAvailability } = require("../utils/generateAvailability");

const providerSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().required(),
	password: Joi.string().min(6).required(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	custom_id: Joi.string().optional(),
	service: Joi.string().min(3).max(100).required(),
	price: Joi.number().min(0).optional(),
	rating: Joi.number().min(0).max(5).optional(),
	availability: Joi.object().optional(),
});

const providerUpdateSchema = Joi.object({
	name: Joi.string().min(3).max(100).optional(),
	email: Joi.string().email().optional(),
	password: Joi.string().min(6).optional(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	custom_id: Joi.string().optional(),
	service: Joi.string().min(3).max(100).optional(),
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
		password,
		service,
		price,
		rating,
		availability,
		location,
		photo,
		bio,
	} = value;

	const client = await db.connect();
	try {
		const role = "provider";
		const hashed = await hashIfPresent(password);
		const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 20);
		const customId = "SRV" + nanoid();

		await client.query("BEGIN");
		console.log("Inserting user with custom ID:", customId);

		const userInsert = await client.query(
			`INSERT INTO users (name, email, role, custom_id, password, location, photo, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
			[name, email, role, customId, hashed, location, photo, bio]
		);
		const userId = userInsert.rows[0].id;

		const providerResult = await client.query(
			`INSERT INTO providers (user_id, service, price, rating, availability)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id`,
			[userId, service, price, rating, availability]
		);

		const slots = generateAvailability();
		for (const slot of slots) {
			await client.query(
				`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
				[
					providerResult.rows[0].user_id,
					slot.date,
					slot.start_time,
					slot.end_time,
				]
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
		console.error("Transaction failed:", err.message);
		next(err);
	} finally {
		client.release();
	}
}

async function getProviders(req, res, next) {
	try {
		const result = await db.query("SELECT * FROM providers");
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
}

async function getProviderById(req, res, next) {
	try {
		const { custom_id } = req.params;

		const result = await db.query(
			`SELECT users.id, users.name, users.email, users.role, users.custom_id,
			        users.location, users.photo, users.bio,
			        providers.service, providers.price, providers.rating, providers.availability
       FROM users
       JOIN providers ON users.id = providers.user_id
       WHERE users.custom_id = $1`,
			[custom_id]
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: "Provider not found" });
		}

		res.json({ message: "Provider fetched", provider: result.rows[0] });
	} catch (err) {
		next(err);
	}
}

async function updateProvider(req, res, next) {
	const { error, value } = providerUpdateSchema.validate(req.body);
	if (error) return res.status(400).json({ error: error.details[0].message });

	const id = req.params.id; // Assumes you're sending id as a route param
	if (!id) return res.status(400).json({ error: "Missing provider id" });

	const {
		name,
		email,
		password,
		location,
		photo,
		bio,
		custom_id,
		service,
		price,
		rating,
		availability,
	} = value;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const hashed = await hashIfPresent(password);

		const userResult = await client.query(
			`UPDATE users
         	 SET name = COALESCE($1, name),
				email = COALESCE($2, email),
				password = COALESCE($3, password),
				location = COALESCE($4, location),
				photo = COALESCE($5, photo),
				bio = COALESCE($6, bio),
				custom_id = COALESCE($7, custom_id)
         WHERE id = $8`,
			[name, email, hashed, location, photo, bio, custom_id, id]
		);

		const providerResult = await client.query(
			`UPDATE providers
         	 SET service = COALESCE($1, service),
            	price = COALESCE($2, price),
             	rating = COALESCE($3, rating),
             	availability = COALESCE($4, availability)
         WHERE user_id = $5`,
			[service, price, rating, availability, id]
		);

		if (userResult.rowCount === 0) {
			await client.query("ROLLBACK");
			return res.status(404).json({ error: "Provider not found" });
		}

		await client.query("COMMIT");
		res.json({ message: "Profile updated successfully" });
	} catch (err) {
		await client.query("ROLLBACK");
		next(err);
	} finally {
		client.release();
	}
}

async function deleteProvider(req, res, next) {
	try {
		const id = req.params.id;
		const result = await db.query("DELETE FROM providers WHERE user_id = $1", [
			id,
		]);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "No record found to delete" });
		}
		res.json({ message: "Data deleted successfully" });
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
	providerSchema,
	providerUpdateSchema,
};
