const crypto = require("crypto");
const { getRedisClient, isRedisReady } = require("../config/redisClient");

// In-memory fallback map for offline / test environments
const memoryLocks = new Map();

// Atomic Lua script: only delete the key if the token matches the lock holder
const RELEASE_LUA_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

class LockAcquisitionError extends Error {
	constructor(message = "Resource is currently locked by another concurrent operation") {
		super(message);
		this.name = "LockAcquisitionError";
		this.statusCode = 409;
	}
}

/**
 * Attempts to acquire an exclusive distributed lock.
 * @param {string} resourceKey Unique key identifying the locked resource
 * @param {number} ttlMs Time to live in milliseconds before auto-expiry (prevents deadlocks)
 * @returns {Promise<{ acquired: boolean, token: string | null, key: string }>}
 */
async function acquireLock(resourceKey, ttlMs = 8000) {
	const key = `lock:${resourceKey}`;
	const token = crypto.randomBytes(16).toString("hex");

	try {
		if (isRedisReady()) {
			const redis = getRedisClient();
			// SET lock:<key> <token> PX <ttlMs> NX
			const result = await redis.set(key, token, "PX", ttlMs, "NX");
			if (result === "OK") {
				return { acquired: true, token, key, engine: "redis" };
			}
			return { acquired: false, token: null, key, engine: "redis" };
		}
	} catch (redisErr) {
		// On Redis glitch, seamlessly degrade to in-memory lock
	}

	// In-memory fallback mutex
	const existing = memoryLocks.get(key);
	const now = Date.now();

	if (existing && existing.expiresAt > now) {
		return { acquired: false, token: null, key, engine: "in-memory" };
	}

	const timeoutId = setTimeout(() => {
		memoryLocks.delete(key);
	}, ttlMs);

	if (typeof timeoutId.unref === "function") {
		timeoutId.unref();
	}

	memoryLocks.set(key, { token, expiresAt: now + ttlMs, timeoutId });
	return { acquired: true, token, key, engine: "in-memory" };
}

/**
 * Atomically releases the distributed lock if the token matches.
 * @param {string} key Full lock key
 * @param {string} token Ownership token returned by acquireLock
 * @returns {Promise<boolean>}
 */
async function releaseLock(key, token) {
	if (!key || !token) return false;

	try {
		if (isRedisReady()) {
			const redis = getRedisClient();
			const result = await redis.eval(RELEASE_LUA_SCRIPT, 1, key, token);
			return result === 1;
		}
	} catch (_) {}

	// In-memory fallback release
	const existing = memoryLocks.get(key);
	if (existing && existing.token === token) {
		clearTimeout(existing.timeoutId);
		memoryLocks.delete(key);
		return true;
	}
	return false;
}

/**
 * Executes an async action within the protection of a distributed lock.
 * Automatically releases the lock when finished or upon exception.
 * @param {string} resourceKey Resource identifier
 * @param {number} ttlMs Lock TTL
 * @param {Function} fn Async function to execute
 */
async function withDistributedLock(resourceKey, ttlMs, fn) {
	const lock = await acquireLock(resourceKey, ttlMs);
	if (!lock.acquired) {
		throw new LockAcquisitionError(
			`Lock collision on resource [${resourceKey}]: another request is currently processing this slot.`,
		);
	}

	try {
		return await fn();
	} finally {
		await releaseLock(lock.key, lock.token);
	}
}

module.exports = {
	acquireLock,
	releaseLock,
	withDistributedLock,
	LockAcquisitionError,
};
