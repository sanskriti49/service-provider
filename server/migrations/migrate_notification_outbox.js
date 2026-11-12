const fs = require("node:fs");
const path = require("node:path");
const outboxSchema = fs.readFileSync(path.join(__dirname, "20261027_notification_outbox.sql"), "utf8");

async function migrateOutbox(db = require("../config/db")) {
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		await client.query(outboxSchema);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally { client.release(); }
}

if (require.main === module) {
	const db = require("../config/db");
	migrateOutbox(db).then(() => console.log("Notification outbox migration complete"))
		.catch((error) => { console.error("Outbox migration failed:", error.message); process.exitCode = 1; })
		.finally(() => db.end());
}
module.exports = { outboxSchema, migrateOutbox };
