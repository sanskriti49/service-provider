const express = require("express");
const router = express.Router();
const { getAvailability } = require("../controllers/availabilityController");

router.get("/:provider_id/availability", getAvailability);

module.exports = router;
