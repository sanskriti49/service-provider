// Check the same relation that the dispatcher will use; this performs no DDL.
async function requireOutboxSchema(db) {
	let client;
	try {
		client = await db.connect();
		const { rows: [relation] } = await client.query(`SELECT
			to_regclass('public.notification_outbox') IS NOT NULL AS exists_in_public,
			to_regclass('notification_outbox') = to_regclass('public.notification_outbox') AS resolves_to_public`);
		if (!relation.exists_in_public) {
			throw new OutboxStartupError("public.notification_outbox is missing. Review the target database and run npm run migrate:outbox --prefix server from the repository root before starting the API.");
		}
		if (!relation.resolves_to_public) {
			throw new OutboxStartupError("The database search_path does not resolve notification_outbox to public.notification_outbox. Correct the search_path before starting the API.");
		}
		const { rows: [access] } = await client.query(`SELECT
			has_table_privilege('public.notification_outbox', 'SELECT') AS can_select,
			has_table_privilege('public.notification_outbox', 'INSERT') AS can_insert,
			has_table_privilege('public.notification_outbox', 'UPDATE') AS can_update`);
		if (!access.can_select || !access.can_insert || !access.can_update) {
			throw new OutboxStartupError("The database role needs SELECT, INSERT and UPDATE on public.notification_outbox.");
		}
		// Check the columns used by the worker, without reading or changing rows.
		await client.query(`SELECT id, event_type, payload, status, generation, attempts,
			max_attempts, dispatch_attempts, next_dispatch_at, dispatch_lease_until,
			last_error, created_at, updated_at, completed_at FROM notification_outbox LIMIT 0`);
	} catch (error) {
		if (error instanceof OutboxStartupError) throw error;
		const code = typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code) ? ` (PostgreSQL ${error.code})` : "";
		throw new OutboxStartupError(`Could not verify the notification outbox${code}. Check database connectivity, permissions and schema; no migration was run at startup.`);
	} finally {
		if (client) client.release();
	}
}

class OutboxStartupError extends Error {}
module.exports = { requireOutboxSchema };
