require("dotenv").config();
const { Pool } = require("pg");

const db = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	port: parseInt(process.env.DB_PORT, 10),
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

db.on("connect", () => console.log("Connected to DB"));
db.on("error", (err) => console.error("DB Error:", err));

module.exports = db;
