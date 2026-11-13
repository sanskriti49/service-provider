const fs = require('node:fs');
const path = require('node:path');
const kycReviewSchema = fs.readFileSync(path.join(__dirname, '20261113_kyc_review.sql'), 'utf8');
async function migrateKycReview(db = require('../config/db')) {
  const client = await db.connect();
  try { await client.query('BEGIN'); await client.query(kycReviewSchema); await client.query('COMMIT'); }
  catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}
if (require.main === module) {
  const db = require('../config/db');
  migrateKycReview(db).then(() => console.log('KYC review migration complete'))
    .catch(err => { console.error('KYC review migration failed:', err.message); process.exitCode = 1; })
    .finally(() => db.end());
}
module.exports = { kycReviewSchema, migrateKycReview };
