require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const app = express();
const db = require("./config/db");

const corsOptions = {
	origin: [
		"http://localhost:5173",
		process.env.CLIENT_URL,
		"https://taskgenieee.vercel.app",
		"https://service-provider-git-main-sanskriti49s-projects.vercel.app",
	].filter(Boolean),
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

// Performance compression for all outgoing JSON and text
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const earningsRoutes = require("./routes/earningsRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
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

app.get("/", (req, res) => {
	res.send("Backend running..");
});
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`🚀 Server listening safely on port ${PORT}`);
});
