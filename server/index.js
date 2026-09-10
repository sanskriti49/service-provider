require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();
const httpServer = http.createServer(app);
const db = require("./config/db");
const { initSocket } = require("./utils/socket");

const corsOptions = {
	origin: (origin, callback) => {
		if (
			!origin ||
			/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
			origin === process.env.CLIENT_URL ||
			origin === "https://taskgenieee.vercel.app" ||
			origin === "https://service-provider-git-main-sanskriti49s-projects.vercel.app"
		) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

initSocket(httpServer, corsOptions);

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

const { register, metricsMiddleware } = require("./utils/metrics");
const eventQueue = require("./utils/eventQueue");
app.use(metricsMiddleware);

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
const errorHandler = require("./middleware/errorHandler");

app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/bookings", bookingRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

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

		const queueStats = eventQueue.getStats();

		res.status(200).json({
			status: "ready",
			checks: {
				database: { status: "connected", latencyMs: dbLatency },
				eventQueue: { status: "healthy", ...queueStats },
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
