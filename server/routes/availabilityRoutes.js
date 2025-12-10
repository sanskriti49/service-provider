const express = require("express");
const router = express.Router();
const { getAvailability } = require("../controllers/availabilityController");

router.get("/providers/:providerId/availability", getAvailability);

module.exports = router;
