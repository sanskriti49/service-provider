const client = require("prom-client");

// Initialize Prometheus Register
const register = new client.Registry();

// Enable default system metrics collection (CPU, Memory, Event loop lag, Heap usage)
client.collectDefaultMetrics({
	register,
	prefix: "taskgenie_",
});

// Custom HTTP Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
	name: "taskgenie_http_request_duration_seconds",
	help: "Duration of HTTP requests in seconds",
	labelNames: ["method", "route", "status_code"],
	buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
	registers: [register],
});

// Custom HTTP Request Counter
const httpRequestsTotal = new client.Counter({
	name: "taskgenie_http_requests_total",
	help: "Total number of HTTP requests made to TaskGenie API",
	labelNames: ["method", "route", "status_code"],
	registers: [register],
});

// Domain Metric: Bookings Activity Counter
const bookingsTotal = new client.Counter({
	name: "taskgenie_bookings_total",
	help: "Total number of bookings partitioned by status transition",
	labelNames: ["status"],
	registers: [register],
});

// Domain Metric: Background Event Queue Counter
const eventQueueJobsTotal = new client.Counter({
	name: "taskgenie_event_queue_jobs_total",
	help: "Total number of background worker jobs executed",
	labelNames: ["event_type", "status"],
	registers: [register],
});

// Express Middleware to observe HTTP latency and throughput
function metricsMiddleware(req, res, next) {
	// Exclude /metrics and /health probes from bloating application metrics
	if (req.path === "/metrics" || req.path.startsWith("/health")) {
		return next();
	}

	const endTimer = httpRequestDurationSeconds.startTimer();
	const startTime = process.hrtime();

	res.on("finish", () => {
		const route = req.route ? req.baseUrl + req.route.path : req.baseUrl || req.path || "unknown";
		const statusCode = res.statusCode.toString();

		endTimer({
			method: req.method,
			route,
			status_code: statusCode,
		});

		httpRequestsTotal.inc({
			method: req.method,
			route,
			status_code: statusCode,
		});
	});

	next();
}

module.exports = {
	register,
	httpRequestDurationSeconds,
	httpRequestsTotal,
	bookingsTotal,
	eventQueueJobsTotal,
	metricsMiddleware,
};
