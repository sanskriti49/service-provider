const express = require("express");

// Liveness answers process health; readiness answers DB reachability. Queue
// fallback is visible, but optional notifications must not disable booking APIs.
function createHealthRouter({ db, eventQueue, updatePoolMetrics = () => {}, getCircuitBreakerStatus = () => ({}) }) {
	const router = express.Router();
	router.get("/live", (req, res) => res.json({ status: "alive", uptime: process.uptime(), timestamp: new Date().toISOString() }));
	router.get("/ready", async (req, res) => {
		const began = Date.now();
		try {
			await db.query({ text: "SELECT 1", query_timeout: 2000 });
			const pool = db.getPoolStats?.() || null;
			if (pool) updatePoolMetrics(pool);
			const queue = eventQueue.getStats();
			res.json({ status: "ready", checks: {
				database: { status: "connected", latencyMs: Date.now() - began, pool },
				eventQueue: { ...queue, status: queue.engine === "bullmq" ? "configured" : "volatile-fallback",
					durable: queue.engine === "bullmq" },
				circuitBreakers: getCircuitBreakerStatus(),
			}, timestamp: new Date().toISOString() });
		} catch {
			// Do not expose connection strings, query text or driver errors publicly.
			res.status(503).json({ status: "degraded", checks: { database: { status: "unavailable" } }, timestamp: new Date().toISOString() });
		}
	});
	router.get("/", (req, res) => res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() }));
	return router;
}
module.exports = { createHealthRouter };
