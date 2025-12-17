// middleware/errorHandler.js
function errorHandler(err, req, res, next) {
	// console.error("Error:", err.message);
	// res.status(500).json({ error: "Internal Server Error" });
	console.error("🔥 SERVER ERROR:", err);
	res.status(500).json({ error: err.message });
}

module.exports = errorHandler;
