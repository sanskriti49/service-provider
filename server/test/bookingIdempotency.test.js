const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

function loadControllerWithExisting(existingRow = null) {
	process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
	process.env.RAZORPAY_KEY_SECRET = "unit-secret";
	const providerId = "11111111-1111-4111-8111-111111111111";
	const customerId = "22222222-2222-4222-8222-222222222222";
	const serviceId = "33333333-3333-4333-8333-333333333333";
	const queries = [];
	const client = {
		async query(sql, params = []) {
			queries.push({ sql, params });
			if (sql.includes("SELECT ps.price")) return { rows: [{ price: 1200, name: "House Cleaning", service_id: serviceId, provider_lat: 0, provider_lng: 72 }] };
			if (sql.includes("AS valid")) return { rows: [{ valid: true }] };
			if (sql.includes("SELECT start_time,end_time FROM provider_master")) return { rows: [{ start_time: "08:00", end_time: "20:00" }] };
			if (sql.includes("SELECT start_time")) return { rows: [] };
			if (sql.includes("INSERT INTO bookings")) return { rows: [{
				booking_id: params[0], provider_id: providerId,
				user_id: customerId, service_id: serviceId, date: params[4], start_time: params[5],
				end_time: params[6], price: params[8], payment_method: params[9], payment_status: "pending",
				razorpay_order_id: params[10], otp: params[11], completion_otp: params[12],
				latitude: params[13], longitude: params[14], search_radius_km: params[15],
			}] };
			return { rows: [] };
		},
		release() {},
	};
	const dbMock = {
		query: async (sql, params = []) => {
			queries.push({ sql, params });
			if (sql.includes("SELECT * FROM bookings WHERE booking_id")) {
				return { rows: existingRow ? [existingRow] : [] };
			}
			if (sql.includes("SELECT id") && !sql.includes("SELECT ps.price")) {
				return { rows: [{ id: providerId }] };
			}
			return client.query(sql, params);
		},
		connect: async () => client,
	};
	const stubs = {
		razorpay: class {
			constructor() { this.orders = { create: async (options) => ({ id: "order_unit", amount: options.amount, currency: options.currency }) }; }
		},
		"../config/db": dbMock,
		"../utils/sendEmail": async () => {},
		"../utils/eventQueue": {},
		"../utils/metrics": { bookingsTotal: { inc() {} } },
		"../utils/geoUtils": {},
		"../utils/notificationService": { sendNotification: async () => {} },
		"../utils/distributedLock": { acquireLock: async () => ({ acquired: true, key: "test-lock", token: "test-token" }), releaseLock: async () => {} },
		"../utils/circuitBreaker": { createProtectedBreaker: (action) => ({ fire: action }) },
	};
	const filename = path.join(__dirname, "../controllers/bookingController.js");
	const controllerModule = new Module(filename, module);
	controllerModule.filename = filename;
	controllerModule.paths = Module._nodeModulePaths(path.dirname(filename));
	const originalRequire = controllerModule.require.bind(controllerModule);
	controllerModule.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : originalRequire(id);
	controllerModule._compile(fs.readFileSync(filename, "utf8"), filename);
	return { controller: controllerModule.exports, customerId, providerId, serviceId, queries };
}

test("booking idempotency: retried request with identical Idempotency-Key returns existing booking with duplicate flag", async () => {
	const customerId = "22222222-2222-4222-8222-222222222222";
	const existingBooking = {
		booking_id: "55555555-5555-4555-8555-555555555555",
		user_id: customerId,
		provider_id: "11111111-1111-4111-8111-111111111111",
		service_id: "33333333-3333-4333-8333-333333333333",
		date: "2026-11-12",
		start_time: "10:00",
		end_time: "11:00",
		price: 1200,
		status: "pending",
		payment_method: "cod",
		payment_status: "pending",
		razorpay_order_id: null,
	};
	const { controller } = loadControllerWithExisting(existingBooking);
	const req = {
		user: { id: customerId, role: "customer" },
		headers: { "idempotency-key": "55555555-5555-4555-8555-555555555555" },
		body: {
			provider_id: "11111111-1111-4111-8111-111111111111",
			service_id: "33333333-3333-4333-8333-333333333333",
			date: "2026-11-12T00:00:00.000Z",
			start_time: "10:00:00",
			address: "Test address",
			payment_method: "cod",
			latitude: 0,
			longitude: 72,
		},
	};
	let status = 200, data = null;
	const res = { status: (c) => { status = c; return res; }, json: (d) => { data = d; return res; } };

	await controller.createBooking(req, res);

	assert.equal(status, 200);
	assert.equal(data.duplicate, true);
	assert.equal(data.booking.booking_id, "55555555-5555-4555-8555-555555555555");
});

test("booking idempotency: non-UUID idempotency key is deterministically hashed and accepted", async () => {
	const { controller, customerId, providerId, serviceId } = loadControllerWithExisting(null);
	const req = {
		user: { id: customerId, role: "customer" },
		headers: { "idempotency-key": "mobile-checkout-token-xyz" },
		body: {
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-12T00:00:00.000Z",
			start_time: "10:00:00",
			address: "Test address",
			payment_method: "cod",
			latitude: 0,
			longitude: 72,
		},
	};
	let status = 200, data = null;
	const res = { status: (c) => { status = c; return res; }, json: (d) => { data = d; return res; } };

	await controller.createBooking(req, res);

	assert.equal(status, 201);
	assert.ok(data.booking.booking_id);
	assert.match(data.booking.booking_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
