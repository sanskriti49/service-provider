import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { once } from "node:events";
import { io } from "socket.io-client";
import { socketOptions } from "../src/utils/socketOptions.js";

const require = createRequire(import.meta.url);
const { Server } = require("../../server/node_modules/socket.io");

async function fixture(t, options = {}) {
	const http = createServer();
	const server = new Server(http, options);
	server.use((socket, next) => next(socket.handshake.auth.token === "test-session" ? undefined : new Error("Invalid token")));
	server.on("connection", (socket) => socket.on("test:echo", (value, ack) => ack(value)));
	http.listen(0, "127.0.0.1");
	await once(http, "listening");
	const socket = io(`http://127.0.0.1:${http.address().port}`, {
		...socketOptions("test-session"), autoConnect: false,
	});
	t.after(async () => { socket.disconnect(); await new Promise((resolve) => server.close(resolve)); });
	return { socket };
}

async function connect(socket) {
	const connected = once(socket, "connect");
	socket.connect();
	await connected;
	assert.equal(await socket.timeout(1000).emitWithAck("test:echo", "hello"), "hello");
}

test("socket: realtime messages work when WebSocket is unavailable", { timeout: 5000 }, async (t) => {
	const { socket } = await fixture(t, { transports: ["polling"] });
	await connect(socket);
	assert.equal(socket.io.engine.transport.name, "polling");
});

test("socket: falls back to WebSocket if polling is unavailable", { timeout: 5000 }, async (t) => {
	const { socket } = await fixture(t, { transports: ["websocket"] });
	await connect(socket);
	assert.equal(socket.io.engine.transport.name, "websocket");
});

test("socket: upgrades a healthy polling connection to WebSocket", { timeout: 5000 }, async (t) => {
	const { socket } = await fixture(t);
	await connect(socket);
	if (socket.io.engine.transport.name !== "websocket") await once(socket.io.engine, "upgrade");
	assert.equal(socket.io.engine.transport.name, "websocket");
	assert.equal(await socket.timeout(1000).emitWithAck("test:echo", "upgraded"), "upgraded");
});

test("socket: transport fallback still enforces authentication", { timeout: 5000 }, async (t) => {
	const { socket } = await fixture(t, { transports: ["websocket"] });
	socket.auth = { token: "invalid-session" };
	const rejected = once(socket, "connect_error");
	socket.connect();
	const [error] = await rejected;
	assert.equal(error.message, "Invalid token");
	assert.equal(socket.connected, false);
});

test("socket: recovers after more than ten failed reconnect attempts", { timeout: 10000 }, async (t) => {
	let unavailable = false;
	let failures = 0;
	const { socket } = await fixture(t, {
		allowRequest: (_request, done) => {
			if (unavailable && ++failures <= 24) return done("Temporarily unavailable", false);
			done(null, true);
		},
	});
	socket.io.reconnectionDelay(1).reconnectionDelayMax(1).randomizationFactor(0);
	await connect(socket);
	let attempts = 0;
	socket.io.on("reconnect_attempt", () => attempts++);
	unavailable = true;
	const reconnected = once(socket, "connect");
	socket.io.engine.close();
	await reconnected;
	assert.ok(attempts > 10, `Expected more than ten reconnect attempts, got ${attempts}`);
	assert.equal(await socket.timeout(1000).emitWithAck("test:echo", "recovered"), "recovered");
});
