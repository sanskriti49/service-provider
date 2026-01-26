function errorHandler(err, req, res, next) {
	console.error("🔥 SERVER ERROR:", err);
	res.status(500).json({ error: err.message });
}

module.exports = errorHandler;
