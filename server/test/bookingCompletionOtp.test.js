const test = require("node:test");
const assert = require("node:assert");

function generate4DigitOtp() {
	return Math.floor(1000 + Math.random() * 9000).toString();
}

function validateCompletionTransition({ currentStatus, targetStatus }) {
	const allowedFromActive = ["in_progress", "completed", "cancelled", "no_show"];
	if (["confirmed", "booked", "in_progress"].includes(currentStatus)) {
		return allowedFromActive.includes(targetStatus);
	}
	return false;
}

function verifyCompletionOtp({ expectedOtp, submittedOtp }) {
	if (!submittedOtp || !expectedOtp) {
		return {
			valid: false,
			message: "Invalid 4-digit completion OTP. Please request the completion code from the customer's dashboard to finalize this job.",
		};
	}

	const normalizedExpected = expectedOtp.toString().trim();
	const normalizedSubmitted = submittedOtp.toString().trim();

	if (
		normalizedSubmitted.length !== 4 ||
		!/^\d{4}$/.test(normalizedSubmitted) ||
		normalizedSubmitted !== normalizedExpected
	) {
		return {
			valid: false,
			message: "Invalid 4-digit completion OTP. Please request the completion code from the customer's dashboard to finalize this job.",
		};
	}

	return { valid: true };
}

function sanitizeBookingForProvider(bookingRow) {
	const { otp, completion_otp, ...sanitized } = bookingRow;
	return sanitized;
}

test("completionOtp: generates valid 4-digit numeric string within 1000-9999", () => {
	for (let i = 0; i < 100; i++) {
		const otp = generate4DigitOtp();
		assert.strictEqual(otp.length, 4);
		assert.match(otp, /^\d{4}$/);
		const num = parseInt(otp, 10);
		assert.ok(num >= 1000 && num <= 9999);
	}
});

test("completionOtp: transition validation allows completed from confirmed, booked, and in_progress", () => {
	assert.strictEqual(
		validateCompletionTransition({ currentStatus: "confirmed", targetStatus: "completed" }),
		true,
	);
	assert.strictEqual(
		validateCompletionTransition({ currentStatus: "booked", targetStatus: "completed" }),
		true,
	);
	assert.strictEqual(
		validateCompletionTransition({ currentStatus: "in_progress", targetStatus: "completed" }),
		true,
	);
	assert.strictEqual(
		validateCompletionTransition({ currentStatus: "pending", targetStatus: "completed" }),
		false,
	);
	assert.strictEqual(
		validateCompletionTransition({ currentStatus: "cancelled", targetStatus: "completed" }),
		false,
	);
});

test("completionOtp: verifies correct matching 4-digit OTP", () => {
	const result = verifyCompletionOtp({ expectedOtp: "5821", submittedOtp: "5821" });
	assert.strictEqual(result.valid, true);
});

test("completionOtp: handles whitespace trimming properly", () => {
	const result = verifyCompletionOtp({ expectedOtp: "4192", submittedOtp: "  4192  " });
	assert.strictEqual(result.valid, true);
});

test("completionOtp: rejects missing, empty, or mismatched OTP", () => {
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: "" }).valid,
		false,
	);
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: null }).valid,
		false,
	);
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: undefined }).valid,
		false,
	);
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: "9999" }).valid,
		false,
	);
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: "123" }).valid,
		false,
	);
	assert.strictEqual(
		verifyCompletionOtp({ expectedOtp: "1234", submittedOtp: "12345" }).valid,
		false,
	);
});

test("completionOtp: sanitizes booking object so provider never receives customer OTP", () => {
	const rawBooking = {
		booking_id: "book-uuid-123",
		service_name: "Plumbing Service",
		price: 750,
		otp: "4821",
		completion_otp: "4821",
		customer_name: "John Doe",
	};

	const sanitized = sanitizeBookingForProvider(rawBooking);
	assert.strictEqual(sanitized.booking_id, "book-uuid-123");
	assert.strictEqual(sanitized.service_name, "Plumbing Service");
	assert.strictEqual(sanitized.otp, undefined);
	assert.strictEqual(sanitized.completion_otp, undefined);
	assert.ok(!("otp" in sanitized));
	assert.ok(!("completion_otp" in sanitized));
});
