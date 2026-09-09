const pool = require("../config/db");
const cache = require("../utils/cache");

const formatService = (row) => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	description: row.description,
	price: row.price,
	price_unit: row.price_unit,
	image_url: row.image_url,
	category: row.category,
});

async function getAllServices(req, res, next) {
	try {
		const cached = cache.get("all_services");
		if (cached) {
			return res.json(cached);
		}

		const result = await pool.query(
			"SELECT * FROM services ORDER BY category, name",
		);

		const serviceList = result.rows.map(formatService);
		cache.set("all_services", serviceList, 300000);

		res.json(serviceList);
	} catch (err) {
		next(err);
	}
}

async function getServiceBySlug(req, res, next) {
	try {
		const { slug } = req.params;
		const cacheKey = `service_slug_${slug}`;
		const cached = cache.get(cacheKey);
		if (cached) {
			return res.json(cached);
		}

		const result = await pool.query("SELECT * FROM services WHERE slug=$1", [
			slug,
		]);

		const service = result.rows[0];

		if (!service) {
			return res.status(404).json({ error: "Service not found" });
		}

		const formatted = formatService(service);
		cache.set(cacheKey, formatted, 300000);

		res.json(formatted);
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAllServices,
	getServiceBySlug,
};
