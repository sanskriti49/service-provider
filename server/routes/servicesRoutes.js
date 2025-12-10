// const express = require("express");
// const router = express.Router();
// const { SERVICES } = require("../utils/services");

// // GET /api/services
// router.get("/", (req, res) => {
// 	res.json({ services: SERVICES });
// });
// module.exports = router;
// server/routes/servicesRoutes.js

const express = require("express");
const router = express.Router();
const servicesController = require("../controllers/servicesController");

// GET /api/services/v1
router.get("/v1", servicesController.getAllServices);

// GET /api/services/v1/:slug
router.get("/v1/:slug", servicesController.getServiceBySlug);

module.exports = router;
