// routes/providerRoutes.js
const express = require("express");
const router = express.Router();

const providerController = require("../controllers/providerController");

router.post("/v1", providerController.createProvider);
router.get("/v1", providerController.getProviders);

router.get("/v1/:id/availability", providerController.getProviderAvailability);

router.get("/v1/:custom_id", providerController.getProviderById);
router.put("/v1/:id", providerController.updateProvider);
router.delete("/v1/:id", providerController.deleteProvider);

module.exports = router;
