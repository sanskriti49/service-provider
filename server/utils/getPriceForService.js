function getPriceForService(service) {
	const pricing = {
		// Home Services (₹)
		"House Cleaning": [300, 1500],
		Laundry: [100, 1000],
		Plumbing: [80, 1500],
		"Electrical Repair": [80, 1200],
		Gardening: [50, 1000],
		"Pest Control": [800, 2000],
		"Appliance Repair": [500, 1500],
		"Cooking Help": [500, 1500],
		"Tech Support": [400, 1000],
		"Moving Help": [1000, 3000],
		Painting: [1500, 5000],
		"Driver Service": [500, 3500],
		Massage: [400, 1500],

		// Child Services
		Babysitting: [200, 600],
		"Child Tutoring": [300, 1500],
		"Haircut (Kids)": [100, 400],

		// Beauty & Personal Care
		"Haircut (Women)": [200, 800],
		"Haircut (Men)": [100, 500],
		"Beard Styling": [150, 400],
		Shaving: [100, 250],
		Makeup: [400, 3000],
		"Bridal Makeup": [5000, 15000],
		"Eyebrow Threading": [100, 300],
		Facial: [500, 1500],
		Manicure: [300, 800],
		Pedicure: [400, 1000],
		"Waxing (Full Body)": [1000, 2500],
		"Waxing (Arms)": [200, 800],
		"Waxing (Legs)": [300, 900],
		"Hair Coloring": [500, 1000],
		"Nail Art": [100, 800],
		"Hair Spa": [400, 1500],
		Mehndi: [500, 2000],
		"Hand Spa": [300, 800],
		"Foot Spa": [400, 1000],
		"Full Body Glow": [1000, 3000],
		"Arm Smoothening": [400, 1000],
		"Leg Smoothening": [500, 1200],

		// Fitness / Health
		"Yoga Instructor": [500, 2000],
		Nutritionist: [500, 2000],
	};

	const [min, max] = pricing[service] || [300, 1000];

	// FIX: Generate a random integer between min and max
	let price = Math.floor(Math.random() * (max - min + 1)) + min;

	// OPTIONAL: Round to the nearest 10 for "prettier" prices (e.g., 350 instead of 347)
	// Remove the line below if you want exact random numbers
	price = Math.ceil(price / 10) * 10;

	return price;
}

module.exports = { getPriceForService };
