const { test, describe } = require("node:test");
const assert = require("node:assert");
const eventQueue = require("../utils/eventQueue");

describe("eventQueue: Asynchronous Event-Driven Worker Queue", () => {
	test("publish queues an event and triggers registered handler asynchronously", async () => {
		let handledData = null;

		eventQueue.registerHandler("TEST_EVENT", async (data) => {
			handledData = data;
		});

		const result = eventQueue.publish("TEST_EVENT", { message: "cloud-native" });
		assert.strictEqual(result.status, "queued");
		assert.ok(result.jobId.startsWith("job_"));

		// Wait for next tick / async processing
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.deepStrictEqual(handledData, { message: "cloud-native" });
	});

	test("retries failed jobs with exponential backoff", async () => {
		let attempts = 0;

		eventQueue.registerHandler("FAIL_ONCE_EVENT", async () => {
			attempts++;
			if (attempts === 1) {
				throw new Error("Simulated network glitch");
			}
		});

		eventQueue.publish("FAIL_ONCE_EVENT", {}, { maxRetries: 2 });

		// Wait for retry backoff
		await new Promise((resolve) => setTimeout(resolve, 350));
		assert.strictEqual(attempts, 2);
	});

	test("getStats returns pending, active, queued, and processed counts", () => {
		const stats = eventQueue.getStats();
		assert.strictEqual(typeof stats.queued, "number");
		assert.strictEqual(typeof stats.processed, "number");
		assert.strictEqual(typeof stats.pending, "number");
		assert.strictEqual(typeof stats.active, "number");
	});
});
