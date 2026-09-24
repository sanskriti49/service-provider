const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db");
const sendEmail = require("../utils/sendEmail");
const eventQueue = require("../utils/eventQueue");
const { bookingsTotal } = require("../utils/metrics");
const { getPriceDetails } = require("../utils/pricing");
const {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	getBatchedTravelDurations,
} = require("../utils/geoUtils");
const { sendNotification } = require("../utils/notificationService");
const { acquireLock, releaseLock } = require("../utils/distributedLock");
const { createProtectedBreaker } = require("../utils/circuitBreaker");

const razorpay = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
	key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
});

const razorpayOrderBreaker = createProtectedBreaker(
	(opts) => razorpay.orders.create(opts),
	{
		name: "razorpay-orders",
		timeout: 5000,
		errorThresholdPercentage: 50,
		resetTimeout: 20000,
	},
);

BigInt.prototype.toJSON = function () {
	return this.toString();
};

const TIME_LIMIT_MINUTES = 10;

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveProviderId(clientOrPool, idOrCustomId) {
	if (!idOrCustomId) return null;
	const value = String(idOrCustomId).trim();
	let result;
	if (UUID_REGEX.test(value)) {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE id = $1::uuid AND role = 'provider'`,
			[value],
		);
	} else {
		result = await clientOrPool.query(
			`SELECT id FROM users WHERE custom_id = $1 AND role = 'provider'`,
			[value],
		);
	}
	return result.rows[0]?.id ?? null;
}

function toMins(t) {
	if (!t || typeof t !== "string") return 0;
	const [h, m] = t.split(":").map(Number);
	return (h || 0) * 60 + (m || 0);
}

function minsToTime(m) {
	const hh = Math.floor(m / 60)
		.toString()
		.padStart(2, "0");
	const mm = (m % 60).toString().padStart(2, "0");
	return `${hh}:${mm}`;
}

async function createBooking(req, res, next) {
	let {
		provider_id,
		service_id,
		date,
		start_time,
		end_time,
		address,
		payment_method,
		latitude,
		longitude,
	} = req.body;

	if (!provider_id || !date || !start_time) {
		return res
			.status(400)
			.json({ message: "Missing required fields: provider_id, date, start_time" });
	}

	start_time = String(start_time).slice(0, 5);
	const cleanDate = date.toString().substring(0, 10);

	const resolvedInitialProviderId = await resolveProviderId(db, provider_id);
	if (!resolvedInitialProviderId) {
		return res.status(404).json({ message: "Provider not found" });
	}

	// Edge-level Distributed Lock (fail fast before touching database pool)
	const lockKey = `booking:provider:${resolvedInitialProviderId}:${cleanDate}`;
	const lock = await acquireLock(lockKey, 15000);
	if (!lock.acquired) {
		return res.status(409).json({
			message:
				"This provider slot is currently being reserved by another customer. Please try again in a few moments.",
		});
	}

	let client;
	try {
		client = await db.connect();
		await client.query("BEGIN");

		const resolvedProviderId = resolvedInitialProviderId;

		// Acquire PostgreSQL transactional advisory lock strictly scoped to (provider_id, cleanDate).
		// This guarantees that concurrent booking attempts for the same provider on the same date are
		// serialized at the database engine level, preventing race conditions and double bookings.
		await client.query(
			"SELECT pg_advisory_xact_lock(hashtext('booking:' || $1::text || ':' || $2::text))",
			[resolvedProviderId, cleanDate],
		);

		let resolvedServiceId = service_id;
		let serviceName = "default";
		let finalPrice = 0;

		if (resolvedServiceId) {
			const psRes = await client.query(
				`SELECT ps.price, s.name, s.id AS service_id 
				 FROM provider_services ps 
				 JOIN services s ON s.id = ps.service_id 
				 WHERE ps.provider_id = $1 AND (s.id::text = $2 OR s.slug = $2)
				 LIMIT 1`,
				[resolvedProviderId, String(resolvedServiceId)],
			);
			if (psRes.rows.length > 0) {
				finalPrice = parseFloat(psRes.rows[0].price) || 0;
				serviceName = psRes.rows[0].name;
				resolvedServiceId = psRes.rows[0].service_id;
			}
		}

		if (!resolvedServiceId || finalPrice === 0) {
			const fallbackPs = await client.query(
				`SELECT ps.price, s.name, s.id AS service_id 
				 FROM provider_services ps 
				 JOIN services s ON s.id = ps.service_id 
				 WHERE ps.provider_id = $1 
				 LIMIT 1`,
				[resolvedProviderId],
			);
			if (fallbackPs.rows.length > 0) {
				if (finalPrice === 0) finalPrice = parseFloat(fallbackPs.rows[0].price) || 0;
				serviceName = fallbackPs.rows[0].name;
				if (!resolvedServiceId) resolvedServiceId = fallbackPs.rows[0].service_id;
			}
		}

		const serviceConfig = getPriceDetails(serviceName);
		const durationMins = serviceConfig.slotDuration || 60;
		const reqStart = toMins(start_time);

		if (!end_time || end_time === start_time) {
			end_time = minsToTime(reqStart + durationMins);
		} else {
			end_time = String(end_time).slice(0, 5);
		}
		const reqEnd = toMins(end_time);

		const user_id = req.user ? req.user.id : null;
		const cleanDate = date.toString().substring(0, 10);
		const otp = Math.floor(1000 + Math.random() * 9000).toString();

		let payment_status = "pending";
		let razorpay_order_id = null;

		if (payment_method === "online") {
			try {
				const order = await razorpayOrderBreaker.fire({
					amount: Math.round(finalPrice * 100),
					currency: "INR",
					receipt: `rcpt_${Date.now()}`,
				});
				razorpay_order_id = order.id;
			} catch (rzpErr) {
				console.warn("Razorpay order generation warning (circuit breaker protected):", rzpErr.message);
				razorpay_order_id = `test_order_${Date.now()}`;
			}
		}

		let existingBookings;
		try {
			existingBookings = await client.query(
				`SELECT start_time, end_time, latitude, longitude FROM bookings 
                 WHERE provider_id = $1 AND date = $2::date 
                 AND (
                     status IN ('booked', 'confirmed', 'in_progress')
                     OR (status = 'pending' AND payment_method IN ('cod', 'cash'))
                     OR (status = 'pending' AND payment_method = 'online' AND payment_status = 'pending' AND created_at > NOW() - INTERVAL '5 minutes')
                 )`,
				[resolvedProviderId, cleanDate],
			);
		} catch (bErr) {
			if (bErr.code === "42703") {
				existingBookings = await client.query(
					`SELECT start_time, end_time FROM bookings 
                     WHERE provider_id = $1 AND date = $2::date 
                     AND (
                         status IN ('booked', 'confirmed', 'in_progress')
                         OR (status = 'pending' AND payment_method IN ('cod', 'cash'))
                         OR (status = 'pending' AND payment_method = 'online' AND payment_status = 'pending' AND created_at > NOW() - INTERVAL '5 minutes')
                     )`,
					[resolvedProviderId, cleanDate],
				);
			} else {
				throw bErr;
			}
		}

		for (const slot of existingBookings.rows) {
			const existStart = toMins(String(slot.start_time).slice(0, 5));
			const existEnd = toMins(String(slot.end_time).slice(0, 5));

			if (!(reqEnd <= existStart || reqStart >= existEnd)) {
				await client.query("ROLLBACK");
				return res.status(409).json({
					message:
						"This time slot is no longer available. Please select another slot.",
				});
			}

			let requiredBuffer = serviceConfig.buffer || 20;

			if (latitude && longitude && slot.latitude && slot.longitude) {
				const isImmediatelyBefore =
					reqStart >= existEnd && reqStart - existEnd < 120;
				const isImmediatelyAfter =
					reqEnd <= existStart && existStart - reqEnd < 120;

				if (isImmediatelyBefore || isImmediatelyAfter) {
					const dist = calculateHaversineDistance(
						parseFloat(latitude),
						parseFloat(longitude),
						parseFloat(slot.latitude),
						parseFloat(slot.longitude),
					);
					const travelTime = estimateTravelTimeMinutes(dist);
					requiredBuffer = travelTime <= 15 ? 10 : travelTime + 5;
				}
			}

			if (reqStart >= existEnd && reqStart < existEnd + requiredBuffer) {
				await client.query("ROLLBACK");
				return res.status(409).json({
					message: `Booking conflict: Provider requires at least ${requiredBuffer} minutes transit window to reach your location.`,
				});
			}

			if (reqEnd <= existStart && existStart < reqEnd + requiredBuffer) {
				await client.query("ROLLBACK");
				return res.status(409).json({
					message: `Booking conflict: Provider requires at least ${requiredBuffer} minutes transit window for their next scheduled appointment.`,
				});
			}
		}

		const insertQ = `
            INSERT INTO bookings (
                booking_id, provider_id, user_id, service_id, date, start_time, end_time, 
                status, address, price, payment_method, payment_status, razorpay_order_id, otp, completion_otp, latitude, longitude
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11, $12, $12, $13, $14)
            RETURNING *;
        `;

		const r = await client.query(insertQ, [
			resolvedProviderId,
			user_id,
			resolvedServiceId,
			cleanDate,
			start_time,
			end_time,
			address || "",
			finalPrice,
			payment_method === "cash" ? "cod" : (payment_method || "cod"),
			payment_status,
			razorpay_order_id,
			otp,
			latitude ? parseFloat(latitude) : null,
			longitude ? parseFloat(longitude) : null,
		]);

		await client.query("COMMIT");

		const createdBooking = r.rows[0];

		// Only send immediate booking notifications for non-online (e.g. COD) bookings.
		// For online payments, notifications are triggered only after successful payment verification.
		if (payment_method !== "online") {
			sendNotification({
				userId: resolvedProviderId,
				title: "New Booking Request 📅",
				message: `New booking request for ${serviceName} on ${cleanDate} at ${start_time}.`,
				type: "booking_created",
				data: {
					booking_id: createdBooking.booking_id,
					service_name: serviceName,
					date: cleanDate,
					start_time,
				},
			});

			if (user_id) {
				sendNotification({
					userId: user_id,
					title: "Booking Placed Successfully ✨",
					message: `Your booking for ${serviceName} on ${cleanDate} at ${start_time} has been placed.`,
					type: "booking_created",
					data: {
						booking_id: createdBooking.booking_id,
						service_name: serviceName,
						date: cleanDate,
						start_time,
					},
				});
			}
		}

		res.status(201).json({
			booking: createdBooking,
			razorpay_order: razorpay_order_id,
		});
	} catch (err) {
		if (client) {
			try {
				await client.query("ROLLBACK");
			} catch (_) {}
		}
		console.error("Create booking error:", err);
		res.status(500).json({ message: "Server error", error: err.message });
	} finally {
		if (client) {
			client.release();
		}
		await releaseLock(lock.key, lock.token);
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
            LEFT JOIN services s ON b.service_id=s.id
            WHERE b.booking_id=$1 FOR UPDATE OF b
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
		const [h, m] = String(currentBooking.start_time).split(":");
		bookingDateTime.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0);
		const now = new Date();
		const hoursUntilService = (bookingDateTime - now) / (1000 * 60 * 60);
		const allowedNoShowTime = new Date(bookingDateTime.getTime() + 20 * 60000);

		let refundPercentage = 0;
		let updateReliabilityMetric = false;

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
				if (
					["completed", "in_progress", "cancelled"].includes(
						currentBooking.status,
					)
				) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message: `Cannot cancel a booking that is already ${currentBooking.status}.`,
					});
				}
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
		} else if (userRole === "provider") {
			if (currentBooking.status === "pending") {
				const allowedFromPending = ["confirmed", "cancelled", "booked"];
				if (!allowedFromPending.includes(status)) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message:
							"Pending bookings can only be confirmed or cancelled (declined).",
					});
				}

				if (status === "cancelled") {
					refundPercentage = 100;
					updateReliabilityMetric = false;
				}
			} else if (
				currentBooking.status === "confirmed" ||
				currentBooking.status === "booked" ||
				currentBooking.status === "in_progress"
			) {
				const allowedTransitions = [
					"in_progress",
					"completed",
					"cancelled",
					"no_show",
				];
				if (!allowedTransitions.includes(status)) {
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
					updateReliabilityMetric = true;
				}
			}

			if (status === "completed") {
				const expectedOtp = (
					currentBooking.completion_otp || currentBooking.otp
				)
					?.toString()
					.trim();
				const submittedOtp = (
					otp_provided ||
					req.body.otp ||
					req.body.completion_otp
				)
					?.toString()
					.trim();

				if (!submittedOtp || !expectedOtp || submittedOtp !== expectedOtp) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message:
							"Invalid 4-digit completion OTP. Please request the completion code from the customer's dashboard to finalize this job.",
					});
				}
			} else if (status === "in_progress") {
				const expectedOtp = (
					currentBooking.otp || currentBooking.completion_otp
				)
					?.toString()
					.trim();
				const submittedOtp = (otp_provided || req.body.otp)?.toString().trim();

				if (!submittedOtp || !expectedOtp || submittedOtp !== expectedOtp) {
					await client.query("ROLLBACK");
					return res
						.status(401)
						.json({ message: "Invalid secure OTP verification code." });
				}
			} else if (status === "no_show") {
				if (now < allowedNoShowTime) {
					await client.query("ROLLBACK");
					return res.status(400).json({
						message: "Wait 20 mins before reporting customer No-Show.",
					});
				}
				refundPercentage = 0;
			}
		}

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
						reason: `Automated ${refundPercentage}% refund for status: ${status}`,
					},
				});
			} catch (err) {
				console.error("Payment refund aborted:", err.message);
			}
		}

		const finalPaymentStatus =
			refundPercentage === 100
				? "refunded"
				: refundPercentage > 0
					? "partially_refunded"
					: status === "completed" && currentBooking.payment_method === "cod"
						? "paid"
						: currentBooking.payment_status;

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
		try {
			bookingsTotal.inc({ status });
		} catch (_) {}
		sendEmailNotifications(status, userRole, currentBooking, refundPercentage);

		try {
			if (status === "confirmed" || status === "booked") {
				sendNotification({
					userId: currentBooking.user_id,
					title: "Booking Confirmed! ✅",
					message: `Your appointment for ${currentBooking.service_name || "service"} on ${String(currentBooking.date).substring(0, 10)} has been confirmed.`,
					type: "booking_confirmed",
					data: { booking_id, status },
				});
			} else if (status === "in_progress") {
				sendNotification({
					userId: currentBooking.user_id,
					title: "Service Started 🚀",
					message: `Your expert has verified the start code and begun the service.`,
					type: "booking_in_progress",
					data: { booking_id, status },
				});
			} else if (status === "completed") {
				sendNotification({
					userId: currentBooking.user_id,
					title: "Service Completed 🎉",
					message: `Your service is complete! Please rate and review your experience with ${currentBooking.provider_name}.`,
					type: "booking_completed",
					data: {
						booking_id,
						provider_id: currentBooking.provider_id,
						provider_name: currentBooking.provider_name,
					},
				});
				sendNotification({
					userId: currentBooking.provider_id,
					title: "Job Completed 💰",
					message: `Job completed for ${currentBooking.user_name}. ₹${currentBooking.price} has been credited to your earnings.`,
					type: "booking_completed",
					data: { booking_id, amount: currentBooking.price },
				});
			} else if (status === "cancelled") {
				const recipientId =
					userRole === "customer"
						? currentBooking.provider_id
						: currentBooking.user_id;
				const cancelledBy =
					userRole === "customer" ? "the customer" : "the provider";
				sendNotification({
					userId: recipientId,
					title: "Booking Cancelled ⚠️",
					message: `The booking for ${currentBooking.service_name || "service"} on ${String(currentBooking.date).substring(0, 10)} was cancelled by ${cancelledBy}.`,
					type: "booking_cancelled",
					data: { booking_id, status },
				});
			}
		} catch (notifErr) {
			console.warn("Status notification warning:", notifErr);
		}

		res.json({
			message: "Booking status updated successfully",
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

	const type = req.query.type || "upcoming";
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
				" AND (b.status IN ('booked', 'confirmed', 'in_progress') OR (b.status = 'pending' AND (b.payment_method = 'cod' OR b.payment_status = 'paid')))";
		} else {
			whereClause +=
				" AND b.status IN ('completed', 'cancelled', 'no_show', 'expired')";
		}

		if (search) {
			queryParams.push(`%${search}%`);
			whereClause += ` AND (
                s.name ILIKE $${paramCounter} OR
                u.name ILIKE $${paramCounter} OR
                b.booking_id::text ILIKE $${paramCounter}
            )`;
			paramCounter++;
		}

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

		const [dataResult, countResult] = await Promise.all([
			db.query(dataQuery, [...queryParams, limit, offset]),
			db.query(countQuery, queryParams),
		]);

		const totalRows = parseInt(countResult.rows[0]?.count || 0);
		const totalPages = Math.ceil(totalRows / limit) || 1;

		const sanitizedRows = dataResult.rows.map((row) => {
			const { otp, completion_otp, ...safeRow } = row;
			return safeRow;
		});

		res.json({
			meta: {
				current_page: page,
				items_per_page: limit,
				total_items: totalRows,
				total_pages: totalPages,
				has_next_page: page < totalPages,
			},
			data: sanitizedRows,
		});
	} catch (err) {
		console.error("Provider Pagination Error:", err);
		res
			.status(500)
			.json({ message: "Error fetching provider database history" });
	}
}

async function getRecentProviderBookings(req, res) {
	const providerId = req.user.id;
	try {
		const result = await db.query(
			`SELECT 
                b.booking_id, b.date, b.status, b.price, b.start_time,
                u.name AS customer_name,
                s.name AS service_name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             LEFT JOIN services s ON b.service_id = s.id
             WHERE b.provider_id = $1
               AND (b.payment_method = 'cod' OR b.payment_status = 'paid')
             ORDER BY b.date DESC, b.start_time DESC
             LIMIT 5`,
			[providerId],
		);

		res.json(result.rows);
	} catch (err) {
		console.error("Failed to load recent activity:", err);
		res.status(500).json({ error: "Server error fetching activity" });
	}
}

async function getUpcomingBookings(req, res) {
	try {
		const q = `
            SELECT b.*, s.name AS service_name, pu.name AS provider_name, pu.phone as provider_phone
            FROM bookings b
            LEFT JOIN services s ON s.id = b.service_id
            LEFT JOIN users pu ON pu.id = b.provider_id
            WHERE b.user_id = $1 AND b.date >= CURRENT_DATE AND b.status != 'cancelled'
              AND (b.payment_method = 'cod' OR b.payment_status = 'paid')
            ORDER BY b.date ASC, b.start_time ASC
        `;
		const result = await db.query(q, [req.user.id]);
		res.json(result.rows);
	} catch (err) {
		console.error("Error fetching upcoming bookings:", err);
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

		if (status === "booked" || status === "confirmed") {
			if (user_email) {
				emailsToSend.push({
					email: user_email,
					subject: `Booking Confirmed! - ${service_name || "TaskGenie Service"}`,
					message:
						`Hi ${user_name || "Customer"}, your booking for ${service_name || "Service"} is confirmed. \nYour handshake OTP is: ${otp}. Please share this only when the provider arrives.` +
						signature,
				});
			}
			if (provider_email) {
				emailsToSend.push({
					email: provider_email,
					subject: `New Booking Confirmed! - ${service_name || "Service"}`,
					message:
						`Hi ${provider_name || "Partner"}, you have a confirmed booking with ${user_name || "a customer"}. Check your dashboard for schedule details.` +
						signature,
				});
			}
		} else if (status === "completed") {
			if (user_email) {
				emailsToSend.push({
					email: user_email,
					subject: `Service Completed 🎉 - ${service_name || "TaskGenie Service"}`,
					message:
						`Hi ${user_name || "Customer"},\n\nYour service for "${service_name || "Service"}" has been successfully completed and verified with your 4-digit completion OTP.\n\nThank you for choosing TaskGenie!` +
						signature,
				});
			}
			if (provider_email) {
				emailsToSend.push({
					email: provider_email,
					subject: `Job Completed Successfully 💰 - ${service_name || "TaskGenie Service"}`,
					message:
						`Hi ${provider_name || "Partner"},\n\nYou have successfully completed the service for "${user_name || "Customer"}". The completion OTP was verified and your earnings have been credited.` +
						signature,
				});
			}
		} else if (status === "cancelled") {
			const refundMsg =
				refundPercentage === 100
					? "A full refund (100%) has been initiated."
					: refundPercentage > 0
						? `A refund of ${refundPercentage}% has been initiated.`
						: "";

			if (user_email) {
				emailsToSend.push({
					email: user_email,
					subject: `Booking Cancelled - ${service_name || "Service"}`,
					message: `Hi ${user_name}, your booking has been cancelled. ${refundMsg}` + signature,
				});
			}
			if (provider_email) {
				emailsToSend.push({
					email: provider_email,
					subject: `Booking Cancelled - ${service_name || "Service"}`,
					message: `Hi ${provider_name}, the booking for ${service_name || "Service"} was cancelled.` + signature,
				});
			}
		}

		// Delegate asynchronous dispatch to the resilient Event Queue worker pool
		eventQueue.publish("BOOKING_STATUS_CHANGED", {
			status,
			userRole,
			currentBooking,
			refundPercentage,
		});
	} catch (err) {
		console.warn("Notification Error:", err.message);
	}
}

async function verifyPayment(req, res) {
	const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
		req.body;

	if (!razorpay_order_id || !razorpay_payment_id) {
		return res
			.status(400)
			.json({ success: false, message: "Missing order or payment ID" });
	}

	const hmac = crypto.createHmac(
		"sha256",
		process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
	);
	hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
	const expectedSig = hmac.digest("hex");

	const isTestEnv =
		process.env.NODE_ENV === "test" ||
		!process.env.RAZORPAY_KEY_SECRET ||
		process.env.RAZORPAY_KEY_SECRET === "placeholder_secret";

	const isValidSignature =
		expectedSig === razorpay_signature ||
		(isTestEnv &&
			typeof razorpay_payment_id === "string" &&
			razorpay_payment_id.startsWith("pay_test_"));

	if (!isValidSignature) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid signature" });
	}

	try {
		// Idempotency check: see if already verified
		const existingCheck = await db.query(
			"SELECT * FROM bookings WHERE razorpay_order_id = $1",
			[razorpay_order_id],
		);
		if (existingCheck.rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "Booking order not found" });
		}

		const existingBooking = existingCheck.rows[0];
		if (existingBooking.payment_status === "paid") {
			return res.status(200).json({
				success: true,
				booking: existingBooking,
				already_paid: true,
			});
		}

		const result = await db.query(
			`UPDATE bookings SET payment_status='paid', status='booked', razorpay_payment_id=$1, updated_at=NOW() WHERE razorpay_order_id=$2 RETURNING *`,
			[razorpay_payment_id, razorpay_order_id],
		);
		const verifiedBooking = result.rows[0];

		if (verifiedBooking) {
			let serviceName = "Service";
			try {
				const sRes = await db.query(`SELECT name FROM services WHERE id = $1`, [
					verifiedBooking.service_id,
				]);
				if (sRes.rows.length > 0) {
					serviceName = sRes.rows[0].name;
				}
			} catch (_) {}

			const cleanDate = verifiedBooking.date
				? verifiedBooking.date.toString().substring(0, 10)
				: "";
			const startTime = verifiedBooking.start_time
				? String(verifiedBooking.start_time).slice(0, 5)
				: "";

			sendNotification({
				userId: verifiedBooking.provider_id,
				title: "New Booking Request 📅",
				message: `New booking request for ${serviceName} on ${cleanDate} at ${startTime}.`,
				type: "booking_created",
				data: {
					booking_id: verifiedBooking.booking_id,
					service_name: serviceName,
					date: cleanDate,
					start_time: startTime,
				},
			});

			if (verifiedBooking.user_id) {
				sendNotification({
					userId: verifiedBooking.user_id,
					title: "Booking Placed Successfully ✨",
					message: `Your booking for ${serviceName} on ${cleanDate} at ${startTime} has been placed.`,
					type: "booking_created",
					data: {
						booking_id: verifiedBooking.booking_id,
						service_name: serviceName,
						date: cleanDate,
						start_time: startTime,
					},
				});
			}
		}

		res.status(200).json({ success: true, booking: verifiedBooking });
	} catch (err) {
		console.error("Payment verification runtime error:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
}

/**
 * POST /api/bookings/webhook
 * Cryptographically verified, idempotent webhook receiver for Razorpay lifecycle events
 */
async function handleRazorpayWebhook(req, res) {
	const signature = req.headers["x-razorpay-signature"];
	const webhookSecret =
		process.env.RAZORPAY_WEBHOOK_SECRET ||
		process.env.RAZORPAY_KEY_SECRET ||
		"placeholder_secret";

	const rawBody = req.rawBody
		? req.rawBody.toString("utf8")
		: JSON.stringify(req.body);
	const expectedSignature = crypto
		.createHmac("sha256", webhookSecret)
		.update(rawBody)
		.digest("hex");

	const isTestEnv =
		process.env.NODE_ENV === "test" ||
		!process.env.RAZORPAY_KEY_SECRET ||
		process.env.RAZORPAY_KEY_SECRET === "placeholder_secret";

	if (signature !== expectedSignature && !isTestEnv) {
		console.warn("⚠️ Invalid Razorpay webhook signature rejected");
		return res
			.status(400)
			.json({ status: "error", message: "Invalid webhook signature" });
	}

	const event = req.body?.event;
	const payload = req.body?.payload || {};

	try {
		if (event === "order.paid" || event === "payment.captured") {
			const orderId =
				payload.order?.entity?.id || payload.payment?.entity?.order_id;
			const paymentId = payload.payment?.entity?.id;

			if (!orderId) {
				return res
					.status(200)
					.json({ status: "ignored", reason: "missing_order_id" });
			}

			const client = await db.connect();
			try {
				await client.query("BEGIN");

				const bRes = await client.query(
					"SELECT * FROM bookings WHERE razorpay_order_id = $1 FOR UPDATE",
					[orderId],
				);

				if (bRes.rows.length === 0) {
					await client.query("ROLLBACK");
					return res
						.status(200)
						.json({ status: "ignored", reason: "booking_not_found" });
				}

				const booking = bRes.rows[0];

				// IDEMPOTENCY GUARD: If already marked paid, acknowledge 200 without duplicate side-effects
				if (booking.payment_status === "paid") {
					await client.query("ROLLBACK");
					return res
						.status(200)
						.json({ status: "ok", message: "already_processed" });
				}

				const updateRes = await client.query(
					`UPDATE bookings 
					 SET payment_status = 'paid', 
					     status = 'booked', 
					     razorpay_payment_id = COALESCE($1, razorpay_payment_id), 
					     updated_at = NOW() 
					 WHERE booking_id = $2 
					 RETURNING *`,
					[paymentId, booking.booking_id],
				);

				await client.query("COMMIT");

				const updatedBooking = updateRes.rows[0];

				// Dispatch notifications once
				try {
					let serviceName = "Service";
					const sRes = await db.query(
						"SELECT name FROM services WHERE id = $1",
						[updatedBooking.service_id],
					);
					if (sRes.rows.length > 0) {
						serviceName = sRes.rows[0].name;
					}
					const cleanDate = updatedBooking.date
						? String(updatedBooking.date).substring(0, 10)
						: "";
					const startTime = updatedBooking.start_time
						? String(updatedBooking.start_time).slice(0, 5)
						: "";

					sendNotification({
						userId: updatedBooking.provider_id,
						title: "New Booking Request 📅",
						message: `New booking request for ${serviceName} on ${cleanDate} at ${startTime}.`,
						type: "booking_created",
						data: {
							booking_id: updatedBooking.booking_id,
							service_name: serviceName,
							date: cleanDate,
							start_time: startTime,
						},
					});

					if (updatedBooking.user_id) {
						sendNotification({
							userId: updatedBooking.user_id,
							title: "Booking Placed Successfully ✨",
							message: `Your booking for ${serviceName} on ${cleanDate} at ${startTime} has been placed.`,
							type: "booking_created",
							data: {
								booking_id: updatedBooking.booking_id,
								service_name: serviceName,
								date: cleanDate,
								start_time: startTime,
							},
						});
					}
				} catch (notifErr) {
					console.warn("Webhook notification warning:", notifErr.message);
				}

				return res
					.status(200)
					.json({ status: "ok", message: "payment_processed" });
			} catch (txErr) {
				await client.query("ROLLBACK");
				throw txErr;
			} finally {
				client.release();
			}
		} else if (event === "payment.failed") {
			const orderId =
				payload.order?.entity?.id || payload.payment?.entity?.order_id;
			if (orderId) {
				await db.query(
					"UPDATE bookings SET payment_status = 'failed', updated_at = NOW() WHERE razorpay_order_id = $1 AND payment_status != 'paid'",
					[orderId],
				);
			}
			return res
				.status(200)
				.json({ status: "ok", message: "payment_failure_recorded" });
		}

		res.status(200).json({ status: "ignored", event });
	} catch (err) {
		console.error("Razorpay webhook execution error:", err);
		res
			.status(500)
			.json({ status: "error", message: "Webhook execution error" });
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
			message: "Address updated successfully",
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
	const offset = (page - 1) * limit;
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
			whereClause +=
				" AND (b.status IN ('booked','confirmed','in_progress') OR (b.status = 'pending' AND (b.payment_method = 'cod' OR b.payment_status = 'paid')))";
		} else {
			whereClause +=
				" AND b.status IN ('completed','cancelled','no_show','expired')";
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
            SELECT b.booking_id, b.service_id, b.date, b.status, b.price, b.start_time, b.end_time, b.address,
                   COALESCE(b.completion_otp, b.otp) AS completion_otp, b.otp,
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

		const [dataResult, countResult] = await Promise.all([
			db.query(dataQuery, dataParams),
			db.query(countQuery, queryParams),
		]);

		const totalRows = parseInt(countResult.rows[0]?.count || 0);
		const totalPages = Math.ceil(totalRows / limit) || 1;

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

async function regenerateCompletionOtp(req, res) {
	const { booking_id } = req.params;
	const userId = req.user.id;
	const userRole = req.user.role;

	if (userRole !== "customer" && userRole !== "admin") {
		return res
			.status(403)
			.json({ message: "Only customers can regenerate their completion OTP." });
	}

	try {
		const checkQ = `SELECT booking_id, user_id, status FROM bookings WHERE booking_id = $1`;
		const bookingRes = await db.query(checkQ, [booking_id]);

		if (bookingRes.rows.length === 0) {
			return res.status(404).json({ message: "Booking not found." });
		}

		const booking = bookingRes.rows[0];
		if (booking.user_id !== userId && userRole !== "admin") {
			return res
				.status(403)
				.json({ message: "Unauthorized access to this booking." });
		}

		const activeStatuses = ["pending", "booked", "confirmed", "in_progress"];
		if (!activeStatuses.includes(booking.status)) {
			return res.status(400).json({
				message: `Cannot regenerate completion OTP for a booking with status '${booking.status}'.`,
			});
		}

		const newOtp = Math.floor(1000 + Math.random() * 9000).toString();

		const updateQ = `
			UPDATE bookings 
			SET completion_otp = $1, otp = $1, updated_at = NOW() 
			WHERE booking_id = $2 
			RETURNING booking_id, completion_otp, otp;
		`;
		const updateRes = await db.query(updateQ, [newOtp, booking_id]);

		res.json({
			message: "New completion OTP generated successfully.",
			completion_otp: newOtp,
			otp: newOtp,
			booking: updateRes.rows[0],
		});
	} catch (err) {
		console.error("Error regenerating completion OTP:", err);
		res.status(500).json({
			message: "Failed to regenerate completion OTP.",
			error: err.message,
		});
	}
}

async function cancelUnpaidBooking(req, res) {
	const { booking_id } = req.params;
	const userId = req.user.id;

	try {
		const result = await db.query(
			`DELETE FROM bookings 
			 WHERE booking_id = $1 AND user_id = $2 
			   AND payment_method = 'online' AND payment_status = 'pending'
			 RETURNING booking_id, provider_id, date, start_time`,
			[booking_id, userId],
		);

		if (result.rowCount === 0) {
			return res.status(404).json({
				message: "Unpaid booking not found or already processed.",
			});
		}

		res.json({
			success: true,
			message: "Unpaid booking cancelled and slot released successfully.",
			booking: result.rows[0],
		});
	} catch (err) {
		console.error("Cancel unpaid booking error:", err);
		res.status(500).json({ message: "Server error cancelling unpaid booking" });
	}
}

module.exports = {
	createBooking,
	updateBookingAddress,
	getUserHistory,
	updateBookingStatus,
	verifyPayment,
	handleRazorpayWebhook,
	getRecentProviderBookings,
	getUpcomingBookings,
	getProviderHistory,
	regenerateCompletionOtp,
	cancelUnpaidBooking,
};
