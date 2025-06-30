require("dotenv").config(); // For CommonJS
const { Client } = require("pg");
const { Pool } = require("pg");

const db = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	port: parseInt(process.env.DB_PORT, 10),
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

db.connect()
	.then(() => console.log("Connected to DB"))
	.catch((err) => console.error("DB Connection Error:", err));

module.exports = db;
