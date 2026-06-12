require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { default: axios } = require("axios");
const db = require("../config/db");
const { hashIfPresent } = require("../utils/hash");
const Joi = require("joi");
const { customAlphabet } = require("nanoid");
const { normalizeEmail } = require("../utils/normalizeEmail");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const userSchema = Joi.object({
	name: Joi.string().min(3).max(100).required(),
	email: Joi.string().email().lowercase().required(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)",
		)
		.required(),
	password: Joi.string().min(6).required(),
	role: Joi.string().valid("customer", "provider"),
	location: Joi.string().optional(),
	address: Joi.string().optional(),
	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
	photo: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).optional(),
});

const userUpdateSchema = Joi.object({
	name: Joi.string().min(3).max(100).optional(),
	email: Joi.string().email().optional(),
	phone: Joi.string()
		.pattern(/^\+91 ?[6-9]\d{9}$/)
		.message(
			"Phone must be a valid Indian number (+91 followed by 10 digits starting with 6-9)",
		)
		.optional(),
	password: Joi.string().min(6).optional(),

	location: Joi.string().allow("").optional(),
	address: Joi.string().allow("").optional(),
	bio: Joi.string().max(500).allow("").optional(),
	photo: Joi.string().allow("").optional(),

	lat: Joi.number().optional(),
	lng: Joi.number().optional(),
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
			],
		);

		if (role === "provider") {
			await db.query(
				`INSERT INTO providers (user_id, rating, availability)
				VALUES ($1,NULL, '[]')
				ON CONFLICT (user_id) DO NOTHING`,
				[result.rows[0].id],
			);
		}
		console.log(result.rows);
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
			`SELECT id,name,email,phone,role,custom_id,photo,bio,location,lat,lng,created_at FROM users`,
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
			`SELECT id, name, email,phone, role, custom_id, photo, bio, location, lat, lng, created_at
            FROM users WHERE custom_id=$1`,
			[custom_id],
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
	let updates = { ...value };

	if (req.file) {
		try {
			const result = await new Promise((resolve, reject) => {
				const stream = cloudinary.uploader.upload_stream(
					{ folder: "profile_photos" },
					(err, res) => {
						if (err) reject(err);
						else resolve(res);
					},
				);
				streamifier.createReadStream(req.file.buffer).pipe(stream);
			});
			updates.photo = result.secure_url;
		} catch (uploadErr) {
			return res.status(500).json({ error: "Profile image upload failed" });
		}
	}

	try {
		// FORWARD GEOCODING (location text -> lat/lng)
		if (
			updates.location &&
			updates.location.trim() !== "" &&
			(!updates.lat || !updates.lng)
		) {
			try {
				const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
					updates.location,
				)}`;
				const geoRes = await axios.get(url, {
					headers: { "User-Agent": "TaskGenie/1.0" },
				});
				if (geoRes.data && geoRes.data.length > 0) {
					updates.lat = parseFloat(geoRes.data[0].lat);
					updates.lng = parseFloat(geoRes.data[0].lon);
				}
			} catch (geoErr) {
				console.error("Forward Geocoding failed:", geoErr.message);
			}
		}

		// REVERSE GEOCODING (lat/lng -> location)
		else if (updates.lat && updates.lng && !updates.location) {
			try {
				const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${updates.lat}&lon=${updates.lng}`;
				const geoRes = await axios.get(url, {
					headers: { "User-Agent": "TaskGenie/1.0" },
				});

				if (geoRes.data && geoRes.data.address) {
					const addr = geoRes.data.address;
					const cityOrTown =
						addr.city ||
						addr.town ||
						addr.village ||
						addr.suburb ||
						"Unknown Local Region";
					updates.location = `${cityOrTown}, ${addr.state || ""}`.trim();
				}
			} catch (geoErr) {
				console.error("Reverse Geocoding failed:", geoErr.message);
			}
		}

		if (updates.password) {
			updates.password = await hashIfPresent(updates.password);
		}

		const fields = [];
		const values = [];
		let index = 1;

		for (const [key, val] of Object.entries(updates)) {
			fields.push(`"${key}" = $${index}`);
			values.push(typeof val === "string" && val.trim() === "" ? null : val);
			index++;
		}

		if (fields.length === 0 && !req.file) {
			return res
				.status(400)
				.json({ message: "No explicit changes detected to process update" });
		}

		values.push(id);

		const query = `
            UPDATE users
            SET ${fields.join(", ")}
            WHERE id = $${index}
            RETURNING id, name, email, phone, role, location, address, lat, lng, photo, bio, created_at
        `;

		const result = await db.query(query, values);

		if (result.rowCount === 0) {
			return res.status(404).json({ message: "User not found" });
		}

		res.json({
			message: "User updated successfully",
			user: result.rows[0],
		});
	} catch (err) {
		next(err);
	}
}

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
