const Razorpay = require("razorpay");
const crypto = require("crypto");

const db = require("../config/db");
const sendEmail = require("../utils/sendEmail");

const razorpay = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID,
	key_secret: process.env.RAZORPAY_KEY_SECRET,
});
BigInt.prototype.toJSON = function () {
	return this.toString();
};

const TIME_LIMIT_MINUTES = 10;

async function createBooking(req, res, next) {
	console.log("--- New Booking Request ---");
	let {
		provider_id,
		service_id,
		date,
		start_time,
		end_time,
		address,
		payment_method,
	} = req.body;

	if (!provider_id || !service_id || !date || !start_time) {
		return res.status(400).json({ message: "Missing fields" });
	}

	if (!end_time || end_time === start_time) {
		const [hours, minutes] = start_time.split(":").map(Number);
		const dateObj = new Date();
		dateObj.setHours(hours, minutes);
		dateObj.setHours(dateObj.getHours() + 1);

		const newH = String(dateObj.getHours()).padStart(2, "0");
		const newM = String(dateObj.getMinutes()).padStart(2, "0");
		end_time = `${newH}:${newM}`;
	}

	const user_id = req.user ? req.user.id : null;
	const cleanDate = date.toString().substring(0, 10);

	const client = await db.connect();

	try {
		await client.query("BEGIN");

		const priceRes = await client.query(
			"SELECT price FROM providers WHERE user_id = $1",
			[provider_id],
		);

		if (priceRes.rows.length === 0) {
			throw new Error(`Provider not found with User ID: ${provider_id}`);
		}

		const finalPrice = priceRes.rows[0].price;

		if (!finalPrice && finalPrice !== 0) {
			console.warn("Warning: This provider has no price set. Defaulting to 0.");
		}

		let payment_status = "pending";
		let razorpay_order_id = null;

		// if online, create a razorpay order first
		if (payment_method === "online") {
			const options = {
				amount: finalPrice * 100,
				currency: "INR",
				receipt: `receipt_${Date.now()}`,
			};
			const order = await razorpay.orders.create(options);
			razorpay_order_id = order.id;
		} else {
			payment_status = "pending";
		}

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
                status, address, price, payment_method, payment_status, razorpay_order_id, otp
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, $4::date, $5, $6, 
                'booked', $7, $8,$9,$10,$11,$12
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
			payment_method,
			payment_status,
			razorpay_order_id,
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

		res
			.status(201)
			.json({ booking: r.rows[0], razorpay_order: razorpay_order_id });
	} catch (err) {
		await client.query("ROLLBACK").catch(() => {});
		console.error("CRITICAL BACKEND ERROR:", err);
		res.status(500).json({ message: "Server error", error: err.message });
	} finally {
		client.release();
	}
}

async function verifyPayment(req, res) {
	const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
		req.body;

	const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
	hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
	const generated_signature = hmac.digest("hex");

	if (generated_signature === razorpay_signature) {
		try {
			const updateQ = `
			UPDATE bookings
			SET payment_status='paid',
				status='booked',
				razorpay_payment_id=$1
			WHERE razorpay_order_id=$2
			RETURNING *
		`;
			const result = await db.query(updateQ, [
				razorpay_payment_id,
				razorpay_order_id,
			]);
			if (result.rowCount === 0) {
				return res.status(404).json({ message: "Booking not found" });
			}
			res.status(200).json({
				success: true,
				message: "Payment verified and booking confirmed",
				booking: result.rows[0],
			});
		} catch (err) {
			console.error("Database update error:", err);
			res.status(500).json({ message: "Internal Server Error" });
		}
	} else {
		res
			.status(400)
			.json({ success: false, message: "Invalid signature, payment failed" });
	}
}

async function updateBookingStatus(req, res) {
	const { bookingId } = req.params;
	const { status, otp_provided } = req.body;
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
		let refundPercentage = 0;

		const bookingDateTime = new Date(currentBooking.date);
		const [h, m] = currentBooking.start_time.split(":");
		bookingDateTime.setHours(h, m);
		const hoursUntilService = (bookingDateTime - new Date()) / (1000 * 60 * 60);

		if (currentBooking.payment_status === "paid") {
			if (status === "cancelled") {
				if (userRole === "provider") {
					refundPercentage = 100;
				} else if (userRole === "customer") {
					refundPercentage = hoursUntilService >= 2 ? 100 : 80;
				}
			} else if (status == "no_show" && userRole === "customer") {
				// customer reports provider didnt come so full refund
				if (userRole === "customer") {
					// Customer marks No-Show (Provider didn't come): Full refund
					refundPercentage = 100;
				} else if (userRole === "provider") {
					// Provider marks No-Show (Customer didn't come): No refund
					refundPercentage = 0;
				}
			}
		}

		if (refundPercentage > 0 && currentBooking.razorpay_payment_id) {
			const refundAmount = Math.round(
				currentBooking.price * (refundPercentage / 100) * 100,
			);
			try {
				await razorpay.payments.refund(currentBooking.razorpay_payment_id, {
					amount: refundAmount,
					notes: {
						reason: `Policy: ${refundPercentage}% refund for ${status}`,
					},
				});
				console.log(`✅ ${refundPercentage}% Refund Issued for ${bookingId}`);
			} catch (err) {
				console.error("❌ Razorpay Refund Failed:", err.message);
			}
		}

		const finalPaymentStatus =
			refundPercentage === 100
				? "refunded"
				: refundPercentage > 0
					? "partially_refunded"
					: currentBooking.payment_status;

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
			if (status === "no_show") {
				const bookingDateTime = new Date(currentBooking.date);
				const [hours, minutes] = currentBooking.start_time.split(":");
				bookingDateTime.setHours(hours, minutes);

				const now = new Date();

				const allowedReportTime = new Date(
					bookingDateTime.getTime() + 20 * 60000,
				);
				if (now < allowedReportTime) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message:
							"You can only report a No-Show 20 minutes after the scheduled start time.",
					});
				}
			} else if (status !== "cancelled") {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Customers can only Cancel or report No-Show." });
			}

			if (
				["no_show", "completed", "cancelled"].includes(currentBooking.status)
			) {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Cannot change status of a finalized booking." });
			}
		} else if (userRole === "provider") {
			// providers move from Booked -> In Progress -> Completed
			const allowed = ["in_progress", "completed", "cancelled", "no_show"];
			if (!allowed.includes(status)) {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Invalid status transition for provider." });
			}
			if (status === "in_progress") {
				const { otp_provided } = req.body; // You need to send this from the frontend
				if (!otp_provided || otp_provided !== currentBooking.otp) {
					await client.query("ROLLBACK");
					return res.status(401).json({
						message:
							"Invalid or missing OTP. Please ask the customer for the code.",
					});
				}
			}
			if (status === "no_show") {
				const bookingDateTime = new Date(currentBooking.date);
				const [hours, minutes] = currentBooking.start_time.split(":");
				bookingDateTime.setHours(hours, minutes);

				const now = new Date();
				const allowedReportTime = new Date(
					bookingDateTime.getTime() + 20 * 60000,
				); // 20 mins after start

				if (now < allowedReportTime) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message:
							"You can only report a No-Show 20 minutes after the scheduled start time.",
					});
				}

				refundPercentage = 0;
			} else if (status === "cancelled") {
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
				refundPercentage = 100; // Provider cancels, customer gets full refund
			}
		}

		const updateQ = `
			UPDATE bookings
			SET status=$1, payment_status=$2, updated_at=NOW()
			WHERE booking_id=$3
			RETURNING *
		`;
		const r = await client.query(updateQ, [
			status,
			finalPaymentStatus,
			bookingId,
		]);
		await client.query("COMMIT");

		try {
			const {
				user_email,
				user_name,
				provider_email,
				provider_name,
				service_name,
				price,
			} = currentBooking;

			if (status === "no_show") {
				//notify provider they were marked as no show
				await sendEmail({
					email: provider_email,
					subject: `Alert: Customer Reported No-Show - ${service_name}`,
					message: `Hi ${provider_name},\n\nThe customer, ${user_name}, has reported that you did not arrive for the scheduled service: ${service_name}.\n\nThis will affect your reliability score. If this is a mistake, please contact support immediately.\n\n- Team TaskGenie`,
				});
			}
			if (status === "cancelled") {
				const isCancelledByProvider = userRole === "provider";
				const isPaid = currentBooking.payment_status === "paid";

				if (isCancelledByProvider) {
					// send the refund sentence only if they actually paid online
					const refundNote = isPaid
						? "\n\nSince this was a prepaid booking, a full refund of ₹" +
							currentBooking.price +
							" has been initiated to your original payment method and should reflect in your account within 5-7 business days."
						: "";
					await sendEmail({
						email: user_email,
						subject: `URGENT: Booking Cancelled - ${service_name}`,
						message: `Hi ${user_name},\n\nWe regret to inform you that your provider, ${provider_name}, is unable to fulfill the booking for ${service_name} and has had to cancel.${refundNote}\n\nWe apologize for the inconvenience. Please open the TaskGenie app to book another expert immediately.\n\n- Team TaskGenie`,
					});
				} else {
					await sendEmail({
						email: provider_email,
						subject: `Booking Cancelled by Customer - ${service_name}`,
						message: `Hi ${provider_name},\n\nThe customer, ${user_name}, has cancelled their booking for ${service_name}.\n\nYour schedule has been updated accordingly.\n\n- Team TaskGenie`,
					});
				}
			}

			if (status === "completed") {
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
			[bookingId],
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
			[address, bookingId],
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

	const type = req.query.type || "upcoming";
	const search = (req.query.search || "").trim();

	const dateFilter = req.query.data_filter || "All Time";
	const minPrice = req.query.min_price;
	const serviceFilter = (req.query.service_filter || "").trim();

	try {
		const autoExpireQuery = `
			UPDATE bookings
			SET status='expired'
			WHERE status='booked'
			AND user_id=$1
			AND (date + end_time) < (NOW()- INTERVAL '15 HOURS')
		`;
		await db.query(autoExpireQuery, [userId]);

		const queryParams = [userId];
		let paramCounter = 1;

		let whereClause = `WHERE b.user_id=$${paramCounter}`;
		paramCounter++;

		if (type === "upcoming") {
			// UPCOMING: only active bookings, sorted by SOONEST date
			whereClause += " AND b.status IN ('booked','in_progress')";
		} else {
			// HISTORY: only finished bookings, sorted by NEWEST date
			whereClause +=
				" AND b.status IN ('booked','in_progress','completed','cancelled','no_show','expired')";
		}

		if (search) {
			queryParams.push(`%${search}%`);

			whereClause += `
			AND (
				s.name ILIKE $${paramCounter} OR
				pu.name ILIKE $${paramCounter} OR
				b.booking_id::text ILIKE $${paramCounter}
			)`;
			paramCounter++;
		}

		if (serviceFilter) {
			queryParams.push(`%${serviceFilter}%`);
			whereClause += ` AND s.name ILIKE $${paramCounter}`;
			paramCounter++;
		}

		// minimum Price Filter
		if (minPrice) {
			queryParams.push(minPrice);
			whereClause += ` AND b.price >= $${paramCounter}`;
			paramCounter++;
		}

		if (dateFilter === "This Month") {
			whereClause += ` AND date_trunc('month', b.date) = date_trunc('month', CURRENT_DATE)`;
		} else if (dateFilter === "Last 3 Months") {
			whereClause += ` AND b.date >= (CURRENT_DATE - INTERVAL '3 months')`;
		}

		const countQuery = `
			SELECT COUNT(*)
			FROM bookings b
			LEFT JOIN users pu ON pu.id=b.provider_id
            LEFT JOIN services s ON s.id=b.service_id
            ${whereClause}`;

		const dataQuery = `
			SELECT b.booking_id, b.service_id, b.date, b.status, b.price, b.start_time, b.address,
				   pu.id AS provider_id,
				   pu.custom_id AS custom_id,
				   pu.name AS provider_name,
				   pu.email AS provider_email,
				   pu.phone AS provider_phone,
			       s.name AS service_name
			FROM bookings b
			LEFT JOIN users pu ON pu.id=b.provider_id
			LEFT JOIN services s ON s.id=b.service_id
			${whereClause}
			${
				type === "upcoming"
					? "ORDER BY b.date ASC, b.start_time ASC"
					: "ORDER BY b.date DESC, b.start_time DESC"
			}
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1};`;

		const dataParams = [...queryParams, limit, offset];

		// tun both queries in parallel for performance (Promise.all)
		const [dataResult, countResult] = await Promise.all([
			db.query(dataQuery, dataParams),
			db.query(countQuery, queryParams),
		]);

		const totalRows = parseInt(countResult.rows[0].count);
		const totalPages = Math.ceil(totalRows / limit);

		// return the "meta" obj
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
	verifyPayment,
};
