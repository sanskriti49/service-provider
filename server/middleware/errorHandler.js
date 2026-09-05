function errorHandler(err, req, res, next) {
	if (res.headersSent) {
		return next(err);
	}

	console.error("🔥 SERVER ERROR:", err);
	const statusCode =
		(typeof err.status === "number" && err.status >= 400 && err.status < 600 && err.status) ||
		(typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600 && err.statusCode) ||
		500;

	res.status(statusCode).json({
		error: err.message || "An unexpected internal server error occurred",
	});
}

module.exports = errorHandler;
