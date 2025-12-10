const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/verifyToken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
	try {
		const { googleToken } = req.body;

		const ticket = await client.verifyIdToken({
			idToken: googleToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();

		const email = payload.email;
		const name = payload.name;
		const picture = payload.picture;

		let result = await db.query(`SELECT * FROM users WHERE email=$1`, [email]);

		let user;

		// If no user, register automatically
		if (result.rows.length === 0) {
			const insert = await db.query(
				`INSERT INTO users (name, email, role, password)
				VALUES ($1, $2, $3, $4)
				RETURNING id, name, email, role`,
				[name, email, "customer", "google_auth_user"] //defaault role
			);

			user = insert.rows[0];
		} else {
			user = result.rows[0];
		}

		// Generrate JWT
		const token = jwt.sign(
			{
				id: user.id,
				role: user.role,
				name: user.name,
				email: user.email,
			},
			process.env.JWT_SECRET
		);

		res.json({ token });
	} catch (err) {
		console.error(err);
		res.status(401).json({ error: "Invalid Google token" });
	}
});

// REGISTER
router.post("/register", async (req, res) => {
	try {
		const { name, email, password, role } = req.body;

		const hashed = await bcrypt.hash(password, 10);

		const user = await db.query(
			`INSERT INTO users (name, email, password, role)
             VALUES ($1,$2,$3,$4)
             RETURNING id, name, email, role`,
			[name, email, hashed, role]
		);

		res.json({
			message: "User registered!",
			user: user.rows[0],
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// LOGIN
router.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		const result = await db.query(`SELECT * FROM users WHERE email=$1`, [
			email,
		]);
		if (result.rows.length === 0) {
			return res.status(400).json({ error: "User not found" });
		}

		const user = result.rows[0];

		const match = await bcrypt.compare(password, user.password);
		if (!match) {
			return res.status(400).json({ error: "Incorrect password" });
		}

		const token = jwt.sign(
			{ id: user.id, role: user.role },
			process.env.JWT_SECRET,
			{ expiresIn: "7d" }
		);
		res.json({ message: "Login sucess", token });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post("/set-role", verifyToken, async (req, res) => {
	try {
		const { role } = req.body;

		await db.query(`UPDATE users SET role=$1 WHERE id=$2`, [role, req.user.id]);

		res.json({ message: "Role updated!" });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});
module.exports = router;
