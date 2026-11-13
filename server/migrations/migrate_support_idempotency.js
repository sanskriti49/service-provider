const fs = require('node:fs');
const path = require('node:path');
const supportIdempotencySchema = fs.readFileSync(path.join(__dirname, '20261113_support_idempotency.sql'), 'utf8');
async function migrateSupportIdempotency(db = require('../config/db')) {
  const client = await db.connect();
  try { await client.query('BEGIN'); await client.query(supportIdempotencySchema); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (require.main === module) {
  const db = require('../config/db');
  migrateSupportIdempotency(db).then(() => console.log('Support idempotency migration complete'))
    .catch(error => { console.error('Support idempotency migration failed:', error.message); process.exitCode = 1; })
    .finally(() => db.end());
}
module.exports = { supportIdempotencySchema, migrateSupportIdempotency };
