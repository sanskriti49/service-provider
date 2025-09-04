function getPriceForService(service) {
	const pricing = {
		// Home Services
		"House Cleaning": [50, 150],
		Plumbing: [60, 200],
		"Electrical Repair": [70, 250],
		Gardening: [40, 100],
		"Pest Control": [80, 200],
		"Appliance Repair": [50, 180],
		"Cooking Help": [20, 60],
		"Tech Support": [30, 120],
		"Moving Help": [100, 300],
		Painting: [150, 500],
		"Driver Service": [50, 150],
		Massage: [60, 120],

		// Child Services
		Babysitting: [15, 40],
		"Child Tutoring": [20, 60],
		"Haircut (Kids)": [10, 25],

		// Beauty & Personal Care
		"Haircut (Women)": [20, 50],
		"Haircut (Men)": [15, 40],
		"Beard Styling": [10, 30],
		Shaving: [5, 20],
		Makeup: [50, 150],
		"Bridal Makeup": [100, 300],
		"Eyebrow Threading": [5, 15],
		Facial: [30, 100],
		Manicure: [20, 50],
		Pedicure: [25, 60],
		"Waxing (Full Body)": [70, 150],
		"Waxing (Arms)": [20, 40],
		"Waxing (Legs)": [30, 60],
		"Hair Coloring": [50, 150],
		"Nail Art": [15, 45],
		"Hair Spa": [30, 80],
		Mehndi: [20, 60],

		// Fitness / Health
		"Yoga Instructor": [40, 100],
		Nutritionist: [50, 120],
	};

	const [min, max] = pricing[service] || [30, 100];
	const price = Math.random() * (max - min) + min;
	return parseFloat(price.toFixed(2));
}
module.exports = { getPriceForService };
