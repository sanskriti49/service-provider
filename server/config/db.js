require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

const poolConfig = isProduction
	? {
			connectionString: process.env.DATABASE_URL,
			ssl: { rejectUnauthorized: false },
		}
	: {
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
		isProduction
			? "🚀 LIVE: Connected to NEON DB CLOUD"
			: "🏠 LOCAL: Connected to localized machine PostgreSQL",
	);
});

pool.on("error", (err) => {
	console.error("❌ DB Engine Error Encountered:", err);
});

module.exports = {
	query: (text, params) => pool.query(text, params),
	connect: () => pool.connect(),
	end: () => pool.end(),
};
