// const generateAvailability = () => {
// 	const availability = [];
// 	const now = new Date();
// 	for (let i = 0; i < 7; i++) {
// 		for (let j = 0; j < 2; j++) {
// 			const date = new Date(now);
// 			date.setDate(now.getDate() + i);

// 			const startHour = 9 + Math.floor(Math.random() * 8); // Between 9 and 16
// 			const start = new Date(date);
// 			start.setHours(startHour, 0, 0, 0);

// 			const end = new Date(start);
// 			end.setHours(end.getHours() + 1);

// 			availability.push({
// 				date: start.toISOString().split("T")[0],
// 				start_time: start.toTimeString().slice(0, 5),
// 				end_time: end.toTimeString().slice(0, 5),
// 			});
// 		}
// 	}
// 	return availability;
// };
//
const generateAvailability = () => {
	const availability = [];
	const now = new Date();
	now.setHours(0, 0, 0, 0); // Prevent timezone rollover issues

	for (let i = 0; i < 7; i++) {
		const base = new Date(now);
		base.setDate(base.getDate() + i);

		for (let j = 0; j < 2; j++) {
			const startHour = 9 + Math.floor(Math.random() * 8);
			const start = new Date(base);
			start.setHours(startHour, 0, 0, 0);

			const end = new Date(start);
			end.setHours(end.getHours() + 1);

			const yyyy = start.getFullYear();
			const mm = String(start.getMonth() + 1).padStart(2, "0");
			const dd = String(start.getDate()).padStart(2, "0");

			availability.push({
				date: `${yyyy}-${mm}-${dd}`, // local safe date
				start_time: start.toTimeString().slice(0, 5),
				end_time: end.toTimeString().slice(0, 5),
			});
		}
	}
	return availability;
};
module.exports = { generateAvailability };
