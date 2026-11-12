const { randomUUID } = require("node:crypto");

// PostgreSQL is the durable source of notification intent. Redis only transports
// references to these rows. All updates are fenced by generation after a replay.
class NotificationOutbox {
	constructor(db) { this.db = db; }

	async enqueue(eventType, payload, { client = this.db, maxAttempts = 3 } = {}) {
		if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new Error("maxAttempts must be between 1 and 20");
		const result = await client.query(
			`INSERT INTO notification_outbox (id,event_type,payload,max_attempts)
			 VALUES ($1,$2,$3::jsonb,$4) RETURNING *`,
			[randomUUID(), eventType, JSON.stringify(payload), maxAttempts],
		);
		return result.rows[0];
	}

	async claim(limit = 25, leaseMs = 30000) {
		return (await this.db.query(
			`WITH ready AS (
			 SELECT id FROM notification_outbox
			 WHERE status IN ('pending','queued') AND next_dispatch_at <= clock_timestamp()
			 AND (dispatch_lease_until IS NULL OR dispatch_lease_until < clock_timestamp())
			 ORDER BY next_dispatch_at,id FOR UPDATE SKIP LOCKED LIMIT $1
			) UPDATE notification_outbox o
			 SET dispatch_lease_until = clock_timestamp() + $2 * INTERVAL '1 millisecond'
			 FROM ready WHERE o.id = ready.id RETURNING o.*`, [limit, leaseMs],
		)).rows;
	}

	async dispatched(row, reconcileMs) {
		await this.db.query(
			`UPDATE notification_outbox SET status='queued', dispatch_lease_until=NULL,
			 next_dispatch_at=clock_timestamp() + $3 * INTERVAL '1 millisecond', updated_at=clock_timestamp()
			 WHERE id=$1 AND generation=$2 AND status IN ('pending','queued')`, [row.id, row.generation, reconcileMs],
		);
	}

	async dispatchFailed(row, error) {
		// Redis outages don't spend the email delivery budget or discard work.
		await this.db.query(
			`UPDATE notification_outbox SET dispatch_lease_until=NULL, dispatch_attempts=dispatch_attempts+1,
			 next_dispatch_at=clock_timestamp() + LEAST(60, power(2, LEAST(dispatch_attempts,6))) * INTERVAL '1 second',
			 last_error=$3, updated_at=clock_timestamp()
			 WHERE id=$1 AND generation=$2 AND status IN ('pending','queued')`,
			[row.id, row.generation, String(error.message).slice(0, 1000)],
		);
	}

	async beginAttempt(id, generation) {
		return (await this.db.query(
			`UPDATE notification_outbox SET attempts=attempts+1, updated_at=clock_timestamp()
			 WHERE id=$1 AND generation=$2 AND status IN ('pending','queued') AND attempts < max_attempts RETURNING *`,
			[id, generation],
		)).rows[0];
	}

	async get(id) { return (await this.db.query("SELECT * FROM notification_outbox WHERE id=$1", [id])).rows[0]; }

	async complete(id, generation) {
		await this.db.query(
			`UPDATE notification_outbox SET status='completed', completed_at=clock_timestamp(),
			 updated_at=clock_timestamp(), last_error=NULL, dispatch_lease_until=NULL
			 WHERE id=$1 AND generation=$2 AND status IN ('pending','queued')`, [id, generation],
		);
	}

	async fail(id, generation, error, terminal = false) {
		await this.db.query(
			`UPDATE notification_outbox SET status=CASE WHEN $4 OR attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
			 last_error=$3, updated_at=clock_timestamp(), dispatch_lease_until=NULL
			 WHERE id=$1 AND generation=$2 AND status IN ('pending','queued')`,
			[id, generation, String(error.message || error).slice(0, 1000), terminal],
		);
	}

	async replay(id) {
		const row = (await this.db.query(
			`UPDATE notification_outbox SET status='pending', generation=generation+1, attempts=0,
			 dispatch_attempts=0, next_dispatch_at=clock_timestamp(), dispatch_lease_until=NULL,
			 last_error=NULL, updated_at=clock_timestamp() WHERE id=$1 AND status='failed' RETURNING *`, [id],
		)).rows[0];
		if (!row) throw new Error("Only failed outbox jobs can be replayed");
		return row;
	}

	async summary() {
		const { rows } = await this.db.query(
			`SELECT status, COUNT(*)::int AS count,
			 EXTRACT(EPOCH FROM (clock_timestamp()-MIN(created_at)))::float AS oldest_age_seconds
			 FROM notification_outbox GROUP BY status`,
		);
		const counts = { pending: 0, queued: 0, completed: 0, failed: 0 };
		let oldestPendingSeconds = 0;
		for (const row of rows) {
			counts[row.status] = row.count;
			if (["pending", "queued"].includes(row.status)) oldestPendingSeconds = Math.max(oldestPendingSeconds, row.oldest_age_seconds);
		}
		return { ...counts, oldestPendingSeconds };
	}
}

function jobIdFor(row) { return `outbox-${row.id}-${row.generation}`; }
module.exports = { NotificationOutbox, jobIdFor };
