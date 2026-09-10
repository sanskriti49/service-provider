const { test, describe } = require("node:test");
const assert = require("node:assert");
const {
	register,
	bookingsTotal,
	eventQueueJobsTotal,
	metricsMiddleware,
} = require("../utils/metrics");

describe("metrics: Prometheus Cloud Observability", () => {
	test("register renders Prometheus metrics format string", async () => {
		const metricsText = await register.metrics();
		assert.strictEqual(typeof metricsText, "string");
		assert.ok(metricsText.includes("taskgenie_"));
	});

	test("bookingsTotal increment properly tracks status label", async () => {
		bookingsTotal.inc({ status: "test_created" });
		const metricsText = await register.metrics();
		assert.ok(metricsText.includes('taskgenie_bookings_total{status="test_created"} 1'));
	});

	test("eventQueueJobsTotal increment tracks event_type and status labels", async () => {
		eventQueueJobsTotal.inc({ event_type: "TEST_JOB", status: "success" });
		const metricsText = await register.metrics();
		assert.ok(metricsText.includes('taskgenie_event_queue_jobs_total{event_type="TEST_JOB",status="success"} 1'));
	});

	test("metricsMiddleware calls next() for bypassed and active routes", () => {
		let calledNext = false;
		const req = { path: "/metrics" };
		const res = {};
		metricsMiddleware(req, res, () => {
			calledNext = true;
		});
		assert.strictEqual(calledNext, true);
	});
});
