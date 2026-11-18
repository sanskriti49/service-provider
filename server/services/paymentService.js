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
	async function findOrder(intent) {
		const { items } = await gateway.orders.all({ receipt: intent.booking_id, count: 100 });
		const matches = items.filter((order) => order.receipt === intent.booking_id);
		if (matches.length > 1 || items.length >= 100) throw new Error("Order lookup is ambiguous");
		return matches[0];
	}

	async function initializeOrder({ bookingId, userId, requestHash, amount, createOrder }) {
		const inserted = await db.query(`INSERT INTO booking_order_intents (booking_id,user_id,request_hash,amount_paise,payment_method)
			VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`, [bookingId, userId, requestHash, amount, createOrder ? "online" : "cod"]);
		const intent = inserted.rows[0] || (await db.query("SELECT * FROM booking_order_intents WHERE booking_id=$1", [bookingId])).rows[0];
		if (!intent || intent.user_id !== userId || intent.request_hash !== requestHash) {
			throw new BookingError(409, "This booking attempt key was already used with different details");
		}
		if (!createOrder) return { orderId: null, requiresCheck: false };
		if (Number(intent.amount_paise) !== amount) throw new BookingError(409, "The price changed. Start a new booking attempt.");
		if (intent.order_id) return { orderId: intent.order_id, requiresCheck: true };
		try {
			// Look up the receipt first after an uncertain POST. If still absent, only
			// one request can retry after cooldown, using Razorpay's same unique receipt.
			let order = inserted.rows.length ? null : await findOrder(intent);
			const foundByReceipt = Boolean(order);
			if (!order) {
				const maySubmit = inserted.rows.length || (await db.query(`UPDATE booking_order_intents
					SET last_create_at=clock_timestamp() WHERE booking_id=$1 AND order_id IS NULL
					AND created_at >= NOW()-INTERVAL '7 days' AND last_create_at < NOW()-INTERVAL '30 seconds'
					RETURNING booking_id`, [bookingId])).rowCount;
				if (maySubmit) order = await createOrder({ amount, currency: "INR", receipt: bookingId, partial_payment: false });
			}
			if (!order?.id || order.receipt !== bookingId || order.amount !== amount || order.currency !== "INR") {
				throw new Error("Order could not be verified by receipt");
			}
			await db.query("UPDATE booking_order_intents SET order_id=$2 WHERE booking_id=$1 AND (order_id IS NULL OR order_id=$2)", [bookingId, order.id]);
			return { orderId: order.id, requiresCheck: foundByReceipt };
		} catch {
			console.warn(JSON.stringify({ event: "booking_order_initialization_pending" }));
			throw new BookingError(503, "Payment setup is being checked. Retry this same booking attempt.");
		}
	}

	async function inspectOrder(booking) {
		const orderId = booking.razorpay_order_id;
		if (!orderId) return { canRetry: false, recovered: 0 };
		const order = await gateway.orders.fetch(orderId);
		const payments = await gateway.orders.fetchPayments(orderId);
		if (order.id !== orderId || order.currency !== "INR" || order.amount !== amountInPaise(booking.price) ||
			!Number.isInteger(order.attempts) || order.attempts < 0 || !Array.isArray(payments.items) ||
			payments.items.some((payment) => payment.order_id !== orderId)) {
			throw new Error("Gateway order and payments could not be verified");
		}
		let recovered = 0;
		const captures = payments.items.filter((payment) => payment.status === "captured")
			.sort((left, right) => (left.created_at || 0) - (right.created_at || 0) || String(left.id).localeCompare(String(right.id)));
		for (const payment of captures) {
			const result = await finalize(orderId, payment);
			if (!result.duplicate) recovered++;
		}
		const canRetry = ["created", "attempted"].includes(order.status) && order.amount_paid === 0 &&
			payments.items.every((payment) => payment.status === "failed" && payment.captured === false) &&
			new Set(payments.items.map((payment) => payment.id)).size === order.attempts &&
			payments.items.length === order.attempts;
		return { canRetry, recovered };
	}

	async function requestRefund(client, booking, amount, key) {
		if (!Number.isSafeInteger(amount) || amount <= 0 || booking.payment_method !== "online" || !booking.razorpay_payment_id) throw new BookingError(409, "No captured online payment available for refund");
		const previous = await client.query("SELECT * FROM booking_refunds WHERE booking_id=$1 AND request_key=$2", [booking.booking_id, key]);
		if (previous.rows.length) {
			if (Number(previous.rows[0].amount_paise) !== amount) throw new BookingError(409, "Refund request already exists with a different amount");
			return previous.rows[0];
		}
		const reserved = await client.query("SELECT COALESCE(SUM(amount_paise),0) AS amount FROM booking_refunds WHERE booking_id=$1 AND payment_id=$2", [booking.booking_id, booking.razorpay_payment_id]);
		if (Number(reserved.rows[0].amount) + amount > amountInPaise(booking.price)) throw new BookingError(409, "Refund exceeds the remaining captured amount");
		const result = await client.query(`INSERT INTO booking_refunds (booking_id, payment_id, amount_paise, request_key)
			VALUES ($1,$2,$3,$4) RETURNING *`, [booking.booking_id, booking.razorpay_payment_id, amount, key]);
		if (!key.startsWith("extra-payment:")) await client.query("UPDATE bookings SET payment_status='refund_pending', updated_at=NOW() WHERE booking_id=$1", [booking.booking_id]);
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
				if (booking.razorpay_payment_id !== payment.id) {
					if (payment.status !== "captured" || payment.captured !== true) throw new BookingError(409, "Payment is not captured");
					await requestRefund(client, { ...booking, razorpay_payment_id: payment.id }, payment.amount, `extra-payment:${payment.id}`);
					await client.query("COMMIT");
					return { booking, duplicate: true, late: true };
				}
				await client.query("COMMIT");
				return { booking, duplicate: true };
			}
			if (payment.status !== "captured" || payment.captured !== true) throw new BookingError(409, "Payment is not captured");
			const expired = booking.hold_valid !== true;
			const conflict = await client.query(`SELECT booking_id FROM bookings WHERE provider_id=$1 AND date=$2::date AND booking_id<>$3
				AND ${activeBookingPredicate} AND start_time < $4::time AND end_time > $5::time LIMIT 1`,
				[booking.provider_id, booking.date_string, booking.booking_id, booking.end_time, booking.start_time]);
			// Expired/cancelled intents never regain a slot, even when it happens to be free.
			// Razorpay timestamps are whole seconds. Refuse to use a payment from before
			// the renewed hold, including the renewal second when ordering is ambiguous.
			const predatesRenewal = booking.renewed_hold_at && (!Number.isSafeInteger(payment.created_at) ||
				payment.created_at <= Math.floor(new Date(booking.renewed_hold_at).getTime() / 1000));
			let late = booking.status !== "pending" || expired || predatesRenewal || conflict.rows.length > 0;
			if (!late) {
				try {
					await require("./bookingSchedule").validateLocationChange(client, { ...booking, date: booking.date_string });
				} catch (error) {
					if (![400, 409, 503].includes(error.status)) throw error;
					// Account for the captured money even when the location/travel check fails.
					// The existing idempotent refund flow handles the unsafe reservation.
					late = true;
				}
				const validity = await client.query("SELECT (hold_expires_at > clock_timestamp()) AS hold_valid FROM bookings WHERE booking_id=$1", [booking.booking_id]);
				late ||= validity.rows[0].hold_valid !== true;
			}
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
		if (!refund?.id || refund.payment_id !== intent.payment_id || refund.amount !== Number(intent.amount_paise) ||
			!["pending", "processed", "failed"].includes(refund.status)) throw new BookingError(409, "Refund does not match stored intent");
		const state = refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "processing";
		await client.query("BEGIN");
		try {
			const booking = await lockBooking(client, intent.booking_id);
			const current = await client.query("SELECT state FROM booking_refunds WHERE id=$1 FOR UPDATE", [intent.id]);
			if (current.rows[0].state === "processed") { await client.query("COMMIT"); return; }
			await client.query("UPDATE booking_refunds SET gateway_refund_id=$1, state=$2, updated_at=NOW() WHERE id=$3", [refund.id, state, intent.id]);
			if (intent.payment_id !== booking.razorpay_payment_id) {
				await client.query("COMMIT");
				return;
			}
			const totals = await client.query(`SELECT COALESCE(SUM(amount_paise) FILTER (WHERE state='processed'),0) AS processed,
				COUNT(*) FILTER (WHERE state<>'processed') AS outstanding, COUNT(*) FILTER (WHERE state='failed') AS failures
				FROM booking_refunds WHERE booking_id=$1 AND payment_id=$2`, [intent.booking_id, intent.payment_id]);
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
					if (skip >= 1000) throw new BookingError(503, "Refund receipt lookup needs manual review");
					const page = await gateway.payments.fetchMultipleRefund(intent.payment_id, { count: 100, skip });
					refund = page.items.find((item) => item.receipt === intent.id);
					if (page.items.length < 100) break;
				}
				if (!refund && intent.state === "pending") {
					const claimed = await client.query("UPDATE booking_refunds SET state='submitting', updated_at=NOW() WHERE id=$1 AND state='pending' RETURNING id", [id]);
					if (!claimed.rows.length) return false;
					refund = await gateway.payments.refund(intent.payment_id, { amount: Number(intent.amount_paise), receipt: intent.id, notes: { booking_id: intent.booking_id, request_key: intent.request_key } });
				}
				if (!refund) {
					await client.query("UPDATE booking_refunds SET state='unknown', last_error='Submission outcome uncertain; reconcile receipt or review in gateway dashboard', updated_at=NOW() WHERE id=$1 AND state IN ('submitting','unknown')", [id]);
					return false;
				}
			}
			await syncRefund(client, intent, refund);
		} catch (error) {
			await client.query("UPDATE booking_refunds SET last_error='Gateway refund check failed', updated_at=NOW() WHERE id=$1 AND state<>'processed'", [id]).catch(() => {});
			throw error;
		} finally {
			client.release();
		}
	}

	async function reconcile() {
		const token = crypto.randomUUID();
		let acquired = false;
		let failed = false;
		const stats = { paymentChecks: 0, capturesRecovered: 0, holdsExpired: 0, gatewayFailures: 0, orderIntentsRecovered: 0 };
		try {
			const claim = await db.query(`INSERT INTO booking_reconciliation_health (lease_token,lease_until)
				VALUES ($1, NOW() + INTERVAL '2 minutes') ON CONFLICT (singleton) DO UPDATE
				SET lease_token=$1, lease_until=EXCLUDED.lease_until
				WHERE booking_reconciliation_health.lease_until IS NULL OR booking_reconciliation_health.lease_until < NOW()
				RETURNING singleton`, [token]);
			acquired = claim.rowCount === 1;
			if (!acquired) return { skipped: true };
			const renewLease = async () => {
				const renewed = await db.query(`UPDATE booking_reconciliation_health SET lease_until=NOW()+INTERVAL '2 minutes'
					WHERE lease_token=$1 AND lease_until > NOW()`, [token]);
				return renewed.rowCount === 1;
			};
			const expired = await db.query("UPDATE bookings SET status='expired', updated_at=NOW() WHERE status='pending' AND payment_method='online' AND hold_expires_at<=clock_timestamp() AND razorpay_payment_id IS NULL");
			stats.holdsExpired = expired.rowCount;
			const pending = await db.query(`SELECT booking_id, razorpay_order_id, price FROM bookings
				WHERE payment_method='online' AND razorpay_order_id IS NOT NULL
				AND (razorpay_payment_id IS NULL OR created_at >= NOW() - INTERVAL '7 days')
				AND (next_payment_check_at IS NULL OR next_payment_check_at <= NOW())
				ORDER BY COALESCE(next_payment_check_at, created_at), booking_id LIMIT 50`);
			for (const row of pending.rows) {
				if (!await renewLease()) return { skipped: true };
				try {
					const result = await inspectOrder(row);
					stats.paymentChecks++;
					stats.capturesRecovered += result.recovered;
					await db.query(`UPDATE bookings SET last_payment_check_at=NOW(), payment_check_failures=0,
						next_payment_check_at=NOW() + CASE
							WHEN razorpay_payment_id IS NOT NULL THEN INTERVAL '1 hour'
							WHEN status IN ('expired','cancelled') AND created_at < NOW()-INTERVAL '1 day' THEN INTERVAL '1 day'
							ELSE INTERVAL '30 seconds' END WHERE booking_id=$1`, [row.booking_id]);
				} catch {
					stats.gatewayFailures++;
					await db.query(`UPDATE bookings SET payment_check_failures=LEAST(payment_check_failures+1, 10),
						next_payment_check_at=NOW() + INTERVAL '30 seconds' * power(2, LEAST(payment_check_failures, 7))
						WHERE booking_id=$1`, [row.booking_id]);
				}
			}
			const refunds = await db.query(`SELECT id FROM booking_refunds WHERE state<>'processed'
				AND (state='pending' OR updated_at < NOW() - CASE WHEN state IN ('failed','unknown')
					THEN INTERVAL '15 minutes' ELSE INTERVAL '1 minute' END) ORDER BY updated_at, id LIMIT 50`);
			for (const row of refunds.rows) {
				if (!await renewLease()) return { skipped: true };
				try { await reconcileRefund(row.id); }
				catch { stats.gatewayFailures++; }
			}
			const intents = await db.query(`SELECT booking_id, amount_paise FROM booking_order_intents
				WHERE payment_method='online' AND order_id IS NULL AND created_at >= NOW()-INTERVAL '7 days'
				AND next_lookup_at <= NOW() AND last_create_at < NOW()-INTERVAL '30 seconds'
				ORDER BY next_lookup_at LIMIT 10`);
			for (const intent of intents.rows) {
				if (!await renewLease()) return { skipped: true };
				try {
					const order = await findOrder(intent);
					if (order) {
						if (!order.id || order.amount !== Number(intent.amount_paise) || order.currency !== "INR") throw new Error("Order mismatch");
						const saved = await db.query("UPDATE booking_order_intents SET order_id=$2 WHERE booking_id=$1 AND order_id IS NULL", [intent.booking_id, order.id]);
						stats.orderIntentsRecovered += saved.rowCount;
					}
				} catch { stats.gatewayFailures++; }
				await db.query("UPDATE booking_order_intents SET next_lookup_at=NOW()+INTERVAL '15 minutes' WHERE booking_id=$1 AND order_id IS NULL", [intent.booking_id]);
			}
			return stats;
		} catch (error) {
			failed = true;
			throw error;
		} finally {
			if (acquired) {
				await db.query(`UPDATE booking_reconciliation_health SET
					last_success_at=CASE WHEN NOT $5 THEN NOW() ELSE last_success_at END,
					last_failure_at=CASE WHEN $5 THEN NOW() ELSE last_failure_at END,
					payment_checks=payment_checks+$1, captures_recovered=captures_recovered+$2,
					holds_expired=holds_expired+$3, gateway_failures=gateway_failures+$4,
					lease_token=NULL, lease_until=NULL WHERE lease_token=$6`,
					[stats.paymentChecks, stats.capturesRecovered, stats.holdsExpired, stats.gatewayFailures,
						failed || stats.gatewayFailures > 0, token]);
				console.info(JSON.stringify({ event: "booking_reconciliation_finished", failed: failed || stats.gatewayFailures > 0, ...stats }));
			}
		}
	}
	return { initializeOrder, inspectOrder, verify, finalize, requestRefund, reconcileRefund, reconcile };
}
module.exports = { createPaymentService, verifyHmac, amountInPaise };
