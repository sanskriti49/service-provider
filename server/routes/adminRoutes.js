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
router.put("/providers/:id/kyc", adminController.updateProviderKyc);

// Dispute Management & Refunds
router.get("/disputes", adminController.getDisputes);
router.post("/disputes", adminController.createDispute);
router.put("/disputes/:id/resolve", adminController.resolveDispute);

// Admin Users
router.get("/admins", adminController.getAdmins);

// Support Work Queue
router.get("/support/tickets", adminController.getSupportTickets);
router.get("/support/tickets/:id", adminController.getSupportTicketById);
router.put("/support/tickets/:id/assign", adminController.assignSupportTicket);
router.post("/support/tickets/:id/replies", adminController.replySupportTicket);
router.put("/support/tickets/:id/resolve", adminController.resolveSupportTicket);

// Chat Reports & Trust/Safety Moderation Queue
router.get("/moderation/reports", adminController.getModerationReports);
router.get("/moderation/reports/:id", adminController.getModerationReportById);
router.put("/moderation/reports/:id/assign", adminController.assignModerationReport);
router.put("/moderation/reports/:id/resolve", adminController.resolveModerationReport);
router.post("/moderation/reports/:id/action", adminController.actionModerationReport);

// Platform & Commission Settings
router.get("/settings", adminController.getSettings);
router.put("/settings", adminController.updateSettings);

module.exports = router;
