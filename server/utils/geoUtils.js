const axios = require("axios");

/**
 * Calculates great-circle distance between two points on the Earth using Haversine formula
 * @param {number} lat1 - Latitude of point 1 in decimal degrees
 * @param {number} lon1 - Longitude of point 1 in decimal degrees
 * @param {number} lat2 - Latitude of point 2 in decimal degrees
 * @param {number} lon2 - Longitude of point 2 in decimal degrees
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
	if (
		lat1 == null ||
		lon1 == null ||
		lat2 == null ||
		lon2 == null ||
		isNaN(lat1) ||
		isNaN(lon1) ||
		isNaN(lat2) ||
		isNaN(lon2)
	) {
		return null;
	}

	const R = 6371; // Earth's mean radius in km
	const toRad = (deg) => (deg * Math.PI) / 180;

	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const rLat1 = toRad(lat1);
	const rLat2 = toRad(lat2);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return Math.round(distance * 10) / 10; // 1 decimal place
}

/**
 * Estimates driving travel time in minutes based on distance and urban traffic model
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} avgSpeedKmh - Average speed in km/h (default 28 km/h for urban transit)
 * @returns {number} Estimated transit duration in minutes
 */
function estimateTravelTimeMinutes(distanceKm, avgSpeedKmh = 28) {
	if (distanceKm == null || isNaN(distanceKm)) return 20; // safe default buffer
	if (distanceKm <= 0.5) return 5;
	const minutes = Math.ceil((distanceKm / avgSpeedKmh) * 60) + 5; // +5 mins parking/arrival grace
	return Math.max(5, minutes);
}

/**
 * Computes a weighted matching score (0-100) between a user request and a provider
 * @param {Object} params
 * @param {number} params.distanceKm - Distance in km
 * @param {number} params.maxRadiusKm - Search radius in km
 * @param {number} params.rating - Provider rating (0-5)
 * @param {number} params.price - Provider service price
 * @param {number} params.avgPrice - Average price in category
 * @param {boolean} params.hasAvailableSlots - Whether provider has slots today/soon
 * @returns {number} Composite Match Score between 0 and 100
 */
function calculateMatchScore({
	distanceKm,
	maxRadiusKm = 30,
	rating = 4.5,
	price = 500,
	avgPrice = 500,
	hasAvailableSlots = true,
}) {
	// 1. Proximity Score (Weight: 40%)
	let proximityScore = 70; // default if distance unknown
	if (distanceKm != null && !isNaN(distanceKm)) {
		if (distanceKm <= 2) {
			proximityScore = 100;
		} else if (distanceKm <= maxRadiusKm) {
			proximityScore = Math.max(
				10,
				Math.round(100 - (distanceKm / maxRadiusKm) * 75),
			);
		} else {
			proximityScore = Math.max(0, Math.round(25 - (distanceKm - maxRadiusKm) * 2));
		}
	}

	// 2. Rating Score (Weight: 30%)
	const effectiveRating = rating != null && rating > 0 ? rating : 4.5;
	const ratingScore = Math.min(100, Math.round((effectiveRating / 5.0) * 100));

	// 3. Price Competitiveness Score (Weight: 20%)
	let priceScore = 80;
	if (price > 0 && avgPrice > 0) {
		const priceRatio = price / avgPrice;
		if (priceRatio <= 0.9) {
			priceScore = 100; // Competitive / affordable
		} else if (priceRatio <= 1.1) {
			priceScore = 85; // Standard market rate
		} else if (priceRatio <= 1.4) {
			priceScore = 65; // Premium
		} else {
			priceScore = 45; // High premium
		}
	}

	// 4. Availability & Readiness Score (Weight: 10%)
	const availabilityScore = hasAvailableSlots ? 100 : 50;

	// Weighted Total
	const totalScore = Math.round(
		proximityScore * 0.4 +
			ratingScore * 0.3 +
			priceScore * 0.2 +
			availabilityScore * 0.1,
	);

	return Math.min(100, Math.max(0, totalScore));
}

/**
 * Batched travel time retrieval with OSRM engine and instant Haversine fallback
 * @param {[number, number]} origin - [lng, lat] of customer
 * @param {Array<[number, number]>} destinations - Array of [lng, lat]
 * @returns {Promise<Array<number>>} Array of travel durations in minutes
 */
async function getBatchedTravelDurations(origin, destinations) {
	if (!origin || !destinations || destinations.length === 0) return [];

	const [oLng, oLat] = origin;
	const fallbackDurations = destinations.map(([dLng, dLat]) => {
		const dist = calculateHaversineDistance(oLat, oLng, dLat, dLng);
		return estimateTravelTimeMinutes(dist);
	});

	if (destinations.length > 25) {
		return fallbackDurations; // avoid exceeding URL length limits on public OSRM demo
	}

	try {
		const allCoords = [origin, ...destinations]
			.map((c) => `${c[0]},${c[1]}`)
			.join(";");
		const destIndices = destinations.map((_, i) => i + 1).join(";");
		const url = `http://router.project-osrm.org/table/v1/driving/${allCoords}?sources=0&destinations=${destIndices}&annotations=duration`;

		const response = await axios.get(url, { timeout: 2500 });
		if (
			response.data &&
			response.data.durations &&
			response.data.durations[0]
		) {
			const row = response.data.durations[0];
			return row.map((sec, idx) => {
				if (sec != null && !isNaN(sec)) {
					return Math.ceil(sec / 60);
				}
				return fallbackDurations[idx];
			});
		}
		return fallbackDurations;
	} catch (err) {
		return fallbackDurations;
	}
}

module.exports = {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	calculateMatchScore,
	getBatchedTravelDurations,
};
