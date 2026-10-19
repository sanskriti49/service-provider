const fs = require("node:fs");
const path = require("node:path");
const db = require("../config/db");
const locationSchema = fs.readFileSync(path.join(__dirname, "20261014_booking_search_radius.sql"), "utf8");
async function migrateLocation() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(locationSchema);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
if (require.main === module) migrateLocation().then(() => console.log("Booking location migration complete"))
  .catch(error => { console.error("Location migration rolled back:", error.message); process.exitCode = 1; })
  .finally(() => db.end());
module.exports = { locationSchema, migrateLocation };
