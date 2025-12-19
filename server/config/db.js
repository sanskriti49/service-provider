require("dotenv").config();
const { Pool } = require("pg");

// checks if proj is in production (neon) or local
const isProduction = !!process.env.DATABASE_URL;

const poolConfig = isProduction
	? {
			connectionString: process.env.DATABASE_URL,
			ssl: {
				rejectUnauthorized: false, // for neon
			},
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
		isProduction ? "✅ Connected to NEON DB" : "✅ Connected to LOCAL DB"
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
