const db = require("../config/db");
const {
	timeToMinutes,
	minutesToTime,
	splitIntoChunks,
} = require("../utils/timeUtils");

async function getAvailability(req, res, next) {
	try {
		const providerId = req.params.providerId;
		const from = req.query.from ? new Date(req.query.from) : new Date();
		from.setHours(0, 0, 0, 0);

		const days = Math.min(parseInt(req.query.days || "7", 10), 30);

		const masterRes = await db.query(
			`SELECT day_of_week,start_time::text, end_time::text
             FROM provider_master_availability
             WHERE provider_id=$1`,
			[providerId]
		);

		const endDate = new Date(from);
		endDate.setDate(endDate.getDate() + days - 1);

		const exceptionsRes = await db.query(
			`SELECT date,is_available, override_slots
            FROM provider_date_exceptions
            WHERE provider_id = $1 AND date BETWEEN $2 AND $3`,
			[
				providerId,
				from.toISOString().slice(0, 10),
				endDate.toISOString().slice(0, 10),
			]
		);

		const bookingsRes = await db.query(
			`SELECT date, start_time::text AS start_time, end_time::text AS end_time
             FROM bookings
             WHERE provider_id = $1 AND date BETWEEN $2 AND $3 AND status = 'booked'`,
			[
				providerId,
				from.toISOString().slice(0, 10),
				endDate.toISOString().slice(0, 10),
			]
		);

		const masterMap = {}; // day_of_week => [{start,end},...]
		for (const row of masterRes.rows) {
			const d = parseInt(row.day_of_week, 10);
			masterMap[d] = masterMap[d] || [];
			masterMap[d].push({ start: row.start_time, end: row.end_time });
		}

		const exceptionsMap = {};
		for (const ex of exceptionsRes.rows) {
			exceptionsMap[ex.date.toISOString().slice(0, 10)] = ex;
		}

		const bookingsMap = {};
		for (const b of bookingsRes.rows) {
			const key = b.date.toISOString().slice(0, 10);
			bookingsMap[key] = bookingsMap[key] || [];
			bookingsMap[key].push({ start: b.start_time, end: b.end_time });
		}

		// Expand each day and subtract bookings + apply exceptions
		const results = [];
		for (let i = 0; i < days; i++) {
			const dt = new Date(from);
			dt.setDate(from.getDate() + i);
			const dateStr = dt.toISOString().slice(0, 10);
			const dow = dt.getDay(); // 0..6

			let slots = [];

			const exception = exceptionsMap[dateStr];
			if (exception) {
				if (exception.is_available && exception.override_slots) {
					// use override slots (stored as JSONB)
					slots = exception.override_slots.map((s) => ({
						start: s.start,
						end: s.end,
					}));
				} else if (!exception.is_available) {
					// fully blocked
					slots = [];
				}
			} else {
				// use master template for this weekday
				const templ = masterMap[dow] || [];
				slots = templ.map((s) => ({ start: s.start, end: s.end }));
			}

			// subtract bookings (naive subtraction; for each booked slot remove overlapping chunk)
			const booked = bookingsMap[dateStr] || [];
			// convert to minutes and subtract
			let freeChunks = [];
			for (const slot of slots) {
				let intervals = [
					{ s: timeToMinutes(slot.start), e: timeToMinutes(slot.end) },
				];

				for (const b of booked) {
					const bs = timeToMinutes(b.start);
					const be = timeToMinutes(b.end);
					intervals = intervals.flatMap((iv) => {
						// no overlap
						if (be <= iv.s || bs >= iv.e) return [iv];
						const out = [];
						if (bs > iv.s) out.push({ s: iv.s, e: bs });
						if (be < iv.e) out.push({ s: be, e: iv.e });
						return out;
					});
				}

				freeChunks.push(
					...intervals.map((iv) => ({
						start: minutesToTime(iv.s),
						end: minutesToTime(iv.e),
					}))
				);
			}

			// Optionally split into fixed booking chunks, e.g., 60-min slots
			// const finalSlots = freeChunks.flatMap(fc => splitIntoChunks(fc.start, fc.end, 60));

			results.push({ date: dateStr, free_slots: freeChunks });
		}

		res.json({ provider_id: providerId, availability: results });
	} catch (err) {
		next(err);
	}
}

module.exports = { getAvailability };
