const test = require("node:test");
const assert = require("node:assert/strict");
const {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	calculateMatchScore,
} = require("../utils/geoUtils");

test("geoUtils: calculateHaversineDistance calculates distance accurately", () => {
	// Distance between Mumbai (19.0760, 72.8777) and Pune (18.5204, 73.8567) is ~120-150 km
	const dist = calculateHaversineDistance(19.076, 72.8777, 18.5204, 73.8567);
	assert.ok(dist > 100 && dist < 160, `Distance should be ~120-150km, got ${dist}`);
});

test("geoUtils: calculateHaversineDistance handles identical coordinates", () => {
	const dist = calculateHaversineDistance(28.7041, 77.1025, 28.7041, 77.1025);
	assert.strictEqual(dist, 0);
});

test("geoUtils: calculateHaversineDistance handles invalid/null coordinates", () => {
	assert.strictEqual(calculateHaversineDistance(null, 77.1025, 28.7041, 77.1025), null);
	assert.strictEqual(calculateHaversineDistance(28.7041, NaN, 28.7041, 77.1025), null);
});

test("geoUtils: estimateTravelTimeMinutes computes realistic buffer times", () => {
	assert.strictEqual(estimateTravelTimeMinutes(null), 20);
	assert.strictEqual(estimateTravelTimeMinutes(0.4), 5);
	const timeFor28km = estimateTravelTimeMinutes(28); // 28km at 28km/h = 60m + 5m buffer = 65m
	assert.strictEqual(timeFor28km, 65);
});

test("geoUtils: calculateMatchScore yields higher score for closer, high-rated providers", () => {
	const closeAndHighRated = calculateMatchScore({
		distanceKm: 1.5,
		maxRadiusKm: 25,
		rating: 4.9,
		price: 450,
		avgPrice: 500,
		hasAvailableSlots: true,
	});

	const farAndLowerRated = calculateMatchScore({
		distanceKm: 24,
		maxRadiusKm: 25,
		rating: 3.5,
		price: 800,
		avgPrice: 500,
		hasAvailableSlots: false,
	});

	assert.ok(
		closeAndHighRated > farAndLowerRated,
		`Expected closeAndHighRated (${closeAndHighRated}) > farAndLowerRated (${farAndLowerRated})`,
	);
	assert.ok(closeAndHighRated >= 0 && closeAndHighRated <= 100);
});
