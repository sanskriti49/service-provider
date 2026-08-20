// Fast in-memory client cache with TTL
const cacheStore = new Map();

export const apiCache = {
	get: (key) => {
		const item = cacheStore.get(key);
		if (!item) return null;
		if (Date.now() > item.expiry) {
			cacheStore.delete(key);
			return null;
		}
		return item.data;
	},
	set: (key, data, ttlMs = 120000) => { // 2 mins default
		if (cacheStore.size > 200) {
			const firstKey = cacheStore.keys().next().value;
			cacheStore.delete(firstKey);
		}
		cacheStore.set(key, { data, expiry: Date.now() + ttlMs });
	},
	delete: (key) => {
		cacheStore.delete(key);
	},
	clear: () => {
		cacheStore.clear();
	},
};
