const axios = require("axios");

async function getOSRMDurationMatrix(coordinates) {
	try {
		const coordString = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
		const url = `http://router.project-osrm.org/table/v1/driving/${coordString}?annotations=duration`;

		const response = await axios.get(url);
		if (response.data && response.data.durations) {
			return response.data.durations.map((row) =>
				row.map((d) => Math.ceil(d / 60)),
			);
		}
		return null;
	} catch (err) {
		console.error("OSRM Engine Connection Failure:", err.message);
		return null;
	}
}

module.exports = { getOSRMDurationMatrix };
