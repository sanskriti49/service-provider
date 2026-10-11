const crypto = require("crypto");
const { BookingError, lockBooking, activeBookingPredicate } = require("../utils/bookingLifecycle");

function verifyHmac(secret, body, signature) {
	if (!secret || secret === "placeholder_secret" || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) return false;
	const expected = crypto.createHmac("sha256", secret).update(body).digest();
	return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
function amountInPaise(price) {
	const value = Number(price);
	if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new BookingError(400, "Invalid payment amount");
	return Math.round(value * 100);
}

function createPaymentService({ db, gateway, notify = async () => {} }) {
	async function requestRefund(client, booking, amount, key) {
		if (!Number.isSafeInteger(amount) || amount <= 0 || booking.payment_method !== "online" || !booking.razorpay_payment_id) throw new BookingError(409, "No captured online payment available for refund");
		const previous = await client.query("SELECT * FROM booking_refunds WHERE booking_id=$1 AND request_key=$2", [booking.booking_id, key]);
		if (previous.rows.length) {
			if (Number(previous.rows[0].amount_paise) !== amount) throw new BookingError(409, "Refund request already exists with a different amount");
			return previous.rows[0];
		}
		const reserved = await client.query("SELECT COALESCE(SUM(amount_paise),0) AS amount FROM booking_refunds WHERE booking_id=$1", [booking.booking_id]);
		if (Number(reserved.rows[0].amount) + amount > amountInPaise(booking.price)) throw new BookingError(409, "Refund exceeds the remaining captured amount");
		const result = await client.query(`INSERT INTO booking_refunds (booking_id, payment_id, amount_paise, request_key)
			VALUES ($1,$2,$3,$4) RETURNING *`, [booking.booking_id, booking.razorpay_payment_id, amount, key]);
		await client.query("UPDATE bookings SET payment_status='refund_pending', updated_at=NOW() WHERE booking_id=$1", [booking.booking_id]);
		return result.rows[0];
	}

	async function finalize(orderId, payment, actor) {
		const client = await db.connect();
		let result;
		try {
			await client.query("BEGIN");
			const lookup = await client.query("SELECT booking_id FROM bookings WHERE razorpay_order_id=$1", [orderId]);
			if (!lookup.rows.length) throw new BookingError(404, "Stored booking order not found");
			const booking = await lockBooking(client, lookup.rows[0].booking_id);
			if (actor && (actor.role !== "customer" || actor.id !== booking.user_id)) throw new BookingError(403, "Payment does not belong to this customer");
			if (booking.payment_method !== "online" || booking.razorpay_order_id !== orderId || payment.order_id !== orderId || payment.currency !== "INR" || payment.amount !== amountInPaise(booking.price)) throw new BookingError(409, "Payment must match the stored order, amount, currency and captured state");
			if (booking.razorpay_payment_id) {
				if (booking.razorpay_payment_id !== payment.id) throw new BookingError(409, "A different payment is already recorded for this order");
				await client.query("COMMIT");
				return { booking, duplicate: true };
			}
			if (payment.status !== "captured" || payment.captured !== true) throw new BookingError(409, "Payment is not captured");
			const expired = booking.hold_valid !== true;
			const conflict = await client.query(`SELECT booking_id FROM bookings WHERE provider_id=$1 AND date=$2::date AND booking_id<>$3
				AND ${activeBookingPredicate} AND start_time < $4::time AND end_time > $5::time LIMIT 1`,
				[booking.provider_id, booking.date_string, booking.booking_id, booking.end_time, booking.start_time]);
			// Expired/cancelled intents never regain a slot, even when it happens to be free.
			const late = booking.status !== "pending" || expired || conflict.rows.length > 0;
			const updated = await client.query(`UPDATE bookings SET razorpay_payment_id=$1, payment_status='paid',
				status=$2, updated_at=NOW() WHERE booking_id=$3 RETURNING *`,
				[payment.id, late ? (booking.status === "pending" ? "expired" : booking.status) : "booked", booking.booking_id]);
			result = { booking: updated.rows[0], duplicate: false, late };
			if (late) {
				await requestRefund(client, result.booking, payment.amount, "late-payment");
				result.booking.payment_status = "refund_pending";
			}
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK").catch(() => {});
			throw error;
		} finally { client.release(); }
		if (!result.late) await notify(result.booking).catch((error) => console.error("Payment notification failed:", error.message));
		return result;
	}

	async function verify(input, actor) {
		const { razorpay_order_id: order, razorpay_payment_id: paymentId, razorpay_signature: signature } = input;
		if (typeof order !== "string" || !/^order_[A-Za-z0-9]+$/.test(order) || typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !verifyHmac(process.env.RAZORPAY_KEY_SECRET, `${order}|${paymentId}`, signature)) throw new BookingError(400, "Invalid payment signature or identifiers");
		const owned = await db.query("SELECT user_id FROM bookings WHERE razorpay_order_id=$1", [order]);
		if (!owned.rows.length) throw new BookingError(404, "Stored booking order not found");
		if (actor.role !== "customer" || owned.rows[0].user_id !== actor.id) throw new BookingError(403, "Payment does not belong to this customer");
		return finalize(order, await gateway.payments.fetch(paymentId), actor);
	}

	async function syncRefund(client, intent, refund) {
		if (refund.payment_id !== intent.payment_id || refund.amount !== Number(intent.amount_paise)) throw new BookingError(409, "Refund does not match stored intent");
		const state = refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "processing";
		await client.query("BEGIN");
		try {
			const booking = await lockBooking(client, intent.booking_id);
			const current = await client.query("SELECT state FROM booking_refunds WHERE id=$1 FOR UPDATE", [intent.id]);
			if (current.rows[0].state === "processed") { await client.query("COMMIT"); return; }
			await client.query("UPDATE booking_refunds SET gateway_refund_id=$1, state=$2, updated_at=NOW() WHERE id=$3", [refund.id, state, intent.id]);
			const totals = await client.query(`SELECT COALESCE(SUM(amount_paise) FILTER (WHERE state='processed'),0) AS processed,
				COUNT(*) FILTER (WHERE state<>'processed') AS outstanding, COUNT(*) FILTER (WHERE state='failed') AS failures FROM booking_refunds WHERE booking_id=$1`, [intent.booking_id]);
			const total = Number(totals.rows[0].processed);
			const status = total >= amountInPaise(booking.price) ? "refunded" : Number(totals.rows[0].outstanding) > 0 ? (Number(totals.rows[0].failures) > 0 ? "refund_failed" : "refund_pending") : total > 0 ? "partially_refunded" : "paid";
			await client.query("UPDATE bookings SET payment_status=$1, updated_at=NOW() WHERE booking_id=$2", [status, intent.booking_id]);
			await client.query("COMMIT");
		} catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
	}

	async function reconcileRefund(id) {
		const client = await db.connect();
		try {
			const { rows } = await client.query("SELECT * FROM booking_refunds WHERE id=$1", [id]);
			const intent = rows[0];
			if (!intent || intent.state === "processed") return;
			let refund;
			if (intent.gateway_refund_id) refund = await gateway.refunds.fetch(intent.gateway_refund_id);
			else {
				// A lost HTTP response must be reconciled by receipt; never blindly issue twice.
				for (let skip = 0; !refund; skip += 100) {
					const page = await gateway.payments.fetchMultipleRefund(intent.payment_id, { count: 100, skip });
					refund = page.items.find((item) => item.receipt === intent.id);
					if (page.items.length < 100) break;
				}
				if (!refund && intent.state === "pending") {
					const claimed = await client.query("UPDATE booking_refunds SET state='submitting', updated_at=NOW() WHERE id=$1 AND state='pending' RETURNING id", [id]);
					if (!claimed.rows.length) return;
					refund = await gateway.payments.refund(intent.payment_id, { amount: Number(intent.amount_paise), receipt: intent.id, notes: { booking_id: intent.booking_id, request_key: intent.request_key } });
				}
				if (!refund) {
					await client.query("UPDATE booking_refunds SET state='unknown', last_error='Submission outcome uncertain; reconcile receipt or review in gateway dashboard', updated_at=NOW() WHERE id=$1 AND state IN ('submitting','unknown')", [id]);
					return;
				}
			}
			await syncRefund(client, intent, refund);
		} catch (error) {
			await client.query("UPDATE booking_refunds SET last_error=$2, updated_at=NOW() WHERE id=$1", [id, error.message.slice(0, 500)]).catch(() => {});
			throw error;
		} finally {
			client.release();
		}
	}

	async function reconcile() {
		const pending = await db.query(`SELECT razorpay_order_id FROM bookings WHERE payment_method='online'
			AND razorpay_order_id IS NOT NULL AND razorpay_payment_id IS NULL ORDER BY last_payment_check_at NULLS FIRST, created_at LIMIT 50`);
		for (const row of pending.rows) {
			try {
				const payments = await gateway.orders.fetchPayments(row.razorpay_order_id);
				for (const payment of payments.items) if (payment.status === "captured") await finalize(row.razorpay_order_id, payment);
			} catch (error) { console.error("Payment reconciliation failed:", error.message); }
			finally { await db.query("UPDATE bookings SET last_payment_check_at=NOW() WHERE razorpay_order_id=$1", [row.razorpay_order_id]); }
		}
		await db.query("UPDATE bookings SET status='expired', updated_at=NOW() WHERE status='pending' AND payment_method='online' AND hold_expires_at<=NOW() AND razorpay_payment_id IS NULL");
		const refunds = await db.query("SELECT id FROM booking_refunds WHERE state<>'processed' ORDER BY updated_at LIMIT 50");
		for (const row of refunds.rows) { try { await reconcileRefund(row.id); } catch (error) { console.error("Refund reconciliation failed:", error.message); } }
	}
	return { verify, finalize, requestRefund, reconcileRefund, reconcile };
}
module.exports = { createPaymentService, verifyHmac, amountInPaise };
