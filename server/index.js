const express = require("express");
const cors = require("cors");
const app = express();

// ✅ Enable CORS for your frontend
app.use(
	cors({
		origin: "http://localhost:5173", // Adjust this if your frontend runs elsewhere
		credentials: true, // Optional: include this if you're using cookies/auth
	})
);

// Middleware to parse JSON
app.use(express.json());

// Routes
const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const errorHandler = require("./middleware/errorHandler");

// Use routes
app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
