require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();
const httpServer = http.createServer(app);
const db = require("./config/db");
const { initSocket } = require("./utils/socket");

// Global process safeguards against unhandled background rejections
process.on("unhandledRejection", (reason) => {
	console.warn("⚠️ [Server Process] Handled rejection:", reason?.message || reason);
});

process.on("uncaughtException", (err) => {
	console.error("⚠️ [Server Process] Handled exception:", err?.message || err);
});

const corsOptions = {
	origin: (origin, callback) => {
		// Allow requests with no origin (curl, mobile apps, Postman)
		if (!origin) return callback(null, true);

		// Allow all localhost / 127.0.0.1 / [::1] on any port
		const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
		const isPrivateIp = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
		const isAllowedDomain =
			origin === process.env.CLIENT_URL ||
			origin === process.env.FRONTEND_URL ||
			origin.endsWith(".vercel.app") ||
			origin === "https://taskgenieee.vercel.app" ||
			origin === "https://service-provider-git-main-sanskriti49s-projects.vercel.app";

		if (isLocalhost || isPrivateIp || isAllowedDomain) {
			return callback(null, true);
		}

		// In non-production environments, allow everything to prevent local dev friction
		if (process.env.NODE_ENV !== "production") {
			return callback(null, true);
		}

		return callback(null, false);
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
	allowedHeaders: [
		"Content-Type",
		"Authorization",
		"X-Requested-With",
		"Accept",
		"Origin",
		"Cache-Control",
		"Pragma",
		"x-test-bypass-ratelimit",
	],
	optionsSuccessStatus: 200,
};

initSocket(httpServer, corsOptions);

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

const { register, metricsMiddleware, updatePoolMetrics } = require("./utils/metrics");
const { globalLimiter } = require("./middleware/rateLimiter");
const { getCircuitBreakerStatus } = require("./utils/circuitBreaker");
const eventQueue = require("./utils/eventQueue");
app.use(metricsMiddleware);
app.use("/api", globalLimiter);

const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const earningsRoutes = require("./routes/earningsRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const supportRoutes = require("./routes/supportRoutes");
const errorHandler = require("./middleware/errorHandler");

app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);

app.get("/", (req, res) => {
	res.send("Backend running..");
});

// Prometheus Cloud Metrics Scraping Endpoint
app.get("/metrics", async (req, res) => {
	try {
		res.set("Content-Type", register.contentType);
		res.end(await register.metrics());
	} catch (err) {
		res.status(500).end(err.message);
	}
});

// Cloud Liveness Probe (process vitality)
app.get("/health/live", (req, res) => {
	res.status(200).json({
		status: "alive",
		uptime: process.uptime(),
		memory: process.memoryUsage(),
		timestamp: new Date().toISOString(),
	});
});

// Cloud Readiness Probe (DB connectivity & queue worker health)
app.get("/health/ready", async (req, res) => {
	try {
		const dbStart = Date.now();
		await db.query("SELECT 1");
		const dbLatency = Date.now() - dbStart;

		const poolStats = db.getPoolStats ? db.getPoolStats() : null;
		if (poolStats) {
			updatePoolMetrics(poolStats);
		}

		const queueStats = eventQueue.getStats();
		const circuitBreakerStats = getCircuitBreakerStatus();

		res.status(200).json({
			status: "ready",
			checks: {
				database: { status: "connected", latencyMs: dbLatency, pool: poolStats },
				eventQueue: { status: "healthy", ...queueStats },
				circuitBreakers: circuitBreakerStats,
			},
			timestamp: new Date().toISOString(),
		});
	} catch (err) {
		res.status(503).json({
			status: "degraded",
			checks: {
				database: { status: "disconnected", error: err.message },
			},
			timestamp: new Date().toISOString(),
		});
	}
});

// General Health Endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
	console.log(`🚀 Server listening with WebSocket on port ${PORT}`);
});
