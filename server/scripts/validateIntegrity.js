const db = require("../config/db");
async function validate() {
	const client = await db.connect();
	try {
		await client.query("BEGIN");
		const result = await client.query(`SELECT c.conname, t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
			WHERE c.conrelid IN ('public.bookings'::regclass,'public.reviews'::regclass,'public.provider_master_availability'::regclass,'public.availability_slots'::regclass) AND NOT c.convalidated`);
		for (const row of result.rows) {
			const quoted = (name) => '"' + name.replaceAll('"', '""') + '"';
			await client.query(`ALTER TABLE public.${quoted(row.relname)} VALIDATE CONSTRAINT ${quoted(row.conname)}`);
		}
		await client.query("COMMIT");
		console.log("Historical booking/review constraints validated");
	} catch (error) { await client.query("ROLLBACK"); throw error; }
	finally { client.release(); }
}
validate().catch((error) => { console.error("Historical data needs review:", error.message); process.exitCode=1; }).finally(() => db.end());
