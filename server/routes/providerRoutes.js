const express = require("express");
const router = express.Router();
const c = require("../controllers/providerController");
const authenticate = require("../middleware/authMiddleware");

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/v1", c.createProvider);
router.get("/v1", c.getProviders);
router.get("/v1/:custom_id", c.getProviderById);
router.get("/v1/:id/availability", c.getProviderAvailability); // Now safely maps to a valid function!

// ── Protected ─────────────────────────────────────────────────────────────────
router.put("/v1/:id", authenticate, c.updateProvider);
router.delete("/v1/:id", authenticate, c.deleteProvider);

// ── Service management ────────────────────────────────────────────────────────
router.get("/v1/:id/services", authenticate, c.getProviderServices);
router.post("/v1/:id/services", authenticate, c.addProviderService);
router.delete(
	"/v1/:id/services/:service_id",
	authenticate,
	c.removeProviderService,
);
router.put(
	"/v1/:id/services/:service_id/visibility",
	authenticate,
	c.toggleServiceVisibility,
);

module.exports = router;
