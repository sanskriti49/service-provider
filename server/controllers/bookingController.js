const db = require("../config/db");
const sendEmail = require("../utils/sendEmail");

BigInt.prototype.toJSON = function () {
	return this.toString();
};

const TIME_LIMIT_MINUTES = 10;

async function createBooking(req, res, next) {
	console.log("--- New Booking Request ---");
	const { provider_id, service_id, date, start_time, end_time, address } =
		req.body;

	if (!provider_id || !service_id || !date || !start_time) {
		return res.status(400).json({ message: "Missing fields" });
	}

	const user_id = req.user ? req.user.id : null;
	const cleanDate = date.toString().substring(0, 10);

	const client = await db.connect();

	try {
		await client.query("BEGIN");

		const priceRes = await client.query(
			"SELECT price FROM providers WHERE user_id = $1",
			[provider_id]
		);

		if (priceRes.rows.length === 0) {
			throw new Error(`Provider not found with User ID: ${provider_id}`);
		}

		const providerPrice = priceRes.rows[0].price;

		if (!providerPrice && providerPrice !== 0) {
			console.warn("Warning: This provider has no price set. Defaulting to 0.");
		}

		const finalPrice = providerPrice || 0;

		const conflictQ = `
            SELECT 1 FROM bookings
            WHERE provider_id=$1
            AND date=$2::date
            AND status='booked'
            AND NOT (end_time <= $3 OR start_time >= $4)
            LIMIT 1
        `;

		const conflict = await client.query(conflictQ, [
			provider_id,
			cleanDate,
			start_time,
			end_time,
		]);

		if (conflict.rowCount > 0) {
			await client.query("ROLLBACK");
			return res.status(409).json({ message: "Slot already booked!" });
		}

		const insertQ = `
            INSERT INTO bookings (
                booking_id, provider_id, user_id, service_id, date, start_time, end_time, 
                status, address, price
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, 
                'booked', $7, $8
            )
            RETURNING *;
        `;

		const r = await client.query(insertQ, [
			provider_id,
			user_id,
			service_id,
			cleanDate,
			start_time,
			end_time,
			address,
			finalPrice,
		]);

		const booking = r.rows[0];

		const namesQ = `
            SELECT
            (SELECT name FROM users WHERE id=$1) as provider_name,
            (SELECT name FROM services WHERE id=$2) as service_name
        `;
		const namesRes = await client.query(namesQ, [provider_id, service_id]);

		const providerName = namesRes.rows[0]?.provider_name || "the Provider";
		const serviceName = namesRes.rows[0]?.service_name || "Service";

		await client.query("COMMIT");

		console.log("✅ Booking successful. ID:", booking.booking_id);

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

		res.status(201).json({ booking });
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		console.error("CRITICAL BACKEND ERROR:", err);
		res.status(500).json({ message: "Server error", error: err.message });
	} finally {
		client.release();
	}
}

async function updateBookingStatus(req, res) {
	const { bookingId } = req.params;
	const { status } = req.body;
	const userId = req.user.id;
	const userRole = req.user.role;

	const validStatuses = [
		"booked",
		"in_progress",
		"completed",
		"cancelled",
		"no_show",
	];
	if (!validStatuses.includes(status)) {
		return res.status(400).json({ message: "Invalid status value" });
	}
	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const checkQ = `
			SELECT b.*,
				   u.email AS user_email, u.name AS user_name,
				   p.email AS provider_email, p.name AS provider_name,
				   s.name AS service_name
			FROM bookings b
			JOIN users u on b.user_id=u.id
			JOIN users p ON b.provider_id=p.id
			JOIN services s ON b.service_id=s.id
			WHERE booking_id=$1
		`;
		const bookingRes = await client.query(checkQ, [bookingId]);

		if (bookingRes.rows.length === 0) {
			await client.query("ROLLBACK");
			return res.status(404).json({ message: "Booking not found." });
		}
		const currentBooking = bookingRes.rows[0];

		if (
			currentBooking.user_id !== userId &&
			currentBooking.provider_id !== userId &&
			userRole !== "admin"
		) {
			await client.query("ROLLBACK");
			return res
				.status(403)
				.json({ message: "Unauthorized access to this booking." });
		}

		if (userRole === "customer") {
			if (status !== "cancelled") {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Customers can only cancel bookings." });
			}

			if (
				["in_progress", "completed", "cancelled"].includes(
					currentBooking.status
				)
			) {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Cannot cancel this booking at this stage." });
			}
		} else if (userRole === "provider") {
			// providers move from Booked -> In Progress -> Completed
			const allowed = ["in_progress", "completed", "cancelled"];
			if (!allowed.includes(status)) {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Invalid status transition for provider." });
			}
			if (status === "cancelled") {
				const jobDate = new Date(currentBooking.date);
				const [hours, minutes] = currentBooking.start_time.split(":");
				jobDate.setHours(hours, minutes);

				const now = new Date();
				const hoursUntilJob = (jobDate - now) / 1000 / 60 / 60;

				if (hoursUntilJob < 2) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message: "Too late to cancel! Please contact support.",
					});
				}
			}
		}

		const updateQ = `
			UPDATE bookings
			SET status=$1, updated_at=NOW()
			WHERE booking_id=$2
			RETURNING *
		`;
		const r = await client.query(updateQ, [status, bookingId]);
		await client.query("COMMIT");

		try {
			const {
				user_email,
				user_name,
				provider_email,
				provider_name,
				service_name,
			} = currentBooking;

			if (status === "cancelled") {
				const isCancelledByProvider = userRole === "provider";

				if (isCancelledByProvider) {
					await sendEmail({
						email: user_email,
						subject: `URGENT: Booking Cancelled - ${service_name}`,
						message: `Hi ${user_name},\n\nWe regret to inform you that your provider, ${provider_name}, has cancelled the booking for ${service_name}.\n\nPlease open the app to book another provider immediately.\n\n- Team TaskGenie`,
					});
				} else {
					await sendEmail({
						email: provider_email,
						subject: `Booking Cancelled by Customer - ${service_name}`,
						message: `Hi ${provider_name},\n\nThe customer, ${user_name}, has cancelled their booking for ${service_name}.\n\nYour schedule has been freed up.\n\n- Team TaskGenie`,
					});
				}
			}

			// booking completed
			if (status === "completed") {
				// to Customer
				await sendEmail({
					email: user_email,
					subject: `Service Completed: ${service_name}`,
					message: `Hi ${user_name},\n\nYour service with ${provider_name} has been marked as completed.\n\nPlease log in to the dashboard to rate your provider and download your invoice.\n\nThank you!\n- Team TaskGenie`,
				});
			}
		} catch (emailErr) {
			console.error("⚠️ Email Notification Failed:", emailErr.message);
		}

		console.log(`Booking ${bookingId} status updated to: ${status}`);
		res.json({ message: "Status updated successfully", booking: r.rows[0] });
	} catch (err) {
		await client.query("ROLLBACK");
		console.error("Status Update Error:", err);
		res.status(500).json({ message: "Server error" });
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

async function getUserHistory(req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 10;

	// "Offset" (How many rows to skip)
	const offset = (page - 1) * limit; // Page 1: skip 0. Page 2: skip 10. Page 3: skip 20.
	const userId = req.user.id;

	try {
		const dataQuery = `
			SELECT b.booking_id, b.service_id, b.date, b.status, b.price, b.start_time, b.address,
				   pu.name AS provider_name,
				   pu.email AS provider_email,
				   pu.phone AS provider_phone,
			       s.name AS service_name
			FROM bookings b
			LEFT JOIN users pu ON pu.id=b.provider_id
			LEFT JOIN services s ON s.id=b.service_id
			WHERE b.user_id=$1
			ORDER BY b.date DESC, b.start_time DESC
			LIMIT $2 OFFSET $3`;

		const countQuery = `
			SELECT COUNT(*)
			FROM bookings
			WHERE user_id=$1`;

		// tun both queries in parallel for performance (Promise.all)
		const [dataResult, countResult] = await Promise.all([
			db.query(dataQuery, [userId, limit, offset]),
			db.query(countQuery, [userId]),
		]);

		const totalRows = parseInt(countResult.rows[0].count);
		const totalPages = Math.ceil(totalRows / limit);

		// return the "Meta" object (Standard API Response Structure)
		res.json({
			meta: {
				current_page: page,
				items_per_page: limit,
				total_items: totalRows,
				total_pages: totalPages,
				has_next_page: page < totalPages,
			},
			data: dataResult.rows,
		});
	} catch (err) {
		console.error("Pagination Error:", err);
		if (!res.headersSent) {
			res.status(500).json({ message: "Error fetching history" });
		}
	}
}

module.exports = {
	createBooking,
	updateBookingAddress,
	getUserHistory,
	updateBookingStatus,
};
