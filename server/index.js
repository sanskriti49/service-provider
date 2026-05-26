require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const db = require("./config/db");

// ── CORS CONFIGURATION ───────────────────────────────────────────────────────
const corsOptions = {
	origin: [
		"http://localhost:5173",
		process.env.CLIENT_URL,
		"https://taskgenieee.vercel.app",
		"https://service-provider-git-main-sanskriti49s-projects.vercel.app",
	],
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// ── ROUTE IMPORTS ────────────────────────────────────────────────────────────
const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const errorHandler = require("./middleware/errorHandler");

// ── ENDPOINT MOUNTING ────────────────────────────────────────────────────────
app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/availability", availabilityRoutes);

// ── BASE HEALTH CHECK ────────────────────────────────────────────────────────
app.get("/", (req, res) => {
	res.send("Backend running..");
});

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── SERVER LIFECYCLE ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`🚀 Server listening safely on port ${PORT}`);
});
