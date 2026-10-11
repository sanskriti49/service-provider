const fs = require("node:fs");
const path = require("node:path");
const db = require("../config/db");
const integritySchema = fs.readFileSync(path.join(__dirname, "20261011_booking_integrity.sql"), "utf8");
async function migrateIntegrity() {
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		await client.query(integritySchema);
		await client.query("COMMIT");
	} catch (error) { await client.query("ROLLBACK"); throw error; }
	finally { client.release(); }
}
if (require.main === module) migrateIntegrity().then(() => console.log("Booking integrity migration complete")).catch((error) => {
	console.error("Migration rolled back. Review legacy duplicates/overlaps before retrying:", error.message);
	process.exitCode = 1;
}).finally(() => db.end());
module.exports = { integritySchema, migrateIntegrity };
