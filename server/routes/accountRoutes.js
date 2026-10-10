const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const accountController = require("../controllers/accountController");

// Addresses
router.get("/addresses", authMiddleware, accountController.getAddresses);
router.post("/addresses", authMiddleware, accountController.createAddress);
router.put("/addresses/:id", authMiddleware, accountController.updateAddress);
router.delete("/addresses/:id", authMiddleware, accountController.deleteAddress);
router.patch("/addresses/:id/default", authMiddleware, accountController.setDefaultAddress);

// Payment Methods / Accounts
router.get("/payment-methods", authMiddleware, accountController.getPaymentMethods);
router.post("/payment-methods", authMiddleware, accountController.createPaymentMethod);
router.delete("/payment-methods/:id", authMiddleware, accountController.deletePaymentMethod);
router.patch("/payment-methods/:id/default", authMiddleware, accountController.setDefaultPaymentMethod);

// Feedback
router.post("/feedback", authMiddleware, accountController.submitFeedback);
router.get("/feedback", authMiddleware, accountController.getMyFeedback);

module.exports = router;
