const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const db = require("../config/db");
const bcrypt = require("bcrypt");
const { customAlphabet } = require("nanoid");

async function ensureAdmin() {
	const client = await db.connect();
	try {
		console.log("Checking for existing administrator accounts...");
		const existingAdmin = await client.query(
			"SELECT id, name, email, custom_id FROM users WHERE role = 'admin' LIMIT 1"
		);

		if (existingAdmin.rows.length > 0) {
			const admin = existingAdmin.rows[0];
			console.log(`✅ Administrator account already exists: ${admin.name} (${admin.email}, Custom ID: ${admin.custom_id})`);
			return;
		}

		const adminEmail = (process.env.ADMIN_EMAIL || "admin@taskgenie.com").toLowerCase().trim();
		const adminName = process.env.ADMIN_NAME || "System Administrator";
		const adminPassword = process.env.ADMIN_PASSWORD || "Admin@TaskGenie2026!";
		const hashedPassword = await bcrypt.hash(adminPassword, 10);

		const genAdminId = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 15);
		const customId = "ADM" + genAdminId();

		// Check if user with this email already exists
		const userCheck = await client.query("SELECT id FROM users WHERE email = $1", [adminEmail]);

		if (userCheck.rows.length > 0) {
			const userId = userCheck.rows[0].id;
			await client.query(
				`UPDATE users
				 SET role = 'admin', custom_id = $1, password = $2
				 WHERE id = $3`,
				[customId, hashedPassword, userId]
			);
			console.log(`✅ Updated existing user ${adminEmail} to Administrator role!`);
		} else {
			await client.query(
				`INSERT INTO users (name, email, password, role, custom_id, phone)
				 VALUES ($1, $2, $3, 'admin', $4, '+919999999999')`,
				[adminName, adminEmail, hashedPassword, customId]
			);
			console.log(`✅ Created new Administrator account!`);
			console.log(`   Email:    ${adminEmail}`);
			console.log(`   Password: ${adminPassword}`);
			console.log(`   CustomID: ${customId}`);
		}
	} catch (err) {
		console.error("❌ ensureAdmin failed:", err.message);
		process.exitCode = 1;
	} finally {
		client.release();
		await db.end();
	}
}

ensureAdmin();
