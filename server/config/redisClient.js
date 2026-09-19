require("dotenv").config();
const Redis = require("ioredis");

let redisClient = null;
let isReady = false;
let connectionAttempted = false;
let warnedOffline = false;

function isTestEnvironment() {
	return (
		process.env.NODE_ENV === "test" ||
		process.argv.includes("--test") ||
		process.argv.some((a) => typeof a === "string" && a.includes("test"))
	);
}

function getRedisConfig() {
	const redisUrl = process.env.REDIS_URL;
	const isTest = isTestEnvironment();
	const isTls = Boolean(
		redisUrl && (redisUrl.startsWith("rediss://") || redisUrl.includes("upstash.io")),
	);

	const baseOptions = {
		maxRetriesPerRequest: null,
		enableReadyCheck: true,
		lazyConnect: true,
		connectTimeout: isTest ? 1000 : 5000,
		enableOfflineQueue: true,
		...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
		retryStrategy: (times) => {
			if (isTest || !process.env.REDIS_URL) {
				return null;
			}
			return Math.min(times * 500, 5000);
		},
	};

	if (redisUrl) {
		return [redisUrl, baseOptions];
	}

	return [{
		host: process.env.REDIS_HOST || "127.0.0.1",
		port: parseInt(process.env.REDIS_PORT || "6379", 10),
		password: process.env.REDIS_PASSWORD || undefined,
		...baseOptions,
	}];
}

function getRedisClient() {
	if (redisClient) return redisClient;

	const args = getRedisConfig();
	redisClient = new Redis(...args);

	redisClient.on("ready", () => {
		isReady = true;
		warnedOffline = false;
		if (!isTestEnvironment()) {
			console.log("⚡ [Redis] Connected and ready.");
		}
	});

	redisClient.on("connect", () => {
		isReady = true;
	});

	redisClient.on("error", (err) => {
		isReady = false;
		if (!warnedOffline && !isTestEnvironment()) {
			warnedOffline = true;
			console.log(
				`ℹ️ [Redis] Notice: ${err.message}. Operating in resilient in-memory fallback mode.`,
			);
		}
	});

	redisClient.on("close", () => {
		isReady = false;
	});

	redisClient.on("end", () => {
		isReady = false;
	});

	if (!connectionAttempted) {
		connectionAttempted = true;
		redisClient.connect().catch(() => {
			isReady = false;
		});
	}

	return redisClient;
}

function createRedisClient(customOptions = {}) {
	const [target, baseOpts] = getRedisConfig();
	let client;
	if (typeof target === "string") {
		client = new Redis(target, { ...baseOpts, ...customOptions });
	} else {
		client = new Redis({ ...target, ...baseOpts, ...customOptions });
	}
	client.on("error", () => {});
	return client;
}

function isRedisReady() {
	return isReady && redisClient && redisClient.status === "ready";
}

async function closeRedis() {
	if (redisClient) {
		try {
			await redisClient.quit();
		} catch (_) {
			redisClient.disconnect();
		}
		redisClient = null;
		isReady = false;
		connectionAttempted = false;
		warnedOffline = false;
	}
}

module.exports = {
	getRedisClient,
	createRedisClient,
	isRedisReady,
	closeRedis,
};
