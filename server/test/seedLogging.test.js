const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("seed connection diagnostics do not print database credentials or private connection details", () => {
	const script = `
		const Module = require('node:module');
		const original = Module._load;
		const client = { async query(sql) {
			if (sql.includes('current_database()')) return { rows: [{ db: 'private-database-marker', schema: 'private-schema-marker', host: 'private-host-marker' }] };
			return { rows: [] };
		}, release() {} };
		Module._load = function(name, parent, ...rest) {
			if (name === '../config/db' && parent.filename.endsWith('seedDb.js')) return { connect: async () => client, end: async () => {} };
			if (name === 'dotenv') return { config() {} };
			return original.call(this, name, parent, ...rest);
		};
		require('./seeds/seedDb');
	`;
	const result = spawnSync(process.execPath, ["-e", script], {
		cwd: path.resolve(__dirname, ".."),
		env: { ...process.env, DATABASE_URL: "postgresql://user-marker:password-marker@private-host-marker/private-database-marker" },
		encoding: "utf8",
	});
	assert.equal(result.status, 0);
	assert.match(result.stdout, /Connected to DB/);
	for (const value of ["user-marker", "password-marker", "private-host-marker", "private-database-marker", "private-schema-marker", "DATABASE_URL:"]) {
		assert(!`${result.stdout}${result.stderr}`.includes(value));
	}
});
