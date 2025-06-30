function getPriceForService(service) {
	const pricing = {
		// Personal Care / Beauty Services
		Haircut: [20, 50],
		Makeup: [50, 150],
		"Bridal Makeup": [100, 300],
		"Massage Therapy": [60, 120],
		"Waxing - Full Body": [70, 150],
		"Waxing - Arms": [20, 40],
		"Waxing - Legs": [30, 60],
		Manicure: [20, 50],
		Pedicure: [25, 60],
		"Hair Coloring": [50, 150],
		Facial: [30, 100],
		"Nail Art": [15, 45],
		"Eyelash Extensions": [50, 100],
		"Skin Treatment": [40, 120],
		"Hair Spa": [30, 80],
		"Mehndi (Henna)": [20, 60],
		"Eyebrow Threading": [5, 15],
		"Beard Styling": [10, 30],

		// Domestic Services
		"House Cleaning": [50, 150],
		Plumbing: [60, 200],
		"Electrical Repair": [70, 250],
		Gardening: [40, 100],
		Babysitting: [15, 40],
		"Pet Sitting": [10, 30],
		"Pest Control": [80, 200],
		"Appliance Repair": [50, 180],
		"Window Cleaning": [30, 90],
		"Carpet Cleaning": [60, 150],
	};

	const [min, max] = pricing[service] || [30, 100];
	const price = Math.random() * (max - min) + min;
	return parseFloat(price.toFixed(2));
}
module.exports = { getPriceForService };
