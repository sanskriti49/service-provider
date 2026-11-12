const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventQueue } = require("../utils/eventQueue");

test("publish waits for PostgreSQL and reports transactional intent rather than Redis acceptance", async () => {
	let release, inserted = false;
	const gate = new Promise((resolve) => { release = resolve; });
	const tx = { query: async () => { await gate; inserted = true; return { rows: [{ id: "outbox-id" }] }; } };
	const queue = new EventQueue({ db: { query() { throw new Error("must use transaction client"); } } });
	let resolved = false;
	const pending = queue.publish("SEND_EMAIL", { email: "fixture@example.com" }, { client: tx }).then((result) => { resolved = true; return result; });
	await Promise.resolve(); assert.equal(resolved, false);
	release(); const result = await pending;
	assert.equal(inserted, true); assert.equal(result.status, "recorded-in-transaction");
	assert.equal(result.engine, "postgres-outbox");
});

test("publish rejects failed persistence and unknown handlers without claiming queued success", async () => {
	const queue = new EventQueue({ db: { query: async () => { throw new Error("database unavailable"); } } });
	await assert.rejects(queue.publish("SEND_EMAIL", {}), /database unavailable/);
	await assert.rejects(queue.publish("MISSING_HANDLER", {}), /No registered handler/);
	await assert.rejects(queue.publish("SEND_EMAIL", {}, { maxAttempts: 0 }), /maxAttempts/);
});

test("a handler error reaches retry handling, and an exhausted attempt is recorded as terminal", async () => {
	const queue = new EventQueue();
	const failures = [];
	queue._store = {
		beginAttempt: async () => ({ id: "id", generation: 0, event_type: "FAIL", payload: {}, attempts: 3, max_attempts: 3 }),
		fail: async (...args) => failures.push(args),
	};
	queue.count = () => {};
	queue.registerHandler("FAIL", async () => { throw new Error("SMTP unavailable"); });
	await assert.rejects(queue.processJob({ id: "job", data: { outboxId: "id", generation: 0 } }), /SMTP unavailable/);
	assert.equal(failures[0][3], true);
});

test("notification handler passes object input and requests propagation of persistence failures", async () => {
	const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
	const filename = path.join(__dirname, "../utils/eventQueue.js");
	const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
	const original = loaded.require.bind(loaded); let input, options;
	loaded.require = (id) => id === "./notificationService" ? { sendNotification: async (data, _db, opts) => {
		input = data; options = opts; throw new Error("notification insert failed");
	} } : original(id);
	loaded._compile(fs.readFileSync(filename, "utf8"), filename);
	await assert.rejects(loaded.exports.handlers.get("SEND_NOTIFICATION")({ userId: "user", title: "title", message: "body", notifData: { booking_id: "booking" } }), /insert failed/);
	assert.equal(input.userId, "user"); assert.deepEqual(input.data, { booking_id: "booking" }); assert.equal(options.throwOnError, true);
});

test("SMTP message id is stable across delivery retries and email errors propagate", async () => {
	const sent = [];
	const queue = new EventQueue({ sendEmail: async (data) => { sent.push(data); throw new Error("SMTP down"); } });
	const handler = queue.handlers.get("SEND_EMAIL"), data = { email: "fixture@example.com", subject: "test", message: "test" };
	for (let i = 0; i < 2; i++) await assert.rejects(handler(data, { id: "stable-job" }), /SMTP down/);
	assert.equal(sent[0].messageId, sent[1].messageId);
});
