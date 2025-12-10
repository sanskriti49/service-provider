const { SERVICES } = require("../utils/services");

async function getAllServices(req, res, next) {
	try {
		// We only need name, slug, description, and image for the list
		const serviceList = SERVICES.map(({ name, slug, description, image }) => ({
			name,
			slug,
			description,
			image,
		}));
		res.json(serviceList);
	} catch (err) {
		next(err);
	}
}

async function getServiceBySlug(req, res, next) {
	try {
		const { slug } = req.params;
		const service = SERVICES.find((s) => s.slug === slug);

		if (!service) {
			return res.status(404).json({ error: "Service not found" });
		}

		res.json(service);
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAllServices,
	getServiceBySlug,
};
