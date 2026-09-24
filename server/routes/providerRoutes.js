const express = require("express");
const router = express.Router();
const c = require("../controllers/providerController");
const authenticate = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const db = require("../config/db");

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireProviderOwnerOrAdmin(req, res, next) {
	if (!req.user) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	if (req.user.role === "admin") {
		return next();
	}
	const idOrCustomId = req.params.id;
	if (!idOrCustomId) {
		return res.status(400).json({ error: "Provider identifier required" });
	}

	try {
		const value = String(idOrCustomId).trim();
		let result;
		if (UUID_REGEX.test(value)) {
			result = await db.query(
				"SELECT id FROM users WHERE id = $1::uuid AND role = 'provider'",
				[value],
			);
		} else {
			result = await db.query(
				"SELECT id FROM users WHERE custom_id = $1 AND role = 'provider'",
				[value],
			);
		}
		const providerId = result.rows[0]?.id;
		if (!providerId) {
			return res.status(404).json({ error: "Provider not found" });
		}

		if (req.user.id !== providerId) {
			return res.status(403).json({
				error:
					"Access denied. You can only manage your own provider profile and services.",
			});
		}
		req.resolvedProviderId = providerId;
		next();
	} catch (err) {
		console.error("Provider ownership verification error:", err);
		res.status(500).json({ error: "Server error verifying provider ownership" });
	}
}

// Authenticated upload with size limits & MIME checking
router.post("/v1/upload-kyc", authenticate, upload.single("document"), c.uploadKycDocument);
router.post("/upload-kyc", authenticate, upload.single("document"), c.uploadKycDocument);

// Public discovery endpoints
router.post("/v1", c.createProvider);
router.get("/v1", c.getProviders);
router.get("/v1/match", c.matchProviders);
router.get("/v1/:id/availability", c.getProviderAvailability);
router.get("/v1/:custom_id", c.getProviderById);

// Provider profile management (Strict ownership / RBAC protected)
router.put("/v1/:id", authenticate, requireProviderOwnerOrAdmin, c.updateProvider);
router.get("/v1/:id/kyc", authenticate, c.getKycStatus);
router.put("/v1/:id/kyc", authenticate, c.submitKyc);
router.post("/v1/:id/kyc", authenticate, c.submitKyc);
router.delete("/v1/:id", authenticate, requireProviderOwnerOrAdmin, c.deleteProvider);

// Provider services catalog (Strict ownership / RBAC protected)
router.get("/v1/:id/services", authenticate, c.getProviderServices);
router.post("/v1/:id/services", authenticate, requireProviderOwnerOrAdmin, c.addProviderService);
router.delete(
	"/v1/:id/services/:service_id",
	authenticate,
	requireProviderOwnerOrAdmin,
	c.removeProviderService,
);
router.put(
	"/v1/:id/services/:service_id/visibility",
	authenticate,
	requireProviderOwnerOrAdmin,
	c.toggleServiceVisibility,
);

module.exports = router;
