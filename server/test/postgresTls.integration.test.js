const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const container = process.env.TLS_TEST_CONTAINER;
const fixtureUrl = process.env.TLS_TEST_DATABASE_URL;
if (process.env.REQUIRE_INTEGRATION_TESTS === "1" && (!container || !fixtureUrl)) {
	throw new Error("TLS_TEST_CONTAINER and TLS_TEST_DATABASE_URL are required");
}

test("actual PostgreSQL client verifies TLS trust and server identity", { skip: !container || !fixtureUrl, timeout: 90000 }, async (t) => {
	const target = new URL(fixtureUrl);
	assert.equal(target.hostname, "127.0.0.1");
	assert.equal(target.pathname, "/taskgenie_tls_test");
	assert.equal(target.search, "");
	const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
	const label = docker("inspect", "--format", '{{index .Config.Labels "taskgenie.tls-fixture"}}', container);
	assert.equal(label, "true", "TLS tests require a dedicated labelled fixture container");
	const port = docker("port", container, "5432/tcp");
	assert.equal(port, `127.0.0.1:${target.port}`, "Fixture URL must point to the labelled container");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskgenie-postgres-tls-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const openssl = (...args) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
	openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "1", "-subj", "/CN=TaskGenie Test CA", "-addext", "basicConstraints=critical,CA:TRUE");
	openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "other.key", "-out", "other.pem", "-days", "1", "-subj", "/CN=Other Test CA", "-addext", "basicConstraints=critical,CA:TRUE");
	openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "server.key", "-out", "server.csr", "-subj", "/CN=localhost");
	fs.writeFileSync(path.join(dir, "extensions.cnf"), "subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n");
	openssl("x509", "-req", "-in", "server.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "server.pem", "-days", "1", "-extfile", "extensions.cnf");
	docker("cp", path.join(dir, "server.key"), `${container}:/tmp/taskgenie-test-server.key`);
	docker("cp", path.join(dir, "server.pem"), `${container}:/tmp/taskgenie-test-server.pem`);
	docker("exec", container, "sh", "-c", "chown postgres:postgres /tmp/taskgenie-test-server.key /tmp/taskgenie-test-server.pem && chmod 600 /tmp/taskgenie-test-server.key");
	const sql = (statement) => docker("exec", "-u", "postgres", container, "psql", "-d", "taskgenie_tls_test", "-v", "ON_ERROR_STOP=1", "-c", statement);
	sql("ALTER SYSTEM SET ssl_cert_file = '/tmp/taskgenie-test-server.pem'");
	sql("ALTER SYSTEM SET ssl_key_file = '/tmp/taskgenie-test-server.key'");
	sql("ALTER SYSTEM SET ssl = on");
	sql("SELECT pg_reload_conf()");
	await new Promise(resolve => setTimeout(resolve, 1500));
	const query = (host, ca) => {
		const url = new URL(fixtureUrl);
		url.hostname = host;
		const script = "const db=require('./config/db');db.query('SELECT 1').then(()=>console.log('TLS_OK')).catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.end())";
		return spawnSync(process.execPath, ["-e", script], { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 15000,
			env: { ...process.env, NODE_ENV: "test", NODE_OPTIONS: "--dns-result-order=ipv4first", DATABASE_URL: url.toString(), DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: path.join(dir, ca), PGSSLMODE: "" } });
	};
	const good = query("localhost", "ca.pem");
	assert.equal(good.status, 0, good.stderr);
	assert.match(good.stdout, /TLS_OK/);
	const untrusted = query("localhost", "other.pem");
	assert.equal(untrusted.status, 1);
	assert.match(untrusted.stderr, /UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
	const mismatch = query("127.0.0.1", "ca.pem");
	assert.equal(mismatch.status, 1);
	assert.match(mismatch.stderr, /ERR_TLS_CERT_ALTNAME_INVALID/);
	sql("ALTER SYSTEM SET ssl = off");
	sql("SELECT pg_reload_conf()");
	await new Promise(resolve => setTimeout(resolve, 1500));
	const plaintext = query("localhost", "ca.pem");
	assert.equal(plaintext.status, 1);
	assert.match(plaintext.stderr, /server does not support SSL connections/i);
});
