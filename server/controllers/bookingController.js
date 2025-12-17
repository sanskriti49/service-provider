const db = require("../config/db");

BigInt.prototype.toJSON = function () {
	return this.toString();
};

async function createBooking(req, res, next) {
	console.log("--- New Booking Request ---");
	console.log("User:", req.user);
	console.log("Body:", req.body);

	const { provider_id, service_id, date, start_time, end_time } = req.body;

	if (!provider_id || !service_id || !date || !start_time) {
		return res.status(400).json({ message: "Missing fields" });
	}

	const user_id = req.user ? req.user.id : null;

	if (!user_id) {
		console.error("Error: User ID missing");
		return res.status(401).json({ message: "User not authenticated" });
	}
	const cleanDate = date.toString().substring(0, 10);

	const client = await db.connect();

	try {
		await client.query("BEGIN");

		const existingQ = `
            SELECT 1 FROM bookings
            WHERE provider_id=$1 
            AND date=$2::date
            AND start_time=$3
			AND status='booked'
			FOR UPDATE
            LIMIT 1
        `;

		const existing = await client.query(existingQ, [
			provider_id,
			date,
			start_time,
		]);

		if (existing.rowCount > 0) {
			await client.query("ROLLBACK");
			return res
				.status(409)
				.json({ message: "This time slot is already booked." });
		}

		// Overlap check
		const conflictQ = `
            SELECT 1 FROM bookings
            WHERE provider_id=$1
            AND date=$2
            AND status='booked'
            AND NOT (end_time <= $3 OR start_time >= $4)
            LIMIT 1
        `;

		const conflict = await client.query(conflictQ, [
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
            INSERT INTO bookings (booking_id, provider_id, user_id, service_id, date, start_time, end_time, status)
            VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, 'booked')
            RETURNING booking_id, provider_id, user_id, service_id, date, start_time, end_time, status
        `;

		const r = await client.query(insertQ, [
			provider_id,
			user_id,
			service_id,
			cleanDate,
			start_time,
			end_time,
		]);

		await client.query("COMMIT");
		console.log("Booking successful:", r.rows[0]);

		res.status(201).json({ booking: r.rows[0] });
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		console.error("CRITICAL BACKEND ERROR:", err);
		res.status(500).json({ message: "Server error", error: err.message });
	} finally {
		client.release();
	}
}

module.exports = { createBooking };
