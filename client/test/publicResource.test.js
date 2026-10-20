import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicResource } from '../src/utils/publicResource.js';

const transient = () => Object.assign(new Error('unavailable'), { response: { status: 503 } });

test('concurrent consumers share a request and short cache; force and TTL refresh', async () => {
	let calls = 0, clock = 0;
	const resource = createPublicResource({ request: async () => ({ version: ++calls }), ttlMs: 100, now: () => clock });
	const [a, b] = await Promise.all([resource.read('/catalogue'), resource.read('/catalogue')]);
	assert.equal(calls, 1);
	assert.deepEqual(a, b);
	await resource.read('/catalogue');
	assert.equal(calls, 1);
	await resource.read('/catalogue', { force: true });
	assert.equal(calls, 2);
	clock = 101;
	await resource.read('/catalogue');
	assert.equal(calls, 3);
});

test('brief GET outage retries, with a per-attempt timeout', async () => {
	let calls = 0;
	const delays = [];
	const resource = createPublicResource({
		request: async (_url, { timeout }) => { assert.equal(timeout, 5000); if (++calls < 3) throw transient(); return ['Plumbing']; },
		sleep: async ms => delays.push(ms),
	});
	assert.deepEqual(await resource.read('/catalogue'), ['Plumbing']);
	assert.deepEqual(delays, [400, 1000]);
});

test('persistent outage stops after three attempts and can be retried manually', async () => {
	let calls = 0, healthy = false;
	const resource = createPublicResource({ request: async () => { calls++; if (!healthy) throw transient(); return []; }, sleep: async () => {} });
	await assert.rejects(resource.read('/catalogue'));
	assert.equal(calls, 3);
	assert.equal(resource.getSnapshot('/catalogue').loading, false);
	healthy = true;
	assert.deepEqual(await resource.read('/catalogue', { force: true }), []);
	assert.equal(calls, 4);
	assert.equal(resource.getSnapshot('/catalogue').error, null);
});

test('does not retry authentication, validation, or rate-limit failures', async () => {
	for (const status of [400, 401, 403, 404, 429]) {
		let calls = 0;
		const resource = createPublicResource({ request: async () => { calls++; throw Object.assign(new Error('rejected'), { response: { status } }); } });
		await assert.rejects(resource.read('/catalogue'));
		assert.equal(calls, 1);
	}
});

test('canceling one subscriber leaves the other request and cache intact', async () => {
	let complete;
	const resource = createPublicResource({ request: () => new Promise(resolve => { complete = resolve; }) });
	const controller = new AbortController();
	const first = resource.read('/catalogue', { signal: controller.signal });
	const second = resource.read('/catalogue');
	controller.abort();
	await assert.rejects(first, error => error.name === 'AbortError');
	complete(['Plumbing']);
	assert.deepEqual(await second, ['Plumbing']);
	assert.deepEqual(await resource.read('/catalogue'), ['Plumbing']);
});

test('retry publishes recovery to every mounted consumer', async () => {
	let healthy = false;
	const resource = createPublicResource({ request: async () => { if (!healthy) throw transient(); return ['Plumbing']; }, sleep: async () => {} });
	const a = [], b = [];
	const offA = resource.subscribe('/catalogue', () => a.push(resource.getSnapshot('/catalogue')));
	const offB = resource.subscribe('/catalogue', () => b.push(resource.getSnapshot('/catalogue')));
	await assert.rejects(resource.read('/catalogue'));
	healthy = true;
	await resource.read('/catalogue', { force: true });
	assert.deepEqual(a, b);
	assert.deepEqual(a.at(-1), { data: ['Plumbing'], loading: false, error: null });
	offA(); offB();
});

test('synchronously thrown transport failures do not poison future retries', async () => {
	let healthy = false;
	const resource = createPublicResource({ request: () => {
		if (!healthy) throw new Error('transport initialization failed');
		return ['Plumbing'];
	} });
	await assert.rejects(resource.read('/catalogue'));
	healthy = true;
	assert.deepEqual(await resource.read('/catalogue', { force: true }), ['Plumbing']);
});
