const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const tls = require("node:tls");
const { execFileSync, spawnSync } = require("node:child_process");
const { databaseConnectionConfig } = require("../config/dbConnection");
const { Client } = require("pg");

test("explicit local plaintext and PostgreSQL URL compatibility", () => {
	assert.equal(databaseConnectionConfig({ DB_SSL_MODE: "disable" }).ssl, false);
	const config = databaseConnectionConfig({ DATABASE_URL: "postgresql://user:pass@localhost:5432/test?sslmode=disable&application_name=taskgenie" });
	assert.equal(config.ssl, false);
	assert.equal(new URL(config.connectionString).searchParams.get("application_name"), "taskgenie");
	const client = new Client(config);
	assert.equal(client.connectionParameters.ssl, false);
});

test("verified TLS is passed to pg without URL overrides", () => {
	const config = databaseConnectionConfig({ DATABASE_URL: "postgresql://user:pass@db.example.com/test?sslmode=verify-full", DB_SSL_MODE: "verify-full" });
	assert.deepEqual(config.ssl, { rejectUnauthorized: true });
	assert.equal(new URL(config.connectionString).searchParams.has("sslmode"), false);
	const client = new Client(config);
	assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
});

test("application pool verifies IP address identity", () => {
	const script = `
		const assert = require('node:assert/strict');
		const db = require('./config/db');
		const check = db.pool.options.ssl.checkServerIdentity;
		const cert = { subject: { CN: 'localhost' }, subjectaltname: 'DNS:localhost' };
		assert.equal(check('ignored', cert).code, 'ERR_TLS_CERT_ALTNAME_INVALID');
		db.end();
	`;
	const result = spawnSync(process.execPath, ["-e", script], {
		cwd: path.resolve(__dirname, ".."),
		env: { ...process.env, DATABASE_URL: "postgresql://user:pass@127.0.0.1/test", DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: "", PGSSLMODE: "" },
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
});

test("missing, invalid, conflicting and overriding settings fail", () => {
	for (const env of [
		{}, { DB_SSL_MODE: "require" }, { DB_SSL_MODE: "disable", PGSSLMODE: "no-verify" },
		{ DATABASE_URL: "invalid", DB_SSL_MODE: "disable" },
		{ DATABASE_URL: "postgresql://db/test?sslmode=require" },
		{ DATABASE_URL: "postgresql://db/test?sslmode=disable&sslmode=verify-full" },
		{ DATABASE_URL: "postgresql://db/test?sslmode=disable", DB_SSL_MODE: "verify-full" },
		{ DATABASE_URL: "postgresql://db/test?ssl=true", DB_SSL_MODE: "verify-full" },
		{ DATABASE_URL: "postgresql://db/test?sslrootcert=other", DB_SSL_MODE: "verify-full" },
		{ DATABASE_URL: "postgresql://db/test?uselibpqcompat=true", DB_SSL_MODE: "verify-full" },
		{ DB_SSL_MODE: "disable", DB_SSL_CA_FILE: "any" },
	]) assert.throws(() => databaseConnectionConfig(env));
});

test("missing and malformed CA files fail clearly", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskgenie-ca-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const malformed = path.join(dir, "bad.pem");
	fs.writeFileSync(malformed, "not a certificate");
	assert.throws(() => databaseConnectionConfig({ DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: path.join(dir, "missing") }), /cannot be read/);
	assert.throws(() => databaseConnectionConfig({ DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: malformed }), /PEM CA certificates/);
});

test("TLS handshake validates both CA trust and hostname", async (t) => {
	if (spawnSync("openssl", ["version"], { stdio: "ignore" }).status !== 0) return t.skip("OpenSSL executable unavailable");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "taskgenie-tls-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const run = (args) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
	run(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "1", "-subj", "/CN=Test CA", "-addext", "basicConstraints=critical,CA:TRUE"]);
	run(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "server.key", "-out", "server.csr", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"]);
	fs.writeFileSync(path.join(dir, "extensions.cnf"), "subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n");
	run(["x509", "-req", "-in", "server.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "server.pem", "-days", "1", "-extfile", "extensions.cnf"]);
	const server = tls.createServer({ key: fs.readFileSync(path.join(dir, "server.key")), cert: fs.readFileSync(path.join(dir, "server.pem")) }, (socket) => socket.end());
	server.on("tlsClientError", () => {});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const ssl = databaseConnectionConfig({ DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: path.join(dir, "ca.pem") }).ssl;
	const connect = (options) => new Promise((resolve, reject) => {
		const socket = tls.connect({ host: "127.0.0.1", port: server.address().port, ...options }, () => { socket.end(); resolve(); });
		socket.on("error", reject);
	});
	await connect({ ...ssl, servername: "localhost" });
	await assert.rejects(connect({ ...ssl, servername: "wrong.example" }), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
	await assert.rejects(connect({ rejectUnauthorized: true, servername: "localhost" }), { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" });
});
