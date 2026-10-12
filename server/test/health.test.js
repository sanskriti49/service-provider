const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createHealthRouter } = require("../routes/healthRoutes");

test("health distinguishes unavailable DB from live process and volatile queue fallback", async (t) => {
	let fail = false, engine = "in-memory", query;
	const app = express();
	app.use("/health", createHealthRouter({
		db: { query: async (input) => { query = input; if (fail) throw new Error("secret connection string"); } },
		eventQueue: { getStats: () => ({ engine }) },
	}));
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
	const get = async (route) => { const res = await fetch(`http://127.0.0.1:${server.address().port}/health/${route}`); return { status: res.status, data: await res.json() }; };
	let ready = await get("ready");
	assert.equal(ready.status, 200);
	assert.equal(ready.data.checks.eventQueue.status, "volatile-fallback");
	assert.equal(ready.data.checks.eventQueue.durable, false);
	assert.deepEqual(query, { text: "SELECT 1", query_timeout: 2000 });
	engine = "bullmq"; ready = await get("ready");
	assert.equal(ready.data.checks.eventQueue.durable, true);
	fail = true;
	const broken = await get("ready");
	assert.equal(broken.status, 503);
	assert.equal(JSON.stringify(broken).includes("secret"), false);
	assert.equal((await get("live")).status, 200);
});
