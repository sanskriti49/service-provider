const axios = require("axios");

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

	const R = 6371;
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

	return Math.round(distance * 10) / 10;
}

function estimateTravelTimeMinutes(distanceKm, avgSpeedKmh = 28) {
	if (distanceKm == null || isNaN(distanceKm)) return 20;
	if (distanceKm <= 0.5) return 5;
	const minutes = Math.ceil((distanceKm / avgSpeedKmh) * 60) + 5;
	return Math.max(5, minutes);
}

function calculateMatchScore({
	distanceKm,
	maxRadiusKm = 30,
	rating = 4.5,
	price = 500,
	avgPrice = 500,
	hasAvailableSlots = true,
}) {
	let proximityScore = 70;
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

	const effectiveRating = rating != null && rating > 0 ? rating : 4.5;
	const ratingScore = Math.min(100, Math.round((effectiveRating / 5.0) * 100));

	let priceScore = 80;
	if (price > 0 && avgPrice > 0) {
		const priceRatio = price / avgPrice;
		if (priceRatio <= 0.9) {
			priceScore = 100;
		} else if (priceRatio <= 1.1) {
			priceScore = 85;
		} else if (priceRatio <= 1.4) {
			priceScore = 65;
		} else {
			priceScore = 45;
		}
	}

	const availabilityScore = hasAvailableSlots ? 100 : 50;

	const totalScore = Math.round(
		proximityScore * 0.4 +
			ratingScore * 0.3 +
			priceScore * 0.2 +
			availabilityScore * 0.1,
	);

	return Math.min(100, Math.max(0, totalScore));
}

async function getBatchedTravelDurations(origin, destinations) {
	if (!origin || !destinations || destinations.length === 0) return [];

	const [oLng, oLat] = origin;
	const fallbackDurations = destinations.map(([dLng, dLat]) => {
		const dist = calculateHaversineDistance(oLat, oLng, dLat, dLng);
		return estimateTravelTimeMinutes(dist);
	});

	if (destinations.length > 25) {
		return fallbackDurations;
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
