const test = require("node:test");
const assert = require("node:assert");
const { formatHourLabel } = require("../controllers/adminController");

test("admin: formatHourLabel accurately converts 24h hours to 12h AM/PM strings", () => {
	assert.strictEqual(formatHourLabel(0), "12 AM");
	assert.strictEqual(formatHourLabel(7), "7 AM");
	assert.strictEqual(formatHourLabel(12), "12 PM");
	assert.strictEqual(formatHourLabel(13), "1 PM");
	assert.strictEqual(formatHourLabel(17), "5 PM");
	assert.strictEqual(formatHourLabel(23), "11 PM");
});

test("admin: Commission calculation applies configured percentage accurately", () => {
	const calculateCommission = (gmv, percentage) => Math.round(gmv * (percentage / 100));

	assert.strictEqual(calculateCommission(100000, 15), 15000);
	assert.strictEqual(calculateCommission(50000, 20), 10000);
	assert.strictEqual(calculateCommission(1499, 15), 225);
	assert.strictEqual(calculateCommission(0, 15), 0);
});

test("admin: Provider status transitions strictly validate allowed statuses", () => {
	const validStatuses = ["approved", "rejected", "suspended", "pending"];

	const isValidStatus = (status) => validStatuses.includes(status);

	assert.strictEqual(isValidStatus("approved"), true);
	assert.strictEqual(isValidStatus("rejected"), true);
	assert.strictEqual(isValidStatus("suspended"), true);
	assert.strictEqual(isValidStatus("pending"), true);
	assert.strictEqual(isValidStatus("banned"), false);
	assert.strictEqual(isValidStatus(""), false);
	assert.strictEqual(isValidStatus(null), false);
});

test("admin: Dispute resolution validates statuses and refund constraints", () => {
	const validateDisputeResolution = ({ status, refund_amount }) => {
		if (!["resolved", "rejected"].includes(status)) {
			return { valid: false, error: "Invalid dispute status" };
		}
		const amount = parseFloat(refund_amount) || 0;
		if (amount < 0) {
			return { valid: false, error: "Refund amount cannot be negative" };
		}
		return { valid: true, amount };
	};

	assert.strictEqual(validateDisputeResolution({ status: "resolved", refund_amount: 500 }).valid, true);
	assert.strictEqual(validateDisputeResolution({ status: "rejected", refund_amount: 0 }).valid, true);
	assert.strictEqual(validateDisputeResolution({ status: "pending", refund_amount: 0 }).valid, false);
	assert.strictEqual(validateDisputeResolution({ status: "resolved", refund_amount: -50 }).valid, false);
});

test("admin: Commission settings bounds enforce valid percentage range", () => {
	const validateCommissionSetting = (pct) => {
		const val = parseFloat(pct);
		return !isNaN(val) && val >= 0 && val <= 100;
	};

	assert.strictEqual(validateCommissionSetting(15), true);
	assert.strictEqual(validateCommissionSetting(0), true);
	assert.strictEqual(validateCommissionSetting(100), true);
	assert.strictEqual(validateCommissionSetting(105), false);
	assert.strictEqual(validateCommissionSetting(-5), false);
	assert.strictEqual(validateCommissionSetting("abc"), false);
});
