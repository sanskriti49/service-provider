const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middleware/authMiddleware");

// Public: Get reviews for a provider
router.get("/provider/:provider_id", reviewController.getProviderReviews);

// Protected: Check review for a booking
router.get("/booking/:booking_id", authMiddleware, reviewController.getBookingReview);

// Protected: Submit or update a review (customers only)
router.post("/", authMiddleware, reviewController.createReview);

module.exports = router;
