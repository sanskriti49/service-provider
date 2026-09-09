const test = require("node:test");
const assert = require("node:assert/strict");
const { getPriceDetails, pricingConfig } = require("../utils/pricing");

test("pricing: getPriceDetails returns accurate details for House Cleaning", () => {
	const details = getPriceDetails("House Cleaning");
	assert.strictEqual(details.unit, "fixed");
	assert.strictEqual(details.slotDuration, 120);
	assert.strictEqual(details.buffer, 30);
	assert.ok(typeof details.price === "number");
	assert.ok(details.price >= pricingConfig["House Cleaning"].min);
});

test("pricing: getPriceDetails returns accurate details for Laundry (per cloth)", () => {
	const details = getPriceDetails("Laundry");
	assert.strictEqual(details.unit, "per cloth");
	assert.strictEqual(details.slotDuration, 30);
	assert.strictEqual(details.price, pricingConfig["Laundry"].min);
});

test("pricing: getPriceDetails returns accurate details for Plumbing (visiting)", () => {
	const details = getPriceDetails("Plumbing");
	assert.strictEqual(details.unit, "visiting");
	assert.strictEqual(details.slotDuration, 60);
	assert.ok(details.price > 0);
});

test("pricing: getPriceDetails falls back to default for unknown service", () => {
	const details = getPriceDetails("Nonexistent Service XYZ");
	assert.strictEqual(details.unit, pricingConfig.default.unit);
	assert.strictEqual(details.slotDuration, pricingConfig.default.slotDuration);
	assert.strictEqual(details.buffer, pricingConfig.default.buffer);
	assert.ok(details.price > 0);
});
