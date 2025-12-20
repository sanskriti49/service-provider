const db = require("../config/db");
const sendEmail = require("../utils/sendEmail");

BigInt.prototype.toJSON = function () {
	return this.toString();
};

const TIME_LIMIT_MINUTES = 10;

async function createBooking(req, res, next) {
	console.log("--- New Booking Request ---");
	console.log("User:", req.user);

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

		const namesQ = `
			SELECT
			(SELECT name FROM users WHERE id=$1) as provider_name,
			(SELECT name FROM services WHERE id=$2) as service_name
		`;
		const namesRes = await client.query(namesQ, [provider_id, service_id]);

		const providerName = namesRes.rows[0]?.provider_name || "the Provider";
		const serviceName = namesRes.rows[0]?.service_name || "Service";

		await client.query("COMMIT");
		console.log("Booking successful:", r.rows[0]);

		const bookingDate = new Date(date).toLocaleDateString("en-IN", {
			timeZone: "Asia/Kolkata",
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
		const [hours, minutes] = start_time.split(":");
		const timeObj = new Date();
		timeObj.setHours(hours, minutes);

		const formattedTime = timeObj.toLocaleTimeString("en-IN", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
		const emailMessage = `Hello ${req.user.name || "Customer"},

        Your booking has been confirmed!
            
		--------------------------------------------------
		Service:  ${serviceName}
		Provider: ${providerName}
		Date:     ${bookingDate}
		Time:     ${formattedTime}
		Location: ${address}
		--------------------------------------------------
		
		You can view or manage your booking in your dashboard.

		Thank you for choosing TaskGenie!`;

		try {
			if (req.user && req.user.email) {
				await sendEmail({
					email: req.user.email,
					subject: `Booking Confirmed: ${serviceName} with ${providerName}`,
					message: emailMessage,
				});
				console.log(`Confirmation email sent to ${req.user.email}`);
			}
		} catch (emailErr) {
			console.error("Failed to send confirmation email:", emailErr);
		}

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
