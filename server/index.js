require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();
app.set("trust proxy", 1);
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
		
		const configuredOrigins = new Set(
			[
				process.env.CLIENT_URL,
				process.env.FRONTEND_URL,
				"https://taskgenieee.vercel.app",
				"https://service-provider-git-main-sanskriti49s-projects.vercel.app",
				...(process.env.ALLOWED_ORIGINS
					? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
					: []),
			].filter(Boolean),
		);
		const isAllowedDomain = configuredOrigins.has(origin);

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

const helmet = require("helmet");
app.use(
	helmet({
		contentSecurityPolicy: false,
		crossOriginEmbedderPolicy: false,
		crossOriginResourcePolicy: { policy: "cross-origin" },
	}),
);
app.disable("x-powered-by");
app.use(compression());
app.use(cors(corsOptions));
app.use(
	express.json({
		limit: "5mb",
		verify: (req, res, buf) => {
			req.rawBody = buf;
		},
	}),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
const accountRoutes = require("./routes/accountRoutes");
const errorHandler = require("./middleware/errorHandler");

app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/earnings", earningsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/support", supportRoutes);

// Mock S3 direct upload endpoint for local zero-config offline development & testing
app.put("/api/providers/mock-s3-upload", express.raw({ type: "*/*", limit: "10mb" }), (req, res) => {
	res.status(200).json({
		success: true,
		message: "Mock S3 direct upload successful",
		key: req.query.key,
		bytesReceived: req.body ? req.body.length : 0,
	});
});

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

app.use("/health", require("./routes/healthRoutes").createHealthRouter({
    db, eventQueue, updatePoolMetrics, getCircuitBreakerStatus,
}));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
	console.log(`🚀 Server listening with WebSocket on port ${PORT}`);
});

// Reconcile missed callbacks and durable refund intents without relying on Redis.
if (process.env.NODE_ENV !== "test" && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.PAYMENT_RECONCILIATION_ENABLED !== "false") {
    const { paymentService } = require("./controllers/bookingController");
    let reconciling = false;
    const timer = setInterval(async () => {
        if (reconciling) return;
        reconciling = true;
        try { await paymentService.reconcile(); } catch (error) { console.error("Payment reconciliation failed:", error.message); }
        finally { reconciling = false; }
    }, 30000);
    timer.unref();
}

// Graceful Shutdown: Handle container stops cleanly (Kubernetes / Docker / ECS)
let isShuttingDown = false;
async function gracefulShutdown(signal) {
	if (isShuttingDown) return;
	isShuttingDown = true;
	console.log(`\n🛑 [Server] Received ${signal}. Starting graceful shutdown...`);

	try {
		await new Promise((resolve, reject) => {
			httpServer.close((err) => {
				if (err) return reject(err);
				console.log("🔒 [Server] Closed HTTP & WebSocket listener.");
				resolve();
			});
		});

		if (eventQueue && typeof eventQueue.close === "function") {
			console.log("⏳ [Server] Closing background event queue workers...");
			await eventQueue.close();
		}

		if (db && typeof db.end === "function") {
			console.log("⏳ [Server] Draining PostgreSQL connection pool...");
			await db.end();
		}

		const { closeRedis } = require("./config/redisClient");
		await closeRedis();

		console.log("✅ [Server] Graceful shutdown completed cleanly.");
		process.exit(0);
	} catch (err) {
		console.error("❌ [Server] Error during graceful shutdown:", err);
		process.exit(1);
	}

	setTimeout(() => {
		console.error("⚠️ [Server] Graceful shutdown timed out after 10s. Forcing exit.");
		process.exit(1);
	}, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
