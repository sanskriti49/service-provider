require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(
	cors({
		origin: ["http://localhost:5173", process.env.CLIENT_URL],
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);

app.use(express.json());

const providerRoutes = require("./routes/providerRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");

const errorHandler = require("./middleware/errorHandler");

app.use("/api/providers", providerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api", availabilityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);

app.get("/", (req, res) => {
	res.send("Backend running..");
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
