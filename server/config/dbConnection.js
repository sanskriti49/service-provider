const fs = require("node:fs");
const { X509Certificate } = require("node:crypto");

function databaseConnectionConfig(env) {
	let connectionString = env.DATABASE_URL || undefined;
	let urlMode;
	if (connectionString) {
		let url;
		try { url = new URL(connectionString); } catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL"); }
		if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
			throw new Error("DATABASE_URL must be a valid PostgreSQL URL with a hostname");
		}
		for (const key of url.searchParams.keys()) {
			if (["ssl", "sslcert", "sslkey", "sslrootcert", "sslpassword", "uselibpqcompat", "sslnegotiation"].includes(key.toLowerCase())) {
				throw new Error(`DATABASE_URL parameter ${key} is unsupported; use DB_SSL_MODE and DB_SSL_CA_FILE`);
			}
		}
		const modes = url.searchParams.getAll("sslmode");
		if (modes.length > 1 || (modes.length && !["disable", "verify-full"].includes(modes[0]))) {
			throw new Error("DATABASE_URL sslmode must be disable or verify-full, with no duplicates");
		}
		urlMode = modes[0];
		url.searchParams.delete("sslmode");
		connectionString = url.toString();
	}
	if (env.PGSSLMODE) throw new Error("PGSSLMODE is unsupported; use DB_SSL_MODE");
	const mode = env.DB_SSL_MODE || urlMode;
	if (!["disable", "verify-full"].includes(mode)) {
		throw new Error("Set DB_SSL_MODE to disable or verify-full (or use that sslmode in DATABASE_URL)");
	}
	if (urlMode && env.DB_SSL_MODE && urlMode !== env.DB_SSL_MODE) {
		throw new Error("DB_SSL_MODE conflicts with DATABASE_URL sslmode");
	}
	if (mode === "disable" && env.DB_SSL_CA_FILE) {
		throw new Error("DB_SSL_CA_FILE requires DB_SSL_MODE=verify-full");
	}
	let ssl = false;
	if (mode === "verify-full") {
		ssl = { rejectUnauthorized: true };
		if (env.DB_SSL_CA_FILE) {
			let ca;
			try { ca = fs.readFileSync(env.DB_SSL_CA_FILE, "utf8"); }
			catch { throw new Error("DB_SSL_CA_FILE cannot be read"); }
			const certificates = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
			try {
				if (!certificates.length || ca.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim()) throw new Error();
				for (const certificate of certificates) {
					if (!new X509Certificate(certificate).ca) throw new Error();
				}
			} catch { throw new Error("DB_SSL_CA_FILE must contain PEM CA certificates"); }
			ssl.ca = ca;
		}
	}
	return { connectionString, ssl };
}

module.exports = { databaseConnectionConfig };
