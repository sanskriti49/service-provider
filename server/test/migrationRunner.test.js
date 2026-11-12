const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

function fixture({ postgis, failOn } = {}) {
	const statements = [];
	const failure = Object.assign(new Error("fixture SQL failure"), { code: "42601" });
	const client = {
		async query(sql) {
			statements.push(sql);
			if (sql.includes("pg_available_extensions")) return { rows: [{ available: postgis }] };
			if (sql === failOn) throw failure;
			return { rows: [] };
		},
		release() { statements.push("RELEASE"); },
	};
	const filename = path.resolve(__dirname, "../migrations/create_tables.js");
	const loaded = new Module(filename, module);
	loaded.filename = filename;
	loaded.paths = Module._nodeModulePaths(path.dirname(filename));
	const original = loaded.require.bind(loaded);
	loaded.require = (name) => name === "../config/db" ? { connect: async () => client } : original(name);
	loaded._compile(fs.readFileSync(filename, "utf8"), filename);
	return { migration: loaded.exports, statements, failure };
}

test("missing PostGIS skips only the designated spatial steps", async () => {
	const { migration, statements } = fixture({ postgis: false });
	await migration.runMigration();
	assert(!statements.includes("CREATE EXTENSION IF NOT EXISTS postgis;"));
	assert(statements.includes(require("../migrations/migrate_booking_location").locationSchema));
	assert(statements.some(sql => sql.includes("notification_outbox")));
	assert(statements.includes("COMMIT"));
	assert.equal(statements.at(-1), "RELEASE");
});

test("spatial SQL failure rolls back even when error code is normally associated with missing extensions", async () => {
	const failOn = "CREATE EXTENSION IF NOT EXISTS postgis;";
	const { migration, statements, failure } = fixture({ postgis: true, failOn });
	failure.code = "0A000";
	await assert.rejects(migration.runMigration(), error => error === failure);
	assert(statements.includes("ROLLBACK"));
	assert(!statements.includes("COMMIT"));
	assert.equal(statements.at(-1), "RELEASE");
});

test("missing PostGIS does not hide unrelated SQL containing spatial terms", async () => {
	const failOn = "SELECT broken_geography_statement";
	const { migration, statements, failure } = fixture({ postgis: false, failOn });
	const start = migration.queries.indexOf("CREATE EXTENSION IF NOT EXISTS postgis;");
	migration.queries.splice(start + 1, 0, failOn);
	await assert.rejects(migration.runMigration(), error => error === failure);
	assert(statements.includes(failOn));
	assert(statements.includes("ROLLBACK"));
	assert(!statements.includes("COMMIT"));
});
