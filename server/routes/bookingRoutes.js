const express = require("express");
const router = express.Router();
const {
	createBooking,
	updateBookingAddress,
	getUserHistory,
	updateBookingStatus,
	verifyPayment,
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
// 1. CREATE BOOKING
router.post("/", authMiddleware, allowRoles("customer"), createBooking);

// 2. ADMIN: GET ALL
router.get("/", authMiddleware, allowRoles("admin"), async (req, res) => {
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
});

router.get(
	"/user/upcoming",
	authMiddleware,
	allowRoles("customer"),
	async (req, res) => {
		try {
			const q = `
            SELECT b.*, s.name AS service_name, pu.name AS provider_name
            FROM bookings b
            LEFT JOIN services s on s.id = b.service_id
            LEFT JOIN users pu ON pu.id = b.provider_id
            WHERE b.user_id = $1 AND b.date >= NOW() AND b.status != 'cancelled'
            ORDER BY b.date ASC
        `;
			const result = await db.query(q, [req.user.id]);
			res.json(result.rows);
		} catch (err) {
			console.error(err);
			res.status(500).json({ message: "Error fetching upcoming bookings" });
		}
	},
);

router.get(
	"/user/history",
	authMiddleware,
	allowRoles("customer"),
	getUserHistory,
);

router.put("/:bookingId/status", authMiddleware, updateBookingStatus);

router.get(
	"/provider",
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

router.patch(
	"/:bookingId/address",
	authMiddleware,
	allowRoles("customer"),
	updateBookingAddress,
);

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

router.post("/verify-payment", authMiddleware, verifyPayment);

module.exports = router;
