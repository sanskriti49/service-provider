const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { waitForReady, runDev } = require('./dev.cjs');

async function fixture(t, handler) {
	const server = http.createServer(handler);
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	t.after(() => new Promise(resolve => server.close(resolve)));
	return `http://127.0.0.1:${server.address().port}/health/ready`;
}

test('readiness waits through a DB outage and accepts only ready JSON', async t => {
	let probes = 0;
	const url = await fixture(t, (_request, response) => {
		probes++;
		response.writeHead(probes === 1 ? 503 : 200);
		response.end(JSON.stringify({ status: probes < 3 ? 'degraded' : 'ready' }));
	});
	await waitForReady(url, { intervalMs: 5, timeoutMs: 1000 });
	assert.equal(probes, 3);
});

test('readiness bounds a server that never responds', async t => {
	const url = await fixture(t, () => {});
	await assert.rejects(waitForReady(url, { intervalMs: 5, probeTimeoutMs: 15, timeoutMs: 65 }), /did not become ready/);
});

test('readiness can be canceled promptly', async t => {
	const url = await fixture(t, (_request, response) => { response.writeHead(503); response.end('{}'); });
	const controller = new AbortController();
	const ready = waitForReady(url, { signal: controller.signal, intervalMs: 1000 });
	controller.abort();
	await assert.rejects(ready, error => error.name === 'AbortError');
});

test('readiness survives connection refused before the API begins listening', async t => {
	const server = http.createServer((_request, response) => response.end('{"status":"ready"}'));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const port = server.address().port;
	await new Promise(resolve => server.close(resolve));
	const timer = setTimeout(() => server.listen(port, '127.0.0.1'), 50);
	t.after(() => { clearTimeout(timer); return new Promise(resolve => server.close(resolve)); });
	await waitForReady(`http://127.0.0.1:${port}/health/ready`, { intervalMs: 10, timeoutMs: 2000 });
});

test('an occupied API port produces an actionable error without launching processes', async t => {
	const url = await fixture(t, (_request, response) => response.end('{}'));
	let starts = 0;
	await assert.rejects(runDev({ env: { PORT: new URL(url).port }, start: () => { starts++; }, log: () => {} }), /already in use/);
	assert.equal(starts, 0);
});

test('detects a dual-stack API listener on Windows as well as IPv4 listeners', async t => {
	const server = http.createServer();
	await new Promise(resolve => server.listen(0, resolve));
	t.after(() => new Promise(resolve => server.close(resolve)));
	let starts = 0;
	await assert.rejects(runDev({ env: { PORT: String(server.address().port) }, start: () => { starts++; }, log: () => {} }), /already in use/);
	assert.equal(starts, 0);
});

test('Vite starts only after readiness, and follows the API port', async () => {
	const children = [];
	let ready = false;
	await assert.rejects(runDev({
		env: { PORT: '32123' }, checkPort: async () => {}, log: () => {},
		readiness: async url => { assert.equal(url, 'http://127.0.0.1:32123/health/ready'); assert.equal(children.length, 1); ready = true; },
		start: (entry, cwd, env) => {
			const child = new EventEmitter();
			children.push(child);
			if (children.length === 2) {
				assert.ok(ready);
				assert.match(entry, /vite/);
				assert.equal(env.TASKGENIE_DEV_API_TARGET, 'http://127.0.0.1:32123');
				setImmediate(() => child.emit('exit', 1));
			}
			return child;
		},
	}), /client exited/);
	assert.equal(children.length, 2);
});

test('failed readiness never launches Vite', async () => {
	let starts = 0;
	await assert.rejects(runDev({
		checkPort: async () => {}, log: () => {},
		readiness: async () => { throw new Error('database unavailable'); },
		start: () => { starts++; return new EventEmitter(); },
	}), /database unavailable/);
	assert.equal(starts, 1);
});

test('backend process failure aborts readiness and never launches Vite', async () => {
	let starts = 0;
	await assert.rejects(runDev({
		checkPort: async () => {}, log: () => {},
		readiness: (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
		start: () => { starts++; const child = new EventEmitter(); setImmediate(() => child.emit('exit', 1)); return child; },
	}), /server exited/);
	assert.equal(starts, 1);
});
