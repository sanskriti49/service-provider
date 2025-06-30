const generateAvailability = () => {
	const availability = [];
	const now = new Date();
	for (let i = 0; i < 7; i++) {
		for (let j = 0; j < 2; j++) {
			const date = new Date(now);
			date.setDate(now.getDate() + i);

			const startHour = 9 + Math.floor(Math.random() * 8); // Between 9 and 16
			const start = new Date(date);
			start.setHours(startHour, 0, 0, 0);

			const end = new Date(start);
			end.setHours(end.getHours() + 1);

			availability.push({
				date: start.toISOString().split("T")[0],
				start_time: start.toTimeString().slice(0, 5),
				end_time: end.toTimeString().slice(0, 5),
			});
		}
	}
	return availability;
};
module.exports = { generateAvailability };
