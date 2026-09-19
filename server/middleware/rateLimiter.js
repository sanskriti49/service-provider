const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedisClient, isRedisReady } = require("../config/redisClient");

/**
 * Creates a resilient rate limiter that uses Redis store if available,
 * falling back to MemoryStore if Redis is offline.
 */
function createResilientLimiter(options) {
	let store;
	try {
		if (isRedisReady()) {
			const client = getRedisClient();
			store = new RedisStore({
				sendCommand: (...args) => client.call(...args),
				prefix: options.prefix || "rl:",
			});
		}
	} catch (_) {
		// Memory store fallback
	}

	return rateLimit({
		windowMs: options.windowMs || 15 * 60 * 1000,
		max: options.max || 100,
		standardHeaders: true,
		legacyHeaders: false,
		validate: { trustProxy: false },
		message: {
			status: 429,
			error: options.message || "Too many requests from this IP, please try again later.",
		},
		store,
		// Skip rate limiting in tests if requested
		skip: (req) => {
			if (process.env.NODE_ENV === "test" && req.headers["x-test-bypass-ratelimit"]) {
				return true;
			}
			return false;
		},
	});
}

// Global API Limiter: 300 requests per 15 minutes
const globalLimiter = createResilientLimiter({
	windowMs: 15 * 60 * 1000,
	max: 300,
	prefix: "rl:global:",
	message: "Too many requests to TaskGenie API, please slow down.",
});

// Strict Auth Limiter: 10 requests per 15 minutes (protects login, register, OTP)
const authLimiter = createResilientLimiter({
	windowMs: 15 * 60 * 1000,
	max: 15,
	prefix: "rl:auth:",
	message: "Too many authentication attempts. Please try again after 15 minutes.",
});

// Booking Creation Limiter: 25 requests per 5 minutes
const bookingLimiter = createResilientLimiter({
	windowMs: 5 * 60 * 1000,
	max: 25,
	prefix: "rl:booking:",
	message: "Booking rate limit exceeded. Please wait a few moments before creating another reservation.",
});

module.exports = {
	globalLimiter,
	authLimiter,
	bookingLimiter,
	createResilientLimiter,
};
