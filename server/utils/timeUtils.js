// utils/timeUtils.js
function timeToMinutes(t) {
	// "09:30" -> 570
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minutesToTime(m) {
	// 570 -> "09:30"
	const hh = Math.floor(m / 60)
		.toString()
		.padStart(2, "0");
	const mm = (m % 60).toString().padStart(2, "0");
	return `${hh}:${mm}`;
}

// split a slot into smaller fixed-size chunks (optional)
function splitIntoChunks(start, end, chunkMinutes = 60) {
	const s = timeToMinutes(start),
		e = timeToMinutes(end);
	const chunks = [];
	for (let t = s; t + chunkMinutes <= e; t += chunkMinutes) {
		chunks.push({
			start: minutesToTime(t),
			end: minutesToTime(t + chunkMinutes),
		});
	}
	return chunks;
}

function generateDailySlots(startStr, endStr, intervalMin = 60) {
	const slots = [];
	let current = new Date(`2000-01-01T${startStr}`);
	const end = new Date(`2000-01-01T${endStr}`);

	while (current < end) {
		// Extract "HH:MM"
		const timeString = current.toTimeString().slice(0, 5);
		slots.push(timeString);
		current.setMinutes(current.getMinutes() + intervalMin);
	}
	return slots;
}

module.exports = {
	timeToMinutes,
	minutesToTime,
	splitIntoChunks,
	generateDailySlots,
};
