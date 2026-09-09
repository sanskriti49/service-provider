function timeToMinutes(t) {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minutesToTime(m) {
	const hh = Math.floor(m / 60)
		.toString()
		.padStart(2, "0");
	const mm = (m % 60).toString().padStart(2, "0");
	return `${hh}:${mm}`;
}

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
		const timeString = current.toTimeString().slice(0, 5);
		slots.push(timeString);
		current.setMinutes(current.getMinutes() + intervalMin);
	}
	return slots;
}

const generateMasterSchedule = () => {
	const personas = [
		{
			name: "Standard 9-5",
			days: [1, 2, 3, 4, 5],
			start: "09:00:00",
			end: "17:00:00",
		},
		{ name: "Weekender", days: [0, 6], start: "10:00:00", end: "18:00:00" },
		{
			name: "Morning Person",
			days: [1, 3, 5],
			start: "07:00:00",
			end: "12:00:00",
		},
		{ name: "Part Timer", days: [2, 4], start: "13:00:00", end: "18:00:00" },
		{
			name: "Grindset",
			days: [0, 1, 2, 3, 4, 5, 6],
			start: "08:00:00",
			end: "20:00:00",
		},
	];

	const persona = personas[Math.floor(Math.random() * personas.length)];

	return persona.days.map((day) => ({
		day: day,
		start: persona.start,
		end: persona.end,
	}));
};

const generateRealSlots = (masterSchedule) => {
	const slots = [];
	const today = new Date();

	const scheduleMap = {};
	masterSchedule.forEach((s) => {
		scheduleMap[s.day] = { start: s.start, end: s.end };
	});

	for (let i = 0; i < 30; i++) {
		const currentDate = new Date();
		currentDate.setDate(today.getDate() + i);

		const dayOfWeek = currentDate.getDay();
		const config = scheduleMap[dayOfWeek];

		if (config) {
			const year = currentDate.getFullYear();
			const month = String(currentDate.getMonth() + 1).padStart(2, "0");
			const day = String(currentDate.getDate()).padStart(2, "0");
			const dateString = `${year}-${month}-${day}`;

			const currentStart = parseInt(config.start.split(":")[0]);
			const currentEnd = parseInt(config.end.split(":")[0]);

			let currentHour = currentStart;
			while (currentHour < currentEnd) {
				const startStr = `${String(currentHour).padStart(2, "0")}:00`;
				const endStr = `${String(currentHour + 1).padStart(2, "0")}:00`;

				slots.push({
					date: dateString,
					start_time: startStr,
					end_time: endStr,
				});
				currentHour++;
			}
		}
	}
	return slots;
};

module.exports = {
	timeToMinutes,
	minutesToTime,
	splitIntoChunks,
	generateDailySlots,
	generateMasterSchedule,
	generateRealSlots,
};
