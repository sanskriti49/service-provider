const { BookingError, activeBookingPredicate } = require("../utils/bookingLifecycle");
const { getPriceDetails } = require("../utils/pricing");
const { calculateHaversineDistance, estimateTravelTimeMinutes } = require("../utils/geoUtils");

const minutes = (value) => { const [h, m] = String(value).split(":").map(Number); return h * 60 + m; };
const time = (value) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
async function assertNoConflicts(client, booking, config) {
	const existing = await client.query(`SELECT start_time,end_time,latitude,longitude FROM bookings WHERE provider_id=$1 AND date=$2::date
		AND ($3::uuid IS NULL OR booking_id<>$3) AND ${activeBookingPredicate}`, [booking.provider_id, booking.date, booking.booking_id || null]);
	const start = minutes(booking.start_time), end = minutes(booking.end_time);
	for (const row of existing.rows) {
		const otherStart = minutes(row.start_time), otherEnd = minutes(row.end_time);
		let buffer = config.buffer ?? 20;
		if ([booking.latitude, booking.longitude, row.latitude, row.longitude].every((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))) {
			const travel = estimateTravelTimeMinutes(calculateHaversineDistance(Number(booking.latitude), Number(booking.longitude), Number(row.latitude), Number(row.longitude)));
			buffer = Math.max(buffer, travel + 5);
		}
		if (!(end + buffer <= otherStart || start >= otherEnd + buffer)) throw new BookingError(409, "Slot conflicts with another booking or its travel buffer");
	}
}
async function validateSchedule(client, booking) {
	const service = await client.query(`SELECT ps.price,s.name,s.id AS service_id FROM provider_services ps
		JOIN services s ON s.id=ps.service_id JOIN providers p ON p.user_id=ps.provider_id
		WHERE ps.provider_id=$1 AND (s.id::text=$2 OR s.slug=$2) AND ps.is_visible=TRUE AND p.status='approved'`, [booking.provider_id, String(booking.service_id)]);
	if (!service.rows.length) throw new BookingError(409, "Provider must be approved and offer the selected visible service");
	const selected = service.rows[0], config = getPriceDetails(selected.name);
	const duration = config.slotDuration || 60;
	const end = minutes(booking.start_time) + duration;
	if (end >= 1440) throw new BookingError(400, "Service must finish before midnight");
	booking.end_time = time(end);
	const future = await client.query("SELECT ($1::date + $2::time) AT TIME ZONE 'Asia/Kolkata' >= NOW() + INTERVAL '45 minutes' AS valid", [booking.date, booking.start_time]);
	if (!future.rows[0].valid) throw new BookingError(400, "Booking requires at least 45 minutes lead time");
	const exceptions = await client.query("SELECT is_available,override_slots FROM provider_date_exceptions WHERE provider_id=$1 AND date=$2::date", [booking.provider_id, booking.date]);
	let intervals;
	if (exceptions.rows.length && !exceptions.rows[0].is_available) throw new BookingError(409, "Provider is unavailable on this date");
	if (Array.isArray(exceptions.rows[0]?.override_slots)) intervals = exceptions.rows[0].override_slots;
	else {
        intervals = (await client.query("SELECT start_time,end_time FROM provider_master_availability WHERE provider_id=$1 AND day_of_week=EXTRACT(DOW FROM $2::date)", [booking.provider_id, booking.date])).rows;
        if (!intervals.length) {
            const provider = await client.query("SELECT availability FROM providers WHERE user_id=$1", [booking.provider_id]);
            let legacy = provider.rows[0]?.availability;
            if (typeof legacy === "string") { try { legacy = JSON.parse(legacy); } catch { legacy = []; } }
            if (Array.isArray(legacy)) intervals = legacy.filter((slot) => Number(slot.day) === new Date(`${booking.date}T00:00:00Z`).getUTCDay());
        }
    }
	if (!intervals.some((slot) => minutes(slot.start_time || slot.start) <= minutes(booking.start_time) && minutes(slot.end_time || slot.end) >= end)) throw new BookingError(409, "Slot is outside the provider's published working hours");
	await assertNoConflicts(client, booking, config);
	return selected;
}
module.exports = { validateSchedule, assertNoConflicts };
