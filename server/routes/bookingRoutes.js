const express = require("express");
const router = express.Router();
const {
	createBooking,
	updateBookingAddress,
	getUserHistory,
	updateBookingStatus,
	verifyPayment,
	getRecentProviderBookings,
	getUpcomingBookings,
} = require("../controllers/bookingController");
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../config/db");

function allowRoles(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Access denied." });
		}
		next();
	};
}
router.post("/", authMiddleware, allowRoles("customer"), createBooking);
router.post("/verify-payment", authMiddleware, verifyPayment);

// GET USER HISTORY
router.get(
	"/user/history",
	authMiddleware,
	allowRoles("customer"),
	getUserHistory,
);
// GET UPCOMING
router.get(
	"/user/upcoming",
	authMiddleware,
	allowRoles("customer"),
	getUpcomingBookings,
);

// GET PROVIDER BOOKINGS
router.get(
	"/provider/history/all",
	authMiddleware,
	allowRoles("provider"),
	async (req, res) => {
		try {
			const q = `
            SELECT b.*, u.name AS customer_name
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            WHERE b.provider_id=$1
            ORDER BY b.date ASC
        `;
			const result = await db.query(q, [req.user.id]);
			res.json(result.rows);
		} catch (err) {
			res.status(500).json({ message: "Error fetching provider bookings" });
		}
	},
);

router.get(
	"/provider/history/recent",
	authMiddleware,
	getRecentProviderBookings,
);

// ADMIN: GET ALL BOOKINGS
router.get(
	"/admin/all",
	authMiddleware,
	allowRoles("admin"),
	async (req, res) => {
		try {
			const q = `
            SELECT b.*, u.name AS customer_name, pu.name AS provider_name
            FROM bookings b
            LEFT JOIN users u ON u.id = b.user_id
            LEFT JOIN users pu ON pu.id = b.provider_id
            ORDER BY b.date ASC
        `;
			const result = await db.query(q);
			res.json(result.rows);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Error fetching bookings" });
		}
	},
);

router.patch(
	"/:booking_id/address",
	authMiddleware,
	allowRoles("customer"),
	updateBookingAddress,
);
// ADDED EXPLICIT GUARDS: Ensures only permitted actors trigger logic checks
router.put("/:booking_id/status", authMiddleware, updateBookingStatus);

// GET SINGLE BOOKING
router.get("/:booking_id", authMiddleware, async (req, res) => {
	try {
		const q = `SELECT * FROM bookings WHERE booking_id=$1`;
		const result = await db.query(q, [req.params.booking_id]);

		if (result.rowCount === 0)
			return res.status(404).json({ message: "Not found" });

		const booking = result.rows[0];

		if (
			req.user.role !== "admin" &&
			booking.user_id !== req.user.id &&
			booking.provider_id !== req.user.id
		) {
			return res.status(403).json({ message: "Access denied" });
		}

		res.json(booking);
	} catch (err) {
		res.status(500).json({ message: "Server error" });
	}
});

module.exports = router;
