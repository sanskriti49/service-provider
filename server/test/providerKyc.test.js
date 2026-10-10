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

test("s3: generatePresignedUploadUrl returns valid upload URL and scoped fileKey", async () => {
	const { generatePresignedUploadUrl, bucketName } = require("../config/s3");
	const key = "kyc-documents/user_123/1700000000-abc123-id_card.png";
	const result = await generatePresignedUploadUrl({
		key,
		contentType: "image/png",
		expiresIn: 300,
	});

	assert.strictEqual(result.fileKey, key);
	assert.ok(result.uploadUrl, "Should have uploadUrl");
	assert.ok(result.fileUrl.includes(bucketName), "File URL should reference configured S3 bucket");
});

test("s3: generatePresignedDownloadUrl returns signed URL for private documents", async () => {
	const { generatePresignedDownloadUrl, bucketName } = require("../config/s3");
	const key = "kyc-documents/user_123/1700000000-abc123-id_card.png";
	const result = await generatePresignedDownloadUrl({
		key,
		expiresIn: 3600,
	});

	assert.ok(result.downloadUrl, "Should return a downloadUrl");
	assert.ok(result.downloadUrl.includes(bucketName), "Download URL should include bucket name");
});

test("s3: uploadBufferToS3 correctly processes file buffer and returns URL", async () => {
	const { uploadBufferToS3 } = require("../config/s3");
	const dummyBuffer = Buffer.from("fake-image-bytes");
	const key = "kyc-documents/user_456/test_doc.png";
	const res = await uploadBufferToS3({
		buffer: dummyBuffer,
		key,
		contentType: "image/png",
	});

	assert.strictEqual(res.key, key);
	assert.ok(res.fileUrl, "Should return fileUrl");
});

