import test from "node:test";
import assert from "node:assert/strict";
import { getAllowedUnits, UNIT_LABELS } from "../src/utils/pricingHelper.js";

test("pricingHelper: UNIT_LABELS contains all standard unit labels", () => {
	assert.strictEqual(UNIT_LABELS["fixed"], "Fixed Rate");
	assert.strictEqual(UNIT_LABELS["per hr"], "Per Hour");
	assert.strictEqual(UNIT_LABELS["per cloth"], "Per Cloth");
	assert.strictEqual(UNIT_LABELS["visiting"], "Visiting Charge");
});

test("pricingHelper: getAllowedUnits returns correct whitelisted units for service", () => {
	const laundryUnits = getAllowedUnits("laundry");
	assert.ok(laundryUnits.includes("per cloth"));

	const cleaningUnits = getAllowedUnits("house-cleaning");
	assert.ok(cleaningUnits.includes("fixed"));
	assert.ok(cleaningUnits.includes("per hr"));
});

test("pricingHelper: getAllowedUnits includes dbDefaultUnit if specified", () => {
	const customUnits = getAllowedUnits("custom-unknown-service", "per meter");
	assert.ok(customUnits.includes("per meter"));
});
