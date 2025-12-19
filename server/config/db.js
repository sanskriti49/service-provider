require("dotenv").config();
const { Pool } = require("pg");

const db = new Pool({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	password: process.env.DB_PASSWORD,
	port: parseInt(process.env.DB_PORT || "5432", 10),
	database: process.env.DB_NAME,
	ssl:
		process.env.DB_HOST === "localhost" ? false : { rejectUnauthorized: false },
});

db.on("connect", () => console.log("Connected to DB"));
db.on("error", (err) => console.error("DB Error:", err));

module.exports = db;
