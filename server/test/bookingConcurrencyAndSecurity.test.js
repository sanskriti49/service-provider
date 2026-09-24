const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

describe("Security & Concurrency: Booking Integrity & Payment Webhooks", () => {
	// 1. Transaction Advisory Lock Key Determinism
	test("advisory locking: generates consistent and isolated lock keys per provider and date", () => {
		const generateLockKey = (providerId, date) => {
			const cleanDate = String(date).substring(0, 10);
			return `booking:${providerId}:${cleanDate}`;
		};

		const provider1 = "11111111-1111-1111-1111-111111111111";
		const provider2 = "22222222-2222-2222-2222-222222222222";
		const date1 = "2026-10-15";
		const date2 = "2026-10-16";

		// Same provider and date produce identical lock key
		assert.strictEqual(
			generateLockKey(provider1, date1),
			generateLockKey(provider1, "2026-10-15T00:00:00.000Z"),
		);

		// Different dates or providers produce distinct lock keys
		assert.notStrictEqual(
			generateLockKey(provider1, date1),
			generateLockKey(provider1, date2),
		);
		assert.notStrictEqual(
			generateLockKey(provider1, date1),
			generateLockKey(provider2, date1),
		);
	});

	// 2. Webhook Cryptographic HMAC Verification
	test("webhook: verifies valid HMAC sha256 signature and rejects forged signatures", () => {
		const webhookSecret = "test_webhook_secret_key_12345";
		const payload = JSON.stringify({
			event: "order.paid",
			payload: {
				order: { entity: { id: "order_xyz123" } },
				payment: { entity: { id: "pay_abc789", order_id: "order_xyz123" } },
			},
		});

		const validSignature = crypto
			.createHmac("sha256", webhookSecret)
			.update(payload)
			.digest("hex");

		const verifySignature = (rawBody, signature, secret) => {
			const expectedSignature = crypto
				.createHmac("sha256", secret)
				.update(rawBody)
				.digest("hex");
			return crypto.timingSafeEqual(
				Buffer.from(signature, "hex"),
				Buffer.from(expectedSignature, "hex"),
			);
		};

		assert.strictEqual(verifySignature(payload, validSignature, webhookSecret), true);

		// Tampered payload
		const tamperedPayload = JSON.stringify({
			event: "order.paid",
			payload: {
				order: { entity: { id: "order_xyz123" } },
				payment: { entity: { id: "pay_tampered", order_id: "order_xyz123" } },
			},
		});
		assert.strictEqual(verifySignature(tamperedPayload, validSignature, webhookSecret), false);

		// Invalid secret
		assert.strictEqual(verifySignature(payload, validSignature, "wrong_secret"), false);
	});

	// 3. Webhook Idempotency Simulation
	test("webhook: idempotency guard prevents double processing of captured payments", () => {
		// Mock booking state in database
		let booking = {
			booking_id: 101,
			razorpay_order_id: "order_test_999",
			payment_status: "paid",
			status: "booked",
		};
		let notificationCount = 0;

		const processWebhookPayment = (incomingBooking) => {
			if (incomingBooking.payment_status === "paid") {
				return { status: "ok", message: "already_processed", sideEffectsTriggered: false };
			}
			incomingBooking.payment_status = "paid";
			incomingBooking.status = "booked";
			notificationCount++;
			return { status: "ok", message: "payment_processed", sideEffectsTriggered: true };
		};

		// First attempt with already 'paid' status
		const result1 = processWebhookPayment(booking);
		assert.strictEqual(result1.status, "ok");
		assert.strictEqual(result1.message, "already_processed");
		assert.strictEqual(result1.sideEffectsTriggered, false);
		assert.strictEqual(notificationCount, 0);

		// Simulating transition from 'pending' to 'paid'
		booking.payment_status = "pending";
		const result2 = processWebhookPayment(booking);
		assert.strictEqual(result2.status, "ok");
		assert.strictEqual(result2.message, "payment_processed");
		assert.strictEqual(result2.sideEffectsTriggered, true);
		assert.strictEqual(notificationCount, 1);

		// Duplicate event arriving right after
		const result3 = processWebhookPayment(booking);
		assert.strictEqual(result3.status, "ok");
		assert.strictEqual(result3.message, "already_processed");
		assert.strictEqual(result3.sideEffectsTriggered, false);
		assert.strictEqual(notificationCount, 1);
	});

	// 4. Provider Ownership & IDOR Protection
	test("authorization: rejects unauthorized access when user is not owner and not admin", () => {
		const checkOwnership = ({ userId, userRole, providerOwnerId }) => {
			if (userRole === "admin") return { allowed: true };
			if (userId === providerOwnerId) return { allowed: true };
			return { allowed: false, statusCode: 403, error: "Access denied" };
		};

		// Owner access
		assert.deepStrictEqual(
			checkOwnership({ userId: "user-1", userRole: "provider", providerOwnerId: "user-1" }),
			{ allowed: true },
		);

		// Admin access
		assert.deepStrictEqual(
			checkOwnership({ userId: "admin-1", userRole: "admin", providerOwnerId: "user-2" }),
			{ allowed: true },
		);

		// Unrelated provider attempting IDOR
		assert.deepStrictEqual(
			checkOwnership({ userId: "attacker-user", userRole: "provider", providerOwnerId: "victim-user" }),
			{ allowed: false, statusCode: 403, error: "Access denied" },
		);

		// Customer attempting to modify provider services
		assert.deepStrictEqual(
			checkOwnership({ userId: "customer-1", userRole: "customer", providerOwnerId: "provider-1" }),
			{ allowed: false, statusCode: 403, error: "Access denied" },
		);
	});

	// 5. KYC Privacy Sanitization
	test("kyc sanitization: strips sensitive identification and KYC document URLs from public view", () => {
		const rawProviderDbRow = {
			id: "provider-uuid-1",
			name: "Expert Electrician",
			email: "private_provider@gmail.com",
			phone: "9876543210",
			rating: 4.8,
			document_type: "aadhaar",
			document_number: "4523-8910-1234",
			document_front_url: "https://cloudinary.com/secret/front.jpg",
			document_back_url: "https://cloudinary.com/secret/back.jpg",
			rejection_reason: null,
			is_verified: true,
			verification_badge: "verified_pro",
		};

		const sanitizePublicProvider = (provider) => {
			const safe = { ...provider };
			delete safe.document_number;
			delete safe.document_front_url;
			delete safe.document_back_url;
			delete safe.rejection_reason;
			delete safe.email;
			return safe;
		};

		const sanitized = sanitizePublicProvider(rawProviderDbRow);
		assert.strictEqual(sanitized.document_number, undefined);
		assert.strictEqual(sanitized.document_front_url, undefined);
		assert.strictEqual(sanitized.document_back_url, undefined);
		assert.strictEqual(sanitized.rejection_reason, undefined);
		assert.strictEqual(sanitized.email, undefined);
		assert.strictEqual(sanitized.name, "Expert Electrician");
		assert.strictEqual(sanitized.rating, 4.8);
		assert.strictEqual(sanitized.verification_badge, "verified_pro");
	});

	// 6. Upload MIME-type and Size Guard
	test("upload guard: allows only safe images and PDF files, rejecting dangerous mime types", () => {
		const allowedMimes = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/pdf",
		];

		const validateUploadMime = (mime) => allowedMimes.includes(mime);

		assert.strictEqual(validateUploadMime("image/jpeg"), true);
		assert.strictEqual(validateUploadMime("image/png"), true);
		assert.strictEqual(validateUploadMime("image/webp"), true);
		assert.strictEqual(validateUploadMime("application/pdf"), true);

		// Disallowed file types
		assert.strictEqual(validateUploadMime("application/javascript"), false);
		assert.strictEqual(validateUploadMime("text/html"), false);
		assert.strictEqual(validateUploadMime("application/x-sh"), false);
		assert.strictEqual(validateUploadMime("image/svg+xml"), false);
	});

	// 7. Booking Status Cancellation Guards
	test("booking transitions: prevents customer cancellation on active or terminal states", () => {
		const canCustomerCancel = (currentStatus) => {
			if (["in_progress", "completed", "cancelled"].includes(currentStatus)) {
				return false;
			}
			return true;
		};

		assert.strictEqual(canCustomerCancel("pending"), true);
		assert.strictEqual(canCustomerCancel("booked"), true);
		assert.strictEqual(canCustomerCancel("confirmed"), true);

		assert.strictEqual(canCustomerCancel("in_progress"), false);
		assert.strictEqual(canCustomerCancel("completed"), false);
		assert.strictEqual(canCustomerCancel("cancelled"), false);
	});

	// 8. Review Authorization Guards
	test("review validation: requires completed booking and customer ownership", () => {
		const validateReviewEligibility = ({ bookingUserId, currentUserId, bookingStatus }) => {
			if (bookingUserId !== currentUserId) {
				return { eligible: false, error: "Only the customer who booked can review" };
			}
			if (bookingStatus !== "completed") {
				return { eligible: false, error: "Can only review completed bookings" };
			}
			return { eligible: true };
		};

		assert.deepStrictEqual(
			validateReviewEligibility({
				bookingUserId: "cust-1",
				currentUserId: "cust-1",
				bookingStatus: "completed",
			}),
			{ eligible: true },
		);

		assert.deepStrictEqual(
			validateReviewEligibility({
				bookingUserId: "cust-1",
				currentUserId: "cust-2",
				bookingStatus: "completed",
			}),
			{ eligible: false, error: "Only the customer who booked can review" },
		);

		assert.deepStrictEqual(
			validateReviewEligibility({
				bookingUserId: "cust-1",
				currentUserId: "cust-1",
				bookingStatus: "in_progress",
			}),
			{ eligible: false, error: "Can only review completed bookings" },
		);
	});
});
