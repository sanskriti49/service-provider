import test from "node:test";
import assert from "node:assert/strict";
import { apiCache } from "../src/utils/apiCache.js";

test("apiCache: set and get cached data", () => {
	apiCache.set("user_123", { name: "Bob" }, 5000);
	assert.deepStrictEqual(apiCache.get("user_123"), { name: "Bob" });
});

test("apiCache: delete removes cached data", () => {
	apiCache.set("temp", "test", 5000);
	apiCache.delete("temp");
	assert.strictEqual(apiCache.get("temp"), null);
});

test("apiCache: clear empties cache", () => {
	apiCache.set("k1", 1, 5000);
	apiCache.set("k2", 2, 5000);
	apiCache.clear();
	assert.strictEqual(apiCache.get("k1"), null);
	assert.strictEqual(apiCache.get("k2"), null);
});

test("apiCache: expired item returns null", async () => {
	apiCache.set("short_lived", "expired", 20);
	await new Promise((r) => setTimeout(r, 35));
	assert.strictEqual(apiCache.get("short_lived"), null);
});

test("discovery invalidation clears every location/filter variant while preserving service metadata",()=>{
	apiCache.clear();apiCache.set('providers_service=cleaning&radius=50',[]);apiCache.set('providers_service=cleaning&radius=100',[]);apiCache.set('service_cleaning',{name:'Cleaning'});
	apiCache.deletePrefix('providers_');assert.equal(apiCache.get('providers_service=cleaning&radius=50'),null);assert.equal(apiCache.get('providers_service=cleaning&radius=100'),null);assert.deepEqual(apiCache.get('service_cleaning'),{name:'Cleaning'});
});
