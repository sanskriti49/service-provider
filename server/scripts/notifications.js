// Operator CLI: no HTTP replay endpoint and no automatic delivery side effects.
const { NotificationOutbox } = require("../utils/notificationOutbox");

async function run(db, args) {
	const [command, id] = args;
	if (command === "list") {
		// Deliberately omit recipient addresses and message bodies from the listing.
		return (await db.query(`SELECT id,event_type,status,attempts,max_attempts,generation,created_at,updated_at
		 FROM notification_outbox WHERE status='failed' ORDER BY updated_at DESC LIMIT 100`)).rows;
	}
	if (command === "retry" && /^[a-f0-9-]{36}$/i.test(id || "")) {
		const row = await new NotificationOutbox(db).replay(id);
		return { id: row.id, status: row.status, generation: row.generation };
	}
	throw new Error("Usage: npm run notifications -- list | retry <outbox-uuid>");
}

if (require.main === module) {
	const db = require("../config/db");
	run(db, process.argv.slice(2)).then((result) => console.log(JSON.stringify(result, null, 2)))
		.catch((error) => { console.error(error.message); process.exitCode = 1; })
		.finally(() => db.end());
}
module.exports = { run };
