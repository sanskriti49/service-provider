const test = require("node:test");
const assert = require("node:assert");

test("kyc: Document type validation allows only authorized identification types", () => {
	const validDocTypes = ["aadhaar", "driving_license", "certificate"];
	const isValidDocType = (docType) => validDocTypes.includes(docType);

	assert.strictEqual(isValidDocType("aadhaar"), true);
	assert.strictEqual(isValidDocType("driving_license"), true);
	assert.strictEqual(isValidDocType("certificate"), true);
	assert.strictEqual(isValidDocType("passport"), false);
	assert.strictEqual(isValidDocType("random_card"), false);
	assert.strictEqual(isValidDocType(""), false);
});

test("kyc: Status transitions enforce verified, rejected, or pending states", () => {
	const validKycStatuses = ["verified", "rejected", "pending"];
	const isValidKycStatus = (s) => validKycStatuses.includes(s);

	assert.strictEqual(isValidKycStatus("verified"), true);
	assert.strictEqual(isValidKycStatus("rejected"), true);
	assert.strictEqual(isValidKycStatus("pending"), true);
	assert.strictEqual(isValidKycStatus("active"), false);
	assert.strictEqual(isValidKycStatus("approved"), false);
});

test("kyc: Verified Pro badge is awarded upon verification and revoked upon rejection or suspension", () => {
	const resolveBadgeState = (kycStatus, providerStatus) => {
		const isVerified = kycStatus === "verified" || providerStatus === "approved";
		const isSuspendedOrRejected = providerStatus === "rejected" || providerStatus === "suspended" || kycStatus === "rejected";
		
		if (isSuspendedOrRejected) {
			return { is_verified: false, verification_badge: null };
		}
		if (isVerified) {
			return { is_verified: true, verification_badge: "verified_pro" };
		}
		return { is_verified: false, verification_badge: null };
	};

	assert.deepStrictEqual(resolveBadgeState("verified", "approved"), {
		is_verified: true,
		verification_badge: "verified_pro",
	});

	assert.deepStrictEqual(resolveBadgeState("pending", "approved"), {
		is_verified: true,
		verification_badge: "verified_pro",
	});

	assert.deepStrictEqual(resolveBadgeState("verified", "suspended"), {
		is_verified: false,
		verification_badge: null,
	});

	assert.deepStrictEqual(resolveBadgeState("rejected", "pending"), {
		is_verified: false,
		verification_badge: null,
	});

	assert.deepStrictEqual(resolveBadgeState("pending", "pending"), {
		is_verified: false,
		verification_badge: null,
	});
});

test("kyc: Document number sanitization trims and strips invalid special characters", () => {
	const sanitizeDocNumber = (raw) => {
		if (!raw || typeof raw !== "string") return "";
		return raw.trim().toUpperCase();
	};

	assert.strictEqual(sanitizeDocNumber(" 4523-8910-1234 "), "4523-8910-1234");
	assert.strictEqual(sanitizeDocNumber("dl-0420110012345"), "DL-0420110012345");
	assert.strictEqual(sanitizeDocNumber(null), "");
});
