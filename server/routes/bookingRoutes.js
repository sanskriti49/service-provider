const express = require("express");
const router = express.Router();
const { createBooking } = require("../controllers/bookingController");
const authMiddleware = require("../middleware/authMiddleware");
//router.post("/bookings", createBooking);
router.post(
	"/bookings",
	authMiddleware,
	(req, res, next) => {
		if (req.user.role !== "customer") {
			return res.status(403).json({ error: "Only customers can book." });
		}
		next();
	},
	createBooking
);

module.exports = router;
