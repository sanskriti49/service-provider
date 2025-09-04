const express = require("express");
const router = express.Router();
const { SERVICES } = require("../utils/services");

// GET /api/services
router.get("/", (req, res) => {
	res.json({ services: SERVICES });
});
module.exports = router;
