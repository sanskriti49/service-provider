const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

// Require user to be authenticated and have role === 'admin'
function requireAdmin(req, res, next) {
	if (!req.user || req.user.role !== "admin") {
		return res.status(403).json({ error: "Access denied. Administrator privileges required." });
	}
	next();
}

router.use(authMiddleware);
router.use(requireAdmin);

// Overview & Analytics
router.get("/overview", adminController.getOverviewStats);

// Provider Approval Pipeline
router.get("/providers", adminController.getProviders);
router.put("/providers/:id/status", adminController.updateProviderStatus);

// Dispute Management & Refunds
router.get("/disputes", adminController.getDisputes);
router.post("/disputes", adminController.createDispute);
router.put("/disputes/:id/resolve", adminController.resolveDispute);

// Platform & Commission Settings
router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);

module.exports = router;
