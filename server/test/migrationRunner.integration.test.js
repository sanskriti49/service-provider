const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const { Pool } = require("pg");

const postgisUrl = process.env.MIGRATION_TEST_POSTGIS_URL;
const plainUrl = process.env.MIGRATION_TEST_PLAIN_URL;
if (process.env.REQUIRE_INTEGRATION_TESTS === "1" && (!postgisUrl || !plainUrl)) {
	throw new Error("MIGRATION_TEST_POSTGIS_URL and MIGRATION_TEST_PLAIN_URL are required");
}
const serverDir = path.resolve(__dirname, "..");

async function disposableDatabase(t, fixtureUrl) {
	const target = new URL(fixtureUrl);
	assert(["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname === "/taskgenie_migration_test" && !target.search,
		"Migration tests require an explicit local taskgenie_migration_test fixture server");
	const admin = new Pool({ connectionString: fixtureUrl });
	const name = `tg_migration_${randomUUID().replaceAll("-", "")}`;
	await admin.query(`CREATE DATABASE ${name}`);
	target.pathname = `/${name}`;
	const databaseUrl = target.toString();
	const pool = new Pool({ connectionString: databaseUrl });
	t.after(async () => {
		await pool.end();
		await admin.query(`DROP DATABASE ${name}`);
		await admin.end();
	});
	return { pool, databaseUrl };
}

function childEnv(databaseUrl) {
	return { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, DB_SSL_MODE: "disable", DB_SSL_CA_FILE: "", PGSSLMODE: "" };
}

function migrate(databaseUrl, sql) {
	const script = sql ? `const m=require('./migrations/create_tables');m.queries.splice(1,0,${JSON.stringify(sql)});m.runMigration().catch(()=>{process.exitCode=1}).finally(()=>require('./config/db').end())` : null;
	return spawnSync(process.execPath, script ? ["-e", script] : ["migrations/create_tables.js"], {
		cwd: serverDir, env: childEnv(databaseUrl), encoding: "utf8", timeout: 60000,
	});
}

for (const [name, url, spatial] of [["PostGIS", postgisUrl, true], ["plain PostgreSQL", plainUrl, false]]) {
	test(`clean and repeated migration with ${name}`, { skip: !url, timeout: 120000 }, async (t) => {
		const { pool, databaseUrl } = await disposableDatabase(t, url);
		for (let i = 0; i < 2; i++) {
			const result = migrate(databaseUrl);
			assert.equal(result.status, 0, result.stderr);
			assert.match(result.stdout, /All tables created successfully/);
		}
		const result = await pool.query(`SELECT to_regclass('public.bookings') IS NOT NULL AS booking,
			to_regclass('public.notification_outbox') IS NOT NULL AS outbox,
			EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='geom') AS spatial`);
		assert.deepEqual(result.rows[0], { booking: true, outbox: true, spatial });
	});
}

test("syntax errors containing spatial terms fail and rollback before a successful retry", { skip: !postgisUrl, timeout: 120000 }, async (t) => {
	const { pool, databaseUrl } = await disposableDatabase(t, postgisUrl);
	const result = migrate(databaseUrl, "SELECT geography invalid syntax !");
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Migration failed/);
	assert.doesNotMatch(result.stdout, /All tables created successfully/);
	assert.equal((await pool.query("SELECT to_regclass('public.users') AS users")).rows[0].users, null);
	assert.equal(migrate(databaseUrl).status, 0);
	assert.notEqual((await pool.query("SELECT to_regclass('public.notification_outbox') AS outbox")).rows[0].outbox, null);
});

test("constraint failure rolls back earlier migration steps", { skip: !postgisUrl, timeout: 60000 }, async (t) => {
	const { pool, databaseUrl } = await disposableDatabase(t, postgisUrl);
	const result = migrate(databaseUrl, "CREATE TABLE public.fixture_constraint (value integer CHECK (value > 0)); INSERT INTO public.fixture_constraint VALUES (-1)");
	assert.equal(result.status, 1);
	assert.doesNotMatch(result.stdout, /All tables created successfully/);
	const row = (await pool.query("SELECT to_regclass('public.users') AS users, to_regclass('public.fixture_constraint') AS fixture")).rows[0];
	assert.deepEqual(row, { users: null, fixture: null });
});

test("migration command exits nonzero and preserves an incompatible existing table", { skip: !postgisUrl, timeout: 60000 }, async (t) => {
	const { pool, databaseUrl } = await disposableDatabase(t, postgisUrl);
	await pool.query("CREATE TABLE public.users (id integer PRIMARY KEY)");
	await pool.query("INSERT INTO public.users VALUES (42)");
	const result = migrate(databaseUrl);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Migration failed/);
	assert.doesNotMatch(result.stdout, /All tables created successfully/);
	assert.equal((await pool.query("SELECT id FROM public.users")).rows[0].id, 42);
	assert.equal((await pool.query("SELECT to_regclass('public.services') AS services")).rows[0].services, null);
});

test("interrupted migration rolls back and can be retried", { skip: !postgisUrl, timeout: 120000 }, async (t) => {
	const { pool, databaseUrl } = await disposableDatabase(t, postgisUrl);
	const script = "const m=require('./migrations/create_tables');m.queries.splice(1,0,'SELECT pg_sleep(30)');m.runMigration().catch(()=>{process.exitCode=1}).finally(()=>require('./config/db').end())";
	const child = spawn(process.execPath, ["-e", script], { cwd: serverDir, env: childEnv(databaseUrl), stdio: ["ignore", "pipe", "pipe"] });
	let output = "";
	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => { child.kill(); reject(new Error("Migration did not reach the interruption point")); }, 20000);
		child.stdout.on("data", chunk => { output += chunk; if (output.includes("Running Step 2/")) { clearTimeout(timeout); child.kill(); } });
		child.on("error", reject);
		child.on("exit", () => { clearTimeout(timeout); output.includes("Running Step 2/") ? resolve() : reject(new Error("Migration exited before interruption")); });
	});
	assert.equal((await pool.query("SELECT to_regclass('public.users') AS users")).rows[0].users, null);
	assert.equal(migrate(databaseUrl).status, 0);
});
