const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersController");
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");

function requireSelfOrAdmin(req, res, next) {
	if (!req.user) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	if (req.user.id !== req.params.id && req.user.role !== "admin") {
		return res.status(403).json({
			error: "Access denied. You can only modify your own account.",
		});
	}
	next();
}

function requireAdmin(req, res, next) {
	if (!req.user || req.user.role !== "admin") {
		return res.status(403).json({ error: "Access denied. Admin only." });
	}
	next();
}

router.post("/", usersController.createUser);
router.get("/", authMiddleware, requireAdmin, usersController.getUsers);

const accountController = require("../controllers/accountController");

// Addresses aliases (defined before /:custom_id to avoid shadowing)
router.get("/addresses", authMiddleware, accountController.getAddresses);
router.post("/addresses", authMiddleware, accountController.createAddress);
router.put("/addresses/:id", authMiddleware, accountController.updateAddress);
router.delete("/addresses/:id", authMiddleware, accountController.deleteAddress);
router.patch("/addresses/:id/default", authMiddleware, accountController.setDefaultAddress);

// Payment methods aliases (defined before /:custom_id to avoid shadowing)
router.get("/payment-methods", authMiddleware, accountController.getPaymentMethods);
router.post("/payment-methods", authMiddleware, accountController.createPaymentMethod);
router.delete("/payment-methods/:id", authMiddleware, accountController.deletePaymentMethod);
router.patch("/payment-methods/:id/default", authMiddleware, accountController.setDefaultPaymentMethod);

router.get("/:custom_id", usersController.getUserByCustomId);
router.put(
	"/:id",
	authMiddleware,
	requireSelfOrAdmin,
	upload.single("photo"),
	usersController.updateUser,
);
router.delete(
	"/:id",
	authMiddleware,
	requireSelfOrAdmin,
	usersController.deleteUser,
);

module.exports = router;
