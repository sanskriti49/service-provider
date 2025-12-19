const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { customAlphabet } = require("nanoid");

const verifyToken = require("../middleware/verifyToken");
const verifyTurnstile = require("../middleware/verifyRecaptcha");

const { formatName } = require("../utils/formatName");
const { normalizeEmail } = require("../utils/normalizeEmail");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			role: user.role,
			name: user.name,
			email: user.email,
			photo: user.photo,
			custom_id: user.custom_id,
		},
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);
};

function generateCustomId(role) {
	const nano = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 15);
	if (role === "provider") return "SRV" + nano();
	return "CUS" + nano();
}

const getSafeUser = (user) => {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		photo: user.photo,
		custom_id: user.custom_id,
		phone: user.phone,
		isGoogleUser: user.password === "google_auth_user",
	};
};

router.post("/google", async (req, res) => {
	try {
		const { googleToken, lat, lng, location } = req.body;

		const ticket = await client.verifyIdToken({
			idToken: googleToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();
		const email = payload.email;
		const name = formatName(payload.name);
		const picture = payload.picture;

		let result = await db.query(`SELECT * FROM users WHERE email=$1`, [email]);
		let user;

		if (result.rows.length === 0) {
			const insert = await db.query(
				`INSERT INTO users 
                 (name, email, password, photo, custom_id, role, lat, lng, location)
                 VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7)
                 RETURNING *`,
				[name, email, "google_auth_user", picture, lat, lng, location]
			);
			user = insert.rows[0];
		} else {
			user = result.rows[0];
		}

		const token = generateToken(user); 

		res.json({ token, user: getSafeUser(user) });
	} catch (err) {
		console.error(err);
		res.status(401).json({ error: "Invalid Google token" });
	}
});

router.post("/register", verifyTurnstile, async (req, res) => {
	try {
		const { name, email, password, role, phone } = req.body;

		const cleanEmail = normalizeEmail(email);
		const cleanName = formatName(name);

		if (!["customer", "provider"].includes(role)) {
			return res.status(400).json({ error: "Invalid role selected" });
		}

		const existingCheck = await db.query(
			"SELECT id FROM users WHERE email=$1",
			[cleanEmail]
		);
		if (existingCheck.rows.length > 0) {
			return res.status(400).json({ error: "Email already exists" });
		}

		const customId = generateCustomId(role);
		const hashed = await bcrypt.hash(password, 10);

		const result = await db.query(
			`INSERT INTO users (name, email, password, role, custom_id, phone)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
			[cleanName, cleanEmail, hashed, role, customId, phone]
		);

		const newUser = result.rows[0]; // FIX: Extract the user row first

		// FIX: Use the full payload helper so it matches /login
		const token = generateToken(newUser);

		res.status(201).json({
			message: "User registered!",
			token,
			user: getSafeUser(newUser),
		});
	} catch (err) {
		// Handle unique constraint violation just in case race condition
		if (err.code === "23505") {
			return res.status(400).json({ error: "Email already exists" });
		}
		res.status(500).json({ error: err.message });
	}
});

router.post("/login", verifyTurnstile, async (req, res) => {
	try {
		const { email, password } = req.body;
		const cleanEmail = normalizeEmail(email);

		const result = await db.query(`SELECT * FROM users WHERE email=$1`, [
			cleanEmail,
		]);

		if (result.rows.length === 0) {
			return res.status(400).json({ error: "User not found" });
		}

		const user = result.rows[0];

		if (user.password === "google_auth_user") {
			return res.status(400).json({
				error:
					"You typically sign in with Google. Please use the Google button above.",
			});
		}

		const match = await bcrypt.compare(password, user.password);
		if (!match) {
			return res.status(400).json({ error: "Incorrect password" });
		}

		const token = generateToken(user); // Used helper

		res.json({ message: "Login success", token, user: getSafeUser(user) });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/set-role", verifyToken, async (req, res) => {
	try {
		const { role } = req.body;
		const userId = req.user.id;

		if (!["customer", "provider"].includes(role)) {
			return res.status(400).json({ error: "Invalid role selected" });
		}

		const userRes = await db.query("SELECT role FROM users WHERE id=$1", [
			userId,
		]);
		const existingUser = userRes.rows[0];

		if (existingUser.role) {
			return res.status(403).json({
				error:
					"You have already selected a role. Contact support to change it.",
			});
		}

		const customId = generateCustomId(role);

		const update = await db.query(
			`UPDATE users 
             SET role = $1, custom_id = $2 
             WHERE id = $3 
             RETURNING *`,
			[role, customId, userId]
		);

		const updatedUser = update.rows[0];
		const newToken = generateToken(updatedUser); // Used helper

		res.json({
			message: "Role updated!",
			token: newToken,
			user: getSafeUser(updatedUser),
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
});

// ... Keep /me and /update-password as is ...
// (You might want to add generateToken logic to /me if you refresh tokens there,
// but usually /me just returns data)

router.get("/me", verifyToken, async (req, res) => {
	try {
		const result = await db.query("SELECT * FROM users WHERE id=$1", [
			req.user.id,
		]);
		if (result.rows.length === 0) {
			return res.status(404).json({ error: "User not found" });
		}

		const user = result.rows[0];
		res.json({ user: getSafeUser(user) });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

router.post("/update-password", verifyToken, async (req, res) => {
	try {
		const { newPassword } = req.body;
		const userId = req.user.id;

		if (!newPassword || newPassword.length < 6) {
			return res
				.status(400)
				.json({ error: "Password must be at least 6 characters" });
		}

		const hashed = await bcrypt.hash(newPassword, 10);

		await db.query("UPDATE users SET password = $1 WHERE id = $2", [
			hashed,
			userId,
		]);
		res.json({ message: "Password updated successfully" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Server error" });
	}
});

module.exports = router;
