const express = require("express");
const cors = require("cors");
const app = express();

app.use(
	cors({
		origin: "http://localhost:5173", // ONLY your frontend
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);

// Middleware to parse JSON
app.use(express.json());

// Routes
const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const errorHandler = require("./middleware/errorHandler");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");

// Use routes
app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api", availabilityRoutes);
app.use("/api", bookingRoutes);

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
	res.send("Backend running..");
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
