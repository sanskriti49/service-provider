const pool = require("../config/db");

// Helper to format the DB row into a clean JSON object
const formatService = (row) => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	description: row.description,
	price: row.price,
	price_unit: row.price_unit, // ✅ Added: Sends "per hr", "fixed", etc.
	image_url: row.image_url, // ✅ Fixed: Kept as 'image_url' to match Frontend
	category: row.category,
});

async function getAllServices(req, res, next) {
	try {
		// improved query: Sort by category so they appear grouped
		const result = await pool.query(
			"SELECT * FROM services ORDER BY category, name",
		);

		const serviceList = result.rows.map(formatService);

		res.json(serviceList);
	} catch (err) {
		next(err);
	}
}

async function getServiceBySlug(req, res, next) {
	try {
		const { slug } = req.params;
		const result = await pool.query("SELECT * FROM services WHERE slug=$1", [
			slug,
		]);

		const service = result.rows[0];

		if (!service) {
			return res.status(404).json({ error: "Service not found" });
		}

		res.json(formatService(service));
	} catch (err) {
		next(err);
	}
}

module.exports = {
	getAllServices,
	getServiceBySlug,
};
