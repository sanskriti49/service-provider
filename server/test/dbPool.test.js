const { test, describe } = require("node:test");
const assert = require("node:assert");
const db = require("../config/db");
const { updatePoolMetrics, dbPoolTotal, dbPoolIdle, dbPoolWaiting } = require("../utils/metrics");

describe("dbPool: PostgreSQL Connection Pooling Safeguards", () => {
	test("getPoolStats returns valid structure and limits", () => {
		const stats = db.getPoolStats();
		assert.strictEqual(typeof stats.totalCount, "number");
		assert.strictEqual(typeof stats.idleCount, "number");
		assert.strictEqual(typeof stats.waitingCount, "number");
		assert.strictEqual(typeof stats.maxLimit, "number");
		assert.ok(stats.maxLimit >= 1);
		assert.strictEqual(typeof stats.isPgBouncerCompatible, "boolean");
	});

	test("updatePoolMetrics correctly sets Prometheus gauges", async () => {
		updatePoolMetrics({
			totalCount: 8,
			idleCount: 5,
			waitingCount: 1,
		});

		const totalMetric = await dbPoolTotal.get();
		const idleMetric = await dbPoolIdle.get();
		const waitingMetric = await dbPoolWaiting.get();

		assert.strictEqual(totalMetric.values[0].value, 8);
		assert.strictEqual(idleMetric.values[0].value, 5);
		assert.strictEqual(waitingMetric.values[0].value, 1);
	});
});
