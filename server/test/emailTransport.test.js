const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

for (const [environment, expected] of [["development", "mail"], ["production", "gmail"]]) {
	test(`email transport uses ${expected} in ${environment}`, () => {
		const script = `
			const Module = require('node:module');
			const assert = require('node:assert/strict');
			const original = Module._load;
			Module._load = function(name, ...args) {
				if (name === 'nodemailer') return { createTransport(config) {
					assert.equal(config.host || config.service, process.env.EXPECTED_TRANSPORT);
					return { sendMail: async () => ({ messageId: 'fixture' }) };
				} };
				if (name === './circuitBreaker') return { createProtectedBreaker: (fn) => ({ fire: fn }) };
				return original.call(this, name, ...args);
			};
			require('./utils/sendEmail')({ email: 'test@example.test', subject: 'test', message: 'test' })
				.catch(error => { console.error(error.message); process.exitCode = 1; });
		`;
		const result = spawnSync(process.execPath, ["-e", script], {
			cwd: path.resolve(__dirname, ".."),
			env: { ...process.env, NODE_ENV: environment, SMTP_HOST: "mail", SMTP_PORT: "1025", EXPECTED_TRANSPORT: expected },
			encoding: "utf8",
		});
		assert.equal(result.status, 0, result.stderr);
	});
}
