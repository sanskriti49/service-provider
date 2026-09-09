require("dotenv").config({ path: "../.env" });
const db = require("../config/db");
const { inferGender, getGenderMatchedPhoto, generateProfessionalBio } = require("../utils/bioGenerator");

async function fixProviders() {
	const client = await db.connect();
	try {
		console.log("🔍 Fetching all providers from database...");

		const query = `
			SELECT u.id, u.name, u.photo, u.bio,
			       COALESCE(s.name, 'Home Services') AS service_name,
			       COALESCE(s.slug, 'home-services') AS service_slug
			FROM users u
			JOIN providers p ON u.id = p.user_id
			LEFT JOIN provider_services ps ON ps.provider_id = u.id AND ps.is_visible = TRUE
			LEFT JOIN services s ON s.id = ps.service_id
		`;

		const res = await client.query(query);
		const rows = res.rows;
		console.log(`📋 Found ${rows.length} provider records to verify and enhance.`);

		await client.query("BEGIN");

		let updatedCount = 0;
		// Group by user id because a provider might have multiple services
		const seenUsers = new Set();

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (seenUsers.has(row.id)) continue;
			seenUsers.add(row.id);

			const gender = inferGender(row.name, row.service_slug);
			const newPhoto = getGenderMatchedPhoto(gender, i + 1);
			const newBio = generateProfessionalBio(row.service_name, row.service_slug);

			await client.query(
				`UPDATE users SET photo = $1, bio = $2 WHERE id = $3`,
				[newPhoto, newBio, row.id]
			);
			updatedCount++;
		}

		await client.query("COMMIT");
		console.log(`✅ Successfully updated ${updatedCount} providers with gender-matched photos and professional bios!`);
	} catch (err) {
		await client.query("ROLLBACK");
		console.error("❌ Failed to update providers:", err);
	} finally {
		client.release();
		process.exit(0);
	}
}

fixProviders();
