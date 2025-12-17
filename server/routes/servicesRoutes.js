const express = require("express");
const router = express.Router();
const servicesController = require("../controllers/servicesController");

router.get("/v1", servicesController.getAllServices);

router.get("/v1/:slug", servicesController.getServiceBySlug);

module.exports = router;
