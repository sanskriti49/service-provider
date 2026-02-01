require("dotenv").config();
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const dbHost = process.env.DB_HOST;

// check if we are using neon or local
// check if the connection string OR the host variable contains "neon.tech"
const isNeon =
	(connectionString && connectionString.includes("neon.tech")) ||
	(dbHost && dbHost.includes("neon.tech"));

const poolConfig = process.env.DATABASE_URL
	? {
			connectionString: process.env.DATABASE_URL,
			ssl: isNeon ? { rejectUnauthorized: false } : false, // for neon
		}
	: {
			// LOCAL CONFIG ( when DATABASE_URL is missing)
			user: process.env.DB_USER,
			host: process.env.DB_HOST,
			password: process.env.DB_PASSWORD,
			port: parseInt(process.env.DB_PORT || "5432", 10),
			database: process.env.DB_NAME,
			ssl: false,
		};

const pool = new Pool(poolConfig);

pool.on("connect", () => {
	console.log(
		isNeon
			? "✅ Connected to NEON DB (SSL Enabled)"
			: "✅ Connected to LOCAL DB",
	);
});

pool.on("error", (err) => {
	console.error("❌ DB Error:", err);
});

module.exports = {
	query: (text, params) => pool.query(text, params),
	connect: () => pool.connect(),
	end: () => pool.end(),
};
