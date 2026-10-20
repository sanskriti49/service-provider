const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function mockResponse() {
	return {
		statusCode: 200,
		data: null,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(payload) {
			this.data = payload;
			return this;
		},
	};
}

function createRecoveryHarness() {
	const customerId = "22222222-2222-4222-8222-222222222222";
	const otherCustomerId = "77777777-7777-4777-8777-777777777777";
	const providerId = "11111111-1111-4111-8111-111111111111";
	const serviceId = "33333333-3333-4333-8333-333333333333";

	const refundUuid1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const refundUuid2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
	const refundUuid3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

	const now = Date.now();

	const bookings = [
		// 1. Interrupted checkout with ACTIVE hold (expires in 4 minutes)
		{
			booking_id: "active-hold-booking-1",
			user_id: customerId,
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-20",
			start_time: "14:00",
			end_time: "15:00",
			price: "499.00",
			address: "123 Marine Drive, Mumbai",
			payment_method: "online",
			payment_status: "pending",
			status: "pending",
			razorpay_order_id: "order_active_123",
			razorpay_payment_id: null,
			hold_expires_at: new Date(now + 4 * 60 * 1000),
			created_at: new Date(now - 60 * 1000),
			updated_at: new Date(now - 60 * 1000),
		},
		// 2. Interrupted checkout with EXPIRED hold
		{
			booking_id: "expired-hold-booking-2",
			user_id: customerId,
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-21",
			start_time: "10:00",
			end_time: "11:00",
			price: "799.00",
			address: "456 Bandra West, Mumbai",
			payment_method: "online",
			payment_status: "pending",
			status: "expired",
			razorpay_order_id: "order_expired_456",
			razorpay_payment_id: null,
			hold_expires_at: new Date(now - 10 * 60 * 1000),
			created_at: new Date(now - 20 * 60 * 1000),
			updated_at: new Date(now - 10 * 60 * 1000),
		},
		// 3. Paid booking that had late payment / slot expired -> refund pending
		{
			booking_id: "late-paid-booking-3",
			user_id: customerId,
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-19",
			start_time: "16:00",
			end_time: "17:00",
			price: "599.00",
			address: "789 Juhu Beach, Mumbai",
			payment_method: "online",
			payment_status: "refund_pending",
			status: "expired",
			razorpay_order_id: "order_late_789",
			razorpay_payment_id: "pay_late_789",
			hold_expires_at: new Date(now - 60 * 60 * 1000),
			created_at: new Date(now - 60 * 60 * 1000),
			updated_at: new Date(now - 55 * 60 * 1000),
		},
		// 4. Booking owned by someone else
		{
			booking_id: "other-user-booking-4",
			user_id: otherCustomerId,
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-22",
			start_time: "11:00",
			end_time: "12:00",
			price: "499.00",
			address: "Other Address",
			payment_method: "online",
			payment_status: "pending",
			status: "pending",
			razorpay_order_id: "order_other_111",
			razorpay_payment_id: null,
			hold_expires_at: new Date(now + 3 * 60 * 1000),
			created_at: new Date(now - 30 * 1000),
			updated_at: new Date(now - 30 * 1000),
		},
		// 5. Cancelled unpaid booking
		{
			booking_id: "cancelled-booking-5",
			user_id: customerId,
			provider_id: providerId,
			service_id: serviceId,
			date: "2026-11-23",
			start_time: "14:00",
			end_time: "15:00",
			price: "499.00",
			address: "123 Marine Drive, Mumbai",
			payment_method: "online",
			payment_status: "pending",
			status: "cancelled",
			razorpay_order_id: "order_cancelled_555",
			razorpay_payment_id: null,
			hold_expires_at: new Date(now - 60 * 1000),
			created_at: new Date(now - 120 * 1000),
			updated_at: new Date(now - 60 * 1000),
		},
	];

	const bookingRefunds = [
		// In-flight processing refund
		{
			id: refundUuid1,
			booking_id: "late-paid-booking-3",
			payment_id: "pay_late_789",
			amount_paise: "59900",
			request_key: "late-payment",
			state: "processing",
			gateway_refund_id: "rfnd_gateway_12345",
			last_error: null,
			created_at: new Date(now - 2 * 3600 * 1000),
			updated_at: new Date(now - 2 * 3600 * 1000),
		},
		// Failed refund
		{
			id: refundUuid2,
			booking_id: "late-paid-booking-3",
			payment_id: "pay_failed_456",
			amount_paise: "20000",
			request_key: "dispute-compensation",
			state: "failed",
			gateway_refund_id: "rfnd_failed_67890",
			last_error: "Card issuer bank declined the refund (account closed)",
			created_at: new Date(now - 24 * 3600 * 1000),
			updated_at: new Date(now - 24 * 3600 * 1000),
		},
		// Uncertain refund
		{
			id: refundUuid3,
			booking_id: "late-paid-booking-3",
			payment_id: "pay_uncertain_789",
			amount_paise: "15000",
			request_key: "cancellation",
			state: "unknown",
			gateway_refund_id: null,
			last_error: "Submission outcome uncertain; reconcile receipt or review in gateway dashboard",
			created_at: new Date(now - 36 * 3600 * 1000),
			updated_at: new Date(now - 36 * 3600 * 1000),
		},
	];

	let slotConflictSimulated = false;
	let simulateMissingRefund = false;
	let simulateGatewayError = false;
	const queries = [];
	let reconcileCalledWith = null;

	const queryHandler = async (sql, params = []) => {
		queries.push({ sql, params });

		if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
			return { rows: [] };
		}

		// pg_advisory_xact_lock
		if (sql.includes("pg_advisory_xact_lock")) {
			return { rows: [] };
		}

		// Lock booking (lockBooking utility in bookingLifecycle.js)
		if (
			sql.includes("FROM bookings WHERE booking_id=$1") ||
			sql.includes("FROM bookings WHERE booking_id = $1")
		) {
			const bId = params[0];
			const b = bookings.find((x) => x.booking_id === bId);
			if (!b) return { rows: [] };
			if (sql.includes("(hold_expires_at > clock_timestamp()) AS hold_valid")) {
				const isHoldValid = b.status === "pending" && new Date(b.hold_expires_at).getTime() > Date.now();
				return { rows: [{ hold_valid: isHoldValid }] };
			}
			return {
				rows: [
					{
						...b,
						date_string: b.date,
						provider_id: b.provider_id,
						date: b.date,
					},
				],
			};
		}

		// Conflict check during resume checkout
		if (sql.includes("SELECT booking_id FROM bookings") && sql.includes("WHERE provider_id = $1 AND date = $2::date")) {
			if (slotConflictSimulated) {
				return { rows: [{ booking_id: "conflicting-booking-99" }] };
			}
			return { rows: [] };
		}

		// Checkouts query for getRecoveryItems
		if (sql.includes("WHERE b.user_id = $1") && sql.includes("b.razorpay_payment_id IS NULL")) {
			const uid = params[0];
			const matching = bookings.filter(
				(b) =>
					b.user_id === uid &&
					b.payment_method === "online" &&
					b.razorpay_payment_id === null &&
					["pending", "expired"].includes(b.status)
			);
			return {
				rows: matching.map((b) => ({
					...b,
					provider_name: "Expert Plumber John",
					provider_phone: "+919876543210",
					provider_custom_id: "SRVJOHN123",
					service_name: "Plumbing Repair",
					service_slug: "plumbing-repair",
				})),
			};
		}

		// Missing refunds query (checked BEFORE refunds query to avoid subquery match)
		if (sql.includes("NOT EXISTS (SELECT 1 FROM booking_refunds")) {
			if (simulateMissingRefund) {
				return {
					rows: [
						{
							booking_id: "partially-refunded-booking-6",
							price: "1000.00",
							booking_status: "cancelled",
							payment_status: "partially_refunded",
							razorpay_payment_id: "pay_partial_123",
							booking_date: "2026-11-15",
							updated_at: new Date(now - 2 * 3600 * 1000),
							service_name: "Deep Cleaning",
							provider_name: "Expert Cleaner Bob",
						},
					],
				};
			}
			return { rows: [] };
		}

		// Refunds query for getRecoveryItems
		if (sql.includes("FROM booking_refunds br") && sql.includes("WHERE b.user_id = $1")) {
			const uid = params[0];
			const list = bookingRefunds
				.filter((r) => {
					const b = bookings.find((x) => x.booking_id === r.booking_id);
					return b && b.user_id === uid;
				})
				.map((r) => {
					const b = bookings.find((x) => x.booking_id === r.booking_id);
					return {
						...r,
						refund_id: r.id,
						booking_price: b.price,
						booking_date: b.date,
						booking_status: b.status,
						payment_status: b.payment_status,
						razorpay_payment_id: b.razorpay_payment_id,
						provider_name: "Expert Plumber John",
						service_name: "Plumbing Repair",
					};
				});
			return { rows: list };
		}

		// Reconcile refund lookup
		if (sql.includes("SELECT br.id, b.user_id") && sql.includes("WHERE br.id = $1")) {
			const rId = params[0];
			const r = bookingRefunds.find((x) => x.id === rId);
			if (!r) return { rows: [] };
			const b = bookings.find((x) => x.booking_id === r.booking_id);
			return { rows: [{ id: r.id, user_id: b?.user_id }] };
		}

		// Single refund select after reconcile
		if (sql.includes("SELECT br.*, b.price AS booking_price") && sql.includes("WHERE br.id = $1")) {
			const rId = params[0];
			const r = bookingRefunds.find((x) => x.id === rId);
			if (!r) return { rows: [] };
			const b = bookings.find((x) => x.booking_id === r.booking_id);
			return {
				rows: [
					{
						...r,
						booking_price: b.price,
						booking_status: b.status,
						payment_status: b.payment_status,
						service_name: "Plumbing Repair",
						provider_name: "Expert Plumber John",
					},
				],
			};
		}

		// Update booking query
		if (sql.includes("UPDATE bookings")) {
			const bId = params[params.length - 1];
			const b = bookings.find((x) => x.booking_id === bId);
			if (b) {
				if (sql.includes("SET status = 'pending'") || sql.includes("hold_expires_at = clock_timestamp()")) {
					b.status = "pending";
					b.hold_expires_at = new Date(Date.now() + 5 * 60 * 1000);
					if (params[0]) b.razorpay_order_id = params[0];
				} else if (sql.includes("SET status = 'expired'")) {
					b.status = "expired";
				} else if (sql.includes("SET status='cancelled'")) {
					b.status = "cancelled";
				}
				b.updated_at = new Date();
				return { rows: [b] };
			}
			return { rows: [] };
		}

		return { rows: [] };
	};

	const clientMock = {
		query: queryHandler,
		release: () => queries.push({ sql: "release" }),
	};

	const dbMock = {
		connect: async () => clientMock,
		query: queryHandler,
	};

	const razorpayMock = {
		orders: {
			create: async (opts) => ({
				id: `order_renewed_${Date.now()}`,
				amount: opts.amount,
				currency: opts.currency,
			}),
		},
		payments: {
			fetch: async (id) => ({ id, status: "captured", captured: true }),
		},
		refunds: {
			fetch: async (id) => ({ id, status: "processed" }),
		},
	};

	const filename = path.resolve(__dirname, "../controllers/bookingController.js");
	const instance = new Module(filename, module);
	instance.filename = filename;
	instance.paths = Module._nodeModulePaths(path.dirname(filename));
	const origReq = instance.require.bind(instance);

	instance.require = (reqPath) => {
		if (reqPath === "../config/db") return dbMock;
		if (reqPath === "razorpay") return function () { return razorpayMock; };
		if (reqPath === "../services/bookingSchedule") {
			return { validateSchedule: async () => ({ price: 799, service_id: serviceId }) };
		}
		if (reqPath === "../utils/circuitBreaker") {
			return { createProtectedBreaker: (fn) => ({ fire: fn }) };
		}
		return origReq(reqPath);
	};

	instance.load(filename);

	// Mock paymentService.reconcileRefund
	instance.exports.paymentService.reconcileRefund = async (rId) => {
		reconcileCalledWith = rId;
		if (simulateGatewayError) {
			throw new Error("Razorpay gateway timeout: connection reset");
		}
		const r = bookingRefunds.find((x) => x.id === rId);
		if (r && r.state === "processing") {
			r.state = "processed";
			r.updated_at = new Date();
		}
	};

	return {
		controller: instance.exports,
		customerId,
		otherCustomerId,
		refundUuid1,
		refundUuid2,
		refundUuid3,
		bookings,
		bookingRefunds,
		setSlotConflict: (val) => { slotConflictSimulated = val; },
		setSimulateMissingRefund: (val) => { simulateMissingRefund = val; },
		setSimulateGatewayError: (val) => { simulateGatewayError = val; },
		getReconcileCalledWith: () => reconcileCalledWith,
	};
}

// ---------------------------------------------------------------------------
// Tests for Booking / Payment Recovery Hub
// ---------------------------------------------------------------------------

test("recovery: getRecoveryItems returns interrupted checkouts with active hold and countdown", async () => {
	const harness = createRecoveryHarness();
	const req = { user: { id: harness.customerId, role: "customer" } };
	const res = mockResponse();

	await harness.controller.getRecoveryItems(req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.interrupted_checkouts.length, 2);

	const active = res.data.interrupted_checkouts.find((c) => c.booking_id === "active-hold-booking-1");
	assert.ok(active, "Active hold booking must be present");
	assert.equal(active.is_hold_active, true);
	assert.ok(active.seconds_remaining > 0, "Seconds remaining should be positive");
	assert.equal(active.price, 499);
	assert.equal(active.service_name, "Plumbing Repair");

	const expired = res.data.interrupted_checkouts.find((c) => c.booking_id === "expired-hold-booking-2");
	assert.ok(expired, "Expired hold booking must be present");
	assert.equal(expired.is_hold_active, false);
	assert.equal(expired.seconds_remaining, 0);
});

test("recovery: getRecoveryItems exposes pending, failed, and uncertain refunds transparently", async () => {
	const harness = createRecoveryHarness();
	const req = { user: { id: harness.customerId, role: "customer" } };
	const res = mockResponse();

	await harness.controller.getRecoveryItems(req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.refunds.length, 3);

	// In-flight refund
	const inFlight = res.data.refunds.find((r) => r.refund_id === harness.refundUuid1);
	assert.ok(inFlight);
	assert.equal(inFlight.state, "processing");
	assert.equal(inFlight.is_pending, true);
	assert.equal(inFlight.amount_inr, 599);
	assert.equal(inFlight.gateway_refund_id, "rfnd_gateway_12345");
	assert.equal(inFlight.can_reconcile, true);
	assert.match(inFlight.reason_label, /Slot hold expired/);

	// Failed refund
	const failed = res.data.refunds.find((r) => r.refund_id === harness.refundUuid2);
	assert.ok(failed);
	assert.equal(failed.state, "failed");
	assert.equal(failed.is_failed, true);
	assert.equal(failed.amount_inr, 200);
	assert.equal(failed.can_reconcile, true);
	assert.match(failed.last_error, /Card issuer bank declined/);

	// Uncertain refund
	const uncertain = res.data.refunds.find((r) => r.refund_id === harness.refundUuid3);
	assert.ok(uncertain);
	assert.equal(uncertain.state, "unknown");
	assert.equal(uncertain.is_uncertain, true);
	assert.equal(uncertain.can_reconcile, true);
	assert.match(uncertain.status_label, /Under manual review/);

	// Summary statistics
	assert.equal(res.data.summary.interrupted_count, 2);
	assert.equal(res.data.summary.active_holds_count, 1);
	assert.equal(res.data.summary.failed_refunds_count, 1);
	assert.equal(res.data.summary.uncertain_refunds_count, 1);
	assert.equal(res.data.summary.has_actionable_items, true);
});

test("recovery: missing refund record with partially_refunded produces unknown amount under review without crashing", async () => {
	const harness = createRecoveryHarness();
	harness.setSimulateMissingRefund(true);
	const req = { user: { id: harness.customerId, role: "customer" } };
	const res = mockResponse();

	await harness.controller.getRecoveryItems(req, res);

	assert.equal(res.statusCode, 200);
	const partial = res.data.refunds.find((r) => r.booking_id === "partially-refunded-booking-6");
	assert.ok(partial, "Synthetic refund entry must be synthesized");
	assert.equal(partial.is_synthetic, true);
	assert.equal(partial.is_amount_unknown, true);
	assert.equal(partial.amount_inr, null, "Amount must NOT be invented for partially_refunded without refund intent");
	assert.equal(partial.can_reconcile, false, "Synthetic record cannot be directly reconciled at gateway");
	assert.match(partial.status_label, /Partial refund under review/);
	assert.match(partial.last_error, /Manual balance review required/);
});

test("recovery: resumeCheckout on an ACTIVE hold proceeds immediately with existing order", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { booking_id: "active-hold-booking-1" },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.resumeCheckout(req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.can_pay, true);
	assert.equal(res.data.slot_renewed, false);
	assert.equal(res.data.razorpay_order, "order_active_123");
});

test("recovery: resumeCheckout on an EXPIRED hold re-verifies slot and re-holds for 5 minutes", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { booking_id: "expired-hold-booking-2" },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.resumeCheckout(req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.can_pay, true);
	assert.equal(res.data.slot_renewed, true);
	assert.ok(res.data.razorpay_order);

	// Booking status updated back to pending
	const b = harness.bookings.find((x) => x.booking_id === "expired-hold-booking-2");
	assert.equal(b.status, "pending");
	assert.ok(new Date(b.hold_expires_at).getTime() > Date.now());
});

test("recovery: resumeCheckout rejects CANCELLED booking and does NOT resurrect it", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { booking_id: "cancelled-booking-5" },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.resumeCheckout(req, res);

	assert.equal(res.statusCode, 409);
	assert.match(res.data.message, /Cannot resume checkout for a cancelled booking/);

	// Ensure booking remained cancelled in database
	const b = harness.bookings.find((x) => x.booking_id === "cancelled-booking-5");
	assert.equal(b.status, "cancelled", "Cancelled booking must NOT be resurrected to pending");
});

test("recovery: resumeCheckout on an expired hold fails safely if slot was taken by another user", async () => {
	const harness = createRecoveryHarness();
	harness.setSlotConflict(true); // Simulate slot conflict

	const req = {
		params: { booking_id: "expired-hold-booking-2" },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.resumeCheckout(req, res);

	assert.equal(res.statusCode, 409);
	assert.equal(res.data.can_pay, false);
	assert.equal(res.data.reason, "slot_taken");
	assert.match(res.data.message, /time slot was booked by another customer/);
});

test("recovery: resumeCheckout denies unauthorized customer (403)", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { booking_id: "other-user-booking-4" },
		user: { id: harness.customerId, role: "customer" }, // Jane trying to access Dave's booking
	};
	const res = mockResponse();

	await harness.controller.resumeCheckout(req, res);

	assert.equal(res.statusCode, 403);
});

test("recovery: reconcileCustomerRefund checks gateway and updates refund status", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { refund_id: harness.refundUuid1 },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.reconcileCustomerRefund(req, res);

	assert.equal(res.statusCode, 200);
	assert.equal(res.data.success, true);
	assert.equal(res.data.synced, true);
	assert.equal(harness.getReconcileCalledWith(), harness.refundUuid1);
	assert.equal(res.data.refund.state, "processed");
});

test("recovery: reconcileCustomerRefund rejects synthetic ID or invalid UUID with 400 Bad Request", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { refund_id: "synth-partially-refunded-booking-6" },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.reconcileCustomerRefund(req, res);

	assert.equal(res.statusCode, 400);
	assert.equal(res.data.can_reconcile, false);
	assert.match(res.data.message, /Direct gateway reconciliation is not available/);
});

test("recovery: reconcileCustomerRefund returns 502 with synced: false when gateway sync fails", async () => {
	const harness = createRecoveryHarness();
	harness.setSimulateGatewayError(true);
	const req = {
		params: { refund_id: harness.refundUuid1 },
		user: { id: harness.customerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.reconcileCustomerRefund(req, res);

	assert.equal(res.statusCode, 502);
	assert.equal(res.data.success, false);
	assert.equal(res.data.synced, false);
	assert.match(res.data.message, /Could not sync with payment gateway/);
	assert.ok(res.data.refund, "Still returns the last recorded refund state");
});

test("recovery: reconcileCustomerRefund rejects non-owner customer with 403", async () => {
	const harness = createRecoveryHarness();
	const req = {
		params: { refund_id: harness.refundUuid1 },
		user: { id: harness.otherCustomerId, role: "customer" },
	};
	const res = mockResponse();

	await harness.controller.reconcileCustomerRefund(req, res);

	assert.equal(res.statusCode, 403);
});
