const Joi = require("joi");
const db = require("../config/db");
const schedule = require("../services/bookingSchedule");
const { BookingError, generateOtp, lockSchedule } = require("../utils/bookingLifecycle");
const { validCoordinates, validDate, DEFAULT_RADIUS_KM } = require("../utils/location");
const { calculateHaversineDistance } = require("../utils/geoUtils");
const { amountInPaise } = require("../services/paymentService");
const { sendNotification, emitNotification } = require("../utils/notificationService");

const uuid = Joi.string().guid();
const dateField = Joi.string().custom(validDate);
const selection = Joi.object({
	provider_id: uuid.required(),
	date: dateField.required(),
	start_time: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/).required(),
	approved_price_paise: Joi.number().integer().positive().max(999999999999).strict().required(),
});

const originals = `SELECT b.*, TO_CHAR(b.date,'YYYY-MM-DD') AS date_string, u.name AS provider_name,
	s.name AS service_name, r.booking_id AS replacement_id, r.status AS replacement_status,
	ru.name AS replacement_provider_name, r.replacement_offered AS replacement_can_retry
	FROM bookings b JOIN users u ON u.id=b.provider_id
	LEFT JOIN services s ON s.id=b.service_id
	LEFT JOIN bookings r ON r.replaces_booking_id=b.booking_id AND r.user_id=b.user_id
	LEFT JOIN users ru ON ru.id=r.provider_id
	WHERE b.user_id=$1 AND b.replacement_offered AND b.status='cancelled' AND b.action_by='provider'`;

async function originalFor(connection, userId, bookingId) {
	const { rows } = await connection.query(`${originals} AND b.booking_id=$2`, [userId, bookingId]);
	if (!rows.length) throw new BookingError(404, "Booking recovery is unavailable for this booking.");
	return rows[0];
}

function summarize(b) {
	return {
		booking_id: b.booking_id, date: b.date_string, start_time: b.start_time.slice(0, 5),
		provider_name: b.provider_name, service_name: b.service_name, cancellation_reason: b.cancellation_reason,
		price_paise: b.price == null ? null : Math.round(Number(b.price) * 100),
		payment_method: b.payment_method, payment_status: b.payment_status,
		replacement_id: b.replacement_id, replacement_status: b.replacement_status,
		replacement_provider_name: b.replacement_provider_name,
		replacement_can_retry: b.replacement_can_retry === true,
	};
}

async function previousProviders(connection, booking) {
	const { rows } = await connection.query(`WITH RECURSIVE previous(booking_id, replaces_booking_id, provider_id) AS (
		SELECT booking_id, replaces_booking_id, provider_id FROM bookings WHERE booking_id=$1 AND user_id=$2
		UNION
		SELECT b.booking_id, b.replaces_booking_id, b.provider_id FROM bookings b
		JOIN previous p ON p.replaces_booking_id=b.booking_id WHERE b.user_id=$2
	) SELECT DISTINCT provider_id FROM previous`, [booking.booking_id, booking.user_id]);
	return rows.map(row => row.provider_id);
}

function dateWindow(b) {
	const min = schedule.indiaDate();
	const preferred = b.date_string < min ? min : b.date_string;
	const end = new Date(`${preferred}T00:00:00Z`);
	end.setUTCDate(end.getUTCDate() + 13);
	return { min, preferred, max: end.toISOString().slice(0, 10) };
}

function schedulingDetails(b) {
	if (!b.service_id || !b.address || !validCoordinates(b.latitude, b.longitude)) {
		throw new BookingError(409, "This booking is missing service or location details. Book a new service with a confirmed address.");
	}
	return {
		service_id: b.service_id, latitude: b.latitude, longitude: b.longitude,
		radius: b.search_radius_km ?? DEFAULT_RADIUS_KM,
	};
}

async function paymentBlock(connection, b) {
	if (b.payment_method === "cod" && b.payment_status === "pending" &&
		!b.razorpay_order_id && !b.razorpay_payment_id) return null;
	if (b.payment_method === "online" && b.payment_status === "refunded" && b.razorpay_payment_id) {
		const { rows } = await connection.query(`SELECT COALESCE(SUM(amount_paise),0) AS total
			FROM booking_refunds WHERE booking_id=$1 AND payment_id=$2 AND state='processed'`,
			[b.booking_id, b.razorpay_payment_id]);
		if (Number(rows[0].total) >= amountInPaise(b.price)) return null;
	}
	return b.payment_method === "online"
		? "Wait for the full refund to be confirmed before reserving a replacement. Check the original payment in Refunds below."
		: "This booking's payment needs review before a replacement can be reserved.";
}

function replyError(res, error) {
	if (error.code === "23P01") return res.status(409).json({ message: "That slot was just taken. Refresh the options or try another time." });
	if (!error.status) console.error("Booking replacement failed:", error.code || error.name, error.message);
	return res.status(error.status || 500).json({ message: error.status ? error.message : "Unable to complete booking recovery. Please try again." });
}

async function listReplacements(req, res) {
	try {
		const { rows } = await db.query(`${originals}
			ORDER BY (r.booking_id IS NULL) DESC, b.date DESC, b.booking_id LIMIT 20`, [req.user.id]);
		return res.json({ items: rows.map(summarize) });
	} catch (error) { return replyError(res, error); }
}

async function replacementOptions(req, res) {
	const id = uuid.validate(req.params.booking_id);
	const date = dateField.validate(req.query.date);
	if (id.error || date.error) return res.status(400).json({ message: "Choose a valid booking and date." });
	try {
		const booking = await originalFor(db, req.user.id, id.value);
		const window = dateWindow(booking);
		const response = { original: summarize(booking), window, options: [] };
		if (booking.replacement_id) return res.json(response);
		const from = date.value || window.preferred;
		if (from < window.min || from > window.max) throw new BookingError(400, "Choose a date within the displayed range.");
		const details = schedulingDetails(booking);
		response.payment_block = await paymentBlock(db, booking);
		const preferred = from === booking.date_string ? booking.start_time.slice(0, 5) : undefined;
		const { rows } = await db.query(`SELECT u.id, u.name, u.lat, u.lng, ps.price
			FROM provider_services ps JOIN providers p ON p.user_id=ps.provider_id JOIN users u ON u.id=p.user_id
			WHERE ps.service_id=$1 AND ps.is_visible AND ps.price>0 AND p.status='approved' AND u.role='provider'
			AND u.id<>ALL($2::uuid[]) AND u.lat BETWEEN $3::float8 - $4::float8/110 AND $3::float8 + $4::float8/110`,
			[booking.service_id, await previousProviders(db, booking), details.latitude, details.radius]);
		const candidates = rows.map(provider => ({
			...provider, distance: calculateHaversineDistance(details.latitude, details.longitude, provider.lat, provider.lng),
		})).filter(p => p.distance != null && p.distance <= details.radius)
			.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
		let routingUnavailable = false;
		const nearby = candidates.slice(0, 24);
		for (let i = 0; i < nearby.length; i += 4) {
			const batch = await Promise.all(nearby.slice(i, i + 4).map(async provider => {
				try {
					const [day] = await schedule.getAvailability(db, {
						...details, provider_id: provider.id, from, days: 1, preferredStart: preferred,
					});
					const slots = day.free_slots.map(slot => ({
						start: slot.start, end: slot.end, same_time: slot.start === preferred,
					}));
					if (slots.length) return { provider_id: provider.id, name: provider.name, price_paise: amountInPaise(provider.price), slots };
				} catch (error) {
					if (error.status === 503) routingUnavailable = true;
					else if (![400, 409].includes(error.status)) throw error;
				}
				return null;
			}));
			response.options.push(...batch.filter(Boolean));
			if (response.options.filter(p => p.slots.some(s => s.same_time)).length >= 6) break;
		}
		if (!response.options.length && routingUnavailable) throw new BookingError(503, "Travel availability could not be checked. Please try again.");
		response.options.sort((a, b) => Number(b.slots.some(s => s.same_time)) - Number(a.slots.some(s => s.same_time)));
		response.options = response.options.slice(0, 6);
		return res.json({ ...response, date: from, partial: routingUnavailable || candidates.length > nearby.length });
	} catch (error) { return replyError(res, error); }
}

async function confirmReplacement(req, res) {
	const id = uuid.validate(req.params.booking_id);
	const { value, error: invalid } = selection.validate(req.body);
	if (id.error || invalid) return res.status(400).json({ message: "Select a provider, time and exact price before confirming." });
	let client;
	try {
		client = await db.connect();
		await client.query("BEGIN");
		// The offer belongs to a terminal booking. Serialize attempts on that row before taking the target slot lock.
		const locked = await client.query("SELECT booking_id FROM bookings WHERE booking_id=$1 AND user_id=$2 AND replacement_offered FOR UPDATE",
			[id.value, req.user.id]);
		if (!locked.rowCount) throw new BookingError(404, "Booking recovery is unavailable for this booking.");
		const original = await originalFor(client, req.user.id, id.value);
		if (original.replacement_id) {
			await client.query("COMMIT");
			return res.json({ original: summarize(original), already_resolved: true });
		}
		const block = await paymentBlock(client, original);
		if (block) throw new BookingError(409, block);
		const window = dateWindow(original);
		const providerId = value.provider_id.toLowerCase();
		if (value.date < window.min || value.date > window.max || (await previousProviders(client, original)).includes(providerId)) {
			throw new BookingError(409, "Choose a different provider and an available date.");
		}
		const booking = { ...schedulingDetails(original), ...value, provider_id: providerId };
		await lockSchedule(client, booking.provider_id, booking.date);
		// Profile edits update the user before changing working hours. Keep the provider, location
		// and service offer stable through validation and commit.
		const provider = await client.query("SELECT id FROM users WHERE id=$1 AND role='provider' FOR SHARE", [booking.provider_id]);
		if (!provider.rowCount) throw new BookingError(409, "This provider is no longer available.");
		await client.query("SELECT id FROM provider_services WHERE provider_id=$1 AND service_id=$2 FOR SHARE", [booking.provider_id, booking.service_id]);
		await client.query("SELECT user_id FROM providers WHERE user_id=$1 FOR SHARE", [booking.provider_id]);
		const selected = await schedule.validateSchedule(client, booking);
		const price = amountInPaise(selected.price);
		if (price !== value.approved_price_paise) throw new BookingError(409, "The price changed. Refresh the options and review the new price.");
		const arrival = generateOtp();
		let completion;
		do { completion = generateOtp(); } while (completion === arrival);
		const { rows: [created] } = await client.query(`INSERT INTO bookings
			(user_id,provider_id,service_id,date,start_time,end_time,address,latitude,longitude,search_radius_km,
			 price,status,payment_method,payment_status,otp,completion_otp,replaces_booking_id)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending','cod','pending',$12,$13,$14)
			RETURNING booking_id,status`, [req.user.id, booking.provider_id, booking.service_id, booking.date,
			booking.start_time, booking.end_time, original.address, booking.latitude, booking.longitude,
			booking.radius, price / 100, arrival, completion, original.booking_id]);
		const notification = await sendNotification({
			userId: booking.provider_id, title: "New booking request", message: "A customer has requested a service.",
			type: "booking_created", data: { booking_id: created.booking_id },
		}, client, { throwOnError: true });
		const result = await originalFor(client, req.user.id, id.value);
		await client.query("COMMIT");
		emitNotification(notification);
		return res.status(201).json({ original: summarize(result) });
	} catch (error) {
		if (client) await client.query("ROLLBACK").catch(() => {});
		return replyError(res, error);
	} finally { if (client) client.release(); }
}

module.exports = { listReplacements, replacementOptions, confirmReplacement };
