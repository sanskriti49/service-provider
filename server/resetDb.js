// resetDb.js
const db = require("./config/db");

async function resetDatabase() {
	try {
		console.log("🔄 Resetting database tables...");

		await db.query("BEGIN");
		await db.query(
			"TRUNCATE availability_slots, providers, users RESTART IDENTITY CASCADE"
		);
		await db.query("COMMIT");

		console.log("✅ Database tables reset successfully.");
		process.exit(0);
	} catch (err) {
		await db.query("ROLLBACK");
		console.error("❌ Failed to reset database:", err);
		process.exit(1);
	}
}

resetDatabase();
