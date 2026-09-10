require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../config/db");
const { generateRealSlots } = require("../utils/timeUtils");

async function backfill() {
	const client = await db.connect();
	try {
		console.log("🚀 Starting Provider Availability Backfill...");
		await client.query("BEGIN");

		const providersRes = await client.query(`
			SELECT p.user_id, u.name, p.availability
			FROM providers p
			JOIN users u ON p.user_id = u.id
		`);
		console.log(`Found ${providersRes.rows.length} total providers.`);

		let masterInserted = 0;
		let slotsInserted = 0;

		for (const p of providersRes.rows) {
			let schedule = p.availability;
			if (typeof schedule === "string") {
				try {
					schedule = JSON.parse(schedule);
				} catch {
					schedule = [];
				}
			}

			if (!Array.isArray(schedule) || schedule.length === 0) {
				// Standard Mon-Sat schedule
				schedule = [
					{ day: 1, start: "09:00:00", end: "18:00:00" },
					{ day: 2, start: "09:00:00", end: "18:00:00" },
					{ day: 3, start: "09:00:00", end: "18:00:00" },
					{ day: 4, start: "09:00:00", end: "18:00:00" },
					{ day: 5, start: "09:00:00", end: "18:00:00" },
					{ day: 6, start: "10:00:00", end: "17:00:00" },
				];

				await client.query(
					"UPDATE providers SET availability = $1 WHERE user_id = $2",
					[JSON.stringify(schedule), p.user_id],
				);
			}

			// Clean master schedule rules
			const seenRules = new Set();
			const uniqueSchedule = [];
			for (const rule of schedule) {
				const sStart = (rule.start || rule.start_time || "09:00").slice(0, 5) + ":00";
				const sEnd = (rule.end || rule.end_time || "18:00").slice(0, 5) + ":00";
				const key = `${rule.day}_${sStart}_${sEnd}`;
				if (!seenRules.has(key)) {
					seenRules.add(key);
					uniqueSchedule.push({ day: Number(rule.day), start: sStart, end: sEnd });
				}
			}

			// Insert master rules
			for (const rule of uniqueSchedule) {
				await client.query(
					`INSERT INTO provider_master_availability (provider_id, day_of_week, start_time, end_time)
					 VALUES ($1, $2, $3::time, $4::time)
					 ON CONFLICT (provider_id, day_of_week, start_time, end_time) DO NOTHING`,
					[p.user_id, rule.day, rule.start, rule.end],
				);
				masterInserted++;
			}

			// Generate and insert 30 days of slots
			await client.query("DELETE FROM availability_slots WHERE provider_id = $1", [p.user_id]);
			const realSlots = generateRealSlots(uniqueSchedule);
			for (const s of realSlots) {
				const cleanDateStr =
					s.date instanceof Date
						? s.date.toISOString().slice(0, 10)
						: String(s.date).substring(0, 10);

				await client.query(
					`INSERT INTO availability_slots (provider_id, date, start_time, end_time)
					 VALUES ($1, $2::date, $3::time, $4::time)`,
					[p.user_id, cleanDateStr, s.start_time, s.end_time],
				);
				slotsInserted++;
			}
		}

		await client.query("COMMIT");
		console.log(`✅ Backfill completed successfully!`);
		console.log(`📊 Stats: ${masterInserted} master availability rules, ${slotsInserted} availability slots inserted across ${providersRes.rows.length} providers.`);
		process.exit(0);
	} catch (err) {
		console.error("❌ Backfill failed:", err);
		await client.query("ROLLBACK");
		process.exit(1);
	} finally {
		client.release();
		await db.end();
	}
}

backfill();
