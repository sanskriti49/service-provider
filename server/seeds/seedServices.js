require("dotenv").config({ path: "../.env" });
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const db = require("../config/db");
const { SERVICES, SERVICE_CATEGORIES } = require("../utils/services");
const { getPriceDetails } = require("../utils/pricing");

// Cloudinary Config
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function seedServices() {
	const client = await db.connect();

	try {
		console.log("🔥 STARTING FRESH SEED...");

		console.log("🗑️  Truncating services table...");
		// This deletes everything and resets the table
		await client.query("TRUNCATE services CASCADE");

		const seedImagesDir = path.join(__dirname, "../seed_images");
		console.log(`🚀 Processing ${SERVICES.length} services...`);

		for (const service of SERVICES) {
			// A. Get Price & Unit
			const pricingInfo = getPriceDetails(service.name) || {
				price: 500,
				unit: "fixed",
			};
			const { price, unit } = pricingInfo;

			// B. Get Category & Slug
			const category = SERVICE_CATEGORIES[service.name] || "General";
			const slug = service.slug;

			// C. Upload Image logic
			let finalImageUrl = service.image; // Fallback
			const localImagePath = path.join(seedImagesDir, `${slug}.jpg`);

			if (fs.existsSync(localImagePath)) {
				process.stdout.write(`   ☁️  Uploading ${slug}... `);
				try {
					const uploadResult = await cloudinary.uploader.upload(
						localImagePath,
						{
							public_id: slug,
							folder: "services",
							overwrite: true,
						},
					);
					finalImageUrl = uploadResult.secure_url;
					console.log("✅");
				} catch (upErr) {
					console.log("❌ (Upload failed)");
					console.error(upErr.message);
				}
			} else {
				console.log(`   ⚠️  Image not found: ${slug}.jpg`);
			}

			// D. Insert into DB (with UUID handling)
			try {
				await client.query(
					`INSERT INTO services (name, description, price, price_unit, category, image_url, slug)
                     VALUES($1, $2, $3, $4, $5, $6, $7)`,
					[
						service.name,
						service.description,
						price,
						unit,
						category,
						finalImageUrl,
						slug,
					],
				);
			} catch (dbErr) {
				console.error(`   ❌ Failed to insert ${service.name}:`, dbErr.message);
			}
		}

		console.log("------------------------------------------------");
		console.log("🎉 SUCCESS! Database seeded with Cloudinary URLs & Units.");
		console.log("------------------------------------------------");
	} catch (err) {
		console.error("❌ FATAL ERROR:", err);
	} finally {
		client.release();
		db.end();
	}
}

seedServices();
