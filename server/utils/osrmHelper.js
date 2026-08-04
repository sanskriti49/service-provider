// utils/osrmHelper.js
const axios = require("axios");

/**
 * Calculates transit times between coordinates using OSRM Open Data engine
 * @param {Array} coordinates - Array of [[lng, lat], [lng, lat]]
 * @returns {Promise<Array>} Matrix of durations in minutes
 */
async function getOSRMDurationMatrix(coordinates) {
	try {
		const coordString = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
		// Public demo server. For production workloads, host this on your own EC2 instance!
		const url = `http://router.project-osrm.org/table/v1/driving/${coordString}?annotations=duration`;

		const response = await axios.get(url);
		if (response.data && response.data.durations) {
			// OSRM returns durations in seconds -> convert to minutes
			return response.data.durations.map((row) =>
				row.map((d) => Math.ceil(d / 60)),
			);
		}
		return null;
	} catch (err) {
		console.error("OSRM Engine Connection Failure:", err.message);
		return null; // Fallback gracefully to standard static defaults if network drops
	}
}

module.exports = { getOSRMDurationMatrix };
