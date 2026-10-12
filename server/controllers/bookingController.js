const Razorpay = require("razorpay");
const crypto = require("crypto");
const db = require("../config/db");
const eventQueue = require("../utils/eventQueue");
const { bookingsTotal } = require("../utils/metrics");
const { getPriceDetails } = require("../utils/pricing");
const { sendNotification } = require("../utils/notificationService");
const { acquireLock, releaseLock } = require("../utils/distributedLock");
const { createProtectedBreaker } = require("../utils/circuitBreaker");

const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
	? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
	: { orders: { create: async () => { throw new BookingError(503, "Online payments are not configured"); } } };

if (razorpay.api?.rq) razorpay.api.rq.defaults.timeout = 8000;

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

const { BookingError, assertTransition, serializeBooking, generateOtp, lockBooking } = require("../utils/bookingLifecycle");
const { createPaymentService, verifyHmac, amountInPaise } = require("../services/paymentService");
const paymentService = createPaymentService({ db, gateway: razorpay, notify: async (booking) => {
    await sendNotification({ userId: booking.provider_id, title: "New paid booking", message: "A payment was captured for your booking.", type: "booking_created", data: { booking_id: booking.booking_id } });
    await sendNotification({ userId: booking.user_id, title: "Booking paid", message: "Your payment was captured and your slot reserved.", type: "booking_created", data: { booking_id: booking.booking_id } });
} });
function respondError(res, error) { if (!error.status) console.error("Booking operation failed:", error.code || error.name, error.message); return res.status(error.status || 500).json({ message: error.status ? error.message : "Operation failed. Please retry." }); }
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

async function createBooking(req, res) {
    const Joi = require("joi");
    const schema = Joi.object({
        provider_id: Joi.string().required(), service_id: Joi.string().required(),
        date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/).required(),
        start_time: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d(?::00)?$/).required(),
        end_time: Joi.string().optional(), address: Joi.string().trim().min(5).max(1000).required(),
        payment_method: Joi.string().valid("online", "cod", "cash").default("cod"),
        latitude: Joi.number().min(-90).max(90).allow(null), longitude: Joi.number().min(-180).max(180).allow(null),
        price: Joi.any().strip(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });
    if (value.payment_method === "online" && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET === "placeholder_secret")) return res.status(503).json({ message: "Online payments are not configured" });
    const providerId = await resolveProviderId(db, value.provider_id);
    if (!providerId) return res.status(404).json({ message: "Provider not found" });
    const date = value.date.slice(0, 10);
    const lock = await acquireLock(`booking:provider:${providerId}:${date}`, 15000);
    if (!lock.acquired) return res.status(409).json({ message: "Provider is being reserved. Please retry." });
    let client;
    try {
        client = await db.connect();
        await client.query("BEGIN");
        const { lockSchedule } = require("../utils/bookingLifecycle");
        await lockSchedule(client, providerId, date);
        const booking = { ...value, provider_id: providerId, date, start_time: value.start_time.slice(0,5) };
        const selected = await require("../services/bookingSchedule").validateSchedule(client, booking);
        const amount = amountInPaise(selected.price);
        const id = crypto.randomUUID();
        const arrivalCode = generateOtp();
        let completionCode;
        do { completionCode = generateOtp(); } while (completionCode === arrivalCode);
        let orderId = null;
        if (value.payment_method === "online") {
            // Never manufacture a successful order when the provider fails.
            const order = await razorpayOrderBreaker.fire({ amount, currency: "INR", receipt: id });
            if (!order.id || order.amount !== amount || order.currency !== "INR") throw new BookingError(502, "Gateway order did not match booking");
            orderId = order.id;
        }
        const result = await client.query(`INSERT INTO bookings (booking_id,provider_id,user_id,service_id,date,start_time,end_time,status,address,price,payment_method,payment_status,razorpay_order_id,otp,completion_otp,latitude,longitude,hold_expires_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10,'pending',$11,$12,$13,$14,$15,CASE WHEN $10::varchar='online' THEN clock_timestamp()+INTERVAL '5 minutes' ELSE NULL END) RETURNING *`,
            [id,providerId,req.user.id,selected.service_id,date,booking.start_time,booking.end_time,value.address,amount/100,value.payment_method === "cash" ? "cod" : value.payment_method,orderId,arrivalCode,completionCode,value.latitude ?? null,value.longitude ?? null]);
        await client.query("COMMIT");
        client.release(); client = null;
        if (value.payment_method !== "online") {
            await Promise.allSettled([
                sendNotification({ userId: providerId, title: "New booking request", message: "A customer has requested a service.", type: "booking_created", data: { booking_id: id } }),
                sendNotification({ userId: req.user.id, title: "Booking placed", message: "Your booking request was placed.", type: "booking_created", data: { booking_id: id } }),
            ]);
        }
        return res.status(201).json({ booking: serializeBooking(result.rows[0], req.user), razorpay_order: orderId });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => {});
        return respondError(res, error);
    } finally { if (client) client.release(); await releaseLock(lock.key, lock.token); }
}

async function updateBookingStatus(req, res) {
    const { status, otp_provided } = req.body;
    let client = await db.connect();
    try {
        await client.query("BEGIN");
        const booking = await lockBooking(client, req.params.booking_id);
        assertTransition(booking, req.user, status);
        const clock = await client.query("SELECT ($1::date + $2::time) AT TIME ZONE 'Asia/Kolkata' AS starts_at", [booking.date_string, booking.start_time]);
        const startsAt = new Date(clock.rows[0].starts_at).getTime();
        const hoursUntil = (startsAt - Date.now()) / 3600000;
        let refundPercentage = 0;
        if (status === "no_show") {
            if (Date.now() < startsAt + 20 * 60000) throw new BookingError(409, "Wait 20 minutes after service start to report no-show");
            if (req.user.role === "customer") refundPercentage = 100;
        }
        if (status === "cancelled") {
            if (req.user.role === "provider" && booking.status !== "pending" && hoursUntil < 2) throw new BookingError(409, "Too late to cancel; contact support");
            refundPercentage = req.user.role === "customer" && booking.status !== "pending" && hoursUntil < 2 ? 80 : 100;
        }
        if (["in_progress", "completed"].includes(status)) {
            if (status === "in_progress" && Date.now() < startsAt - 15 * 60000) throw new BookingError(409, "Service cannot start more than 15 minutes early");
            const expected = status === "completed" ? booking.completion_otp : booking.otp;
            const supplied = String(otp_provided || req.body.otp || req.body.completion_otp || "").trim();
            if (!/^\d{4}$/.test(supplied) || !expected || supplied !== expected) throw new BookingError(400, "Invalid service verification code");
        }
        let paymentStatus = booking.payment_status;
        if (refundPercentage > 0 && booking.payment_method === "online" && booking.payment_status === "paid") {
            await paymentService.requestRefund(client, booking, Math.round(amountInPaise(booking.price) * refundPercentage / 100), "cancellation");
            paymentStatus = "refund_pending";
        } else if (status === "completed" && booking.payment_method === "cod") paymentStatus = "paid";
        const updated = await client.query("UPDATE bookings SET status=$1,payment_status=$2,action_by=$3,updated_at=NOW() WHERE booking_id=$4 RETURNING *", [status,paymentStatus,req.user.role,booking.booking_id]);
        await client.query("COMMIT");
        client.release(); client = null;
        bookingsTotal.inc({ status });
        const recipient = req.user.id === booking.user_id ? booking.provider_id : booking.user_id;
        await sendNotification({ userId: recipient, title: "Booking updated", message: `Booking status: ${status}.${paymentStatus === "refund_pending" ? " Refund awaits gateway confirmation." : ""}`, type: "booking_status", data: { booking_id: booking.booking_id, status, payment_status: paymentStatus } }).catch((error) => console.error("Status notification failed:", error.message));
        await queueStatusEmails(booking, status, paymentStatus);
        return res.json({ message: "Booking updated", booking: serializeBooking(updated.rows[0], req.user) });
    } catch (error) { if (client) await client.query("ROLLBACK").catch(() => {}); return respondError(res, error); }
    finally { if (client) client.release(); }
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

async function queueStatusEmails(booking, status, paymentStatus) {
    try {
        const contacts = await db.query("SELECT email FROM users WHERE id IN ($1,$2)", [booking.user_id,booking.provider_id]);
        for (const contact of contacts.rows) eventQueue.publish("SEND_EMAIL", {
            email: contact.email, subject: `TaskGenie booking ${status}`,
            message: `Booking ${booking.booking_id} is now ${status}. Payment status: ${paymentStatus}. Refunds are complete only after gateway confirmation.`,
        });
    } catch (error) { console.error("Status email enqueue failed:", error.message); }
}

async function verifyPayment(req, res) {
    try {
        const result = await paymentService.verify(req.body, req.user);
        return res.json({ success: true, booking: serializeBooking(result.booking, req.user), already_paid: result.duplicate, refund_pending: result.late || ["expired", "cancelled"].includes(result.booking.status) || result.booking.payment_status.startsWith("refund") });
    } catch (error) { return respondError(res, error); }
}

async function handleRazorpayWebhook(req, res) {
    if (!req.rawBody || !verifyHmac(process.env.RAZORPAY_WEBHOOK_SECRET, req.rawBody, req.headers["x-razorpay-signature"])) return res.status(400).json({ message: "Invalid webhook signature" });
    try {
        const event = req.body?.event;
        const payload = req.body?.payload;
        if (["order.paid", "payment.captured"].includes(event)) {
            const id = payload?.payment?.entity?.id;
            if (!id) throw new BookingError(400, "Missing payment ID");
            const payment = await razorpay.payments.fetch(id);
            await paymentService.finalize(payment.order_id, payment);
        } else if (["refund.created", "refund.processed", "refund.failed"].includes(event)) {
            const refund = payload?.refund?.entity;
            const intents = await db.query("SELECT id FROM booking_refunds WHERE gateway_refund_id=$1 OR id::text=$2", [refund?.id, refund?.receipt || ""]);
            for (const intent of intents.rows) await paymentService.reconcileRefund(intent.id);
        }
        // A failed payment attempt does not release an unexpired hold or overwrite capture.
        return res.json({ status: "ok" });
    } catch (error) { return respondError(res, error); }
}

async function updateBookingAddress(req, res) {
    const { address, latitude, longitude } = req.body;
    if (typeof address !== "string" || !address.trim() || address.length > 1000 || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) return res.status(400).json({ message: "Address and valid coordinates required to verify travel availability" });
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const booking = await lockBooking(client, req.params.booking_id);
        if (booking.user_id !== req.user.id) throw new BookingError(403, "Access denied");
        if (!["pending", "booked", "confirmed"].includes(booking.status) || Date.now() - new Date(booking.created_at).getTime() > TIME_LIMIT_MINUTES * 60000) throw new BookingError(409, "Address edit window has closed");
        const service = await client.query("SELECT name FROM services WHERE id=$1", [booking.service_id]);
        await require("../services/bookingSchedule").assertNoConflicts(client, { ...booking, date: booking.date_string, latitude, longitude }, getPriceDetails(service.rows[0]?.name));
        await client.query("UPDATE bookings SET address=$1,latitude=$2,longitude=$3,updated_at=NOW() WHERE booking_id=$4", [address.trim(),latitude,longitude,booking.booking_id]);
        await client.query("COMMIT");
        return res.json({ address: address.trim(), message: "Address and travel availability updated" });
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); return respondError(res, error); }
    finally { client.release(); }
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
            SELECT b.booking_id, b.service_id, b.date, b.status, b.price, b.start_time, b.end_time, b.address, b.payment_status, b.payment_method,
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

	if (userRole !== "customer") {
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
		if (booking.user_id !== userId) {
			return res
				.status(403)
				.json({ message: "Unauthorized access to this booking." });
		}

		const activeStatuses = ["booked", "confirmed", "in_progress"];
		if (!activeStatuses.includes(booking.status)) {
			return res.status(400).json({
				message: `Cannot regenerate completion OTP for a booking with status '${booking.status}'.`,
			});
		}

		const newOtp = generateOtp();

		const updateQ = `
			UPDATE bookings
			SET completion_otp = $1, updated_at = NOW()
			WHERE booking_id = $2 AND user_id = $3 AND status IN ('booked','confirmed','in_progress')
			RETURNING booking_id, completion_otp;
		`;
		const updateRes = await db.query(updateQ, [newOtp, booking_id, userId]);

		if (!updateRes.rows.length) return res.status(409).json({ message: "Booking state changed" });
		res.json({
			message: "New completion OTP generated successfully.",
			completion_otp: newOtp,
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
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const booking = await lockBooking(client, req.params.booking_id);
        if (booking.user_id !== req.user.id) throw new BookingError(403, "Access denied");
        if (booking.payment_method !== "online" || booking.razorpay_payment_id) throw new BookingError(409, "Payment already processed; use cancellation instead");
        if (!["pending", "expired", "cancelled"].includes(booking.status)) throw new BookingError(409, "Cannot release this booking");
        const result = await client.query("UPDATE bookings SET status='cancelled', hold_expires_at=NOW(), updated_at=NOW() WHERE booking_id=$1 RETURNING *", [booking.booking_id]);
        await client.query("COMMIT");
        return res.json({ success: true, message: "Slot released; payment intent retained for reconciliation", booking: serializeBooking(result.rows[0], req.user) });
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); return respondError(res, error); }
    finally { client.release(); }
}

module.exports = {
	paymentService,
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
