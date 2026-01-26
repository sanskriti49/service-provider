const pool = require("../config/db");

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
