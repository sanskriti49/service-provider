const fs = require("node:fs");
const path = require("node:path");
const db = require("../config/db");

const supportModerationSchema = fs.readFileSync(
	path.join(__dirname, "20261020_support_moderation_queue.sql"),
	"utf8"
);

async function migrateSupportModeration() {
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		await client.query(supportModerationSchema);
		await client.query("COMMIT");
	} catch (err) {
		await client.query("ROLLBACK");
		throw err;
	} finally {
		client.release();
	}
}

if (require.main === module) {
	migrateSupportModeration()
		.then(() => console.log("Support & Moderation migration complete"))
		.catch((err) => {
			console.error("Support & Moderation migration failed:", err.message);
			process.exitCode = 1;
		})
		.finally(() => db.end());
}

module.exports = { supportModerationSchema, migrateSupportModeration };
