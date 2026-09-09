const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/provider/:provider_id", reviewController.getProviderReviews);

router.get("/booking/:booking_id", authMiddleware, reviewController.getBookingReview);

router.post("/", authMiddleware, reviewController.createReview);

module.exports = router;
