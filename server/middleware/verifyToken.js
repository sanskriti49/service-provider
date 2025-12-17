// const jwt = require("jsonwebtoken");

// module.exports = function (req, res, next) {
// 	const authHeader = req.headers.authorization;

// 	if (!authHeader) {
// 		return res.status(401).json({ error: "No token provided." });
// 	}
// 	const token = authHeader.split(" ")[1];

// 	try {
// 		const decoded = jwt.verify(token, process.env.JWT_SECRET);
// 		req.user = decoded;
// 		next();
// 	} catch (err) {
// 		console.error(err);
// 		return res.status(401).json({ error: "Invalid token" });
// 	}
// };
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const verifyToken = async (req, res, next) => {
	// 1. Get the token from the header

	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "No token provided." });
	}
	const token = authHeader.split(" ")[1];
	//const token = req.header("Authorization")?.split(" ")[1];

	if (!token) return res.status(401).json({ error: "Access Denied" });

	try {
		// 2. Verify the signature (The "Math" check)
		const verified = jwt.verify(token, process.env.JWT_SECRET);

		// 3. THE FIX: Check if this user actually exists in the DB
		const result = await db.query(
			"SELECT id, role, email FROM users WHERE id = $1",
			[verified.id]
		);

		if (result.rows.length === 0) {
			// User was deleted from DB, but token is still valid.
			// We must reject the request!
			return res.status(401).json({ error: "User no longer exists" });
		}

		// 4. Attach latest user info to the request
		req.user = result.rows[0];
		next();
	} catch (err) {
		res.status(400).json({ error: "Invalid Token" });
	}
};

module.exports = verifyToken;
