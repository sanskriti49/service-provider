const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const crypto = require("node:crypto");

// -------------------------------------------------------------
// Helper: Mock res
// -------------------------------------------------------------
function mockResponse() {
	const headers = {};
	return {
		statusCode: 200,
		data: null,
		headers,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(payload) {
			this.data = payload;
			return this;
		},
		set(key, val) {
			headers[key] = String(val);
			return this;
		},
	};
}

// -------------------------------------------------------------
// 1. Tests for Provider Controller Improvements
// -------------------------------------------------------------
function providerFixture({ knownService = true, knownProvider = true } = {}) {
	const queries = [];
	const client = {
		query: async (sql, params = []) => {
			queries.push({ sql, params });
			if (sql.includes("SELECT id FROM users")) {
				return { rows: knownProvider ? [{ id: "11111111-1111-4111-8111-111111111111" }] : [] };
			}
			if (sql.includes("SELECT id FROM services")) {
				return { rows: knownService ? [{ id: "22222222-2222-4222-8222-222222222222" }] : [] };
			}
			if (sql.includes("INSERT INTO provider_services")) {
				return { rows: [{ id: 1, slug: "cleaning", price: 100 }] };
			}
			return { rows: [] };
		},
		release: () => queries.push({ sql: "release" }),
	};
	const dbMock = {
		connect: async () => client,
		query: async (sql, params = []) => {
			queries.push({ sql, params });
			if (sql.includes("SELECT id FROM users")) {
				return { rows: knownProvider ? [{ id: "11111111-1111-4111-8111-111111111111" }] : [] };
			}
			if (sql.includes("INSERT INTO providers")) {
				return {
					rows: [
						{
							user_id: params[0],
							kyc_doc_type: params[1],
							kyc_doc_number: params[2],
							kyc_doc_front: params[3],
							kyc_doc_back: params[4],
							kyc_status: "pending",
							kyc_submitted_at: new Date(),
							is_verified: false,
							verification_badge: null,
						},
					],
				};
			}
			return { rows: [] };
		},
	};

	const filename = path.resolve(__dirname, "../controllers/providerController.js");
	const instance = new Module(filename, module);
	instance.filename = filename;
	instance.paths = Module._nodeModulePaths(path.dirname(filename));
	const original = instance.require.bind(instance);
	const stubs = {
		"../config/db": dbMock,
		"../utils/cache": { delPattern: () => {} },
	};
	instance.require = (id) => (Object.hasOwn(stubs, id) ? stubs[id] : original(id));
	instance._compile(fs.readFileSync(filename, "utf8"), filename);
	return { controller: instance.exports, queries };
}

test("providerController: addProviderService rolls back transaction before returning 400 for unknown service slug", async () => {
	const { controller, queries } = providerFixture({ knownService: false, knownProvider: true });
	const req = {
		params: { id: "11111111-1111-4111-8111-111111111111" },
		user: { id: "11111111-1111-4111-8111-111111111111", role: "provider" },
		body: { slug: "unknown-service", price: 150 },
	};
	const res = mockResponse();

	await controller.addProviderService(req, res, (err) => {
		throw err;
	});

	assert.equal(res.statusCode, 400);
	assert.deepEqual(res.data, { error: "Unknown service slug: unknown-service" });

	const txSequence = queries
		.filter((q) => ["BEGIN", "ROLLBACK", "COMMIT", "release"].includes(q.sql))
		.map((q) => q.sql);
	assert.deepEqual(txSequence, ["BEGIN", "ROLLBACK", "release"]);
});

test("providerController: addProviderService rolls back transaction before returning 404 for unknown provider", async () => {
	const { controller, queries } = providerFixture({ knownService: true, knownProvider: false });
	const req = {
		params: { id: "non-existent-provider" },
		user: { id: "non-existent-provider", role: "provider" },
		body: { slug: "cleaning", price: 150 },
	};
	const res = mockResponse();

	await controller.addProviderService(req, res, (err) => {
		throw err;
	});

	assert.equal(res.statusCode, 404);
	assert.deepEqual(res.data, { error: "Provider not found" });

	const txSequence = queries
		.filter((q) => ["BEGIN", "ROLLBACK", "COMMIT", "release"].includes(q.sql))
		.map((q) => q.sql);
	assert.deepEqual(txSequence, ["BEGIN", "ROLLBACK", "release"]);
});

test("providerController: submitKyc clears verification flags and badges on replacement KYC resubmission", async () => {
	const { controller, queries } = providerFixture({ knownProvider: true });
	const req = {
		params: { id: "11111111-1111-4111-8111-111111111111" },
		user: { id: "11111111-1111-4111-8111-111111111111", role: "provider" },
		body: {
			kyc_doc_type: "aadhaar",
			kyc_doc_number: "1234-5678-9012",
			kyc_doc_front: "https://example.com/front.png",
			kyc_doc_back: "https://example.com/back.png",
			kyc_declaration: true,
		},
	};
	const res = mockResponse();

	await controller.submitKyc(req, res, (err) => {
		throw err;
	});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.kyc.is_verified, false);
	assert.equal(res.data.kyc.verification_badge, null);

	const updateQuery = queries.find((q) => q.sql.includes("INSERT INTO providers"));
	assert.ok(updateQuery, "Must issue INSERT INTO providers query");
	assert.match(updateQuery.sql, /is_verified\s*=\s*FALSE/i);
	assert.match(updateQuery.sql, /verification_badge\s*=\s*NULL/i);
	assert.match(updateQuery.sql, /verified_at\s*=\s*NULL/i);
	assert.match(updateQuery.sql, /kyc_status\s*=\s*'pending'/i);
});

// -------------------------------------------------------------
// 2. Tests for Email Change OTP Attempt Counter Persistence
// -------------------------------------------------------------
function authFixture(initialUser) {
	const queries = [];
	let currentUser = { ...initialUser };

	const dbMock = {
		query: async (sql, params = []) => {
			queries.push({ sql, params });
			if (sql.includes("SELECT * FROM users WHERE id=$1")) {
				return { rows: currentUser.id ? [currentUser] : [] };
			}
			if (sql.includes("UPDATE users SET temp_email_attempts = $1 WHERE id = $2")) {
				currentUser.temp_email_attempts = params[0];
				return { rows: [] };
			}
			if (sql.includes("UPDATE users SET temp_email = NULL")) {
				currentUser.temp_email = null;
				currentUser.temp_email_otp = null;
				currentUser.temp_email_expires = null;
				currentUser.temp_email_attempts = 0;
				return { rows: [] };
			}
			if (sql.includes("SET email = temp_email")) {
				currentUser.email = currentUser.temp_email;
				currentUser.temp_email = null;
				currentUser.temp_email_otp = null;
				currentUser.temp_email_expires = null;
				currentUser.temp_email_attempts = 0;
				return { rows: [] };
			}
			return { rows: [] };
		},
	};

	const filename = path.resolve(__dirname, "../routes/authRoutes.js");
	const instance = new Module(filename, module);
	instance.filename = filename;
	instance.paths = Module._nodeModulePaths(path.dirname(filename));
	const original = instance.require.bind(instance);
	const stubs = {
		"../config/db": dbMock,
		"../utils/cache": { del: () => {} },
		"../middleware/verifyToken": (req, res, next) => next(),
		"../middleware/rateLimiter": { authLimiter: (req, res, next) => next() },
	};
	instance.require = (id) => (Object.hasOwn(stubs, id) ? stubs[id] : original(id));
	instance._compile(fs.readFileSync(filename, "utf8"), filename);

	const router = instance.exports;
	// Find the route handler for POST /verify-email-change
	const routeLayer = router.stack.find(
		(layer) => layer.route && layer.route.path === "/verify-email-change" && layer.route.methods.post,
	);
	const verifyHandler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;

	return {
		verifyEmailChange: verifyHandler,
		getUser: () => currentUser,
		queries,
	};
}

test("authRoutes: verify-email-change persists attempts and decrements remaining count correctly", async () => {
	const validOtp = "123456";
	const hashedOtp = crypto.createHash("sha256").update(validOtp).digest("hex");
	const initialUser = {
		id: "user-123",
		email: "old@example.com",
		temp_email: "new@example.com",
		temp_email_otp: hashedOtp,
		temp_email_expires: (Date.now() + 600000).toString(),
		temp_email_attempts: 0,
	};

	const { verifyEmailChange, getUser, queries } = authFixture(initialUser);

	// 1st wrong attempt -> reports 4 remaining
	const res1 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res1);
	assert.equal(res1.statusCode, 400);
	assert.equal(res1.data.error, "Invalid OTP. 4 attempts remaining.");
	assert.equal(getUser().temp_email_attempts, 1);

	// 2nd wrong attempt -> reports 3 remaining
	const res2 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res2);
	assert.equal(res2.statusCode, 400);
	assert.equal(res2.data.error, "Invalid OTP. 3 attempts remaining.");
	assert.equal(getUser().temp_email_attempts, 2);

	// 3rd wrong attempt -> reports 2 remaining
	const res3 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res3);
	assert.equal(res3.statusCode, 400);
	assert.equal(res3.data.error, "Invalid OTP. 2 attempts remaining.");
	assert.equal(getUser().temp_email_attempts, 3);

	// 4th wrong attempt -> reports 1 remaining
	const res4 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res4);
	assert.equal(res4.statusCode, 400);
	assert.equal(res4.data.error, "Invalid OTP. 1 attempts remaining.");
	assert.equal(getUser().temp_email_attempts, 4);

	// 5th wrong attempt -> invalidates OTP
	const res5 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res5);
	assert.equal(res5.statusCode, 400);
	assert.equal(res5.data.error, "Too many failed attempts. This OTP has been invalidated for your security.");
	assert.equal(getUser().temp_email, null);
	assert.equal(getUser().temp_email_otp, null);

	// 6th attempt -> no pending email change found
	const res6 = mockResponse();
	await verifyEmailChange({ body: { otp: "000000" }, user: { id: "user-123" } }, res6);
	assert.equal(res6.statusCode, 400);
	assert.equal(res6.data.error, "No pending email change found");
});

// -------------------------------------------------------------
// 3. Tests for Discovery Pagination and Bounded Scheduling Checks
// -------------------------------------------------------------
function discoveryFixture(candidates = [], scheduleMock = null) {
	const queries = [];
	const dbMock = {
		query: async (sql, params = []) => {
			queries.push({ sql, params });
			if (sql.includes("FROM providers p")) {
				return { rows: candidates };
			}
			return { rows: [] };
		},
	};
	const filename = path.resolve(__dirname, "../controllers/providerController.js");
	const instance = new Module(filename, module);
	instance.filename = filename;
	instance.paths = Module._nodeModulePaths(path.dirname(filename));
	const original = instance.require.bind(instance);
	const stubs = {
		"../config/db": dbMock,
		"../utils/cache": { get: () => null, set: () => {} },
	};
	if (scheduleMock) {
		stubs["../services/bookingSchedule"] = scheduleMock;
	}
	instance.require = (id) => (Object.hasOwn(stubs, id) ? stubs[id] : original(id));
	instance._compile(fs.readFileSync(filename, "utf8"), filename);
	return { controller: instance.exports, queries };
}

test("providerController: getProviders paginates results and provides standard pagination headers", async () => {
	const candidates = Array.from({ length: 15 }, (_, i) => ({
		user_id: `prov-${i + 1}`,
		lat: 0,
		lng: 0,
		price: 100 + i * 10,
		rating: 4.0,
		service_id: "srv-clean",
		availability: [],
	}));

	const { controller } = discoveryFixture(candidates);
	const req = {
		query: {
			lat: 0,
			lng: 0,
			radius: 50,
			page: "2",
			limit: "5",
		},
	};
	const res = mockResponse();

	await controller.getProviders(req, res, (err) => {
		throw err;
	});

	assert.equal(res.statusCode, 200);
	assert.ok(Array.isArray(res.data));
	assert.equal(res.data.length, 5);
	assert.equal(res.headers["X-Total-Count"], "15");
	assert.equal(res.headers["X-Page"], "2");
	assert.equal(res.headers["X-Limit"], "5");
	assert.equal(res.headers["X-Total-Pages"], "3");
});

test("providerController: dated discovery with pagination stops schedule checking once page target is fulfilled", async () => {
	let scheduleCheckCount = 0;
	const scheduleMock = {
		getAvailability: async () => {
			scheduleCheckCount++;
			return [{ free_slots: ["10:00"] }];
		},
		validateSchedule: async () => {
			scheduleCheckCount++;
			return { price: 100 };
		},
	};

	// 12 candidates in database
	const candidates = Array.from({ length: 12 }, (_, i) => ({
		user_id: `prov-${i + 1}`,
		lat: 0,
		lng: 0,
		price: 100,
		rating: 4.5,
		service_id: "srv-clean",
		availability: [],
	}));

	const { controller } = discoveryFixture(candidates, scheduleMock);
	// We only request page 1 with limit 4
	const req = {
		query: {
			lat: 0,
			lng: 0,
			radius: 50,
			date: "2030-01-01",
			page: 1,
			limit: 4,
		},
	};
	const res = mockResponse();

	await controller.getProviders(req, res, (err) => {
		throw err;
	});

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.length, 4);
	// In batches of 4, the first 4 were all available, meeting page*limit = 4, so it broke early
	assert.equal(scheduleCheckCount, 4, "Should only check 4 candidates, not all 12");
});

