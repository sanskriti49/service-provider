/**
 * Multi-Tier Resilient Cache (L1 Memory + L2 Redis Distributed Layer)
 * Provides ultra-fast local L1 in-memory hits, backed by Redis for multi-instance synchronization
 * and pub/sub cross-replica cache invalidation.
 */

class DistributedCache {
	constructor(defaultTtlMs = 180000) {
		this.cache = new Map();
		this.defaultTtlMs = defaultTtlMs;
		this.redisSub = null;
		this._setupRedisPubSub();
	}

	_isTest() {
		return (
			process.env.NODE_ENV === "test" ||
			process.argv.includes("--test") ||
			process.argv.some((a) => typeof a === "string" && a.includes("test"))
		);
	}

	_setupRedisPubSub() {
		if (this._isTest()) return;
		try {
			const { createRedisClient, isRedisReady } = require("../config/redisClient");
			const sub = createRedisClient();
			sub.on("ready", () => {
				sub.subscribe("taskgenie:cache:invalidate", (err) => {
					if (!err) this.redisSub = sub;
				});
			});
			sub.on("message", (channel, message) => {
				if (channel === "taskgenie:cache:invalidate") {
					try {
						const event = JSON.parse(message);
						if (event.action === "del" && event.key) {
							this.cache.delete(event.key);
						} else if (event.action === "delPattern" && event.pattern) {
							for (const k of this.cache.keys()) {
								if (k.includes(event.pattern)) this.cache.delete(k);
							}
						} else if (event.action === "clear") {
							this.cache.clear();
						}
					} catch (_) {}
				}
			});
		} catch (_) {}
	}

	_getRedis() {
		try {
			const { getRedisClient, isRedisReady } = require("../config/redisClient");
			if (isRedisReady()) return getRedisClient();
		} catch (_) {}
		return null;
	}

	get(key) {
		const item = this.cache.get(key);
		if (!item) return null;

		if (Date.now() > item.expiry) {
			this.cache.delete(key);
			return null;
		}

		return item.value;
	}

	async getAsync(key) {
		const local = this.get(key);
		if (local !== null) return local;

		const redis = this._getRedis();
		if (!redis) return null;

		try {
			const raw = await redis.get(`cache:${key}`);
			if (!raw) return null;
			const value = JSON.parse(raw);
			// Populate L1 cache with remaining TTL
			const pttl = await redis.pttl(`cache:${key}`);
			const ttlMs = pttl > 0 ? pttl : this.defaultTtlMs;
			this.cache.set(key, { value, expiry: Date.now() + ttlMs });
			return value;
		} catch (_) {
			return null;
		}
	}

	set(key, value, ttlMs = this.defaultTtlMs) {
		if (this.cache.size >= 500) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}

		this.cache.set(key, {
			value,
			expiry: Date.now() + ttlMs,
		});

		const redis = this._getRedis();
		if (redis) {
			try {
				redis.set(`cache:${key}`, JSON.stringify(value), "PX", ttlMs).catch(() => {});
			} catch (_) {}
		}
	}

	del(key) {
		this.cache.delete(key);
		const redis = this._getRedis();
		if (redis) {
			try {
				redis.del(`cache:${key}`).catch(() => {});
				redis.publish("taskgenie:cache:invalidate", JSON.stringify({ action: "del", key })).catch(() => {});
			} catch (_) {}
		}
	}

	delPattern(pattern) {
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				this.cache.delete(key);
			}
		}

		const redis = this._getRedis();
		if (redis) {
			try {
				redis.publish("taskgenie:cache:invalidate", JSON.stringify({ action: "delPattern", pattern })).catch(() => {});
				// Scan and delete matching Redis keys
				const stream = redis.scanStream({ match: `cache:*${pattern}*`, count: 100 });
				stream.on("data", (keys) => {
					if (keys.length) {
						const pipeline = redis.pipeline();
						keys.forEach((k) => pipeline.del(k));
						pipeline.exec().catch(() => {});
					}
				});
			} catch (_) {}
		}
	}

	clear() {
		this.cache.clear();
		const redis = this._getRedis();
		if (redis) {
			try {
				redis.publish("taskgenie:cache:invalidate", JSON.stringify({ action: "clear" })).catch(() => {});
			} catch (_) {}
		}
	}
}

const cache = new DistributedCache();
module.exports = cache;
