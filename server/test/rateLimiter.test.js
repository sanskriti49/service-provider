const { test, describe } = require("node:test");
const assert = require("node:assert");
const { createResilientLimiter } = require("../middleware/rateLimiter");

describe("rateLimiter: API Abuse & DDoS Prevention", () => {
	function createMockResponse() {
		const res = {
			statusCode: 200,
			body: null,
			headers: {},
			setHeader(key, value) {
				this.headers[key] = value;
			},
			getHeader(key) {
				return this.headers[key];
			},
			status(code) {
				this.statusCode = code;
				return this;
			},
			send(data) {
				this.body = data;
				return this;
			},
			json(data) {
				this.body = data;
				return this;
			},
		};
		return res;
	}

	test("allows requests under the rate limit threshold", async () => {
		const limiter = createResilientLimiter({
			windowMs: 60000,
			max: 5,
			prefix: "test:limit:",
		});

		let nextCalled = false;
		const req = {
			ip: "127.0.0.1",
			headers: {},
		};
		const res = createMockResponse();
		const next = () => {
			nextCalled = true;
		};

		await new Promise((resolve) => {
			limiter(req, res, () => {
				next();
				resolve();
			});
		});

		assert.strictEqual(nextCalled, true);
	});

	test("blocks requests when rate limit threshold is exceeded", async () => {
		const limiter = createResilientLimiter({
			windowMs: 60000,
			max: 2,
			prefix: "test:exceed:",
		});

		const req = {
			ip: "192.168.1.100",
			headers: {},
		};

		const res1 = createMockResponse();
		const res2 = createMockResponse();
		const res3 = createMockResponse();

		// Request 1: allowed
		await new Promise((r) => limiter(req, res1, r));
		assert.strictEqual(res1.statusCode, 200);

		// Request 2: allowed
		await new Promise((r) => limiter(req, res2, r));
		assert.strictEqual(res2.statusCode, 200);

		// Request 3: blocked (429)
		await new Promise((r) => {
			limiter(req, res3, () => {
				r();
			});
			setTimeout(r, 20);
		});

		assert.strictEqual(res3.statusCode, 429);
		assert.ok(res3.body);
	});
});
