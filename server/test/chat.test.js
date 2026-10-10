const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const path = require("node:path");

// Opt in explicitly; never run fixtures against the application's configured database.
const testUrl = process.env.CHAT_TEST_DATABASE_URL;
if (testUrl) process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = "test";
const db = require("../config/db");
const chat = require("../utils/chatService");

test("chat validates payloads before acquiring a database connection", async () => {
	const user = randomUUID(), booking = randomUUID();
	for (const body of [null, "", "  ", "x".repeat(4001), "bad\0text"]) {
		await assert.rejects(chat.send(user, booking, { clientMessageId: randomUUID(), body }), { code: "INVALID_INPUT" });
	}
	await assert.rejects(chat.send(user, booking, { clientMessageId: "bad", body: "ok" }), { code: "INVALID_INPUT" });
	for (const options of [{ before: "1", after: "2" }, { after: "1 OR true" }, { before: "9223372036854775808" }, { limit: 101 }]) {
		await assert.rejects(chat.history(user, booking, options), { code: "INVALID_INPUT" });
	}
	await assert.rejects(chat.markRead(user, booking, { throughMessageId: 1 }), { code: "INVALID_INPUT" });
});

test("chat PostgreSQL, HTTP and real Socket.IO integration", { skip: !testUrl, timeout: 60000 }, async (t) => {
	const { Pool } = require("pg");
	const express = require("express");
	const jwt = require("jsonwebtoken");
	const { io: connectSocket } = require(require.resolve("socket.io-client", { paths: [path.join(__dirname, "../../client")] }));
	const schema = `chat_test_${randomUUID().replaceAll("-", "")}`;
	const admin = new Pool({ connectionString: testUrl });
	await admin.query(`CREATE SCHEMA ${schema}`);
	const pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schema}` });
	const oldQuery = db.query, oldConnect = db.connect;
	db.query = (...args) => pool.query(...args);
	db.connect = () => pool.connect();
	const originalSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = randomUUID();
	let server, io;
	const sockets = [];
	t.after(async () => {
		for (const socket of sockets) socket.disconnect();
		if (io) await new Promise((resolve) => io.close(resolve));
		if (server?.listening) await new Promise((resolve) => server.close(resolve));
		db.query = oldQuery; db.connect = oldConnect;
		if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
		await pool.end();
		await admin.query(`DROP SCHEMA ${schema} CASCADE`);
		await admin.end();
		await db.end();
	});
	const { queries } = require("../migrations/create_tables");
	for (const table of ["users", "bookings"]) {
		const ddl = queries.find((q) => q.startsWith(`CREATE TABLE IF NOT EXISTS public.${table} (`));
		await pool.query(ddl.replaceAll("public.", `${schema}.`));
	}
	const { chatSchema } = require("../migrations/migrate_chat");
	await pool.query(chatSchema.replaceAll("public.", `${schema}.`));
	await pool.query(chatSchema.replaceAll("public.", `${schema}.`)); // migration is repeatable
	const customer = randomUUID(), provider = randomUUID(), outsider = randomUUID();
	for (const [id, role] of [[customer, "customer"], [provider, "provider"], [outsider, "customer"]]) {
		await pool.query("INSERT INTO users (id, name, email, password, role) VALUES ($1, 'Chat Test', $2, 'unused', $3)", [id, `${id}@example.invalid`, role]);
	}
	const booking = randomUUID(), otherBooking = randomUUID();
	for (const id of [booking, otherBooking]) {
		await pool.query("INSERT INTO bookings (booking_id, user_id, provider_id, date, start_time, end_time) VALUES ($1, $2, $3, CURRENT_DATE, '10:00', '11:00')", [id, customer, provider]);
	}
	const payload = () => ({ clientMessageId: randomUUID(), body: "Hello" });
	let first;
	await t.test("authorization denies outsiders on all operations without revealing existence", async () => {
		for (const operation of [() => chat.history(outsider, booking), () => chat.send(outsider, booking, payload()), () => chat.markRead(outsider, booking, { throughMessageId: "1" }), () => chat.history(customer, randomUUID())]) {
			await assert.rejects(operation(), { code: "CONVERSATION_NOT_FOUND" });
		}
		assert.equal((await chat.unread(outsider)).total_unread, 0);
	});
	await t.test("simultaneous retries persist once and conflicting reuse is rejected", async () => {
		const input = payload();
		const results = await Promise.all(Array.from({ length: 8 }, () => chat.send(customer, booking, input)));
		assert.equal(results.filter((r) => !r.duplicate).length, 1);
		assert.equal(new Set(results.map((r) => r.message.id)).size, 1);
		first = results[0].message;
		assert.ok(first.created_at);
		await assert.rejects(chat.send(customer, booking, { ...input, body: "Different" }), { code: "IDEMPOTENCY_CONFLICT" });
		assert.equal((await chat.unread(provider)).total_unread, 1);
		assert.equal((await chat.unread(customer)).total_unread, 0);
	});
	await t.test("history pagination, bounded receipts and conversation isolation", async () => {
		const second = (await chat.send(customer, booking, payload())).message;
		const foreign = (await chat.send(customer, otherBooking, payload())).message;
		const third = (await chat.send(provider, booking, payload())).message;
		const recent = await chat.history(provider, booking, { limit: 2 });
		assert.deepEqual(recent.messages.map((m) => m.id), [second.id, third.id]);
		assert.equal(recent.has_more, true);
		assert.deepEqual((await chat.history(provider, booking, { before: recent.next_cursor })).messages.map((m) => m.id), [first.id]);
		assert.deepEqual((await chat.history(provider, booking, { after: first.id })).messages.map((m) => m.id), [second.id, third.id]);
		await assert.rejects(chat.markRead(provider, booking, { throughMessageId: foreign.id }), { code: "INVALID_INPUT" });
		const receipt = await chat.markRead(provider, booking, { throughMessageId: first.id });
		assert.equal(receipt.updated_count, 1);
		assert.equal(receipt.unread_count, 1);
		const firstReadAt = (await chat.history(customer, booking)).messages[0].read_at;
		await chat.markRead(provider, booking, { throughMessageId: third.id });
		const stale = await chat.markRead(provider, booking, { throughMessageId: first.id });
		assert.equal(stale.last_read_message_id, second.id);
		assert.equal(stale.updated_count, 0);
		assert.equal((await chat.history(customer, booking)).messages[0].read_at.getTime(), firstReadAt.getTime());
		assert.equal((await chat.unread(provider)).total_unread, 1); // other booking only
		assert.equal((await chat.history(customer, booking)).unread_count, 1); // provider's own message was not marked
	});
	const app = express();
	app.use(express.json());
	app.use("/api/chat", require("../routes/chatRoutes"));
	server = http.createServer(app);
	io = require("../utils/socket").initSocket(server, { origin: false });
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const base = `http://127.0.0.1:${server.address().port}`;
	const token = (id, extra = {}) => jwt.sign({ id, ...extra }, process.env.JWT_SECRET, { expiresIn: "1h" });
	const request = (id, route, body) => fetch(`${base}/api/chat/${route}`, {
		method: body ? "POST" : "GET",
		headers: { ...(id ? { Authorization: `Bearer ${token(id)}` } : {}), "Content-Type": "application/json" },
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const open = async (authToken) => {
		const socket = connectSocket(base, { auth: { token: authToken }, reconnection: false, forceNew: true });
		sockets.push(socket);
		await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
		return socket;
	};
	const ack = (socket, event, input) => new Promise((resolve, reject) => {
		socket.timeout(3000).emit(event, input, (err, result) => err ? reject(err) : resolve(result));
	});
	const once = (socket, event) => new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Missing ${event}`)), 3000);
		socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
	});
	await t.test("HTTP auth, participant restrictions and safe error responses", async () => {
		assert.equal((await request(null, `${booking}/messages`)).status, 401);
		assert.equal((await request(outsider, `${booking}/messages`)).status, 404);
		assert.equal((await request(outsider, `${booking}/messages`, payload())).status, 404);
		assert.equal((await request(outsider, `${booking}/read`, { throughMessageId: first.id })).status, 404);
		const response = await request(customer, `${booking}/messages`, payload());
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.ok((await response.json()).message.id);
		assert.equal((await request(customer, "invalid/messages")).status, 400);
	});
	await t.test("socket auth rejects missing, invalid, expired and deleted-user tokens", async () => {
		for (const invalid of [undefined, "bad", token(randomUUID()), jwt.sign({ id: customer, exp: 1 }, process.env.JWT_SECRET)]) {
			await assert.rejects(open(invalid));
		}
	});
	await t.test("private socket delivery, acknowledgements, read receipts and reconnect replay", async () => {
		const c = await open(token(customer)), p = await open(token(provider)), o = await open(token(outsider, { role: "admin" }));
		let leaks = 0;
		o.on("chat:message", () => leaks++);
		o.on("chat:read", () => leaks++);
		for (const [event, input] of [["chat:history", { bookingId: booking }], ["chat:send", { bookingId: booking, ...payload() }], ["chat:read", { bookingId: booking, throughMessageId: first.id }]]) {
			assert.equal((await ack(o, event, input)).error.code, "CONVERSATION_NOT_FOUND");
		}
		assert.equal((await ack(c, "chat:send", null)).error.code, "INVALID_INPUT");
		const messageEvent = once(p, "chat:message");
		const input = { bookingId: booking, ...payload() };
		const sent = await ack(c, "chat:send", input);
		assert.equal(sent.ok, true);
		assert.equal((await messageEvent).id, sent.data.message.id);
		assert.equal((await ack(c, "chat:send", input)).data.duplicate, true);
		const readEvent = once(c, "chat:read");
		await ack(p, "chat:read", { bookingId: booking, throughMessageId: sent.data.message.id });
		assert.equal((await readEvent).last_read_message_id, sent.data.message.id);
		p.disconnect();
		const offline = await ack(c, "chat:send", { bookingId: booking, ...payload() });
		const reconnected = await open(token(provider));
		const replay = await ack(reconnected, "chat:history", { bookingId: booking, after: sent.data.message.id });
		assert.deepEqual(replay.data.messages.map((m) => m.id), [offline.data.message.id]);
		assert.equal((await ack(reconnected, "chat:unread", {})).data.total_unread, 2);
		assert.equal(leaks, 0);
		const notification = once(c, "notification:new");
		require("../utils/socket").emitToUser(customer, "notification:new", { preserved: true });
		assert.equal((await notification).preserved, true);
	});
	await t.test("active sockets disconnect on token expiry", async () => {
		const short = jwt.sign({ id: customer }, process.env.JWT_SECRET, { expiresIn: 2 });
		const socket = await open(short);
		assert.equal(await once(socket, "disconnect"), "io server disconnect");
	});
	await t.test("failed database operations do not leak SQL", async () => {
		const original = db.connect;
		db.connect = async () => { throw Object.assign(new Error("secret SQL"), { code: "08006" }); };
		try {
			const response = await request(customer, `${booking}/messages`);
			assert.equal(response.status, 500);
			assert.equal((await response.json()).error.code, "INTERNAL_ERROR");
		} finally { db.connect = original; }
		assert.ok((await chat.history(customer, booking)).messages.length);
	});
	await t.test("transaction failure rolls back a pending message and allows a safe retry", async () => {
		const original = db.connect;
		const input = payload();
		db.connect = async () => {
			const client = await original();
			return {
				query: (sql, params) => sql === "COMMIT" ? Promise.reject(new Error("simulated commit failure")) : client.query(sql, params),
				release: () => client.release(),
			};
		};
		try { await assert.rejects(chat.send(customer, booking, input), /simulated commit failure/); }
		finally { db.connect = original; }
		assert.equal((await pool.query("SELECT id FROM chat_messages WHERE client_message_id = $1", [input.clientMessageId])).rowCount, 0);
		assert.equal((await chat.send(customer, booking, input)).duplicate, false);
	});
	await t.test("socket request limits and server-owned sender identity", async () => {
		const socket = await open(token(customer));
		const sent = await ack(socket, "chat:send", { bookingId: booking, ...payload(), sender_id: provider, senderId: provider });
		assert.equal(sent.data.message.sender_id, customer);
		let last;
		for (let i = 0; i < 120; i++) last = await ack(socket, "chat:history", null);
		assert.equal(last.error.code, "RATE_LIMITED");
	});
	await t.test("booking deletion cascades messages and prevents future access", async () => {
		await pool.query("DELETE FROM bookings WHERE booking_id = $1", [otherBooking]);
		assert.equal((await pool.query("SELECT * FROM chat_messages WHERE booking_id = $1", [otherBooking])).rowCount, 0);
		await assert.rejects(chat.history(customer, otherBooking), { code: "CONVERSATION_NOT_FOUND" });
	});
});
