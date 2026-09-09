const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEmail } = require("../utils/normalizeEmail");
const { formatName } = require("../utils/formatName");
const { hashIfPresent } = require("../utils/hash");

test("authValidation: normalizeEmail trims, downcases, and normalizes gmail addresses", () => {
	assert.strictEqual(normalizeEmail("  John.Doe@Gmail.com "), "johndoe@gmail.com");
	assert.strictEqual(normalizeEmail("USER@DOMAIN.ORG"), "user@domain.org");
});

test("authValidation: formatName capitalizes words and trims properly", () => {
	assert.strictEqual(formatName("   john doe  "), "John Doe");
	assert.strictEqual(formatName("ALICE SMITH"), "Alice Smith");
});

test("authValidation: hashIfPresent returns bcrypt hash for string", async () => {
	const hash = await hashIfPresent("SecretPass123!");
	assert.ok(hash);
	assert.ok(hash.startsWith("$2b$") || hash.startsWith("$2a$"));
	assert.notStrictEqual(hash, "SecretPass123!");
});
