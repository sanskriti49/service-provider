const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const path = require("node:path");
const { Pool } = require("pg");

const fixtureUrl = process.env.OUTBOX_STARTUP_TEST_DATABASE_URL;
const container = process.env.OUTBOX_STARTUP_TEST_CONTAINER;
if (process.env.REQUIRE_INTEGRATION_TESTS === "1" && (!fixtureUrl || !container)) {
	throw new Error("OUTBOX_STARTUP_TEST_DATABASE_URL and OUTBOX_STARTUP_TEST_CONTAINER are required");
}
const serverDir = path.resolve(__dirname, "..");
const noDotenv = "require('dotenv').config=()=>({parsed:{}});";
const bootScript = noDotenv + "const h=require('node:http');const listen=h.Server.prototype.listen;h.Server.prototype.listen=function(...args){this.once('listening',()=>console.log('TEST_BOUND_PORT='+this.address().port));return listen.apply(this,args)};const q=require('./utils/eventQueue');const start=q.start.bind(q);q.start=()=>{console.log('TEST_DISPATCHER_STARTED');return start()};require('./index');";

function childEnv(url) {
	const env = {};
	for (const name of ["PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME"]) {
		if (process.env[name]) env[name] = process.env[name];
	}
	return { ...env, NODE_ENV: "test", DATABASE_URL: url, DB_SSL_MODE: "disable", DB_SSL_CA_FILE: "",
		PGSSLMODE: "", JWT_SECRET: "fixture-only", PORT: "0", REDIS_URL: "redis://127.0.0.1:1",
		PAYMENT_RECONCILIATION_ENABLED: "false", AWS_EC2_METADATA_DISABLED: "true" };
}

function runChild(script, url) {
	return spawnSync(process.execPath, ["-e", script], { cwd: serverDir, env: childEnv(url), encoding: "utf8", timeout: 60000 });
}

function runMigration(url) {
	return spawnSync(process.execPath, ["--require", "./test/fixtures/disableDotenv.cjs", "migrations/migrate_notification_outbox.js"],
		{ cwd: serverDir, env: childEnv(url), encoding: "utf8", timeout: 60000 });
}

async function assertStarted(url) {
	const child = spawn(process.execPath, ["-e", bootScript], { cwd: serverDir, env: childEnv(url), stdio: ["ignore", "pipe", "pipe"] });
	let output = "";
	try {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("Fixture API did not start")), 60000);
			const onData = chunk => {
				output += chunk;
				if (output.includes("Server listening")) { clearTimeout(timeout); resolve(); }
			};
			child.stdout.on("data", onData);
			child.stderr.on("data", onData);
			child.once("error", error => { clearTimeout(timeout); reject(error); });
			child.once("exit", code => { clearTimeout(timeout); reject(new Error(`Fixture API exited before listening (${code})`)); });
		});
		assert.match(output, /TEST_DISPATCHER_STARTED/);
		assert.doesNotMatch(output, /Notification outbox dispatch failed/);
		const port = Number(output.match(/TEST_BOUND_PORT=(\d+)/)?.[1]);
		assert.ok(port > 0, "Fixture API must report its assigned port");
		const health = await fetch(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(5000) });
		assert.equal(health.status, 200);
		const socket = await fetch(`http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`, { signal: AbortSignal.timeout(5000) });
		assert.equal(socket.status, 200);
	} finally {
		if (child.exitCode === null && child.signalCode === null) {
			const exited = new Promise(resolve => child.once("exit", resolve));
			child.kill();
			await exited;
		}
	}
}

test("startup requires the migrated, visible outbox in a disposable PostgreSQL server", { skip: !fixtureUrl || !container, timeout: 240000 }, async (t) => {
	const target = new URL(fixtureUrl);
	assert(["127.0.0.1", "localhost"].includes(target.hostname));
	assert(["/taskgenie_startup_test", "/taskgenie_migration_test"].includes(target.pathname));
	assert.equal(target.search, "");
	const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	assert.equal(docker("inspect", "--format", '{{index .Config.Labels "taskgenie.outbox-startup-fixture"}}', container), "true");
	const ports = JSON.parse(docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", container));
	assert.ok(ports["5432/tcp"].some(mapping => mapping.HostPort === target.port), "Fixture URL must point to the labelled container");
	const admin = new Pool({ connectionString: fixtureUrl });
	t.after(() => admin.end());
	async function freshDatabase() {
		const name = `tg_outbox_${randomUUID().replaceAll("-", "")}`;
		await admin.query(`CREATE DATABASE ${name}`);
		const url = new URL(fixtureUrl); url.pathname = `/${name}`;
		return url;
	}
	// The newly created databases are left in this disposable fixture. No existing database or volume is deleted.
	const url = await freshDatabase();
	const pool = new Pool({ connectionString: url.toString() });
	t.after(() => pool.end());

	await t.test("fresh database fails before listening or starting the dispatcher", async () => {
		assert.equal((await pool.query("SELECT to_regclass('public.notification_outbox') AS relation")).rows[0].relation, null);
		const result = runChild(bootScript, url.toString());
		assert.equal(result.status, 1);
		assert.match(result.stderr, /public\.notification_outbox is missing.*migrate:outbox/);
		assert.doesNotMatch(result.stdout + result.stderr, /TEST_DISPATCHER_STARTED|Server listening|Notification outbox dispatch failed/);
		assert.equal((await pool.query("SELECT to_regclass('public.notification_outbox') AS relation")).rows[0].relation, null);
	});
	await t.test("explicit migration is repeatable and startup works without losing rows", async () => {
		for (let i = 0; i < 2; i++) {
			const result = runMigration(url.toString());
			assert.equal(result.status, 0, "Fixture migration failed");
			assert.match(result.stdout, /Notification outbox migration complete/);
		}
		const id = randomUUID();
		await pool.query("INSERT INTO public.notification_outbox (id,event_type,payload) VALUES ($1,'SEND_EMAIL','{}')", [id]);
		await assertStarted(url.toString());
		await assertStarted(url.toString());
		assert.equal((await pool.query("SELECT count(*)::int AS n FROM public.notification_outbox WHERE id=$1", [id])).rows[0].n, 1);
	});
	await t.test("a shadowed search_path fails before dispatcher startup", async () => {
		await pool.query("CREATE SCHEMA fixture_shadow; CREATE TABLE fixture_shadow.notification_outbox (id integer)");
		const shadow = new URL(url); shadow.searchParams.set("options", "-c search_path=fixture_shadow,public");
		const result = runChild(bootScript, shadow.toString());
		assert.equal(result.status, 1);
		assert.match(result.stderr, /search_path/);
		assert.doesNotMatch(result.stdout, /TEST_DISPATCHER_STARTED|Server listening/);
	});
	await t.test("a failed migration and incompatible table fail without deleting existing data", async () => {
		const broken = await freshDatabase();
		const brokenPool = new Pool({ connectionString: broken.toString() });
		t.after(() => brokenPool.end());
		await brokenPool.query("CREATE TABLE public.notification_outbox (id integer); INSERT INTO public.notification_outbox VALUES (42)");
		const migration = runMigration(broken.toString());
		assert.equal(migration.status, 1);
		assert.match(migration.stderr, /Outbox migration failed/);
		assert.doesNotMatch(migration.stdout, /Notification outbox migration complete/);
		const start = runChild(bootScript, broken.toString());
		assert.equal(start.status, 1);
		assert.match(start.stderr, /Could not verify the notification outbox.*42703/);
		assert.doesNotMatch(start.stdout, /TEST_DISPATCHER_STARTED|Server listening/);
		assert.equal((await brokenPool.query("SELECT id FROM public.notification_outbox")).rows[0].id, 42);
	});
});
