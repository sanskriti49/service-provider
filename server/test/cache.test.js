const test = require("node:test");
const assert = require("node:assert/strict");
const cache = require("../utils/cache");

test("cache: set and get returns cached value", () => {
	cache.set("test_key", { name: "Alice" }, 1000);
	const value = cache.get("test_key");
	assert.deepStrictEqual(value, { name: "Alice" });
});

test("cache: del removes key", () => {
	cache.set("to_delete", 123, 1000);
	cache.del("to_delete");
	assert.strictEqual(cache.get("to_delete"), null);
});

test("cache: delPattern removes all keys matching substring pattern", () => {
	cache.set("providers_plumber_1", "p1", 5000);
	cache.set("providers_plumber_2", "p2", 5000);
	cache.set("services_all", "s1", 5000);

	cache.delPattern("providers_plumber");

	assert.strictEqual(cache.get("providers_plumber_1"), null);
	assert.strictEqual(cache.get("providers_plumber_2"), null);
	assert.strictEqual(cache.get("services_all"), "s1");
});

test("cache: expired item returns null", async () => {
	cache.set("expiring_key", "hello", 20); // 20ms TTL
	await new Promise((resolve) => setTimeout(resolve, 35));
	assert.strictEqual(cache.get("expiring_key"), null);
});
