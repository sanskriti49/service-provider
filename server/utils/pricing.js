const pricingConfig = {
	Laundry: { min: 20, max: 60, unit: "per cloth", slotDuration: 30, buffer: 0 },
	Shaving: { min: 70, max: 200, unit: "fixed", slotDuration: 30, buffer: 15 },
	"Eyebrow Threading": {
		min: 40,
		max: 100,
		unit: "fixed",
		slotDuration: 15,
		buffer: 15,
	},

	"Child Tutoring": {
		min: 300,
		max: 800,
		unit: "per hr",
		slotDuration: 60,
		buffer: 15,
	},
	Babysitting: {
		min: 200,
		max: 500,
		unit: "per hr",
		slotDuration: 60,
		buffer: 30,
	},
	"Yoga Instructor": {
		min: 600,
		max: 1500,
		unit: "per session",
		slotDuration: 60,
		buffer: 15,
	},
	"Driver Service": {
		min: 300,
		max: 700,
		unit: "per hr",
		slotDuration: 120,
		buffer: 60,
	},
	Massage: {
		min: 800,
		max: 2500,
		unit: "per hr",
		slotDuration: 90,
		buffer: 30,
	},

	"Moving Help": {
		min: 1500,
		max: 4000,
		unit: "starts at",
		slotDuration: 180,
		buffer: 60,
	},
	Painting: {
		min: 3000,
		max: 8000,
		unit: "starts at",
		slotDuration: 240,
		buffer: 120,
	},
	"Bridal Makeup": {
		min: 10000,
		max: 25000,
		unit: "package",
		slotDuration: 120,
		buffer: 60,
	},

	"House Cleaning": {
		min: 399,
		max: 1200,
		unit: "fixed",
		slotDuration: 120,
		buffer: 30,
	},
	Plumbing: {
		min: 199,
		max: 800,
		unit: "visiting",
		slotDuration: 60,
		buffer: 30,
	},
	"Pest Control": {
		min: 899,
		max: 2500,
		unit: "fixed",
		slotDuration: 90,
		buffer: 30,
	},
	"Electrical Repair": {
		min: 199,
		max: 800,
		unit: "visiting",
		slotDuration: 60,
		buffer: 30,
	},
	"Computer & Tech Repair": {
		min: 499,
		max: 1500,
		unit: "fixed",
		slotDuration: 90,
		buffer: 30,
	},
	"Cooking Help": {
		min: 300,
		max: 800,
		unit: "per meal",
		slotDuration: 90,
		buffer: 30,
	},
	Gardening: {
		min: 499,
		max: 1200,
		unit: "fixed",
		slotDuration: 120,
		buffer: 30,
	},
	"Appliance Repair": {
		min: 299,
		max: 1000,
		unit: "visiting",
		slotDuration: 60,
		buffer: 30,
	},

	"Men's Haircut": {
		min: 100,
		max: 400,
		unit: "fixed",
		slotDuration: 45,
		buffer: 15,
	},
	"Men's Hair Spa": {
		min: 399,
		max: 1000,
		unit: "fixed",
		slotDuration: 60,
		buffer: 15,
	},
	"Women's Haircut": {
		min: 199,
		max: 1000,
		unit: "fixed",
		slotDuration: 60,
		buffer: 15,
	},
	"Women's Hair Spa": {
		min: 499,
		max: 2000,
		unit: "fixed",
		slotDuration: 90,
		buffer: 15,
	},
	Facial: { min: 799, max: 2500, unit: "fixed", slotDuration: 60, buffer: 15 },
	Makeup: { min: 1500, max: 5000, unit: "fixed", slotDuration: 90, buffer: 30 },
	Mehndi: {
		min: 500,
		max: 2500,
		unit: "per hand",
		slotDuration: 60,
		buffer: 15,
	},
	Waxing: {
		min: 199,
		max: 1500,
		unit: "starts at",
		slotDuration: 45,
		buffer: 15,
	},
	"Nail Studio": {
		min: 299,
		max: 2000,
		unit: "starts at",
		slotDuration: 60,
		buffer: 15,
	},
	Nutritionist: {
		min: 600,
		max: 2500,
		unit: "per session",
		slotDuration: 45,
		buffer: 15,
	},

	default: { min: 299, max: 999, unit: "fixed", slotDuration: 60, buffer: 30 },
};

function getPriceDetails(serviceName) {
	const config = pricingConfig[serviceName] || pricingConfig["default"];
	const { min, max, unit, slotDuration, buffer } = config;

	let finalPrice = min;

	switch (unit) {
		case "per cloth":
		case "per item":
			finalPrice = min;
			break;
		case "starts at":
		case "package":
			finalPrice = Math.ceil(min / 100) * 100;
			break;
		case "visiting":
			finalPrice = Math.ceil(min / 50) * 50 - 1;
			break;
		default:
			let base = min + (max - min) * 0.1;
			finalPrice = Math.ceil(base / 50) * 50 - 1;
			break;
	}

	return { price: finalPrice, unit, slotDuration, buffer };
}

module.exports = { getPriceDetails, pricingConfig };
