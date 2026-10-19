const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cache = require("../utils/cache");
const verifyToken = require("../middleware/verifyToken");

test("auth: revoked token in cache is rejected by verifyToken middleware", async () => {
	const secret = "test_jwt_secret";
	process.env.JWT_SECRET = secret;
	const token = jwt.sign({ id: "11111111-2222-3333-4444-555555555555" }, secret, { expiresIn: "1h" });
	const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

	// Mark token as revoked in distributed cache
	cache.set(`token_revoked:${tokenHash}`, true, 10000);

	const req = { headers: { authorization: `Bearer ${token}` } };
	let statusCode = null, responseData = null;
	const res = {
		status(code) { statusCode = code; return this; },
		json(data) { responseData = data; return this; }
	};
	let nextCalled = false;
	await verifyToken(req, res, () => { nextCalled = true; });

	assert.equal(statusCode, 401);
	assert.match(responseData.error, /revoked/i);
	assert.equal(nextCalled, false);

	// Clean up
	cache.del(`token_revoked:${tokenHash}`);
});

test("auth: cached user authentication bypasses redundant database query", async () => {
	const secret = "test_jwt_secret";
	process.env.JWT_SECRET = secret;
	const userId = "22222222-3333-4444-5555-666666666666";
	const token = jwt.sign({ id: userId }, secret, { expiresIn: "1h" });
	const cachedUserData = { id: userId, role: "customer", email: "cached@example.com" };

	// Pre-populate auth cache
	cache.set(`auth_user:${userId}`, cachedUserData, 10000);

	const req = { headers: { authorization: `Bearer ${token}` } };
	let nextCalled = false;
	const res = {};
	await verifyToken(req, res, () => { nextCalled = true; });

	assert.equal(nextCalled, true);
	assert.deepStrictEqual(req.user, cachedUserData);

	// Clean up
	cache.del(`auth_user:${userId}`);
});
