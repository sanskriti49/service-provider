const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db");
const cache = require("../utils/cache");

const verifyToken = async (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "No token provided." });
	}
	const token = authHeader.split(" ")[1];

	if (!token) return res.status(401).json({ error: "Access Denied" });

	try {
		// 1. Check if token was revoked upon logout/security events (checks L1 memory + L2 Redis)
		const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
		const isRevoked = await cache.getAsync(`token_revoked:${tokenHash}`);
		if (isRevoked) {
			return res.status(401).json({ error: "Token has been revoked. Please log in again." });
		}

		const verified = jwt.verify(token, process.env.JWT_SECRET);

		// 2. Fast L1/L2 cache path: avoids running redundant SELECT queries on every single request
		const cachedUser = await cache.getAsync(`auth_user:${verified.id}`);
		if (cachedUser) {
			req.user = cachedUser;
			return next();
		}

		const result = await db.query(
			"SELECT id, role, email FROM users WHERE id = $1",
			[verified.id]
		);

		if (result.rows.length === 0) {
			return res.status(401).json({ error: "User no longer exists" });
		}

		req.user = result.rows[0];
		// Cache verified user for 60s
		cache.set(`auth_user:${verified.id}`, req.user, 60000);
		next();
	} catch (err) {
		res.status(400).json({ error: "Invalid Token" });
	}
};

module.exports = verifyToken;
