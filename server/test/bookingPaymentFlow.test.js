const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

// Exercise the real controller without creating application bookings, sending
// notifications or making a payment request to Razorpay.
function loadController(source = fs.readFileSync(path.join(__dirname, "../controllers/bookingController.js"), "utf8")) {
	const providerId = "11111111-1111-4111-8111-111111111111";
	const customerId = "22222222-2222-4222-8222-222222222222";
	const serviceId = "33333333-3333-4333-8333-333333333333";
	const queries = [], orders = [], notifications = [], releases = [];
	const client = {
		async query(sql, params = []) {
			queries.push({ sql, params });
			if (sql.includes("SELECT ps.price")) return { rows: [{ price: 1200, name: "House Cleaning", service_id: serviceId }] };
			if (sql.includes("SELECT start_time")) return { rows: [] };
			if (sql.includes("INSERT INTO bookings")) return { rows: [{
				booking_id: "44444444-4444-4444-8444-444444444444", provider_id: providerId,
				user_id: customerId, service_id: serviceId, date: params[3], start_time: params[4],
				end_time: params[5], price: params[7], payment_method: params[8], payment_status: params[9],
				razorpay_order_id: params[10], otp: params[11], completion_otp: params[11],
			}] };
			return { rows: [] };
		},
		release() { releases.push("client"); },
	};
	const stubs = {
		razorpay: class {
			constructor() { this.orders = { create: async (options) => { orders.push(options); return { id: "order_regression_test" }; } }; }
		},
		"../config/db": { query: async () => ({ rows: [{ id: providerId }] }), connect: async () => client },
		"../utils/sendEmail": async () => {},
		"../utils/eventQueue": {},
		"../utils/metrics": { bookingsTotal: { inc() {} } },
		"../utils/geoUtils": {},
		"../utils/notificationService": { sendNotification: (input) => notifications.push(input) },
		"../utils/distributedLock": { acquireLock: async () => ({ acquired: true, key: "test-lock", token: "test-token" }), releaseLock: async () => releases.push("lock") },
		"../utils/circuitBreaker": { createProtectedBreaker: (action) => ({ fire: action }) },
	};
	const filename = path.join(__dirname, "../controllers/bookingController.js");
	const controllerModule = new Module(filename, module);
	controllerModule.filename = filename;
	controllerModule.paths = Module._nodeModulePaths(path.dirname(filename));
	const originalRequire = controllerModule.require.bind(controllerModule);
	controllerModule.require = (id) => Object.hasOwn(stubs, id) ? stubs[id] : originalRequire(id);
	controllerModule._compile(source, filename);
	const request = (method) => ({ user: { id: customerId, role: "customer" }, body: {
		provider_id: providerId, service_id: serviceId, date: "2026-11-12T00:00:00.000Z",
		start_time: "10:00:00", end_time: "11:00:00", address: "Test address", payment_method: method,
	} });
	const response = () => ({ statusCode: 200, data: null, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });
	return { controller: controllerModule.exports, queries, orders, notifications, releases, request, response, source };
}

test("booking controller: online booking uses the normalized date before the advisory lock and returns its Razorpay order", async () => {
	const fixture = loadController();
	const res = fixture.response();
	await fixture.controller.createBooking(fixture.request("online"), res);
	assert.equal(res.statusCode, 201, JSON.stringify(res.data));
	const lock = fixture.queries.find((query) => query.sql.includes("pg_advisory_xact_lock"));
	assert.equal(lock.params[1], "2026-11-12");
	assert.equal(res.data.booking.date, "2026-11-12");
	assert.equal(res.data.razorpay_order, "order_regression_test");
	assert.equal(fixture.orders[0].amount, 120000);
	assert.equal(fixture.orders[0].currency, "INR");
	assert.ok(fixture.queries.some((query) => query.sql === "COMMIT"));
	assert.equal(fixture.notifications.length, 0);
	assert.deepEqual(fixture.releases, ["client", "lock"]);
});

test("booking controller: cash booking still commits and sends booking notifications without creating an online order", async () => {
	const fixture = loadController();
	const res = fixture.response();
	await fixture.controller.createBooking(fixture.request("cod"), res);
	assert.equal(res.statusCode, 201, JSON.stringify(res.data));
	assert.equal(res.data.razorpay_order, null);
	assert.equal(fixture.orders.length, 0);
	assert.equal(fixture.notifications.length, 2);
	assert.ok(fixture.queries.some((query) => query.sql === "COMMIT"));
});

