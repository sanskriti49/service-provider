const axios = require("axios");
const { validCoordinates } = require("./location");

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
	if (!validCoordinates(lat1, lon1) || !validCoordinates(lat2, lon2)) return null;
	// Mean WGS84 radius used by PostGIS geography with use_spheroid=false.
	const R = 6371.00877141506;
	const toRad = (deg) => (deg * Math.PI) / 180;

	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const rLat1 = toRad(lat1);
	const rLat2 = toRad(lat2);

	const rawA =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const a = Math.min(1, Math.max(0, rawA));
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c;

	return distance;
}

function estimateTravelTimeMinutes(distanceKm, avgSpeedKmh = 28) {
	if (distanceKm == null || isNaN(distanceKm)) return 20;
	if (distanceKm <= 0.5) return 5;
	const minutes = Math.ceil((distanceKm / avgSpeedKmh) * 60) + 5;
	return Math.max(5, minutes);
}

function calculateMatchScore({
	distanceKm,
	maxRadiusKm = 50,
	rating = 4.5,
	price = 500,
	avgPrice = 500,
	hasAvailableSlots = null,
}) {
	let proximityScore = 0;
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

	const effectiveRating = rating != null && Number.isFinite(Number(rating)) ? Math.min(5,Math.max(0,Number(rating))) : 0;
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

	const availabilityScore = hasAvailableSlots === true ? 100 : hasAvailableSlots === false ? 0 : 50;

	const totalScore = Math.round(
		proximityScore * 0.4 +
			ratingScore * 0.3 +
			priceScore * 0.2 +
			availabilityScore * 0.1,
	);

	return Math.min(100, Math.max(0, totalScore));
}

const routeCache = new Map();
async function getDirectionalTravelDurations(origin, destinations, {
  strict = true
} = {}) {
  if (!destinations.length) return {
    to: [],
    from: []
  };
  if (!validCoordinates(origin?.[1], origin?.[0]) || destinations.some(p => !validCoordinates(p?.[1], p?.[0]))) throw new Error("Valid routing coordinates required");
  const fallback = destinations.map(([lng, lat]) => estimateTravelTimeMinutes(calculateHaversineDistance(origin[1], origin[0], lat, lng) * 1.5));
  if (destinations.every(p => calculateHaversineDistance(origin[1], origin[0], p[1], p[0]) < 0.01)) return {
    to: destinations.map(() => 0),
    from: destinations.map(() => 0)
  };
  const key = JSON.stringify([origin, destinations]);
  const cached = routeCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (destinations.length > 25) {
    const parts = [];
    for (let i = 0; i < destinations.length; i += 25) parts.push(await getDirectionalTravelDurations(origin, destinations.slice(i, i + 25), {
      strict
    }));
    return {
      to: parts.flatMap(p => p.to),
      from: parts.flatMap(p => p.from)
    };
  }
  try {
    const points = [origin, ...destinations];
    const indices = points.map((_, i) => i).join(";");
    const base = process.env.OSRM_URL || "https://router.project-osrm.org";
    const response = await axios.get(`${base}/table/v1/driving/${points.map(p => p.join(",")).join(";")}?sources=${indices}&destinations=${indices}&annotations=duration`, {
      timeout: 2500
    });
    const matrix = response.data?.durations;
    const to = destinations.map((_, i) => matrix?.[0]?.[i + 1]);
    const from = destinations.map((_, i) => matrix?.[i + 1]?.[0]);
    if ([...to, ...from].some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0)) throw new Error("A route could not be verified");
    const value = {
      to: to.map(v => Math.ceil(v / 60)),
      from: from.map(v => Math.ceil(v / 60))
    };
    if (routeCache.size >= 500) routeCache.delete(routeCache.keys().next().value);
    routeCache.set(key, {
      value,
      expires: Date.now() + 60000
    });
    return value;
  } catch (err) {
    if (!strict) return {
      to: fallback,
      from: fallback
    };
    const unavailable = new Error("Travel availability couldn't be verified. Please retry shortly.");
    unavailable.code = "ROUTING_UNAVAILABLE";
    throw unavailable;
  }
}
async function getBatchedTravelDurations(origin, destinations) {
  if (!origin || !destinations?.length) return [];
  return (await getDirectionalTravelDurations(origin, destinations, {
    strict: false
  })).to;
}

function formatPostGisPoint(lng, lat) {
	if (lng == null || lat == null || isNaN(lng) || isNaN(lat)) return null;
	return `SRID=4326;POINT(${parseFloat(lng)} ${parseFloat(lat)})`;
}

module.exports = {
	calculateHaversineDistance,
	estimateTravelTimeMinutes,
	calculateMatchScore,
	getBatchedTravelDurations,
	getDirectionalTravelDurations,
	formatPostGisPoint,
};
