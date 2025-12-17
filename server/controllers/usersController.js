// -- public.users definition
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { default: axios } = require("axios");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const Joi = require("joi");

const userSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)"
		)
		.required(),
	password: Joi.string().min(6).required(),
	role: Joi.string().valid("customer", "provider"),
	location: Joi.string().optional(),
	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
	photo: Joi.string().uri().optional(),
	bio: Joi.string().max(500).optional(),
});

const userUpdateSchema = Joi.object({
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
	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
	role: Joi.string().valid("customer", "provider").optional(),
});

function generateCustomId(role) {
	const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 15);

	if (role === "provider") return "SRV" + nano();
	return "CUS" + nano();
}

async function createUser(req, res, next) {
	const { error, value } = userSchema.validate(req.body);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}

	const { name, email, phone, password, role, location, photo, bio, lat, lng } =
		value;
	const cleanEmail = normalizeEmail(email);
	try {
		const customId = generateCustomId(role);
		const hashed = await hashIfPresent(password);

		const result = await db.query(
			`INSERT INTO users(name, email, phone, role, custom_id, password, location, photo, bio, lat, lng)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			 RETURNING id, name, email, role, custom_id`,
			[
				name,
				cleanEmail,
				phone,
				role,
				customId,
				hashed,
				location,
				photo,
				bio,
				lat,
				lng,
			]
		);

		res.status(201).json({
			message: "User created successfully!",
			user: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}
async function getUsers(req, res, next) {
	try {
		const result = await db.query(
			`SELECT id,name,email,phone,role,custom_id,photo,bio,location,lat,lng FROM users`
		);
		res.json(result.rows);
	} catch (err) {
		next(err);
	}
}

async function getUserByCustomId(req, res, next) {
	try {
		const { custom_id } = req.params;

		const result = await db.query(
			`SELECT id, name, email,phone, role, custom_id, photo, bio, location, lat, lng
            FROM users WHERE custom_id=$1`,
			[custom_id]
		);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: "User not found" });
		}
		res.json(result.rows[0]);
	} catch (err) {
		next(err);
	}
}

async function updateUser(req, res, next) {
	const { error, value } = userUpdateSchema.validate(req.body);
	if (error) {
		return res.status(400).json({ error: error.details[0].message });
	}
	const id = req.params.id;
	let { name, email, phone, password, role, location, photo, bio, lat, lng } =
		value;

	try {
		if (location) {
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
					location
				)}`;
				const geoRes = await axios.get(url, {
					headers: { "User-Agent": "TaskGenie/1.0" },
				});
				if (geoRes.data && geoRes.data.length > 0) {
					lat = parseFloat(geoRes.data[0].lat);
					lng = parseFloat(geoRes.data[0].lon);
					console.log(`Geocoded '${location}' to:`, lat, lng);
				}
			} catch (err) {
				console.error(
					"Geocoding failed, but continuing update:",
					geoError.message
				);
			}
		}
		const hashed = await hashIfPresent(password);
		await db.query(
			`UPDATE users SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                password = COALESCE($3, password),
                role = COALESCE($4, role),
                location = COALESCE($5, location),
                photo = COALESCE($6, photo),
                bio = COALESCE($7, bio),
                lat = COALESCE($8, lat),
                lng = COALESCE($9, lng),
				phone = COALESCE($10,phone)
             WHERE id = $11`,
			[name, email, hashed, role, location, photo, bio, lat, lng, phone, id]
		);
		res.json({ message: "User updated successfully" });
	} catch (err) {
		next(err);
	}
}

// -------------------- DELETE USER --------------------
async function deleteUser(req, res, next) {
	try {
		const id = req.params.id;

		const result = await db.query(`DELETE FROM users WHERE id=$1`, [id]);

		if (result.rowCount === 0)
			return res.status(404).json({ error: "User not found" });

		res.json({ message: "User deleted successfully" });
	} catch (err) {
		next(err);
	}
}

module.exports = {
	createUser,
	getUsers,
	getUserByCustomId,
	updateUser,
	deleteUser,
	userSchema,
	userUpdateSchema,
};
