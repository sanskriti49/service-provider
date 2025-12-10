const db = require("../config/db");
const { timeToMinutes } = require("../utils/timeUtils");
const crypto = require("crypto");

function uuidHashToBigInt(uuid) {
	const hash = crypto.createHash("sha256").update(uuid).digest("hex");
	return BigInt("0x" + hash.slice(0, 16)); // first 8 bytes → int64
}

/**
 * POST /bookings
 * body: { provider_id, user_id, date: '2025-12-08', start_time: '10:00', end_time: '11:00' }
 */

async function createBooking(req, res, next) {
	const { provider_id, date, start_time, end_time } = req.body;
	const user_id = req.user.id;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		// 1) Lock bookings for provider & date to avoid race (row-level)
		// We lock via a SELECT FOR UPDATE on bookings aggregate row (or use advisory lock)
		// simplest: use advisory lock

		const raw = uuidHashToBigInt(provider_id);
		const lockKey = raw % BigInt("9223372036854775807");

		// await client.query("SELECT pg_advisory_xact_lock($1)", [
		// 	Number(lockKey % BigInt(Number.MAX_SAFE_INTEGER)),
		// ]);
		await client.query(` SELECT pg_advisory_xact_lock($1) `, [lockKey]);
		// await client.query("SELECT pg_advisory_xact_lock($1)", [
		//  lockKey.toString()
		// ]);

		const conflictq = `
        SELECT 1 FROM bookings
        WHERE provider_id=$1
            AND date=$2
            AND status='booked'
            AND NOT (end_time <= $3 OR start_time >= $4)
        LIMIT 1`;

		// Check overlapping bookings
		const conflict = await client.query(conflictq, [
			provider_id,
			date,
			start_time,
			end_time,
		]);
		if (conflict.rowCount > 0) {
			await client.query("ROLLBACK");
			return res.status(409).json({ message: "Slot already booked!" });
		}

		// Insert booking
		const insertQ = `
            INSERT INTO bookings (provider_id, user_id, date, start_time, end_time, status)
            VALUES ($1,$2,$3,$4,$5, 'booked')
            RETURNING id, provider_id, user_id, date, start_time, end_time, status
            `;
		const r = await client.query(insertQ, [
			provider_id,
			user_id,
			date,
			start_time,
			end_time,
		]);

		await client.query("COMMIT");
		res.status(201).json({ booking: r.rows[0] });
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		next(err);
	} finally {
		client.release();
	}
}

module.exports = { createBooking };
