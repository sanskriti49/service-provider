const { test, describe } = require("node:test");
const assert = require("node:assert");

describe("reviews: Customer & Provider Review Validation", () => {
	test("calculates star rating distribution and averages accurately", () => {
		const ratings = [5, 5, 5, 4, 4, 3, 5, 5, 4, 5];
		const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
		let sum = 0;

		for (const r of ratings) {
			distribution[r] = (distribution[r] || 0) + 1;
			sum += r;
		}

		const average = Number((sum / ratings.length).toFixed(1));
		const positiveCount = (distribution[5] || 0) + (distribution[4] || 0);
		const satisfactionRate = Math.round((positiveCount / ratings.length) * 100);

		assert.strictEqual(distribution[5], 6);
		assert.strictEqual(distribution[4], 3);
		assert.strictEqual(distribution[3], 1);
		assert.strictEqual(distribution[2], 0);
		assert.strictEqual(distribution[1], 0);
		assert.strictEqual(average, 4.5);
		assert.strictEqual(satisfactionRate, 90);
	});

	test("validates rating bounds between 1 and 5", () => {
		const isValidRating = (r) => {
			const n = parseInt(r, 10);
			return !isNaN(n) && n >= 1 && n <= 5;
		};

		assert.strictEqual(isValidRating(5), true);
		assert.strictEqual(isValidRating("4"), true);
		assert.strictEqual(isValidRating(1), true);
		assert.strictEqual(isValidRating(0), false);
		assert.strictEqual(isValidRating(6), false);
		assert.strictEqual(isValidRating("abc"), false);
		assert.strictEqual(isValidRating(null), false);
	});

	test("sanitizes review comment strings", () => {
		const sanitizeComment = (c) => (c ? String(c).trim() : "");
		assert.strictEqual(sanitizeComment("   Super service!   "), "Super service!");
		assert.strictEqual(sanitizeComment(null), "");
		assert.strictEqual(sanitizeComment(undefined), "");
	});
});
