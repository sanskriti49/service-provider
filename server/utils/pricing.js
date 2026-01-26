const pricingConfig = {
	// --- MICRO SERVICES (Clean, Small Integers) ---
	Laundry: { min: 20, max: 60, unit: "per cloth" },
	Shaving: { min: 70, max: 200, unit: "fixed" },
	"Eyebrow Threading": { min: 40, max: 100, unit: "fixed" },

	// --- HOURLY / SESSION (Market Rates) ---
	"Child Tutoring": { min: 300, max: 800, unit: "per hr" },
	Babysitting: { min: 200, max: 500, unit: "per hr" },
	"Yoga Instructor": { min: 600, max: 1500, unit: "per session" },
	"Driver Service": { min: 300, max: 700, unit: "per hr" },
	Massage: { min: 800, max: 2500, unit: "per hr" },

	// --- ESTIMATES / PACKAGES (Round Numbers) ---
	"Moving Help": { min: 1500, max: 4000, unit: "starts at" },
	Painting: { min: 3000, max: 8000, unit: "starts at" },
	"Bridal Makeup": { min: 10000, max: 25000, unit: "package" },

	// --- STANDARD FIXED (Psychological Pricing x99) ---
	"House Cleaning": { min: 399, max: 1200, unit: "fixed" },
	Plumbing: { min: 199, max: 800, unit: "visiting" },
	"Pest Control": { min: 899, max: 2500, unit: "fixed" },
	"Electrical Repair": { min: 199, max: 800, unit: "visiting" },
	"Computer & Tech Repair": { min: 499, max: 1500, unit: "fixed" },
	"Cooking Help": { min: 300, max: 800, unit: "per meal" },
	Gardening: { min: 499, max: 1200, unit: "fixed" },
	"Appliance Repair": { min: 299, max: 1000, unit: "visiting" },

	// --- GROOMING (Standard) ---
	"Men's Haircut": { min: 100, max: 400, unit: "fixed" },
	"Men's Hair Spa": { min: 399, max: 1000, unit: "fixed" },
	"Women's Haircut": { min: 199, max: 1000, unit: "fixed" },
	"Women's Hair Spa": { min: 499, max: 2000, unit: "fixed" },
	Facial: { min: 799, max: 2500, unit: "fixed" },
	Makeup: { min: 1500, max: 5000, unit: "fixed" },
	Mehndi: { min: 500, max: 2500, unit: "per hand" },
	Waxing: { min: 199, max: 1500, unit: "starts at" },
	"Nail Studio": { min: 299, max: 2000, unit: "starts at" },
	Nutritionist: { min: 600, max: 2500, unit: "per session" },

	// Fallback
	default: { min: 299, max: 999, unit: "fixed" },
};

function getPriceDetails(serviceName) {
	const config = pricingConfig[serviceName] || pricingConfig["default"];
	const { min, max, unit } = config;

	let finalPrice = min;

	// ALGORITHM: Differentiate strategy based on Unit Type
	switch (unit) {
		case "per cloth":
		case "per item":
			// Strategy: Exact low numbers. No weird math.
			// Example: Laundry min 20 -> 20.
			finalPrice = min;
			break;

		case "starts at":
		case "package":
			// Strategy: Trust Pricing (Round numbers).
			// Example: Painting min 2500 -> 2500 (Not 2499)
			// We round to the nearest 100 to look like a solid estimate.
			finalPrice = Math.ceil(min / 100) * 100;
			break;

		case "visiting":
			// Strategy: Low barrier to entry.
			// Usually ends in 9 or 49 to look cheap.
			// Example: 149, 199, 249
			finalPrice = Math.ceil(min / 50) * 50 - 1;
			break;

		case "fixed":
		case "per hr":
		case "per session":
		default:
			// Strategy: Psychological Pricing (The "99" effect).
			// We add a tiny markup (10% of range) to not be the absolute cheapest,
			// then format it to look attractive.
			let base = min + (max - min) * 0.1;
			// Round to nearest 50, then subtract 1 -> x49 or x99
			finalPrice = Math.ceil(base / 50) * 50 - 1;
			break;
	}

	return { price: finalPrice, unit };
}

module.exports = { getPriceDetails };
