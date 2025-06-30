require("dotenv").config(); // For CommonJS
const { Client } = require("pg");
const { nanoid } = require("nanoid");
const { customAlphabet } = require("nanoid");

const Joi = require("joi");

const { Pool } = require("pg");

//const { v4: uuidv4 } = require("uuid");

const { hashIfPresent } = require("./utils/hash");

const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

//MIDDLEWARE
app.use(express.json());

//DB CONNECTION
const db = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	port: parseInt(process.env.DB_PORT, 10),
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});
db.connect()
	.then(() => console.log("Connected to DB"))
	.catch((err) => console.error("DB Connection Error:", err));

// SCHEMA
const providerSchema = Joi.object({
	// User fields
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().required(),
	password: Joi.string().min(6).required(),
	location: Joi.string().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
	custom_id: Joi.string().optional(), // usually optional on creation, may be auto-generated

	// Provider-specific fields
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

//ROUTES
app.post("/api/providers/v1", async (req, res, next) => {
	const { error, value } = providerSchema.validate(req.body);

	if (error) {
		return res.status(404).json({ error: error.details[0].message });
	}

	// Destructure validated values
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

		// Create custom_id with prefix + UUID (no dashes, uppercase)

		//	const tempId = uuidv4().toLowerCase(); // lowercase!
		const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 16);

		const customId = "SRV" + nanoid();

		await client.query("BEGIN");

		// Insert user without custom_id
		const userInsert = await client.query(
			`INSERT INTO users (name, email, role, custom_id, password)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id`,
			[name, email, role, customId, hashed]
		);
		const userId = userInsert.rows[0].id;
		console.log(userId);

		// Update user row with custom_id
		await client.query(`UPDATE users SET custom_id = $1 WHERE id = $2`, [
			customId,
			userId,
		]);

		// Insert provider info
		await client.query(
			`INSERT INTO providers (user_id, service, price, rating, availability)
       		VALUES ($1, $2, $3, $4, $5)`,
			[userId, service, price, rating, availability]
		);

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
});

app.get("/api/providers/v1", async (req, res, next) => {
	try {
		const result = await db.query("SELECT * FROM providers");
		//console.log(result);
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
});

app.get("/api/providers/v1/:custom_id", async (req, res, next) => {
	try {
		const { custom_id } = req.params;

		const result = await db.query(
			`SELECT users.id, users.name, users.email, users.role, users.custom_id,
		       providers.service, providers.price, providers.rating, providers.availability

			FROM users
			JOIN providers ON users.id=providers.user_id
			WHERE users.custom_id=$1`,
			[custom_id]
		);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: "Provider not found" });
		}
		const provider = result.rows[0];
		// delete provider.password;

		res.json({ message: "Provider fetched", provider });
	} catch (err) {
		next(err);
	}
});

app.put("/api/providers/v1/:id", async (req, res, next) => {
	const { error, value } = providerUpdateSchema.validate(req.body);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
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
	// -------- user-level fields --------------

	// -------- provider-level fields --------------
	try {
		//transaction
		const client = await db.connect();
		try {
			await client.query("BEGIN");

			/* ---------- 1. update users ---------- */
			const hashed = await hashIfPresent(password);
			const userResult = await client.query(
				`UPDATE users
				SET name      = COALESCE($1, name),
					email     = COALESCE($2, email),
					password  = COALESCE($3, password),
					location  = COALESCE($4, location),
					photo     = COALESCE($5, photo),
					bio       = COALESCE($6, bio),
					custom_id = COALESCE($7, custom_id)
				WHERE id = $8`,
				[name, email, hashed, location, photo, bio, custom_id, id]
			);
			const providerResult = await db.query(
				`UPDATE providers
					SET service =COALESCE($1,service)
						price =COALESCE($2,price)
						rating =COALESCE($3,rating)
						availability =COALESCE($4,availability)
					WHERE user_id=$5
				`,
				[service, price, rating, availability, id]
			);

			// if there was no matching user row, bail out early
			if (userResult.rowCount === 0) {
				await client.query("ROLLBACK");
				return res.status(404).json({ error: "User / provider not found" });
			}

			await client.query("COMMIT");
			res.json({ message: "Profile updated successfully" });
		} catch (err) {
			await client.query("ROLLBACK");
			throw err; // handled by outer try/catch
		} finally {
			client.release();
		}
	} catch (err) {
		next(err); // central error middleware
	}
});

app.delete("/api/providers/v1/:id", async (req, res) => {
	try {
		const id = req.params.id;
		const delete_query = "DELETE FROM providers where user_id=$1";
		const result = await db.query(delete_query, [id]);

		if (result.rowCount === 0) {
			return res.status(404).json({ error: "No record found to delete" });
		}
		res.json({ message: "Data deleted successfully", data: result.rows[0] });
	} catch (err) {
		next(err);
	}
});

app.use((err, req, res, next) => {
	console.error("Error:", err.message);
	res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
	console.log(`Server is listening on port ${PORT}`);
});
