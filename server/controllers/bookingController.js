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

	const otp = Math.floor(1000 + Math.random() * 9000).toString();

	if (!end_time || end_time === start_time) {
		const [hours, minutes] = start_time.split(":").map(Number);
		const dateObj = new Date();
		dateObj.setHours(hours + 1, minutes);
		end_time = `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
	}

	const user_id = req.user ? req.user.id : null;
	const cleanDate = date.toString().substring(0, 10);
	const client = await db.connect();

	try {
		await client.query("BEGIN");

		const priceRes = await client.query(
			`SELECT price FROM provider_services 
			WHERE provider_id = $1 AND service_id=$2::uuid`,
			[provider_id, service_id],
		);
		if (priceRes.rows.length === 0) throw new Error("Provider not found");
		const finalPrice = priceRes.rows[0].price || 0;

		let payment_status = "pending";
		let razorpay_order_id = null;

		if (payment_method === "online") {
			const order = await razorpay.orders.create({
				amount: finalPrice * 100,
				currency: "INR",
				receipt: `receipt_${Date.now()}`,
			});
			razorpay_order_id = order.id;
		}

		const conflict = await client.query(
			`SELECT 1 FROM bookings WHERE provider_id=$1 AND date=$2::date AND status='booked' AND NOT (end_time <= $3 OR start_time >= $4) LIMIT 1`,
			[provider_id, cleanDate, start_time, end_time],
		);

		if (conflict.rowCount > 0) {
			await client.query("ROLLBACK");
			return res.status(409).json({ message: "Slot already booked!" });
		}
		const insertQ = `
			INSERT INTO bookings (
				booking_id, provider_id, user_id, service_id, date, start_time, end_time, 
				status, address, price, payment_method, payment_status, razorpay_order_id, otp
			)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12)
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
			otp,
		]);

		await client.query("COMMIT");
		res
			.status(201)
			.json({ booking: r.rows[0], razorpay_order: razorpay_order_id });
	} catch (err) {
		await client.query("ROLLBACK");
		res.status(500).json({ message: "Server error", error: err.message });
	} finally {
		client.release();
	}
}

async function updateBookingStatus(req, res) {
	const { booking_id } = req.params;
	const { status, otp_provided } = req.body;
	const userId = req.user.id;
	const userRole = req.user.role;

	const client = await db.connect();
	try {
		await client.query("BEGIN");

		const checkQ = `
            SELECT b.*, u.email AS user_email, u.name AS user_name,
                   p.email AS provider_email, p.name AS provider_name,
                   s.name AS service_name
            FROM bookings b
            JOIN users u ON b.user_id=u.id
            JOIN users p ON b.provider_id=p.id
            JOIN services s ON b.service_id=s.id
            WHERE booking_id=$1 FOR UPDATE
        `;
		const bookingRes = await client.query(checkQ, [booking_id]);
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
			return res.status(403).json({ message: "Unauthorized access." });
		}

		const bookingDateTime = new Date(currentBooking.date);
		const [h, m] = currentBooking.start_time.split(":");
		bookingDateTime.setHours(h, m);
		const now = new Date();
		const hoursUntilService = (bookingDateTime - now) / (1000 * 60 * 60);
		const allowedNoShowTime = new Date(bookingDateTime.getTime() + 20 * 60000); // 20 mins grace

		let refundPercentage = 0;
		let updateReliabilityMetric = false;

		// CUSTOMER FLOW
		if (userRole === "customer") {
			if (status === "no_show") {
				if (now < allowedNoShowTime) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message: "Wait 20 mins after start time to report No-Show.",
					});
				}
				refundPercentage = 100;
			} else if (status === "cancelled") {
				// If it was still pending provider acceptance, 100% refund instantly
				if (currentBooking.status === "pending") {
					refundPercentage = 100;
				} else {
					refundPercentage = hoursUntilService >= 2 ? 100 : 80;
				}
			} else {
				await client.query("ROLLBACK");
				return res
					.status(400)
					.json({ message: "Customers can only Cancel or report No-Show." });
			}
		}

		// PROVIDER FLOW
		else if (userRole === "provider") {
			// State flow validation checking
			if (currentBooking.status === "pending") {
				const allowedFromPending = ["confirmed", "cancelled"];
				if (!allowedFromPending.includes(status)) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message:
							"Pending bookings can only be confirmed or cancelled (declined).",
					});
				}

				if (status === "cancelled") {
					refundPercentage = 100; // Decline yields a clean 100% automatic refund
					updateReliabilityMetric = false; // Zero profile penalty for declining in queue
				}
			} else if (
				currentBooking.status === "confirmed" ||
				currentBooking.status === "booked"
			) {
				const allowedFromConfirmed = ["in_progress", "cancelled", "no_show"];
				if (!allowedFromConfirmed.includes(status)) {
					await client.query("ROLLBACK");
					return res.status(400).json({ message: "Invalid transition state." });
				}

				if (status === "cancelled") {
					if (hoursUntilService < 2) {
						await client.query("ROLLBACK");
						return res
							.status(400)
							.json({ message: "Too late to cancel! Contact system support." });
					}
					refundPercentage = 100;
					updateReliabilityMetric = true; // Penalty applied: backed out after accepting job
				}
			}

			// In-flight Execution Handshake Verification (OTP Gate)
			if (status === "in_progress") {
				if (
					!otp_provided ||
					otp_provided.toString() !== currentBooking.otp.toString()
				) {
					await client.query("ROLLBACK");
					return res
						.status(401)
						.json({ message: "Invalid secure OTP verification handshake." });
				}
			} else if (status === "no_show") {
				if (now < allowedNoShowTime) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message: "Wait 20 mins before reporting customer No-Show.",
					});
				}
				refundPercentage = 0; // Provider keeps customer transaction deposit
			}
		}

		// Process Razorpay Secure Refund Processing Sub-routine
		if (
			refundPercentage > 0 &&
			currentBooking.payment_status === "paid" &&
			currentBooking.razorpay_payment_id
		) {
			const refundAmount = Math.round(
				currentBooking.price * (refundPercentage / 100) * 100,
			);
			try {
				await razorpay.payments.refund(currentBooking.razorpay_payment_id, {
					amount: refundAmount,
					notes: {
						reason: `Policy automated ${refundPercentage}% refund transaction trigger for status: ${status}`,
					},
				});
			} catch (err) {
				console.error("Payment Gateway Refund execution aborted:", err.message);
			}
		}

		const finalPaymentStatus =
			refundPercentage === 100
				? "refunded"
				: refundPercentage > 0
					? "partially_refunded"
					: currentBooking.payment_status;

		// Apply Penalty Updates to Metrics Log if flag evaluates true
		if (updateReliabilityMetric) {
			await client.query(
				`UPDATE providers SET rating = GREATEST(rating - 0.1, 1.0) WHERE user_id = $1`,
				[currentBooking.provider_id],
			);
		}

		const updateQ = `UPDATE bookings SET status=$1, payment_status=$2, action_by=$3, updated_at=NOW() WHERE booking_id=$4 RETURNING *`;
		const r = await client.query(updateQ, [
			status,
			finalPaymentStatus,
			userRole,
			booking_id,
		]);

		await client.query("COMMIT");
		sendEmailNotifications(status, userRole, currentBooking, refundPercentage);

		res.json({
			message: "Booking status matrix advanced successfully",
			booking: r.rows[0],
		});
	} catch (err) {
		await client.query("ROLLBACK");
		res.status(500).json({
			message: "Server encountered runtime execution error",
			error: err.message,
		});
	} finally {
		client.release();
	}
}

async function getProviderHistory(req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 8;
	const offset = (page - 1) * limit;
	const providerId = req.user.id;

	const type = req.query.type || "upcoming"; // 'upcoming' or 'history'
	const search = (req.query.search || "").trim();
	const dateFilter = req.query.date_filter || "All Time";
	const minPrice = req.query.min_price;
	const customerFilter = (req.query.customer_filter || "").trim();

	try {
		const queryParams = [providerId];
		let paramCounter = 1;

		let whereClause = `WHERE b.provider_id = $${paramCounter}`;
		paramCounter++;

		if (type === "upcoming") {
			whereClause +=
				" AND b.status IN ('pending', 'booked', 'confirmed', 'in_progress')";
		} else {
			whereClause +=
				" AND b.status IN ('completed', 'cancelled', 'no_show', 'expired')";
		}

		// Global search term processing
		if (search) {
			queryParams.push(`%${search}%`);
			whereClause += ` AND (
                s.name ILIKE $${paramCounter} OR
                u.name ILIKE $${paramCounter} OR
                b.booking_id::text ILIKE $${paramCounter}
            )`;
			paramCounter++;
		}

		// Specific sidebar menu structural filters
		if (customerFilter) {
			queryParams.push(`%${customerFilter}%`);
			whereClause += ` AND u.name ILIKE $${paramCounter}`;
			paramCounter++;
		}

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
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN services s ON s.id = b.service_id
            ${whereClause}`;

		const dataQuery = `
            SELECT b.*, u.name AS customer_name, u.email AS customer_email, s.name AS service_name
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN services s ON s.id = b.service_id
            ${whereClause}
            ORDER BY b.date ${type === "upcoming" ? "ASC" : "DESC"}, b.start_time DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1};`;

		// Run concurrently for performance
		const [dataResult, countResult] = await Promise.all([
			db.query(dataQuery, [...queryParams, limit, offset]),
			db.query(countQuery, queryParams),
		]);

		const totalRows = parseInt(countResult.rows[0].count);
		const totalPages = Math.ceil(totalRows / limit);

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
		console.error("Provider Pagination Error:", err);
		res
			.status(500)
			.json({ message: "Error fetching provider database history" });
	}
}

async function getRecentProviderBookings(req, res, next) {
	const providerId = req.user.id;

	try {
		const result = await db.query(
			`SELECT 
                b.booking_id, b.date, b.status, b.price, b.start_time,
                u.name AS customer_name,
                s.name AS service_name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             JOIN services s ON b.service_id = s.id
             WHERE b.provider_id = $1
             ORDER BY b.date DESC, b.start_time DESC
             LIMIT 5`,
			[providerId],
		);

		res.json(result.rows);
	} catch (err) {
		console.error("Failed to load recent dashboard lines:", err);
		res.status(500).json({ error: "Server error parsing activity updates" });
	}
}

async function getUpcomingBookings(req, res) {
	try {
		const q = `
            SELECT b.*, s.name AS service_name, pu.name AS provider_name, pu.phone as provider_phone
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN users pu ON pu.id = b.provider_id
            WHERE b.user_id = $1 AND b.date >=CURRENT_DATE AND b.status != 'cancelled'
            ORDER BY b.date ASC, b.start_time ASC
        `;
		const result = await db.query(q, [req.user.id]);
		res.json(result.rows);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Error fetching upcoming bookings" });
	}
}

async function sendEmailNotifications(
	status,
	role,
	booking,
	refundPercentage = 0,
) {
	try {
		const {
			provider_email,
			provider_name,
			user_email,
			user_name,
			service_name,
			otp,
		} = booking;
		const emailsToSend = [];
		const signature = `\n\nBest Regards,\nTeam TaskGenie\nSupport: support@taskgenie.com\n"Your local service, simplified."`;

		if (status === "booked") {
			// Send to Customer
			emailsToSend.push({
				email: user_email,
				subject: `Booking Confirmed! - ${service_name}`,
				message:
					`Hi ${user_name}, your booking for ${service_name} is confirmed. \nYour handshake OTP is: ${otp}. Please share this only when the provider arrives.` +
					signature,
			});
			// Send to Provider
			emailsToSend.push({
				email: provider_email,
				subject: `New Booking Received! - ${service_name}`,
				message:
					`Hi ${provider_name}, you have a new booking from ${user_name}. Check your dashboard for the schedule.` +
					signature,
			});
		} else if (status === "no_show") {
			if (role === "customer") {
				// Customer reporting Provider
				emailsToSend.push({
					email: user_email,
					subject: `No-Show Reported - ${service_name}`,
					message:
						`Hi ${user_name},\n\nYou have reported that the provider did not arrive for the scheduled service. A full refund (100%) has been initiated to your original payment method.` +
						signature,
				});
				emailsToSend.push({
					email: provider_email,
					subject: `Alert: Customer Reported No-Show - ${service_name}`,
					message:
						`Hi ${provider_name},\n\n${user_name} reported that you did not show up for the scheduled service. This incident has been logged and will affect your reliability score. If this is an error, please contact support.` +
						signature,
				});
			} else {
				// Provider reporting Customer
				emailsToSend.push({
					email: user_email,
					subject: `Alert: No-Show Reported by Provider`,
					message:
						`Hi ${user_name},\n\n${provider_name} reported that you were not available at the scheduled time and location. Per TaskGenie policy, no refund is issued for customer no-shows to compensate the provider for their time and travel.` +
						signature,
				});
				emailsToSend.push({
					email: provider_email,
					subject: `No-Show Logged - ${service_name}`,
					message:
						`Hi ${provider_name},\n\nWe have logged the customer as a no-show for your service. Your payout will be processed as per the platform policy for confirmed bookings.` +
						signature,
				});
			}
		} else if (status === "cancelled") {
			if (role === "customer") {
				const refundMsg =
					refundPercentage === 100
						? "A full refund has been initiated."
						: "A refund of 80% has been initiated (20% cancellation fee applied).";

				emailsToSend.push({
					email: user_email,
					subject: `Booking Cancelled`,
					message:
						`Hi ${user_name}, you cancelled your booking. ${refundMsg}` +
						signature,
				});
				emailsToSend.push({
					email: provider_email,
					subject: `Booking Cancelled by Customer`,
					message:
						`Hi ${provider_name}, ${user_name} has cancelled the service for ${service_name}.` +
						signature,
				});
			} else {
				// Provider Cancelled
				emailsToSend.push({
					email: user_email,
					subject: `Booking Cancelled by Provider`,
					message:
						`Hi ${user_name}, unfortunately ${provider_name} had to cancel. A 100% refund has been initiated to your bank account which will reflect within 3-5 business days.` +
						signature,
				});
				emailsToSend.push({
					email: provider_email,
					subject: `Cancellation Confirmed`,
					message:
						`Hi ${provider_name}, you have cancelled the booking. Please try to avoid last-minute cancellations.` +
						signature,
				});
			}
		}
		for (const { email, subject, message } of emailsToSend) {
			await sendEmail(email, subject, message);
		}
	} catch (err) {
		console.error("Notification Error:", err.message);
	}
}

async function verifyPayment(req, res) {
	const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
		req.body;
	const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
	hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
	if (hmac.digest("hex") === razorpay_signature) {
		try {
			const result = await db.query(
				`UPDATE bookings SET payment_status='paid', status='booked', razorpay_payment_id=$1 WHERE razorpay_order_id=$2 RETURNING *`,
				[razorpay_payment_id, razorpay_order_id],
			);
			res.status(200).json({ success: true, booking: result.rows[0] });
		} catch (err) {
			res.status(500).json({ message: "Internal Server Error" });
		}
	} else {
		res.status(400).json({ success: false, message: "Invalid signature" });
	}
}

async function updateBookingAddress(req, res) {
	const { booking_id } = req.params;
	const { address } = req.body;

	if (!address) {
		return res.status(400).json({ message: "Address is required" });
	}

	try {
		const checkRes = await db.query(
			"SELECT created_at FROM bookings WHERE booking_id=$1",
			[booking_id],
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
			[address, booking_id],
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

	const offset = (page - 1) * limit; // Page 1: skip 0. Page 2: skip 10. Page 3: skip 20.
	const userId = req.user.id;

	const type = req.query.type || "upcoming";
	const search = (req.query.search || "").trim();

	const dateFilter = req.query.date_filter || "All Time";
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
	getRecentProviderBookings,
	getUpcomingBookings,
	getProviderHistory,
};
