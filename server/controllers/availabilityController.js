const db = require("../config/db");
const {
	timeToMinutes,
	minutesToTime,
	splitIntoChunks,
} = require("../utils/timeUtils");

async function getAvailability(req, res, next) {
	try {
		let providerId = req.params.provider_id;

		const isUUID =
			/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(
				providerId,
			);
		if (!isUUID) {
			const userRes = await db.query(
				`SELECT id FROM users WHERE custom_id = $1`,
				[providerId],
			);
			if (userRes.rows.length === 0) {
				return res.status(404).json({ message: "Provider not found" });
			}
			providerId = userRes.rows[0].id;
		}

		const fromStr = req.query.from || new Date().toISOString().slice(0, 10);
		const [year, month, day] = fromStr.split("-").map(Number);
		const from = new Date(year, month - 1, day, 0, 0, 0, 0);

		const days = Math.min(parseInt(req.query.days || "7", 10), 30);

		const masterRes = await db.query(
			`SELECT day_of_week, 
                    TO_CHAR(start_time, 'HH24:MI') AS start_time, 
                    TO_CHAR(end_time, 'HH24:MI') AS end_time
             FROM provider_master_availability
             WHERE provider_id=$1`,
			[providerId],
		);

		const endDate = new Date(from);
		endDate.setDate(from.getDate() + days - 1);
		const endDateStr = endDate.toISOString().slice(0, 10);

		const exceptionsRes = await db.query(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, is_available, override_slots
            FROM provider_date_exceptions
            WHERE provider_id = $1 AND date BETWEEN $2::date AND $3::date`,
			[providerId, fromStr, endDateStr],
		);

		const bookingsRes = await db.query(
			`SELECT TO_CHAR(date, 'YYYY-MM-DD') as date_str, 
                    TO_CHAR(start_time, 'HH24:MI') AS start_time, 
                    TO_CHAR(end_time, 'HH24:MI') AS end_time
             FROM bookings
             WHERE provider_id = $1 AND date BETWEEN $2::date AND $3::date AND status = 'booked'`,
			[providerId, fromStr, endDateStr],
		);

		const masterMap = {};
		for (const row of masterRes.rows) {
			const d = parseInt(row.day_of_week, 10);
			masterMap[d] = masterMap[d] || [];
			masterMap[d].push({ start: row.start_time, end: row.end_time });
		}

		const exceptionsMap = {};
		for (const ex of exceptionsRes.rows) {
			exceptionsMap[ex.date_str] = ex;
		}

		const bookingsMap = {};
		for (const b of bookingsRes.rows) {
			bookingsMap[b.date_str] = bookingsMap[b.date_str] || [];
			bookingsMap[b.date_str].push({ start: b.start_time, end: b.end_time });
		}

		const results = [];
		for (let i = 0; i < days; i++) {
			const dt = new Date(from);
			dt.setDate(from.getDate() + i);
			const dateStr = dt.toISOString().slice(0, 10);
			const dow = dt.getDay();

			let slots = [];
			const exception = exceptionsMap[dateStr];

			if (exception.is_available && exception.override_slots) {
				slots = exception.override_slots.map((s) => ({
					start: s.start && s.start.length > 5 ? s.start.slice(0, 5) : s.start,
					end: s.end && s.end.length > 5 ? s.end.slice(0, 5) : s.end,
				}));
			} else {
				const templ = masterMap[dow] || [];
				slots = templ.map((s) => ({ start: s.start, end: s.end }));
			}

			const booked = bookingsMap[dateStr] || [];
			let freeChunks = [];

			for (const slot of slots) {
				let intervals = [
					{ s: timeToMinutes(slot.start), e: timeToMinutes(slot.end) },
				];

				for (const b of booked) {
					const bs = timeToMinutes(b.start);
					const be = timeToMinutes(b.end);
					intervals = intervals.flatMap((iv) => {
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
					})),
				);
			}

			results.push({ date: dateStr, free_slots: freeChunks });
		}

		res.json({ provider_id: providerId, availability: results });
	} catch (err) {
		next(err);
	}
}

module.exports = { getAvailability };
