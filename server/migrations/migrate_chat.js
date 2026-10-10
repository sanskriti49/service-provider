const fs = require("node:fs");
const path = require("node:path");
const db = require("../config/db");

const chatSchema = fs.readFileSync(path.join(__dirname, "20261010_booking_chat.sql"), "utf8");

async function migrateChat() {
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		await client.query(chatSchema);
		await client.query("COMMIT");
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}

if (require.main === module) {
	migrateChat().then(() => console.log("Chat migration complete")).catch((err) => {
		console.error("Chat migration failed:", err.message);
		process.exitCode = 1;
	}).finally(() => db.end());
}

module.exports = { chatSchema, migrateChat };
