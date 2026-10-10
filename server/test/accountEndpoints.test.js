const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../config/db");
const {
	ensureAccountTables,
	createAddress,
	getAddresses,
	updateAddress,
	deleteAddress,
	setDefaultAddress,
	createPaymentMethod,
	getPaymentMethods,
	deletePaymentMethod,
	setDefaultPaymentMethod,
	submitFeedback,
	getMyFeedback,
} = require("../controllers/accountController");

function createMockRes() {
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

describe("accountController: Saved Addresses, Payment Methods & Feedback", () => {
	let testUser;
	let createdAddressId;
	let createdPaymentId;
	let createdFeedbackId;

	before(async () => {
		await ensureAccountTables();
		const res = await db.query(
			"SELECT id, name, email FROM users WHERE role = 'customer' LIMIT 1",
		);
		testUser = res.rows[0];
		if (!testUser) {
			const uRes = await db.query(
				`INSERT INTO users (name, email, role) VALUES ('Test Customer', 'testcustomer@example.com', 'customer') RETURNING id, name, email`,
			);
			testUser = uRes.rows[0];
		}
	});

	after(async () => {
		if (testUser) {
			await db.query("DELETE FROM user_addresses WHERE user_id = $1", [testUser.id]);
			await db.query("DELETE FROM user_payment_methods WHERE user_id = $1", [testUser.id]);
			await db.query("DELETE FROM platform_feedback WHERE user_id = $1", [testUser.id]);
		}
	});

	test("Address: create, list, set default, update, delete", async () => {
		// 1. Create Address
		const createReq = {
			user: { id: testUser.id },
			body: {
				label: "Home",
				full_address: "Flat 402, Sunshine Heights, Indiranagar",
				city: "Bengaluru",
				state: "Karnataka",
				postal_code: "560038",
				landmark: "Near Metro Station",
			},
		};
		const res1 = createMockRes();
		await createAddress(createReq, res1, (err) => { if (err) throw err; });
		assert.equal(res1.statusCode, 201);
		assert.equal(res1.data.success, true);
		assert.equal(res1.data.address.label, "Home");
		assert.equal(res1.data.address.is_default, true);
		createdAddressId = res1.data.address.id;

		// 2. Get Addresses
		const getReq = { user: { id: testUser.id } };
		const res2 = createMockRes();
		await getAddresses(getReq, res2, (err) => { if (err) throw err; });
		assert.equal(res2.statusCode, 200);
		assert.equal(res2.data.addresses.length >= 1, true);

		// 3. Update Address
		const updateReq = {
			user: { id: testUser.id },
			params: { id: createdAddressId },
			body: {
				label: "Home Sweet Home",
				full_address: "Flat 402, Sunshine Heights, 100ft Road, Indiranagar",
			},
		};
		const res3 = createMockRes();
		await updateAddress(updateReq, res3, (err) => { if (err) throw err; });
		assert.equal(res3.statusCode, 200);
		assert.equal(res3.data.address.label, "Home Sweet Home");

		// 4. Set Default
		const defaultReq = {
			user: { id: testUser.id },
			params: { id: createdAddressId },
		};
		const res4 = createMockRes();
		await setDefaultAddress(defaultReq, res4, (err) => { if (err) throw err; });
		assert.equal(res4.statusCode, 200);
		assert.equal(res4.data.address.is_default, true);

		// 5. Delete Address
		const delReq = {
			user: { id: testUser.id },
			params: { id: createdAddressId },
		};
		const res5 = createMockRes();
		await deleteAddress(delReq, res5, (err) => { if (err) throw err; });
		assert.equal(res5.statusCode, 200);
		assert.equal(res5.data.success, true);
	});

	test("Payment Methods: create card and UPI, list, set default, delete", async () => {
		// 1. Create Card
		const cardReq = {
			user: { id: testUser.id },
			body: {
				type: "card",
				card_number: "4111 2222 3333 4242",
				cardholder_name: "Test User",
				card_expiry: "12/28",
				nickname: "HDFC Visa Salary",
			},
		};
		const res1 = createMockRes();
		await createPaymentMethod(cardReq, res1, (err) => { if (err) throw err; });
		assert.equal(res1.statusCode, 201);
		assert.equal(res1.data.payment_method.type, "card");
		assert.equal(res1.data.payment_method.card_brand, "visa");
		assert.equal(res1.data.payment_method.account_number_masked, "•••• •••• •••• 4242");
		assert.equal(res1.data.payment_method.is_default, true);
		createdPaymentId = res1.data.payment_method.id;

		// 2. Create UPI
		const upiReq = {
			user: { id: testUser.id },
			body: {
				type: "upi",
				upi_id: "testuser@okhdfcbank",
				nickname: "Google Pay UPI",
			},
		};
		const res2 = createMockRes();
		await createPaymentMethod(upiReq, res2, (err) => { if (err) throw err; });
		assert.equal(res2.statusCode, 201);
		assert.equal(res2.data.payment_method.type, "upi");
		assert.equal(res2.data.payment_method.bank_or_provider, "Google Pay");

		// 3. Get Payment Methods
		const getReq = { user: { id: testUser.id } };
		const res3 = createMockRes();
		await getPaymentMethods(getReq, res3, (err) => { if (err) throw err; });
		assert.equal(res3.statusCode, 200);
		assert.equal(res3.data.payment_methods.length, 2);

		// 4. Set UPI as Default
		const defaultReq = {
			user: { id: testUser.id },
			params: { id: res3.data.payment_methods[1].id },
		};
		const res4 = createMockRes();
		await setDefaultPaymentMethod(defaultReq, res4, (err) => { if (err) throw err; });
		assert.equal(res4.statusCode, 200);
		assert.equal(res4.data.payment_method.is_default, true);

		// 5. Delete Card
		const delReq = {
			user: { id: testUser.id },
			params: { id: createdPaymentId },
		};
		const res5 = createMockRes();
		await deletePaymentMethod(delReq, res5, (err) => { if (err) throw err; });
		assert.equal(res5.statusCode, 200);
	});

	test("Feedback: submit feedback and retrieve user feedback history", async () => {
		// 1. Submit Feedback
		const fbReq = {
			user: { id: testUser.id, role: "customer" },
			body: {
				rating: 5,
				category: "app_experience",
				feedback: "The instant booking flow and UI is super fast and intuitive!",
			},
		};
		const res1 = createMockRes();
		await submitFeedback(fbReq, res1, (err) => { if (err) throw err; });
		assert.equal(res1.statusCode, 201);
		assert.equal(res1.data.success, true);
		assert.equal(res1.data.feedback.rating, 5);
		assert.equal(res1.data.feedback.category, "app_experience");
		createdFeedbackId = res1.data.feedback.id;

		// 2. Get My Feedback
		const getReq = { user: { id: testUser.id } };
		const res2 = createMockRes();
		await getMyFeedback(getReq, res2, (err) => { if (err) throw err; });
		assert.equal(res2.statusCode, 200);
		assert.equal(res2.data.feedback.length >= 1, true);
		assert.equal(res2.data.feedback[0].rating, 5);
	});
});
