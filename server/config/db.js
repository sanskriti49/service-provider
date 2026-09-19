require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const isNeonOrCloud = hasDatabaseUrl && (
	process.env.DATABASE_URL.includes("neon.tech") ||
	process.env.DATABASE_URL.includes("aws") ||
	process.env.DATABASE_URL.includes("supabase") ||
	process.env.DATABASE_URL.includes("sslmode=require")
);
const isPgBouncer = process.env.PG_BOUNCER === "true" || (hasDatabaseUrl && process.env.DATABASE_URL.includes("6543"));

// Resilient connection pooling configurations
const poolMax = parseInt(process.env.DB_POOL_MAX || "20", 10);
const poolMin = parseInt(process.env.DB_POOL_MIN || "2", 10);

const baseConfig = {
	max: poolMax,
	min: poolMin,
	idleTimeoutMillis: 30000,          // Close idle connections after 30 seconds
	connectionTimeoutMillis: 5000,     // Return error if connection is not acquired within 5 seconds
	maxUses: 7500,                     // Recycle connection after 7,500 queries to prevent memory leaks
	allowExitOnIdle: true,
};

// Prioritize DATABASE_URL whenever defined (e.g. Neon Cloud), else fall back to local credentials
const poolConfig = (hasDatabaseUrl || isProduction)
	? {
			connectionString: process.env.DATABASE_URL,
			ssl: (isNeonOrCloud || isProduction) ? { rejectUnauthorized: false } : false,
			...baseConfig,
		}
	: {
			user: process.env.DB_USER,
			host: process.env.DB_HOST,
			password: process.env.DB_PASSWORD,
			port: parseInt(process.env.DB_PORT || "5432", 10),
			database: process.env.DB_NAME,
			ssl: false,
			...baseConfig,
		};

const pool = new Pool(poolConfig);

pool.on("connect", () => {
	if (process.env.NODE_ENV !== "test") {
		console.log(
			hasDatabaseUrl && isNeonOrCloud
				? "🚀 LIVE: Connected to NEON DB CLOUD"
				: (isProduction ? "🚀 LIVE: Connected to PostgreSQL Cloud" : "🏠 LOCAL: Connected to localized machine PostgreSQL"),
		);
	}
});

pool.on("error", (err) => {
	// Guard against background idle client disconnects crashing the process
	console.error("❌ DB Engine Pool Error Encountered:", err.message);
});

/**
 * Returns telemetry metrics for PostgreSQL Connection Pool.
 */
function getPoolStats() {
	return {
		totalCount: pool.totalCount,
		idleCount: pool.idleCount,
		waitingCount: pool.waitingCount,
		maxLimit: poolConfig.max,
		isPgBouncerCompatible: isPgBouncer,
	};
}

module.exports = {
	query: (text, params) => pool.query(text, params),
	connect: () => pool.connect(),
	end: () => pool.end(),
	getPoolStats,
	pool,
};
