const jwt = require("jsonwebtoken");
const db = require("../config/db");

const verifyToken = async (req, res, next) => {
	// get the token from the header
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		return res.status(401).json({ error: "No token provided." });
	}
	const token = authHeader.split(" ")[1];

	if (!token) return res.status(401).json({ error: "Access Denied" });

	try {
		// verify the signature
		const verified = jwt.verify(token, process.env.JWT_SECRET);

		//check if this user actually exists in the db
		const result = await db.query(
			"SELECT id, role, email FROM users WHERE id = $1",
			[verified.id]
		);

		if (result.rows.length === 0) {
			// user was deleted from db, but token is still valid.
			// then reject the request!
			return res.status(401).json({ error: "User no longer exists" });
		}

		// attach latest user info to the request
		req.user = result.rows[0];
		next();
	} catch (err) {
		res.status(400).json({ error: "Invalid Token" });
	}
};

module.exports = verifyToken;
