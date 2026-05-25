const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
	getCustomerDashboardStats,
	getProviderDashboardStats,
} = require("../controllers/dashboardController");
const router = express.Router();

function allowRoles(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Access denied." });
		}
		next();
	};
}

router.get(
	"/customer",
	authMiddleware,
	allowRoles("customer"),
	getCustomerDashboardStats,
);

router.get(
	"/provider/:id",
	authMiddleware,
	allowRoles("provider"),
	getProviderDashboardStats,
);
module.exports = router;
