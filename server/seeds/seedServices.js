const db = require("../config/db");
const { getPriceForService } = require("../utils/getPriceForService");
const { SERVICES, SERVICE_CATEGORIES } = require("../utils/services");

async function seedServices() {
	try {
		console.log("Seeding services...");
		for (const s of SERVICES) {
			const price = getPriceForService(s.name);
			const category = SERVICE_CATEGORIES[s.name] || "General";

			await db.query(
				`INSERT INTO services (name, description, price, category, image_url, slug)
                 VALUES($1, $2, $3,$4, $5, $6)
				 ON CONFLICT (slug) DO UPDATE
				 SET 
                    price = EXCLUDED.price, 
                    image_url = EXCLUDED.image_url,
                    category = EXCLUDED.category, 
                    name = EXCLUDED.name`,
				[s.name, s.description, price, category, s.image, s.slug]
			);
		}
		console.log("Done seeding services!");
	} catch (err) {
		console.error("❌ Service seeding failed:", err);
	} finally {
		db.end();
	}
}
seedServices();
