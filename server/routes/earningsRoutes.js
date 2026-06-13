const express = require("express");
const router = express.Router();
const {
	getProviderEarningsSummary,
	getProviderMonthlyChartData,
	getProviderTransactionsList,
} = require("../controllers/earningsController");
const authMiddleware = require("../middleware/authMiddleware");

function allowRoles(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return res
				.status(403)
				.json({ message: "Access denied. Restricted area." });
		}
		next();
	};
}

router.get(
	"/provider/summary",
	authMiddleware,
	allowRoles("provider"),
	getProviderEarningsSummary,
);
router.get(
	"/provider/monthly",
	authMiddleware,
	allowRoles("provider"),
	getProviderMonthlyChartData,
);
router.get(
	"/provider/transactions",
	authMiddleware,
	allowRoles("provider"),
	getProviderTransactionsList,
);

module.exports = router;
