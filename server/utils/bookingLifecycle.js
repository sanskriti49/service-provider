const crypto = require("crypto");

class BookingError extends Error {
	constructor(status, message) { super(message); this.status = status; }
}
const terminal = new Set(["completed", "cancelled", "expired", "no_show"]);
const transitions = {
	customer: { pending: ["cancelled"], booked: ["cancelled", "no_show"], confirmed: ["cancelled", "no_show"] },
	provider: { pending: ["confirmed", "booked", "cancelled"], booked: ["confirmed", "in_progress", "cancelled", "no_show"], confirmed: ["in_progress", "cancelled", "no_show"], in_progress: ["completed"] },
	admin: { pending: ["cancelled"], booked: ["cancelled"], confirmed: ["cancelled"], in_progress: ["cancelled"] },
};
function assertTransition(booking, actor, target) {
	if (actor.role !== "admin" && booking[actor.role === "provider" ? "provider_id" : "user_id"] !== actor.id) throw new BookingError(403, "Access denied");
	if (terminal.has(booking.status) || !transitions[actor.role]?.[booking.status]?.includes(target)) throw new BookingError(409, "Invalid booking transition");
	if (booking.payment_method === "online" && booking.payment_status !== "paid" && target !== "cancelled") throw new BookingError(409, "Online payment must be captured before service starts or is confirmed");
}
function serializeBooking(booking, actor) {
	const safe = { ...booking };
	if (actor?.role !== "customer" || actor.id !== booking.user_id) { delete safe.otp; delete safe.completion_otp; }
	return safe;
}
const generateOtp = () => crypto.randomInt(1000, 10000).toString();
const lockSchedule = (client, provider, date) => client.query("SELECT pg_advisory_xact_lock(hashtext('booking:' || $1::text || ':' || $2::text))", [provider, date]);
// NOW() is frozen at BEGIN; a transaction waiting for a lock may outlive a hold.
const activeBookingPredicate = `(status IN ('booked','confirmed','in_progress') OR (status = 'pending' AND (payment_method = 'cod' OR (payment_method = 'online' AND hold_expires_at > clock_timestamp()))))`;
async function lockBooking(client, bookingId) {
	const initial = await client.query("SELECT provider_id, TO_CHAR(date, 'YYYY-MM-DD') AS date FROM bookings WHERE booking_id=$1", [bookingId]);
	if (!initial.rows.length) throw new BookingError(404, "Booking not found");
	await lockSchedule(client, initial.rows[0].provider_id, initial.rows[0].date);
	const result = await client.query("SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS date_string FROM bookings WHERE booking_id=$1 FOR UPDATE", [bookingId]);
	if (!result.rows.length) throw new BookingError(404, "Booking not found");
	// SELECT projections may be evaluated before FOR UPDATE finishes waiting.
	// Read the clock in a separate statement after owning the row lock (chat also
	// locks this row, independently of the scheduling advisory lock).
	const validity = await client.query("SELECT (hold_expires_at > clock_timestamp()) AS hold_valid FROM bookings WHERE booking_id=$1", [bookingId]);
	result.rows[0].hold_valid = validity.rows[0].hold_valid;
	return result.rows[0];
}
module.exports = { BookingError, terminal, assertTransition, serializeBooking, generateOtp, lockSchedule, lockBooking, activeBookingPredicate };
