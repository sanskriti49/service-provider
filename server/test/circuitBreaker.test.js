const { test, describe } = require("node:test");
const assert = require("node:assert");
const { createProtectedBreaker, getCircuitBreakerStatus } = require("../utils/circuitBreaker");

describe("circuitBreaker: Fault Tolerance & Resilient 3rd-Party Integration", () => {
	test("executes successfully when downstream service is healthy", async () => {
		const healthyAction = async (val) => `success_${val}`;
		const breaker = createProtectedBreaker(healthyAction, {
			name: "test-healthy-service",
			timeout: 1000,
		});

		const result = await breaker.fire("payload");
		assert.strictEqual(result, "success_payload");
		assert.strictEqual(breaker.opened, false);
	});

	test("trips circuit to OPEN when failure threshold is reached", async () => {
		let callCount = 0;
		const failingAction = async () => {
			callCount++;
			throw new Error("Downstream gateway timeout");
		};

		const breaker = createProtectedBreaker(failingAction, {
			name: "test-failing-service",
			errorThresholdPercentage: 1, // Trip immediately on failure
			rollingCountTimeout: 1000,
			rollingCountBuckets: 1,
			volumeThreshold: 1,
			resetTimeout: 500,
		});

		try {
			await breaker.fire();
		} catch (_) {}

		assert.strictEqual(callCount, 1);
		assert.strictEqual(breaker.opened, true);

		// Subsequent call while OPEN fails fast without executing failingAction
		await assert.rejects(
			async () => {
				await breaker.fire();
			},
			(err) => {
				return err.message.includes("open") || err.code === "EOPENBREAKER";
			},
		);

		// Call count should NOT have increased because circuit is open
		assert.strictEqual(callCount, 1);
	});

	test("getCircuitBreakerStatus returns current state of registered breakers", () => {
		const status = getCircuitBreakerStatus();
		assert.ok(typeof status === "object");
		assert.ok(status["test-healthy-service"]);
		assert.strictEqual(status["test-healthy-service"].state, "closed");
	});
});
