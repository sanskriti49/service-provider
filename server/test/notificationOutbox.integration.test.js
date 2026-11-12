const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NotificationOutbox, jobIdFor } = require("../utils/notificationOutbox");
const { EventQueue } = require("../utils/eventQueue");
const { outboxSchema } = require("../migrations/migrate_notification_outbox");

const databaseUrl = process.env.OUTBOX_TEST_DATABASE_URL;
const redisUrl = process.env.OUTBOX_TEST_REDIS_URL;
if (process.env.REQUIRE_INTEGRATION_TESTS === "1" && (!databaseUrl || !redisUrl)) {
	throw new Error("OUTBOX_TEST_DATABASE_URL and OUTBOX_TEST_REDIS_URL are required");
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, message) {
	const end = Date.now() + 10000;
	while (Date.now() < end) { if (await check()) return; await sleep(25); }
	throw new Error(`Timed out: ${message}`);
}

test("notification outbox: real PostgreSQL + Redis/BullMQ with controlled SMTP", { skip: !databaseUrl || !redisUrl, timeout: 90000 }, async (t) => {
	const { Pool } = require("pg");
	const Redis = require("ioredis");
	const admin = new Pool({ connectionString: databaseUrl });
	const schema = `outbox_test_${randomUUID().replaceAll("-", "")}`;
	await admin.query(`CREATE SCHEMA ${schema}`);
	const db = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
	const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
	const queueName = `outbox-test-${randomUUID()}`;
	const adapter = {
		getRedisClient: () => redis,
		isRedisReady: () => redis.status === "ready",
		createRedisClient: (options) => new Redis(redisUrl, { lazyConnect: true, retryStrategy: () => 100, ...options }),
	};
	const queues = [];
	const createQueue = (options = {}) => {
		const queue = new EventQueue({ db, redis: adapter, queueName, pollMs: 100, reconcileMs: 100,
			backoffMs: 20, sendEmail: async () => {}, ...options });
		queues.push(queue); return queue;
	};
	const store = new NotificationOutbox(db);
	const data = { email: "fixture@example.com", subject: "Fixture", message: "Never sent to SMTP" };
	const due = (id) => db.query("UPDATE notification_outbox SET next_dispatch_at=clock_timestamp(),dispatch_lease_until=NULL WHERE id=$1", [id]);
	t.after(async () => {
		for (const queue of queues.reverse()) await queue.close();
		const { Queue } = require("bullmq");
		const cleanup = new Queue(queueName, { connection: redis });
		await cleanup.obliterate({ force: true }); await cleanup.close();
		redis.disconnect();
		await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
	});
	await db.query(outboxSchema.replaceAll("public.", `${schema}.`));
	await db.query(outboxSchema.replaceAll("public.", `${schema}.`));
	await until(() => adapter.isRedisReady(), "Redis ready");

	await t.test("transaction rollback leaves neither the booking change nor an email intent", async () => {
		await db.query("CREATE TABLE fixture_bookings(id int PRIMARY KEY,status text)");
		await db.query("INSERT INTO fixture_bookings VALUES(1,'booked')");
		const tx = await db.connect();
		try {
			await tx.query("BEGIN"); await tx.query("UPDATE fixture_bookings SET status='cancelled' WHERE id=1");
			const row = await store.enqueue("SEND_EMAIL", data, { client: tx });
			assert.equal((await db.query("SELECT * FROM notification_outbox WHERE id=$1", [row.id])).rowCount, 0);
			await tx.query("ROLLBACK");
			assert.equal(await store.get(row.id), undefined);
			assert.equal((await db.query("SELECT status FROM fixture_bookings")).rows[0].status, "booked");
		} finally { tx.release(); }
	});

	await t.test("committed outbox events are read from PostgreSQL, dispatched, and processed by a real worker", async () => {
		const sent = [];
		const queue = createQueue({ workerOptions: { autorun: false }, sendEmail: async (message) => sent.push(message) });
		queue.start(); clearInterval(queue.timer);
		await queue.bullQueue.waitUntilReady();
		const tx = await db.connect();
		let id;
		try {
			await tx.query("BEGIN");
			await tx.query("UPDATE fixture_bookings SET status='cancelled' WHERE id=1");
			const intent = await queue.publish("SEND_EMAIL", data, { client: tx });
			id = intent.jobId;
			// A dispatcher using another DB connection cannot see uncommitted intent.
			assert.equal(await store.get(id), undefined);
			assert.equal((await db.query("SELECT status FROM fixture_bookings WHERE id=1")).rows[0].status, "booked");
			await queue.flush();
			assert.equal(await queue.bullQueue.getJob(jobIdFor({ id, generation: 0 })), undefined);
			assert.equal(sent.length, 0);
			await tx.query("COMMIT");
		} catch (error) { await tx.query("ROLLBACK"); throw error; }
		finally { tx.release(); }

		// Read the committed event through a separate PostgreSQL connection.
		const persisted = await store.get(id);
		assert.equal(persisted.status, "pending");
		assert.equal(persisted.event_type, "SEND_EMAIL");
		assert.deepEqual(persisted.payload, data);
		assert.equal((await db.query("SELECT status FROM fixture_bookings WHERE id=1")).rows[0].status, "cancelled");
		await queue.flush();
		const job = await queue.bullQueue.getJob(jobIdFor(persisted));
		// Redis transports only the DB reference; the worker loads the email from PostgreSQL.
		assert.deepEqual(job.data, { outboxId: id, generation: 0 });
		assert.equal((await store.get(id)).status, "queued");
		queue.bullWorker.run().catch(() => {});
		await until(async () => (await store.get(id)).status === "completed", "committed DB event processed by worker");
		assert.equal(sent.length, 1);
		assert.equal(sent[0].email, persisted.payload.email);
		assert.equal(sent[0].message, persisted.payload.message);
		assert.equal((await store.get(id)).attempts, 1);
		assert.ok((await store.get(id)).completed_at);
		await queue.close();
	});

	await t.test("unavailable Redis keeps committed work durable and a fresh queue instance drains it", async () => {
		const offline = createQueue({ redis: { ...adapter, isRedisReady: () => false } });
		offline.start();
		const result = await offline.publish("SEND_EMAIL", data);
		await offline.flush(); await offline.close();
		assert.equal((await store.get(result.jobId)).status, "pending");
		assert.equal((await offline.getStats()).engine, "postgres-outbox");
		const delivered = [];
		const restarted = createQueue({ sendEmail: async (message) => delivered.push(message) });
		restarted.start();
		await until(async () => (await store.get(result.jobId)).status === "completed", "fresh worker delivers saved job");
		assert.equal(delivered.length, 1); assert.match(delivered[0].messageId, /outbox-/);
		await restarted.close();
	});

	await t.test("duplicate dispatch after lost Redis acknowledgement creates one job; two dispatchers can share work", async () => {
		const first = createQueue({ workerOptions: { autorun: false } });
		const second = createQueue({ workerOptions: { autorun: false } });
		first.start(); second.start();
		// Stop periodic polls so the failure boundary is controlled exactly.
		clearInterval(first.timer); clearInterval(second.timer);
		await Promise.all([first.bullQueue.waitUntilReady(), second.bullQueue.waitUntilReady()]);
		const result = await first.publish("SEND_EMAIL", data), row = await store.get(result.jobId);
		const original = first.bullQueue.add.bind(first.bullQueue);
		first.bullQueue.add = async (...args) => { await original(...args); throw new Error("Lost Redis acknowledgement"); };
		await first.flush();
		assert.equal((await store.get(row.id)).dispatch_attempts, 1);
		first.bullQueue.add = original;
		await due(row.id); await Promise.all([first.flush(), second.flush()]);
		assert.ok(await first.bullQueue.getJob(jobIdFor(row)));
		assert.equal((await first.bullQueue.getJobs(["waiting"])).filter(job => job.data.outboxId === row.id).length, 1);
		let sent = 0; first.options.sendEmail = async () => { sent++; };
		first.bullWorker.run().catch(() => {});
		await until(async () => (await store.get(row.id)).status === "completed", "single delivery after redispatch");
		await first.processJob({ id: jobIdFor(row), data: { outboxId: row.id, generation: 0 } });
		assert.equal(sent, 1); // a duplicate job after completion skips the handler
		await first.close(); await second.close();
	});

	await t.test("reconciliation restores queued work if its Redis job disappears", async () => {
		let sent = 0;
		const queue = createQueue({ workerOptions: { autorun: false }, sendEmail: async () => { sent++; } });
		queue.start(); clearInterval(queue.timer); await queue.bullQueue.waitUntilReady();
		const result = await queue.publish("SEND_EMAIL", data), row = await store.get(result.jobId);
		await queue.flush(); await (await queue.bullQueue.getJob(jobIdFor(row))).remove();
		await due(row.id); await queue.flush();
		assert.ok(await queue.bullQueue.getJob(jobIdFor(row)));
		queue.bullWorker.run().catch(() => {});
		await until(async () => (await store.get(row.id)).status === "completed", "restored Redis job");
		assert.equal(sent, 1); await queue.close();
	});

	await t.test("a broken Redis producer connection preserves work until it reconnects", async () => {
		let sent = 0;
		const queue = createQueue({ workerOptions: { autorun: false }, sendEmail: async () => { sent++; } });
		queue.start(); clearInterval(queue.timer); await queue.bullQueue.waitUntilReady();
		const result = await queue.publish("SEND_EMAIL", data);
		queue.producerClient.disconnect();
		await queue.flush();
		const pending = await store.get(result.jobId);
		assert.equal(pending.status, "pending"); assert.equal(pending.attempts, 0); assert.equal(sent, 0);
		assert.equal(pending.dispatch_attempts, 1);
		await queue.producerClient.connect(); await due(result.jobId); await queue.flush();
		queue.bullWorker.run().catch(() => {});
		await until(async () => (await store.get(result.jobId)).status === "completed", "producer reconnect recovery");
		assert.equal(sent, 1); await queue.close();
	});

	await t.test("real BullMQ retries a transient SMTP failure with the same message id", async () => {
		const messages = [];
		const queue = createQueue({ sendEmail: async (message) => { messages.push(message); if (messages.length === 1) throw new Error("Temporary SMTP outage"); } });
		queue.start(); const result = await queue.publish("SEND_EMAIL", data);
		await until(async () => (await store.get(result.jobId)).status === "completed", "retry succeeds");
		assert.equal(messages.length, 2); assert.equal(messages[0].messageId, messages[1].messageId);
		assert.equal((await store.get(result.jobId)).attempts, 2); await queue.close();
	});

	await t.test("exhausted work is durable, listed without payload, and replay fences the old generation", async () => {
		let calls = 0, fail = true;
		const queue = createQueue({ sendEmail: async () => { calls++; if (fail) throw new Error("SMTP unavailable"); } });
		queue.start(); const result = await queue.publish("SEND_EMAIL", data);
		await until(async () => (await store.get(result.jobId)).status === "failed", "attempt budget exhausted");
		assert.equal(calls, 3); assert.equal((await store.get(result.jobId)).attempts, 3);
		await until(async () => (await queue.bullQueue.getJob(jobIdFor(await store.get(result.jobId)))).getState().then(state => state === "failed"), "BullMQ final failure");
		const { run } = require("../scripts/notifications");
		const listed = await run(db, ["list"]);
		assert.ok(listed.some(row => row.id === result.jobId)); assert.equal(JSON.stringify(listed).includes(data.email), false);
		fail = false; const replayed = await run(db, ["retry", result.jobId]);
		assert.equal(replayed.generation, 1);
		await queue.processJob({ id: "old-job", data: { outboxId: result.jobId, generation: 0 } });
		assert.equal(calls, 3);
		await until(async () => (await store.get(result.jobId)).status === "completed", "replayed job completes");
		assert.equal(calls, 4); await assert.rejects(store.replay(result.jobId), /Only failed/);
		await queue.close();
	});

	await t.test("unknown handlers are recorded as failures rather than successful no-ops", async () => {
		const queue = createQueue(); queue.start();
		const row = await store.enqueue("REMOVED_HANDLER", {});
		await until(async () => (await store.get(row.id)).status === "failed", "unknown handler failure");
		assert.equal((await store.get(row.id)).attempts, 1); await queue.close();
	});
});
