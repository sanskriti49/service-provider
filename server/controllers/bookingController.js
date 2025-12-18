const db = require("../config/db");

BigInt.prototype.toJSON = function () {
	return this.toString();
};

const TIME_LIMIT_MINUTES = 10;

async function createBooking(req, res, next) {
	console.log("--- New Booking Request ---");
	console.log("User:", req.user);
	console.log("Body:", req.body);

	const { provider_id, service_id, date, start_time, end_time, address } =
		req.body;

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

		const insertQ = `
            INSERT INTO bookings (booking_id, provider_id, user_id, service_id, date, start_time, end_time, status,address)
            VALUES (gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, 'booked', $7)
            RETURNING booking_id, provider_id, user_id, service_id, date, start_time, end_time, status, address, created_at
        `;

		const r = await client.query(insertQ, [
			provider_id,
			user_id,
			service_id,
			cleanDate,
			start_time,
			end_time,
			address,
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

async function updateBookingAddress(req, res) {
	const { bookingId } = req.params;
	const { address } = req.body;

	if (!address) {
		return res.status(400).json({ message: "Address is required" });
	}

	try {
		const checkRes = await db.query(
			"SELECT created_at FROM bookings WHERE booking_id=$1",
			[bookingId]
		);
		if (checkRes.rows.length === 0) {
			return res.status(404).json({ message: "Booking not found" });
		}

		const createdAt = new Date(checkRes.rows[0].created_at);
		const now = new Date();
		const diffInMins = (now - createdAt) / 1000 / 60;

		if (diffInMins > TIME_LIMIT_MINUTES) {
			return res.status(403).json({
				message:
					"Time limit exceeded. Address is only allowed to be changed within 10 minutes.",
			});
		}

		const updateRes = await db.query(
			"UPDATE bookings SET address = $1 WHERE booking_id = $2 RETURNING address",
			[address, bookingId]
		);
		res.json({
			message: "Address updated succesfully",
			address: updateRes.rows[0].address,
		});
	} catch (err) {
		console.error("Update address error:", err);
		res.status(500).json({ message: "Server error" });
	}
}

module.exports = { createBooking, updateBookingAddress };
