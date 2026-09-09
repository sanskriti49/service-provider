class MemoryCache {
	constructor(defaultTtlMs = 180000) {
		this.cache = new Map();
		this.defaultTtlMs = defaultTtlMs;
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

	set(key, value, ttlMs = this.defaultTtlMs) {
		if (this.cache.size >= 500) {
			const firstKey = this.cache.keys().next().value;
			this.cache.delete(firstKey);
		}

		this.cache.set(key, {
			value,
			expiry: Date.now() + ttlMs,
		});
	}

	del(key) {
		this.cache.delete(key);
	}

	delPattern(pattern) {
		for (const key of this.cache.keys()) {
			if (key.includes(pattern)) {
				this.cache.delete(key);
			}
		}
	}

	clear() {
		this.cache.clear();
	}
}

const cache = new MemoryCache();
module.exports = cache;
